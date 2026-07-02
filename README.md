# Ledgerly

Ledgerly is a deployable small business accounting app for owner-managed businesses. It supports account registration, secure sign-in, bank CSV imports, transaction allocation, budgets, analytics, general ledger, trial balance, data export, and account deletion.

## Free Render Demo Warning

The included `render.yaml` is configured for Render's free web service plan. This is useful for demos and early feedback, but it should not be used for real customer accounting data because the SQLite database is stored on the service filesystem and may be lost when the service restarts or redeploys.

For real users, upgrade to a paid service with a persistent disk or move the database to managed PostgreSQL/Supabase.

## What Is Included

- User sign-up, sign-in, sign-out, and session cookies
- PBKDF2 password hashing
- Per-user business workspace
- SQLite persistence
- Audit events for key account/state actions
- CSV bank statement import
- Duplicate transaction detection during import
- Custom chart of accounts
- Budget tracking
- Analytics dashboard
- General ledger and trial balance
- CSV report exports
- Full user data export
- Account deletion
- Subscription checkout placeholder for R150/month
- Health check endpoint for hosting
- Dockerfile and Render blueprint
- Starter privacy policy and terms pages
- Local database backup script

## Run Locally

```bash
python3 server.py
```

Open:

```text
http://127.0.0.1:4174
```

Use a different port:

```bash
PORT=8080 python3 server.py
```

## Environment Variables

Copy `.env.example` into your hosting provider's environment settings.

```text
HOST=0.0.0.0
PORT=8080
PUBLIC_BASE_URL=https://your-domain.example
PAYMENT_CHECKOUT_URL=https://your-payment-provider-checkout-link
```

`PUBLIC_BASE_URL` should be HTTPS in production. When it starts with `https://`, Ledgerly marks session cookies as Secure.

`PAYMENT_CHECKOUT_URL` can point to a Paystack, Yoco, Peach Payments, Stripe, or other hosted checkout link. Until this is configured, the app will tell users that payment is not connected yet.

## Deploy With Docker

Build:

```bash
docker build -t ledgerly .
```

Run:

```bash
docker run -p 8080:8080 -v ledgerly-data:/app/data --env-file .env ledgerly
```

Open:

```text
http://127.0.0.1:8080
```

## Deploy On Render

This folder includes `render.yaml`.

1. Create a new Render Blueprint from this project.
2. Set `PUBLIC_BASE_URL` to your live HTTPS URL.
3. Set `PAYMENT_CHECKOUT_URL` when your payment provider is ready.
4. Confirm `/api/health` returns `{"ok": true, ...}` after deploy.

This free demo deployment does not include a persistent disk. Upgrade before inviting real customers.

## Backups

Run:

```bash
python3 scripts/backup.py
```

Backups are written to:

```text
backups/
```

For a real launch, schedule this script daily and copy backups to separate storage, not only the app server.

## Data

The local production database is:

```text
data/ledgerly.sqlite3
```

This version stores each user's accounting workspace as JSON for speed and simplicity. For a larger launch, migrate accounts, transactions, budgets, imports, journal entries, and audit events into separate relational tables.

On Render Free, this database is temporary demo storage. Do not rely on it for real businesses.

## Customer-Facing Pages

Starter pages are included:

```text
/privacy.html
/terms.html
```

These must be reviewed by a qualified legal professional before inviting paying users.

## Before Charging Real Customers

Do these before public paid launch:

- Have an accountant review the ledger, trial balance, VAT wording, and report outputs.
- Have a lawyer review privacy, terms, POPIA obligations, data deletion, and disclaimers.
- Connect a real payment provider.
- Add email verification and password reset.
- Move to managed PostgreSQL or a managed database service once usage grows.
- Add automated off-server backups.
- Add import undo and locked accounting periods.
- Add admin support tools for customer help.
- Add monitoring and error alerts.

## Mobile App Path

After the web version is stable online:

1. Wrap the hosted app with Capacitor.
2. Add iOS/Android icons, splash screens, and store metadata.
3. Test CSV upload behavior on mobile.
4. Submit to Google Play first, then Apple App Store.

## Health Check

```text
GET /api/health
```

Returns:

```json
{
  "ok": true,
  "service": "ledgerly",
  "time": 1782930000
}
```
