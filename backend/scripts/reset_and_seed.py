"""
Reset the database to a fresh state for users/instructors/students and admins,
then seed a new admin account.

Actions performed (idempotent and safe to re-run):
- Disable foreign key checks
- TRUNCATE progress/notification tables: student_lesson_progress, student_module_quiz,
  student_progress, notifications, recent_activity, feedback
- TRUNCATE users (students/instructors) and admins
- Optionally TRUNCATE auxiliary admin tables if they exist: admin_notifications,
  admin_system_settings, admin_audit_logs, instructor_settings
- Re-create a new admin with the email 'nidstoknowadmin@admin.com'

Usage:
  python backend/scripts/reset_and_seed.py

Requires: mysql-connector-python, werkzeug
"""

import sys
import mysql.connector
from werkzeug.security import generate_password_hash


from config import MYSQL_CONFIG


TABLES_TO_TRUNCATE_IN_ORDER = [
    # Progress first
    'student_lesson_progress',
    'student_module_quiz',
    'student_progress',
    # Misc app data
    'notifications',
    'recent_activity',
    'feedback',
    # Users last (students/instructors)
    'users',
    # Admin-supporting tables (optional, if present)
    'admin_notifications',
    'admin_system_settings',
    'admin_audit_logs',
    'instructor_settings',
    # Finally, admins (so we can insert the new one after)
    'admins',
]


def main():
    admin_email = 'nidstoknowadmin@admin.com'
    admin_name = 'NIDSToKnow Admin'
    admin_password = 'Nidstoknowadmin123'
    admin_hash = generate_password_hash(admin_password)

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

        # Recreate the admin
        if 'admins' in existing:
            cur.execute(
                'INSERT INTO admins (name, email, password_hash) VALUES (%s, %s, %s)',
                (admin_name, admin_email, admin_hash),
            )
        else:
            # If admins table is missing, surface a clear message
            print('[WARN] admins table not found; skipping admin creation.', file=sys.stderr)

        # Seed specific demo users/instructor (approved)
        if 'users' in existing:
            try:
                demo_password = generate_password_hash('Password123!')
                # Instructor One
                cur.execute(
                    'INSERT INTO users (name, email, password_hash, userType, status) VALUES (%s, %s, %s, %s, %s)',
                    ('Instructor One', 'instructor.1@lspu.edu.ph', demo_password, 'instructor', 'approved')
                )
                # Student: John Dela Cruz
                cur.execute(
                    'INSERT INTO users (name, email, password_hash, userType, status) VALUES (%s, %s, %s, %s, %s)',
                    ('John Dela Cruz', 'john.delacruz@lspu.edu.ph', demo_password, 'student', 'approved')
                )
                # Student One
                cur.execute(
                    'INSERT INTO users (name, email, password_hash, userType, status) VALUES (%s, %s, %s, %s, %s)',
                    ('Student One', 'student.1@lspu.edu.ph', demo_password, 'student', 'approved')
                )
            except Exception as e:
                print(f'[WARN] Failed to seed demo users: {e}', file=sys.stderr)
        else:
            print('[WARN] users table not found; skipping demo user creation.', file=sys.stderr)

        # Re-enable FKs
        cur.execute('SET FOREIGN_KEY_CHECKS = 1')

        conn.commit()

        print('Reset complete.')
        if truncated:
            print('Truncated tables:', ', '.join(truncated))
        print(f"Created admin: {admin_email} (password set)")
        print("Seeded demo users: instructor.1@lspu.edu.ph (instructor, approved), John Dela Cruz <john.delacruz@lspu.edu.ph> (student, approved), student.1@lspu.edu.ph (student, approved)")
    finally:
        try:
            cur.close()
        except Exception:
            pass
        conn.close()


if __name__ == '__main__':
    main()
