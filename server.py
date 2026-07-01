#!/usr/bin/env python3
import base64
import hashlib
import hmac
import json
import mimetypes
import os
import secrets
import sqlite3
import time
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
DATA = ROOT / "data"
DB_PATH = DATA / "ledgerly.sqlite3"
SESSION_COOKIE = "ledgerly_session"
SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "http://127.0.0.1:4174")
PAYMENT_CHECKOUT_URL = os.environ.get("PAYMENT_CHECKOUT_URL", "")
COOKIE_SECURE = PUBLIC_BASE_URL.startswith("https://")


DEFAULT_STATE = {
    "businessName": "My Business",
    "accounts": [
        {"id": "bank", "name": "Bank", "type": "asset", "system": True},
        {"id": "sales", "name": "Sales revenue", "type": "income"},
        {"id": "service-income", "name": "Service income", "type": "income"},
        {"id": "repairs", "name": "Repairs and maintenance", "type": "expense"},
        {"id": "bank-charges", "name": "Bank charges", "type": "expense"},
        {"id": "rent", "name": "Rent", "type": "expense"},
        {"id": "fuel", "name": "Fuel and travel", "type": "expense"},
        {"id": "software", "name": "Software subscriptions", "type": "expense"},
        {"id": "drawings", "name": "Owner drawings", "type": "equity"},
    ],
    "transactions": [],
    "budgets": {
        "sales": 45000,
        "service-income": 18000,
        "repairs": 3000,
        "bank-charges": 450,
        "rent": 7400,
        "fuel": 2500,
        "software": 750,
    },
}


def connect():
    DATA.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("pragma foreign_keys = on")
    return conn


def migrate():
    with connect() as conn:
        conn.executescript(
            """
            create table if not exists users (
              id integer primary key autoincrement,
              name text not null,
              email text not null unique,
              password_hash text not null,
              created_at text not null default current_timestamp
            );

            create table if not exists sessions (
              token text primary key,
              user_id integer not null references users(id) on delete cascade,
              created_at text not null default current_timestamp
            );

            create table if not exists businesses (
              id integer primary key autoincrement,
              user_id integer not null references users(id) on delete cascade,
              name text not null,
              subscription_status text not null default 'trial',
              monthly_price_cents integer not null default 20000,
              created_at text not null default current_timestamp
            );

            create table if not exists app_states (
              business_id integer primary key references businesses(id) on delete cascade,
              state_json text not null,
              updated_at text not null default current_timestamp
            );

            create table if not exists audit_events (
              id integer primary key autoincrement,
              business_id integer references businesses(id) on delete cascade,
              user_id integer references users(id) on delete set null,
              event_type text not null,
              event_json text not null default '{}',
              created_at text not null default current_timestamp
            );
            """
        )


def password_hash(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return "pbkdf2_sha256$120000$%s$%s" % (
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(digest).decode("ascii"),
    )


def verify_password(password, stored):
    try:
        algorithm, rounds, salt_b64, digest_b64 = stored.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(rounds))
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def read_json(handler):
    length = int(handler.headers.get("content-length", "0"))
    if length > 2_000_000:
        raise ValueError("Request is too large")
    raw = handler.rfile.read(length).decode("utf-8") if length else "{}"
    return json.loads(raw or "{}")


def default_state_for_business(name):
    state = json.loads(json.dumps(DEFAULT_STATE))
    state["businessName"] = name
    return state


class LedgerlyHandler(BaseHTTPRequestHandler):
    server_version = "Ledgerly/0.1"

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.handle_api("GET", parsed.path)
            return
        self.serve_static(parsed.path)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.handle_api("POST", parsed.path)
            return
        self.send_error(404)

    def do_PUT(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.handle_api("PUT", parsed.path)
            return
        self.send_error(404)

    def serve_static(self, path):
        safe_path = "index.html" if path in ("", "/") else path.lstrip("/")
        file_path = (STATIC / safe_path).resolve()
        if not str(file_path).startswith(str(STATIC.resolve())) or not file_path.is_file():
            file_path = STATIC / "index.html"
        body = file_path.read_bytes()
        content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("content-type", content_type)
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_api(self, method, path):
        try:
            if method == "GET" and path == "/api/session":
                self.respond(self.current_payload())
            elif method == "GET" and path == "/api/health":
                self.respond({"ok": True, "service": "ledgerly", "time": int(time.time())})
            elif method == "POST" and path == "/api/signup":
                self.signup()
            elif method == "POST" and path == "/api/login":
                self.login()
            elif method == "POST" and path == "/api/logout":
                self.logout()
            elif method == "POST" and path == "/api/subscription/checkout":
                self.require_user()
                self.subscription_checkout()
            elif method == "GET" and path == "/api/state":
                self.require_user()
                self.respond({"state": self.load_state()})
            elif method == "PUT" and path == "/api/state":
                self.require_user()
                payload = read_json(self)
                self.save_state(payload.get("state"))
                self.respond({"ok": True})
            elif method == "GET" and path == "/api/export-data":
                self.require_user()
                self.export_data()
            elif method == "POST" and path == "/api/delete-account":
                self.require_user()
                self.delete_account()
            else:
                self.respond({"error": "Not found"}, 404)
        except PermissionError:
            self.respond({"error": "Please sign in first"}, 401)
        except sqlite3.IntegrityError:
            self.respond({"error": "That email address is already registered"}, 409)
        except ValueError as error:
            self.respond({"error": str(error)}, 400)
        except Exception as error:
            self.respond({"error": "Server error", "detail": str(error)}, 500)

    def signup(self):
        payload = read_json(self)
        name = str(payload.get("name", "")).strip()
        email = str(payload.get("email", "")).strip().lower()
        password = str(payload.get("password", ""))
        business_name = str(payload.get("businessName", "")).strip() or "My Business"
        if not name or "@" not in email or len(password) < 8:
            raise ValueError("Enter a name, valid email, and password with at least 8 characters")

        with connect() as conn:
            cursor = conn.execute(
                "insert into users (name, email, password_hash) values (?, ?, ?)",
                (name, email, password_hash(password)),
            )
            user_id = cursor.lastrowid
            cursor = conn.execute(
                "insert into businesses (user_id, name) values (?, ?)",
                (user_id, business_name),
            )
            business_id = cursor.lastrowid
            conn.execute(
                "insert into app_states (business_id, state_json) values (?, ?)",
                (business_id, json.dumps(default_state_for_business(business_name))),
            )
            self.audit(conn, business_id, user_id, "user.signup", {"email": email})
        self.create_session(user_id)

    def login(self):
        payload = read_json(self)
        email = str(payload.get("email", "")).strip().lower()
        password = str(payload.get("password", ""))
        with connect() as conn:
            user = conn.execute("select * from users where email = ?", (email,)).fetchone()
        if not user or not verify_password(password, user["password_hash"]):
            self.respond({"error": "Incorrect email or password"}, 401)
            return
        self.create_session(user["id"])

    def logout(self):
        token = self.session_token()
        if token:
            with connect() as conn:
                conn.execute("delete from sessions where token = ?", (token,))
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("set-cookie", self.cookie_header("", max_age=0))
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

    def create_session(self, user_id):
        token = secrets.token_urlsafe(32)
        with connect() as conn:
            conn.execute("insert into sessions (token, user_id) values (?, ?)", (token, user_id))
        payload = self.current_payload(token)
        body = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("set-cookie", self.cookie_header(token, max_age=SESSION_MAX_AGE_SECONDS))
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def subscription_checkout(self):
        user = self.current_user()
        if not PAYMENT_CHECKOUT_URL:
            self.respond(
                {
                    "error": "Payment checkout is not configured yet",
                    "message": "Set PAYMENT_CHECKOUT_URL to your Paystack, Yoco, Peach Payments, or Stripe checkout link.",
                },
                501,
            )
            return
        self.respond(
            {
                "checkoutUrl": PAYMENT_CHECKOUT_URL,
                "businessId": user["business_id"],
                "price": "R200/month",
            }
        )

    def export_data(self):
        user = self.current_user()
        state = self.load_state()
        payload = {
            "exportedAt": int(time.time()),
            "user": {"name": user["name"], "email": user["email"]},
            "business": {
                "name": user["business_name"],
                "subscriptionStatus": user["subscription_status"],
                "monthlyPriceCents": user["monthly_price_cents"],
            },
            "state": state,
        }
        body = json.dumps(payload, indent=2).encode("utf-8")
        filename = f"ledgerly-{user['business_id']}-export.json"
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-disposition", f'attachment; filename="{filename}"')
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def delete_account(self):
        payload = read_json(self)
        if payload.get("confirm") != "DELETE":
            raise ValueError("Type DELETE to confirm account deletion")
        user = self.current_user()
        with connect() as conn:
            conn.execute("delete from users where id = ?", (user["user_id"],))
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("set-cookie", self.cookie_header("", max_age=0))
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

    def current_payload(self, token=None):
        user = self.current_user(token)
        if not user:
            return {"user": None, "business": None}
        return {
            "user": {"id": user["user_id"], "name": user["name"], "email": user["email"]},
            "business": {
                "id": user["business_id"],
                "name": user["business_name"],
                "subscriptionStatus": user["subscription_status"],
                "monthlyPriceCents": user["monthly_price_cents"],
            },
        }

    def current_user(self, token=None):
        token = token or self.session_token()
        if not token:
            return None
        with connect() as conn:
            return conn.execute(
                """
                select
                  users.id as user_id,
                  users.name,
                  users.email,
                  businesses.id as business_id,
                  businesses.name as business_name,
                  businesses.subscription_status,
                  businesses.monthly_price_cents
                from sessions
                join users on users.id = sessions.user_id
                join businesses on businesses.user_id = users.id
                where sessions.token = ?
                order by businesses.id asc
                limit 1
                """,
                (token,),
            ).fetchone()

    def require_user(self):
        if not self.current_user():
            raise PermissionError()

    def load_state(self):
        user = self.current_user()
        with connect() as conn:
            row = conn.execute("select state_json from app_states where business_id = ?", (user["business_id"],)).fetchone()
        return json.loads(row["state_json"]) if row else default_state_for_business(user["business_name"])

    def save_state(self, state):
        if not isinstance(state, dict):
            raise ValueError("State payload is invalid")
        user = self.current_user()
        business_name = str(state.get("businessName", user["business_name"])).strip() or user["business_name"]
        with connect() as conn:
            conn.execute("update businesses set name = ? where id = ?", (business_name, user["business_id"]))
            conn.execute(
                """
                insert into app_states (business_id, state_json, updated_at)
                values (?, ?, current_timestamp)
                on conflict(business_id) do update set
                  state_json = excluded.state_json,
                  updated_at = current_timestamp
                """,
                (user["business_id"], json.dumps(state)),
            )
            self.audit(conn, user["business_id"], user["user_id"], "state.saved", {"businessName": business_name})

    def audit(self, conn, business_id, user_id, event_type, event):
        conn.execute(
            "insert into audit_events (business_id, user_id, event_type, event_json) values (?, ?, ?, ?)",
            (business_id, user_id, event_type, json.dumps(event)),
        )

    def session_token(self):
        raw = self.headers.get("cookie")
        if not raw:
            return None
        jar = cookies.SimpleCookie(raw)
        morsel = jar.get(SESSION_COOKIE)
        return morsel.value if morsel else None

    def cookie_header(self, value, max_age):
        parts = [
            f"{SESSION_COOKIE}={value}",
            "Path=/",
            f"Max-Age={max_age}",
            "SameSite=Lax",
            "HttpOnly",
        ]
        if COOKIE_SECURE:
            parts.append("Secure")
        return "; ".join(parts)

    def respond(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print("%s - %s" % (self.address_string(), format % args))


if __name__ == "__main__":
    migrate()
    port = int(os.environ.get("PORT", "4174"))
    host = os.environ.get("HOST", "127.0.0.1")
    server = ThreadingHTTPServer((host, port), LedgerlyHandler)
    print(f"Ledgerly is running at http://{host}:{port}")
    server.serve_forever()
