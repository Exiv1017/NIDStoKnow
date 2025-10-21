from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
import mysql.connector
from werkzeug.security import check_password_hash
from typing import Optional, List
from datetime import datetime

router = APIRouter()

from config import MYSQL_CONFIG, get_db_connection, get_admin_system_settings_cached, invalidate_admin_system_settings_cache
from auth import create_access_token
def _password_strong_enough(pw: str) -> bool:
    try:
        import re
        if not pw or len(pw) < 8:
            return False
        has_upper = re.search(r'[A-Z]', pw) is not None
        has_lower = re.search(r'[a-z]', pw) is not None
        has_digit = re.search(r'\d', pw) is not None
        has_symbol = re.search(r'[^A-Za-z0-9]', pw) is not None
        return has_upper and has_lower and has_digit and has_symbol
    except Exception:
        return False
from auth import require_role
from notifications_helper import ensure_notifications_table, create_notification, migrate_notifications_schema

def ensure_admins_table(cursor):
        """Create minimal admins table if missing to avoid 1146 errors during login.
        This keeps schema consistent without requiring full migrations here.
        """
        cursor.execute(
                '''
                CREATE TABLE IF NOT EXISTS admins (
                    id INT NOT NULL AUTO_INCREMENT,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL,
                    password_hash TEXT,
                    PRIMARY KEY (id),
                    UNIQUE KEY email (email)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
                '''
        )

def ensure_lobby_tables(cursor):
        """Create minimal lobby tables if missing to avoid 1146 errors.
        Mirrors the schema used by lobby_ws for cross-device persistence.
        """
        try:
                cursor.execute(
                        """
                        CREATE TABLE IF NOT EXISTS lobbies (
                      code VARCHAR(32) PRIMARY KEY,
                      difficulty VARCHAR(32) DEFAULT 'Beginner',
                      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                      created_by INT NULL
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                        """
                )
                try:
                    cursor.execute("ALTER TABLE lobbies ADD COLUMN created_by INT NULL")
                except Exception:
                    pass
                cursor.execute(
                        """
                        CREATE TABLE IF NOT EXISTS lobby_participants (
                            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                            code VARCHAR(32) NOT NULL,
                            name VARCHAR(255) NOT NULL,
                            role VARCHAR(32) NOT NULL,
                            ready TINYINT(1) DEFAULT 0,
                            joined_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE KEY uniq_code_name (code, name),
                            KEY idx_code (code)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                        """
                )
        except Exception:
                # Best-effort: leave to other code paths if creation fails here
                pass

class AdminLoginRequest(BaseModel):
    email: str
    password: str

class AdminProfileUpdateRequest(BaseModel):
    id: int
    name: str
    email: str

class AdminSystemSettings(BaseModel):
    enableUserRegistration: bool
    autoApproveInstructors: bool
    maintenanceMode: bool
    backupFrequency: str
    sessionTimeoutMinutes: int | None = 60
    requireStrongPasswords: bool | None = True
    allowInstructorBulkActions: bool | None = True

class AdminNotificationSettings(BaseModel):
    email: bool
    browser: bool
    systemAlerts: bool

class AdminPasswordChangeRequest(BaseModel):
    id: int
    current_password: str
    new_password: str

class AuditLogEntry(BaseModel):
    id: int
    admin_id: int
    action: str
    timestamp: str

# -------- User maintenance models (admin side) ---------
class AdminUserUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None

class AdminResetPasswordRequest(BaseModel):
    new_password: str

def ensure_users_table(cursor):
    """Ensure users table exists and password_hash allows long hashes (TEXT)."""
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS users (
          id INT NOT NULL AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          password_hash TEXT NOT NULL,
          userType ENUM('student','instructor','admin') NOT NULL,
          status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved',
          PRIMARY KEY (id),
          UNIQUE KEY email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        '''
    )
    try:
        cursor.execute("SHOW COLUMNS FROM users LIKE 'password_hash'")
        row = cursor.fetchone()
        if row and isinstance(row, (list, tuple)):
            col_type = str(row[1]).lower() if len(row) > 1 else ''
            if 'varchar' in col_type:
                cursor.execute('ALTER TABLE users MODIFY COLUMN password_hash TEXT NOT NULL')
    except Exception:
        pass

# -------- Module Request Models (admin side) ---------
class ModuleRequestAdminView(BaseModel):
    id: int
    instructor_id: int
    module_name: str
    category: str
    details: Optional[str] = None
    status: str
    created_at: datetime
    decided_at: Optional[datetime] = None
    admin_comment: Optional[str] = None

class ModuleRequestStatusUpdate(BaseModel):
    status: str
    admin_comment: Optional[str] = None

@router.post("/admin/login")
def admin_login(req: AdminLoginRequest):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    # Ensure table exists to avoid 1146 on fresh deployments
    ensure_admins_table(cursor)
    cursor.execute("SELECT * FROM admins WHERE email=%s", (req.email,))
    admin = cursor.fetchone()
    cursor.close()
    conn.close()
    if not admin or not check_password_hash(admin['password_hash'], req.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    # Issue JWT so protected endpoints (module requests, etc.) can enforce role.
    # Use system settings for session timeout minutes
    from datetime import timedelta
    try:
        settings = get_admin_system_settings_cached()
        minutes = int(settings.get('sessionTimeoutMinutes') or 60)
        exp_delta = timedelta(minutes=minutes)
    except Exception:
        exp_delta = None
    token = create_access_token({"sub": str(admin['id']), "role": "admin", "email": admin['email']}, expires_delta=exp_delta)
    return {"message": "Login successful", "token": token, "admin": {"id": admin["id"], "name": admin["name"], "email": admin["email"]}}

@router.get("/admin/users")
@router.get("/admin/users")
def get_all_users(request: Request):
    # Enforce admin auth
    require_role(request, 'admin')
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    try:
        ensure_users_table(cursor)
        # Exclude admins and sort by status (pending, approved, rejected), then name
        cursor.execute(
            """
            SELECT id, name, email, userType, status FROM users
            WHERE userType != 'admin'
            ORDER BY FIELD(status, 'pending', 'approved', 'rejected'), name ASC
            """
        )
        users = cursor.fetchall() or []
        return {"users": users}
    finally:
        cursor.close(); conn.close()

@router.put('/admin/users/{user_id}')
def admin_update_user(request: Request, user_id: int, body: AdminUserUpdateRequest):
    # Only admins can update user core info
    require_role(request, 'admin')
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    try:
        ensure_users_table(cursor)
        cursor.execute('SELECT id, name, email, userType, status FROM users WHERE id=%s', (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail='User not found')
        new_name = body.name if body.name is not None else user['name']
        new_email = body.email if body.email is not None else user['email']
        # Uniqueness check if email changed
        if new_email != user['email']:
            cursor.execute('SELECT id FROM users WHERE email=%s AND id<>%s', (new_email, user_id))
            exists = cursor.fetchone()
            if exists:
                raise HTTPException(status_code=400, detail='Email already in use by another account')
        cursor.execute('UPDATE users SET name=%s, email=%s WHERE id=%s', (new_name, new_email, user_id))
        conn.commit()
        try:
            admin_id = int(require_role(request, 'admin').get('sub'))
            log_admin_action(admin_id, f"edit_user id={user_id} name={new_name} email={new_email}")
        except Exception:
            pass
        return { 'status': 'success', 'user': { 'id': user_id, 'name': new_name, 'email': new_email, 'userType': user['userType'], 'status': user['status'] } }
    finally:
        cursor.close(); conn.close()

@router.post('/admin/users/{user_id}/reset-password')
def admin_reset_user_password(request: Request, user_id: int, body: AdminResetPasswordRequest):
    require_role(request, 'admin')
    from werkzeug.security import generate_password_hash
    # Enforce strong password if enabled
    try:
        settings = get_admin_system_settings_cached()
        if bool(settings.get('requireStrongPasswords', True)) and not _password_strong_enough(body.new_password):
            raise HTTPException(status_code=400, detail='Password does not meet strength requirements (min 8, upper, lower, number, symbol).')
        elif not body.new_password or len(body.new_password) < 6:
            raise HTTPException(status_code=400, detail='New password must be at least 6 characters long')
    except HTTPException:
        raise
    except Exception:
        if not body.new_password or len(body.new_password) < 6:
            raise HTTPException(status_code=400, detail='New password must be at least 6 characters long')
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    try:
        ensure_users_table(cursor)
        cursor.execute('SELECT id FROM users WHERE id=%s AND userType IN (\'student\', \'instructor\')', (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail='User not found or not eligible')
        new_hash = generate_password_hash(body.new_password)
        cursor.execute('UPDATE users SET password_hash=%s WHERE id=%s', (new_hash, user_id))
        conn.commit()
        try:
            # Best-effort audit/notification
            c2 = conn.cursor()
            ensure_notifications_table(c2); migrate_notifications_schema(c2)
            create_notification(c2, 'admin', f"Password reset for user id={user_id}", 'warning', None)
            conn.commit(); c2.close()
        except Exception:
            pass
        try:
            admin_id = int(require_role(request, 'admin').get('sub'))
            log_admin_action(admin_id, f"reset_password id={user_id}")
        except Exception:
            pass
        return { 'status': 'success' }
    finally:
        cursor.close(); conn.close()

@router.post("/admin/approve/{user_id}")
def approve_user(request: Request, user_id: int):
    require_role(request, 'admin')
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    # Check if user exists and is an instructor
    cursor.execute("SELECT * FROM users WHERE id=%s AND userType='instructor'", (user_id,))
    user = cursor.fetchone()
    if not user:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="User not found or not an instructor")
    
    # Update user status to approved
    cursor.execute("UPDATE users SET status='approved' WHERE id=%s", (user_id,))
    conn.commit()
    # Create an admin broadcast notification about the approval
    try:
        c2 = conn.cursor()
        ensure_notifications_table(c2); migrate_notifications_schema(c2)
        create_notification(c2, 'admin', f"User approved: id={user_id}", 'success', None)
        conn.commit(); c2.close()
    except Exception:
        pass
    # Audit
    try:
        admin_id = int(require_role(request, 'admin').get('sub'))
        log_admin_action(admin_id, f"approve_user id={user_id}")
    except Exception:
        pass
    cursor.close(); conn.close()
    return {"message": "User approved successfully"}

@router.post("/admin/reject/{user_id}")
def reject_user(request: Request, user_id: int):
    require_role(request, 'admin')
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    # Check if user exists and is an instructor
    cursor.execute("SELECT * FROM users WHERE id=%s AND userType='instructor'", (user_id,))
    user = cursor.fetchone()
    if not user:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="User not found or not an instructor")
    
    # Update user status to rejected
    cursor.execute("UPDATE users SET status='rejected' WHERE id=%s", (user_id,))
    conn.commit()
    # Create an admin broadcast notification about the rejection
    try:
        c2 = conn.cursor()
        ensure_notifications_table(c2); migrate_notifications_schema(c2)
        create_notification(c2, 'admin', f"User rejected: id={user_id}", 'warning', None)
        conn.commit(); c2.close()
    except Exception:
        pass
    try:
        admin_id = int(require_role(request, 'admin').get('sub'))
        log_admin_action(admin_id, f"reject_user id={user_id}")
    except Exception:
        pass
    cursor.close(); conn.close()
    return {"message": "User rejected successfully"}

@router.delete("/admin/delete/{user_id}")
def delete_user(request: Request, user_id: int):
    require_role(request, 'admin')
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    # Check if user exists
    cursor.execute("SELECT * FROM users WHERE id=%s", (user_id,))
    user = cursor.fetchone()
    if not user:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete user
    cursor.execute("DELETE FROM users WHERE id=%s", (user_id,))
    conn.commit()
    try:
        admin_id = int(require_role(request, 'admin').get('sub'))
        log_admin_action(admin_id, f"delete_user id={user_id}")
    except Exception:
        pass
    cursor.close(); conn.close()
    return {"message": "User deleted successfully"}

@router.put("/admin/profile")
def update_admin_profile(request: Request, req: AdminProfileUpdateRequest):
    print(f"[DEBUG] Admin profile update: {req}")
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('UPDATE admins SET name=%s, email=%s WHERE id=%s', (req.name, req.email, req.id))
        conn.commit()
        cursor.close()
        conn.close()
        try:
            admin_id = int(require_role(request, 'admin').get('sub'))
            log_admin_action(admin_id, f"update_admin_profile id={req.id}")
        except Exception:
            pass
        print("[DEBUG] Admin profile updated successfully.")
        return {"status": "success", "message": "Profile updated."}
    except Exception as e:
        print(f"[DEBUG] Error updating admin profile: {e}")
        raise HTTPException(status_code=400, detail='Failed to update profile.')

@router.get("/admin/system-settings")
def get_system_settings():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    # Ensure table and columns exist
    try:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_system_settings (
                id INT NOT NULL PRIMARY KEY,
                enableUserRegistration TINYINT(1) DEFAULT 1,
                autoApproveInstructors TINYINT(1) DEFAULT 0,
                maintenanceMode TINYINT(1) DEFAULT 0,
                backupFrequency VARCHAR(16) DEFAULT 'daily',
                sessionTimeoutMinutes INT DEFAULT 60,
                requireStrongPasswords TINYINT(1) DEFAULT 1,
                allowInstructorBulkActions TINYINT(1) DEFAULT 1
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """
        )
        # Attempt to add new columns if missing (idempotent)
        for col_def in [
            ("sessionTimeoutMinutes", "INT DEFAULT 60"),
            ("requireStrongPasswords", "TINYINT(1) DEFAULT 1"),
            ("allowInstructorBulkActions", "TINYINT(1) DEFAULT 1"),
        ]:
            try:
                cursor.execute(f"ALTER TABLE admin_system_settings ADD COLUMN {col_def[0]} {col_def[1]}")
            except Exception:
                pass
    except Exception:
        pass
    cursor.execute("SELECT * FROM admin_system_settings LIMIT 1")
    settings = cursor.fetchone()
    cursor.close()
    conn.close()
    if not settings:
        # Default settings if not set
        return {
            "enableUserRegistration": True,
            "autoApproveInstructors": False,
            "maintenanceMode": False,
            "backupFrequency": "daily",
            "sessionTimeoutMinutes": 60,
            "requireStrongPasswords": True,
            "allowInstructorBulkActions": True,
        }
    # Normalize types from MySQL (0/1 to bool)
    def as_bool(v):
        return bool(int(v)) if isinstance(v, (int,)) else bool(v)
    settings["enableUserRegistration"] = as_bool(settings.get("enableUserRegistration", 1))
    settings["autoApproveInstructors"] = as_bool(settings.get("autoApproveInstructors", 0))
    settings["maintenanceMode"] = as_bool(settings.get("maintenanceMode", 0))
    settings["requireStrongPasswords"] = as_bool(settings.get("requireStrongPasswords", 1))
    settings["allowInstructorBulkActions"] = as_bool(settings.get("allowInstructorBulkActions", 1))
    if settings.get("sessionTimeoutMinutes") is None:
        settings["sessionTimeoutMinutes"] = 60
    if not settings.get("backupFrequency"):
        settings["backupFrequency"] = "daily"
    # Also refresh cache consumers
    try:
        invalidate_admin_system_settings_cache()
    except Exception:
        pass
    return settings

@router.put("/admin/system-settings")
def update_system_settings(settings: AdminSystemSettings):
    print(f"[DEBUG] Admin system settings update: {settings}")
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Ensure table exists with required columns
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_system_settings (
                id INT NOT NULL PRIMARY KEY,
                enableUserRegistration TINYINT(1) DEFAULT 1,
                autoApproveInstructors TINYINT(1) DEFAULT 0,
                maintenanceMode TINYINT(1) DEFAULT 0,
                backupFrequency VARCHAR(16) DEFAULT 'daily',
                sessionTimeoutMinutes INT DEFAULT 60,
                requireStrongPasswords TINYINT(1) DEFAULT 1,
                allowInstructorBulkActions TINYINT(1) DEFAULT 1
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """
        )
        # Idempotent adds for columns
        for col_def in [
            ("sessionTimeoutMinutes", "INT DEFAULT 60"),
            ("requireStrongPasswords", "TINYINT(1) DEFAULT 1"),
            ("allowInstructorBulkActions", "TINYINT(1) DEFAULT 1"),
        ]:
            try:
                cursor.execute(f"ALTER TABLE admin_system_settings ADD COLUMN {col_def[0]} {col_def[1]}")
            except Exception:
                pass
        cursor.execute(
            "REPLACE INTO admin_system_settings (id, enableUserRegistration, autoApproveInstructors, maintenanceMode, backupFrequency, sessionTimeoutMinutes, requireStrongPasswords, allowInstructorBulkActions) VALUES (1, %s, %s, %s, %s, %s, %s, %s)",
            (
                int(bool(settings.enableUserRegistration)),
                int(bool(settings.autoApproveInstructors)),
                int(bool(settings.maintenanceMode)),
                settings.backupFrequency,
                int(settings.sessionTimeoutMinutes or 60),
                int(bool(settings.requireStrongPasswords if settings.requireStrongPasswords is not None else True)),
                int(bool(settings.allowInstructorBulkActions if settings.allowInstructorBulkActions is not None else True)),
            )
        )
        conn.commit()
        cursor.close()
        conn.close()
        print("[DEBUG] Admin system settings updated successfully.")
        try:
            invalidate_admin_system_settings_cache()
        except Exception:
            pass
        return {"status": "success", "message": "System settings updated."}
    except Exception as e:
        print(f"[DEBUG] Error updating admin system settings: {e}")
        raise HTTPException(status_code=400, detail='Failed to update system settings.')

@router.get("/admin/notifications/{admin_id}")
def get_admin_notifications(admin_id: int):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM admin_notifications WHERE admin_id=%s", (admin_id,))
    notif = cursor.fetchone()
    cursor.close()
    conn.close()
    if not notif:
        return {"email": True, "browser": True, "systemAlerts": True}
    return notif

@router.put("/admin/notifications/{admin_id}")
def update_admin_notifications(admin_id: int, settings: AdminNotificationSettings):
    print(f"[DEBUG] Admin notification settings update: admin_id={admin_id}, settings={settings}")
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("REPLACE INTO admin_notifications (admin_id, email, browser, systemAlerts) VALUES (%s, %s, %s, %s)",
            (admin_id, settings.email, settings.browser, settings.systemAlerts))
        conn.commit()
        cursor.close()
        conn.close()
        print("[DEBUG] Admin notification settings updated successfully.")
        return {"status": "success", "message": "Notification settings updated."}
    except Exception as e:
        print(f"[DEBUG] Error updating admin notification settings: {e}")
        raise HTTPException(status_code=400, detail='Failed to update notification settings.')

@router.post("/admin/change-password")
def change_admin_password(req: AdminPasswordChangeRequest):
    print(f"[DEBUG] Admin password change request: id={getattr(req, 'id', None)}, current_password={req.current_password}, new_password={req.new_password}")
    if not hasattr(req, 'id') or not req.id:
        print("[DEBUG] No admin id provided in request body.")
        raise HTTPException(status_code=400, detail='Admin ID is required to change password.')
    admin_id = req.id
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT password_hash FROM admins WHERE id=%s", (admin_id,))
    admin = cursor.fetchone()
    print(f"[DEBUG] DB admin lookup: {admin}")
    if not admin:
        print("[DEBUG] No admin found for id.")
        cursor.close()
        conn.close()
        raise HTTPException(status_code=401, detail='Current password is incorrect (admin not found)')
    if not check_password_hash(admin['password_hash'], req.current_password):
        print("[DEBUG] Password check failed.")
        cursor.close()
        conn.close()
        raise HTTPException(status_code=401, detail='Current password is incorrect')
    # Enforce strong password if enabled
    try:
        settings = get_admin_system_settings_cached()
        if bool(settings.get('requireStrongPasswords', True)) and not _password_strong_enough(req.new_password):
            raise HTTPException(status_code=400, detail='Password does not meet strength requirements (min 8, upper, lower, number, symbol).')
    except HTTPException:
        raise
    except Exception:
        pass
    from werkzeug.security import generate_password_hash
    new_hash = generate_password_hash(req.new_password)
    print(f"[DEBUG] Updating password hash for admin id {admin_id}")
    cursor.execute("UPDATE admins SET password_hash=%s WHERE id=%s", (new_hash, admin_id))
    conn.commit()
    cursor.close()
    conn.close()
    print("[DEBUG] Password updated successfully.")
    return {"status": "success", "message": "Password changed."}

@router.get("/admin/audit-logs/{admin_id}", response_model=List[AuditLogEntry])
def get_audit_logs(admin_id: int):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    # Ensure audit table exists to avoid insert/select failures on fresh DBs
    try:
        cursor.execute(
            '''
            CREATE TABLE IF NOT EXISTS admin_audit_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                admin_id INT NOT NULL,
                action VARCHAR(512) NOT NULL,
                timestamp DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            '''
        )
    except Exception:
        pass
    cursor.execute("SELECT * FROM admin_audit_logs WHERE admin_id=%s ORDER BY timestamp DESC LIMIT 50", (admin_id,))
    logs = cursor.fetchall()
    cursor.close()
    conn.close()
    return logs

# Helper to log admin actions
def log_admin_action(admin_id: int, action: str):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                '''
                CREATE TABLE IF NOT EXISTS admin_audit_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    admin_id INT NOT NULL,
                    action VARCHAR(512) NOT NULL,
                    timestamp DATETIME NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                '''
            )
        except Exception:
            pass
        cursor.execute("INSERT INTO admin_audit_logs (admin_id, action, timestamp) VALUES (%s, %s, %s)", (admin_id, action, datetime.now().isoformat()))
        conn.commit()
    except Exception as e:
        # Do not raise from audit failures; just log to stdout for operators
        print(f"[WARN] log_admin_action failed: {e}")
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass

# ---------------- Lobbies visibility (Admin) -----------------

@router.get('/admin/lobbies')
def admin_list_lobbies(request: Request):
    """Return active lobbies and their participants for quick admin visibility.

    Shape:
    {
      "lobbies": [
         { code, difficulty, created_at, participants: [ { name, role, ready, joined_at } ] }
      ]
    }
    """
    require_role(request, 'admin')
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    try:
        # Ensure tables exist so fresh deployments don't error
        ensure_lobby_tables(cursor)
        conn.commit()
        cursor.execute("SELECT code, difficulty, created_at, created_by FROM lobbies ORDER BY created_at DESC LIMIT 200")
        rows = cursor.fetchall() or []
        codes = [r['code'] for r in rows]
        parts_map = {}
        # Map instructor id to basic info for convenience
        creator_info = {}
        creator_ids = [int(r['created_by']) for r in rows if r.get('created_by')]
        creator_ids = list(dict.fromkeys(creator_ids))  # dedupe
        if creator_ids:
            placeholders = ','.join(['%s'] * len(creator_ids))
            try:
                cursor.execute(f"SELECT id, name, email FROM users WHERE id IN ({placeholders})", creator_ids)
                for u in cursor.fetchall() or []:
                    creator_info[int(u['id'])] = { 'id': int(u['id']), 'name': u.get('name'), 'email': u.get('email') }
            except Exception:
                pass
        if codes:
            # Fetch participants for listed lobbies
            placeholders = ','.join(['%s'] * len(codes))
            cursor.execute(
                f"SELECT code, name, role, ready, joined_at FROM lobby_participants WHERE code IN ({placeholders}) ORDER BY joined_at ASC",
                codes
            )
            for p in cursor.fetchall() or []:
                code = p.get('code')
                if code not in parts_map:
                    parts_map[code] = []
                parts_map[code].append({
                    'name': p.get('name'),
                    'role': p.get('role'),
                    'ready': bool(p.get('ready') or 0),
                    'joined_at': str(p.get('joined_at') or '')
                })
        out = []
        for r in rows:
            cid = r.get('created_by')
            out.append({
                'code': r.get('code'),
                'difficulty': r.get('difficulty') or 'Beginner',
                'created_at': str(r.get('created_at') or ''),
                'participants': parts_map.get(r.get('code'), []),
                'created_by': int(cid) if cid is not None else None,
                'created_by_user': creator_info.get(int(cid)) if cid else None
            })
        return { 'lobbies': out }
    finally:
        try:
            cursor.close(); conn.close()
        except Exception:
            pass

# ---------------- Shared Notifications (Admin view) -----------------

class AdminNotificationOut(BaseModel):
    id: int
    message: str
    type: str
    time: Optional[str] = None
    read: bool

@router.get('/admin/notifications', response_model=List[AdminNotificationOut])
def admin_list_notifications(request: Request, admin_id: Optional[int] = None):
    """List unread notifications for admin (recipient_role='admin'). Supports broadcast (recipient_id IS NULL).

    If admin_id is provided and role is valid, include targeted rows for that id.
    """
    payload = require_role(request, 'admin')
    # Infer admin_id from token if not provided
    try:
        if admin_id is None and payload and payload.get('sub'):
            admin_id = int(payload.get('sub'))
    except Exception:
        admin_id = None
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    try:
        ensure_notifications_table(cursor)
        migrate_notifications_schema(cursor)
        if admin_id:
            cursor.execute(
                '''SELECT id, message, type, time, `read` FROM notifications
                   WHERE recipient_role='admin' AND `read`=0 AND (recipient_id IS NULL OR recipient_id=%s)
                   ORDER BY time DESC LIMIT 100''', (admin_id,)
            )
        else:
            cursor.execute(
                '''SELECT id, message, type, time, `read` FROM notifications
                   WHERE recipient_role='admin' AND `read`=0 AND recipient_id IS NULL
                   ORDER BY time DESC LIMIT 100'''
            )
        rows = cursor.fetchall() or []
        return [
            {
                'id': int(r['id']),
                'message': r.get('message',''),
                'type': r.get('type') or 'info',
                'time': str(r.get('time') or ''),
                'read': bool(r.get('read') or 0)
            } for r in rows
        ]
    finally:
        cursor.close(); conn.close()

@router.get('/admin/notifications-count')
def admin_notifications_count(request: Request, admin_id: Optional[int] = None):
    payload = require_role(request, 'admin')
    try:
        if admin_id is None and payload and payload.get('sub'):
            admin_id = int(payload.get('sub'))
    except Exception:
        admin_id = None
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        ensure_notifications_table(cursor)
        migrate_notifications_schema(cursor)
        if admin_id:
            cursor.execute(
                """SELECT COUNT(*) FROM notifications
                    WHERE recipient_role='admin' AND `read`=0 AND (recipient_id IS NULL OR recipient_id=%s)""",
                (admin_id,)
            )
        else:
            cursor.execute(
                """SELECT COUNT(*) FROM notifications
                    WHERE recipient_role='admin' AND `read`=0 AND recipient_id IS NULL"""
            )
        row = cursor.fetchone()
        return {'count': int(row[0]) if row else 0}
    finally:
        cursor.close(); conn.close()

@router.patch('/admin/notifications/{notification_id}/read')
def admin_mark_notification_read(request: Request, notification_id: int):
    require_role(request, 'admin')
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        ensure_notifications_table(cursor)
        migrate_notifications_schema(cursor)
        cursor.execute('UPDATE notifications SET `read`=1 WHERE id=%s AND recipient_role=\'admin\' AND `read`=0', (notification_id,))
        conn.commit()
        return {'status': 'success' if cursor.rowcount else 'noop'}
    finally:
        cursor.close(); conn.close()

@router.post('/admin/notifications/mark-all-read')
def admin_mark_all_notifications_read(request: Request, admin_id: Optional[int] = None):
    payload = require_role(request, 'admin')
    try:
        if admin_id is None and payload and payload.get('sub'):
            admin_id = int(payload.get('sub'))
    except Exception:
        admin_id = None
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        ensure_notifications_table(cursor)
        migrate_notifications_schema(cursor)
        if admin_id:
            cursor.execute("UPDATE notifications SET `read`=1 WHERE recipient_role='admin' AND `read`=0 AND (recipient_id IS NULL OR recipient_id=%s)", (admin_id,))
        else:
            cursor.execute("UPDATE notifications SET `read`=1 WHERE recipient_role='admin' AND `read`=0 AND recipient_id IS NULL")
        conn.commit()
        return {'updated': cursor.rowcount}
    finally:
        cursor.close(); conn.close()


# ---------------- Module Requests (Admin) -----------------

def _ensure_module_requests_table(cursor):
    """Replicate instructor-side ensure (kept separate to avoid cross-module import)."""
    cursor.execute(
        '''CREATE TABLE IF NOT EXISTS module_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            instructor_id INT NOT NULL,
            module_name VARCHAR(255) NOT NULL,
            category VARCHAR(100) NOT NULL,
            details TEXT,
            content_json LONGTEXT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_instructor (instructor_id),
            INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;'''
    )
    try:
        cursor.execute("SHOW COLUMNS FROM module_requests LIKE 'content_json'")
        if cursor.fetchone() is None:
            cursor.execute("ALTER TABLE module_requests ADD COLUMN content_json LONGTEXT NULL")
    except Exception as me:
        print(f"[WARN] Could not ensure content_json column (admin ensure): {me}")

def _ensure_admin_columns(cursor):
    """Ensure admin_comment and decided_at columns exist (compatible with MySQL < 8)."""
    def column_exists(col: str) -> bool:
        cursor.execute("SHOW COLUMNS FROM module_requests LIKE %s", (col,))
        return cursor.fetchone() is not None
    mutated = False
    try:
        if not column_exists('admin_comment'):
            cursor.execute("ALTER TABLE module_requests ADD COLUMN admin_comment TEXT NULL")
            mutated = True
    except Exception as e:
        print(f"[WARN] Failed adding admin_comment column: {e}")
    try:
        if not column_exists('decided_at'):
            cursor.execute("ALTER TABLE module_requests ADD COLUMN decided_at DATETIME NULL")
            mutated = True
    except Exception as e:
        print(f"[WARN] Failed adding decided_at column: {e}")
    if mutated:
        try:
            cursor.connection.commit()
        except Exception:
            pass

@router.get('/admin/module-requests', response_model=List[ModuleRequestAdminView])
def list_module_requests(request: Request, status: Optional[str] = None):
    """List module requests (optionally filter by status). Admin only."""
    from auth import require_role
    require_role(request, 'admin')
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    try:
        _ensure_module_requests_table(cursor); _ensure_admin_columns(cursor)
        if status:
            cursor.execute(
                "SELECT id, instructor_id, module_name, category, details, status, created_at, decided_at, admin_comment FROM module_requests WHERE status=%s ORDER BY FIELD(status,'pending','approved','rejected'), created_at DESC", (status,)
            )
        else:
            cursor.execute(
                "SELECT id, instructor_id, module_name, category, details, status, created_at, decided_at, admin_comment FROM module_requests ORDER BY FIELD(status,'pending','approved','rejected'), created_at DESC"
            )
        rows = cursor.fetchall()
        return rows
    finally:
        cursor.close(); conn.close()

@router.get('/admin/module-requests/{request_id}', response_model=ModuleRequestAdminView)
def get_module_request(request: Request, request_id: int):
    from auth import require_role
    require_role(request, 'admin')
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    try:
        _ensure_module_requests_table(cursor); _ensure_admin_columns(cursor)
        cursor.execute("SELECT id, instructor_id, module_name, category, details, status, created_at, decided_at, admin_comment, content_json FROM module_requests WHERE id=%s", (request_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail='Module request not found')
        return row
    finally:
        cursor.close(); conn.close()

@router.patch('/admin/module-requests/{request_id}', response_model=ModuleRequestAdminView)
def update_module_request_status(request: Request, request_id: int, body: ModuleRequestStatusUpdate):
    """Approve or reject a module request (status: approved|rejected|pending)."""
    from auth import require_role
    require_role(request, 'admin')
    new_status = body.status.lower().strip()
    if new_status not in ('pending','approved','rejected'):
        raise HTTPException(status_code=400, detail='Invalid status value')
    if body.admin_comment and len(body.admin_comment) > 2000:
        raise HTTPException(status_code=400, detail='admin_comment too long (max 2000 chars)')
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    try:
        _ensure_module_requests_table(cursor); _ensure_admin_columns(cursor)
        cursor.execute("SELECT status, instructor_id, module_name FROM module_requests WHERE id=%s", (request_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail='Module request not found')
        old_status = row['status']
        decided_at_expr = 'NOW()' if new_status in ('approved','rejected') else 'NULL'
        cursor2 = conn.cursor()
        cursor2.execute(
            f"UPDATE module_requests SET status=%s, admin_comment=%s, decided_at={decided_at_expr} WHERE id=%s",
            (new_status, body.admin_comment, request_id)
        )
        conn.commit(); cursor2.close()
        # Notification to the specific instructor about decision (targeted)
        try:
            cursor3 = conn.cursor()
            ensure_notifications_table(cursor3)
            migrate_notifications_schema(cursor3)
            notif_type = 'success' if new_status == 'approved' else ('warning' if new_status == 'rejected' else 'info')
            msg = f"Module request '{row['module_name']}' {new_status}"
            # Target the instructor who filed the request
            create_notification(cursor3, 'instructor', msg, notif_type, recipient_id=row['instructor_id'])
            conn.commit(); cursor3.close()
        except Exception as ne:
            print(f"[WARN] Could not create targeted instructor notification for module request decision {request_id}: {ne}")
        # Return updated row
        cursor.execute("SELECT id, instructor_id, module_name, category, details, status, created_at, decided_at, admin_comment, content_json FROM module_requests WHERE id=%s", (request_id,))
        updated = cursor.fetchone()
        return updated
    finally:
        cursor.close(); conn.close()

@router.get('/admin/module-requests/{request_id}/content')
def get_module_request_content(request: Request, request_id: int):
    """Return parsed JSON content for a module request (if provided)."""
    from auth import require_role
    require_role(request, 'admin')
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    try:
        _ensure_module_requests_table(cursor); _ensure_admin_columns(cursor)
        cursor.execute("SELECT content_json FROM module_requests WHERE id=%s", (request_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail='Module request not found')
        content = row.get('content_json')
        if not content:
            return {'id': request_id, 'content': None}
        try:
            import json
            parsed = json.loads(content)
        except Exception as e:
            return {'id': request_id, 'content': None, 'error': 'Failed to parse content_json'}
        return {'id': request_id, 'content': parsed}
    finally:
        cursor.close(); conn.close()

@router.get('/admin/health')
def admin_health(request: Request):
    """Lightweight health probe for dashboard. Requires admin role.
    Returns API + DB status; DB considered ok if a simple SELECT 1 succeeds."""
    try:
        require_role(request, 'admin')
    except Exception:
        raise HTTPException(status_code=401, detail='Not authorized')
    api_status = 'ok'
    db_status = 'error'
    try:
        conn = get_db_connection(); cursor = conn.cursor(); cursor.execute('SELECT 1'); cursor.fetchone(); cursor.close(); conn.close(); db_status='ok'
    except Exception as e:
        db_status='error'
    from datetime import datetime as _dt
    return { 'api': api_status, 'db': db_status, 'time': _dt.utcnow().isoformat() + 'Z' }