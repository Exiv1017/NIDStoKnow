from typing import Optional


def ensure_notifications_table(cursor) -> None:
    """Ensure the shared notifications table exists.

    Schema matches student/instructor code paths so all roles can consume the same table.
    """
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            recipient_id INT NULL,
            recipient_role VARCHAR(20) NULL,
            message VARCHAR(512) NOT NULL,
            type VARCHAR(50) DEFAULT 'info',
            `read` TINYINT(1) DEFAULT 0,
            time TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_recipient (recipient_role, recipient_id),
            INDEX idx_time (time)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        '''
    )


def create_notification(cursor, recipient_role: str, message: str, ntype: str = 'info', recipient_id: Optional[int] = None) -> int:
    """Insert a notification into the shared table. Returns the new id.

    Caller is responsible for committing on the connection.
    """
    ensure_notifications_table(cursor)
    cursor.execute(
        'INSERT INTO notifications (recipient_id, recipient_role, message, type) VALUES (%s, %s, %s, %s)',
        (recipient_id, recipient_role, message, ntype)
    )
    try:
        return int(cursor.lastrowid)  # type: ignore[attr-defined]
    except Exception:
        return 0


def migrate_notifications_schema(cursor) -> None:
    """Best-effort migration to ensure required columns exist on legacy installs.

    - Add `read` TINYINT(1) if missing
    - Add `time` TIMESTAMP if missing (legacy may have `created_at`)
    """
    def has_column(name: str) -> bool:
        cursor.execute("SHOW COLUMNS FROM notifications LIKE %s", (name,))
        return cursor.fetchone() is not None

    # Ensure table exists first
    ensure_notifications_table(cursor)

    # Add `recipient_role` column if missing
    try:
        if not has_column('recipient_role'):
            cursor.execute("ALTER TABLE notifications ADD COLUMN `recipient_role` VARCHAR(20) NULL AFTER recipient_id")
            try:
                cursor.connection.commit()
            except Exception:
                pass
    except Exception:
        # non-fatal
        pass

    # Add `recipient_id` column if missing
    try:
        if not has_column('recipient_id'):
            cursor.execute("ALTER TABLE notifications ADD COLUMN `recipient_id` INT NULL FIRST")
            try:
                cursor.connection.commit()
            except Exception:
                pass
    except Exception:
        # non-fatal
        pass

    # Add `read` column if missing
    try:
        if not has_column('read'):
            cursor.execute("ALTER TABLE notifications ADD COLUMN `read` TINYINT(1) DEFAULT 0")
            try:
                cursor.connection.commit()
            except Exception:
                pass
    except Exception:
        # non-fatal
        pass

    # Add `time` column if missing
    try:
        if not has_column('time'):
            cursor.execute("ALTER TABLE notifications ADD COLUMN `time` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP")
            try:
                cursor.connection.commit()
            except Exception:
                pass
    except Exception:
        # non-fatal
        pass

    # Ensure indexes exist (best-effort; ignore errors if already exist)
    try:
        cursor.execute("CREATE INDEX idx_recipient ON notifications (recipient_role, recipient_id)")
    except Exception:
        pass
    try:
        cursor.execute("CREATE INDEX idx_time ON notifications (time)")
    except Exception:
        pass
