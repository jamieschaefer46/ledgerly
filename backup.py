#!/usr/bin/env python3
import shutil
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "ledgerly.sqlite3"
BACKUP_DIR = ROOT / "backups"


def main():
    if not DB_PATH.exists():
        print(f"No database found at {DB_PATH}", file=sys.stderr)
        return 1

    BACKUP_DIR.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_path = BACKUP_DIR / f"ledgerly-{stamp}.sqlite3"

    source = sqlite3.connect(DB_PATH)
    target = sqlite3.connect(backup_path)
    try:
        source.backup(target)
    finally:
        target.close()
        source.close()

    latest = BACKUP_DIR / "ledgerly-latest.sqlite3"
    shutil.copy2(backup_path, latest)
    print(backup_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
