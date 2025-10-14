#!/usr/bin/env python3
"""
Create or update an admin account in the database.

Usage:
  python backend/scripts/create_admin.py --name "NIDSToKnow Admin" --email nidstoknowadmin@admin.com --password Nidstoknowadmin123

This will:
  - Ensure the admins table exists
  - Insert a new admin with the hashed password, or update if the email already exists
"""
import sys
import argparse
from werkzeug.security import generate_password_hash
from config import get_db_connection

# Avoid importing the whole admin_api router; just re-create the table like admin_api.ensure_admins_table
CREATE_ADMINS_SQL = (
    """
    CREATE TABLE IF NOT EXISTS admins (
        id INT NOT NULL AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash TEXT,
        PRIMARY KEY (id),
        UNIQUE KEY email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    """
)


def ensure_admins_table(cur):
    cur.execute(CREATE_ADMINS_SQL)


def upsert_admin(name: str, email: str, password: str) -> int:
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        ensure_admins_table(cur)
        phash = generate_password_hash(password)
        # Upsert by unique email
        cur.execute(
            """
            INSERT INTO admins (name, email, password_hash)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE name=VALUES(name), password_hash=VALUES(password_hash)
            """,
            (name, email, phash),
        )
        conn.commit()
        # Return id of existing/new row
        cur.execute("SELECT id FROM admins WHERE email=%s", (email,))
        row = cur.fetchone()
        return int(row[0]) if row else -1
    finally:
        try:
            cur.close()
        except Exception:
            pass
        conn.close()


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--name", required=True)
    p.add_argument("--email", required=True)
    p.add_argument("--password", required=True)
    args = p.parse_args(argv)
    admin_id = upsert_admin(args.name, args.email, args.password)
    if admin_id > 0:
        print(f"Admin upserted. id={admin_id}")
        return 0
    print("Failed to upsert admin", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
