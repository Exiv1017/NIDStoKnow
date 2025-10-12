"""
Reset the database to a clean state by removing all application data but preserving
existing admin accounts in the `admins` table. No new admin will be inserted.

Actions performed (idempotent and safe to re-run):
- Disable foreign key checks
- TRUNCATE app data tables: student_* tables, notifications, recent_activity, feedback,
    submissions, assignments, module_requests, and users (students/instructors only)
- TRUNCATE auxiliary admin tables if they exist: admin_notifications, admin_system_settings,
    admin_audit_logs, instructor_settings
- DO NOT touch the `admins` table contents. No inserts are performed.

Usage:
    python backend/scripts/reset_and_seed.py

Requires: mysql-connector-python
"""

import sys
import mysql.connector


from config import MYSQL_CONFIG


TABLES_TO_TRUNCATE_IN_ORDER = [
    # Progress first
    'student_lesson_progress',
    'student_module_quiz',
    'student_progress',
    # Student profile/settings
    'student_profiles',
    'student_settings',
    # Assignments and requests
    'assignments',
    'module_requests',
    # Misc app data
    'notifications',
    'recent_activity',
    'feedback',
    'submissions',
    # Users last (students/instructors)
    'users',
    # Admin-supporting tables (optional, if present)
    'admin_notifications',
    'admin_system_settings',
    'admin_audit_logs',
    'instructor_settings',
    # DO NOT touch 'admins' — keep existing admin users
]


def main():
    conn = mysql.connector.connect(**MYSQL_CONFIG)
    try:
        cur = conn.cursor()

        # Discover existing tables to avoid errors when truncating non-existent ones
        cur.execute('SHOW TABLES')
        existing = {row[0] for row in cur.fetchall()}

        # Disable FKs
        cur.execute('SET FOREIGN_KEY_CHECKS = 0')

        truncated = []
        for tbl in TABLES_TO_TRUNCATE_IN_ORDER:
            if tbl in existing:
                cur.execute(f'TRUNCATE TABLE `{tbl}`')
                truncated.append(tbl)

        # Preserve existing admins and do not insert any new admin accounts
        if 'admins' not in existing:
            print('[WARN] admins table not found; nothing to preserve.', file=sys.stderr)
        if 'users' not in existing:
            print('[WARN] users table not found; nothing to truncate for users.', file=sys.stderr)

        # Re-enable FKs
        cur.execute('SET FOREIGN_KEY_CHECKS = 1')

        conn.commit()

        print('Reset complete.')
        if truncated:
            print('Truncated tables:', ', '.join(truncated))
        print('Admins preserved. No users or demo data inserted.')
    finally:
        try:
            cur.close()
        except Exception:
            pass
        conn.close()


if __name__ == '__main__':
    main()
