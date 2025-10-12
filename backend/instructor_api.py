
from fastapi import APIRouter, HTTPException, Request, Body, UploadFile, File
from pydantic import BaseModel
import mysql.connector
from werkzeug.security import generate_password_hash, check_password_hash
from typing import List, Optional, Dict, Any
import json
from auth import create_access_token, require_role
from notifications_helper import migrate_notifications_schema

router = APIRouter()

from config import MYSQL_CONFIG, get_db_connection
import os, uuid

def ensure_instructor_profiles_table(cursor):
    """Ensure instructor_profiles exists to store join_date and avatar_url per instructor."""
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS instructor_profiles (
            instructor_id INT NOT NULL,
            join_date DATE NULL,
            avatar_url VARCHAR(512) NULL,
            updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (instructor_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        '''
    )

def ensure_instructor_settings_table(cursor):
    """Ensure instructor_settings exists; stores notifications as JSON text for portability."""
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS instructor_settings (
            instructor_id INT NOT NULL,
            notifications_text LONGTEXT NULL,
            updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (instructor_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        '''
    )

def ensure_users_table(cursor):
    """Create users table if it doesn't exist yet (minimal schema used across instructor APIs)."""
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS users (
          id INT NOT NULL AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          userType ENUM('student','instructor','admin') NOT NULL,
          status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved',
          PRIMARY KEY (id),
          UNIQUE KEY email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        '''
    )

def ensure_assignments_table(cursor):
    """Create assignments table if it doesn't exist yet."""
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS assignments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            instructor_id INT NOT NULL,
            student_id INT NOT NULL,
            module_name VARCHAR(255) NOT NULL,
            module_slug VARCHAR(255) NULL,
            due_date DATETIME NULL,
            status ENUM('assigned','in-progress','completed','overdue') DEFAULT 'assigned',
            notes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        '''
    )

def _notify_once(cursor, recipient_role: str, recipient_id: Optional[int], message: str, ntype: str = 'info') -> None:
    """Insert a notification if an identical unread message doesn't already exist for that recipient."""
    try:
        if recipient_id is None:
            cursor.execute('SELECT id FROM notifications WHERE recipient_role=%s AND recipient_id IS NULL AND `read`=0 AND message=%s', (recipient_role, message))
        else:
            cursor.execute('SELECT id FROM notifications WHERE recipient_role=%s AND recipient_id=%s AND `read`=0 AND message=%s', (recipient_role, recipient_id, message))
        if cursor.fetchone():
            return
        if recipient_id is None:
            cursor.execute('INSERT INTO notifications (recipient_role, message, type) VALUES (%s,%s,%s)', (recipient_role, message, ntype))
        else:
            cursor.execute('INSERT INTO notifications (recipient_id, recipient_role, message, type) VALUES (%s,%s,%s,%s)', (recipient_id, recipient_role, message, ntype))
    except Exception as e:
        print(f"[WARN] _notify_once failed: {e}")

def ensure_notifications_table(cursor):
    """Create notifications table if it doesn't exist yet. Supports per-recipient targeting and read flags."""
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


# ---------------- Instructor Notifications Endpoints -----------------

@router.get('/instructor/notifications')
def instructor_list_notifications(request: Request):
    """List unread notifications for the authenticated instructor.

    Uses shared notifications table with per-recipient targeting.
    """
    payload = require_role(request, 'instructor')
    instructor_id = None
    try:
        instructor_id = int(payload.get('sub')) if payload and payload.get('sub') else None
    except Exception:
        instructor_id = None
    if not instructor_id:
        raise HTTPException(status_code=401, detail='Unauthorized')
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    try:
        ensure_notifications_table(cursor)
        migrate_notifications_schema(cursor)
        cursor.execute(
            '''SELECT id, message, type, time, `read`
               FROM notifications
               WHERE recipient_role='instructor' AND recipient_id=%s AND `read`=0
               ORDER BY time DESC LIMIT 100''',
            (instructor_id,)
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


@router.get('/instructor/notifications/count')
def instructor_notifications_count(request: Request):
    payload = require_role(request, 'instructor')
    instructor_id = None
    try:
        instructor_id = int(payload.get('sub')) if payload and payload.get('sub') else None
    except Exception:
        instructor_id = None
    if not instructor_id:
        return {'count': 0}
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        ensure_notifications_table(cursor)
        migrate_notifications_schema(cursor)
        cursor.execute(
            """SELECT COUNT(*) FROM notifications
                WHERE recipient_role='instructor' AND recipient_id=%s AND `read`=0""",
            (instructor_id,)
        )
        row = cursor.fetchone()
        return {'count': int(row[0]) if row else 0}
    finally:
        cursor.close(); conn.close()


@router.patch('/instructor/notifications/{notification_id}/read')
def instructor_mark_notification_read(request: Request, notification_id: int):
    payload = require_role(request, 'instructor')
    instructor_id = None
    try:
        instructor_id = int(payload.get('sub')) if payload and payload.get('sub') else None
    except Exception:
        instructor_id = None
    if not instructor_id:
        raise HTTPException(status_code=401, detail='Unauthorized')
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        ensure_notifications_table(cursor)
        migrate_notifications_schema(cursor)
        cursor.execute(
            """
            UPDATE notifications
            SET `read`=1
            WHERE id=%s AND recipient_role='instructor' AND recipient_id=%s AND `read`=0
            """,
            (notification_id, instructor_id)
        )
        conn.commit()
        return {'status': 'success' if cursor.rowcount else 'noop'}
    finally:
        cursor.close(); conn.close()


@router.post('/instructor/notifications/mark-all-read')
def instructor_mark_all_notifications_read(request: Request):
    payload = require_role(request, 'instructor')
    instructor_id = None
    try:
        instructor_id = int(payload.get('sub')) if payload and payload.get('sub') else None
    except Exception:
        instructor_id = None
    if not instructor_id:
        raise HTTPException(status_code=401, detail='Unauthorized')
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        ensure_notifications_table(cursor)
        migrate_notifications_schema(cursor)
        cursor.execute(
            """UPDATE notifications
                   SET `read`=1
                 WHERE recipient_role='instructor' AND recipient_id=%s AND `read`=0""",
            (instructor_id,)
        )
        conn.commit()
        return {'updated': cursor.rowcount}
    finally:
        cursor.close(); conn.close()

def _normalize_assignment_status(val: Optional[str]) -> str:
    """Normalize incoming/DB status to one of: assigned, in-progress, completed, overdue"""
    if not val:
        return 'assigned'
    s = str(val).strip().lower().replace('_', '-').replace(' ', '-')
    if s in ('in-progress', 'inprogress'):
        return 'in-progress'
    if s in ('completed', 'complete', 'done'):
        return 'completed'
    if s in ('overdue', 'past-due', 'pastdue'):
        return 'overdue'
    if s in ('assigned', 'not-started', 'notstarted'):
        return 'assigned'
    # Fallback to assigned to keep enum safe
    return 'assigned'

def _normalize_datetime_str(dt: Optional[str]) -> Optional[str]:
    """Convert HTML datetime-local (YYYY-MM-DDTHH:MM) or ISO strings into 'YYYY-MM-DD HH:MM:SS'."""
    if not dt:
      return None
    try:
        s = str(dt).strip()
        # Replace 'T' with space
        s = s.replace('T', ' ')
        # If seconds missing, append :00
        if len(s) == 16:  # 'YYYY-MM-DD HH:MM'
            s = s + ':00'
        # Trim timezone if present
        if '+' in s:
            s = s.split('+', 1)[0]
        if 'Z' in s:
            s = s.replace('Z', '')
        return s
    except Exception:
        return dt

class InstructorSignupRequest(BaseModel):
    name: str
    email: str
    password: str

class InstructorLoginRequest(BaseModel):
    email: str
    password: str

class ChangePasswordRequest(BaseModel):
    email: str
    old_password: str
    new_password: str

class InstructorProfile(BaseModel):
    id: int
    name: str
    email: str

class InstructorProfileOut(BaseModel):
    name: str
    email: str
    instructorId: str
    joinDate: str
    avatar: Optional[str] = None

class InstructorSettings(BaseModel):
    notifications: dict

class StudentProgressOut(BaseModel):
    studentName: str
    moduleName: str
    lessonsCompleted: int
    totalLessons: int
    lastLesson: str
    timeSpent: Optional[int]
    engagementScore: Optional[str]

class StudentSummary(BaseModel):
    id: int
    name: str
    email: str
    progress: int  # Overall progress percentage
    completedModules: int
    totalModules: int
    lastActive: str
    details: str

class AssignmentCreate(BaseModel):
    instructor_id: int
    student_ids: List[int]
    module_name: str
    module_slug: Optional[str] = None
    due_date: Optional[str] = None  # ISO string
    notes: Optional[str] = None

class AssignmentUpdate(BaseModel):
    module_name: Optional[str] = None
    module_slug: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class FeedbackCreate(BaseModel):
    instructor_id: int
    student_id: int
    message: str
    submission_id: Optional[int] = None
    assignment_id: Optional[int] = None

def ensure_feedback_table(cursor):
    """Create feedback table if missing and auto-migrate missing columns for legacy installs."""
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS feedback (
            id INT AUTO_INCREMENT PRIMARY KEY,
            instructor_id INT NULL,
            student_id INT NULL,
            submission_id INT NULL,
            assignment_id INT NULL,
            message TEXT NULL,
            created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        '''
    )
    # Ensure required columns exist (avoid NOT NULL to not break existing rows)
    try:
        cursor.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema=%s AND table_name='feedback'
            """,
            (MYSQL_CONFIG['database'],)
        )
        existing = {row[0] for row in cursor.fetchall()}
        required_defs = [
            ('instructor_id', 'INT NULL'),
            ('student_id', 'INT NULL'),
            ('submission_id', 'INT NULL'),
            ('assignment_id', 'INT NULL'),
            ('message', 'TEXT NULL'),
            ("created_at", "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP")
        ]
        for col, sql_type in required_defs:
            if col not in existing:
                try:
                    cursor.execute(f"ALTER TABLE feedback ADD COLUMN {col} {sql_type}")
                except Exception as ae:
                    print(f"[WARN] Could not add missing column {col} to feedback: {ae}")
    except Exception as e:
        print(f"[WARN] Could not verify/alter feedback schema: {e}")
    # Unconditional safety attempts (ignore duplicate column errors)
    for col, sql_type in (
        ('instructor_id', 'INT NULL'),
        ('submission_id', 'INT NULL'),
        ('assignment_id', 'INT NULL'),
    ):
        try:
            cursor.execute(f"ALTER TABLE feedback ADD COLUMN {col} {sql_type}")
        except Exception as ae:
            # Duplicate column error (1060) or others we can safely ignore
            pass

@router.post('/instructor/signup')
def instructor_signup(req: InstructorSignupRequest):
    # Enforce LSPU email domain for instructors
    if not req.email.lower().endswith('@lspu.edu.ph'):
        raise HTTPException(status_code=400, detail='Email must be an LSPU email (firstname.lastname@lspu.edu.ph)')
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    ensure_users_table(cursor)
    cursor.execute('SELECT id FROM users WHERE email=%s', (req.email,))
    if cursor.fetchone():
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail='Email already registered')
    password_hash = generate_password_hash(req.password)
    cursor.execute(
        'INSERT INTO users (name, email, password_hash, userType, status) VALUES (%s, %s, %s, %s, %s)',
        (req.name, req.email, password_hash, 'instructor', 'pending')
    )
    conn.commit()
    # Notify admins of pending instructor approval
    try:
        c2 = conn.cursor()
        ensure_notifications_table(c2)
        c2.execute('INSERT INTO notifications (recipient_role, message, type) VALUES (%s,%s,%s)', ('admin', f"Instructor signup pending approval: {req.name} ({req.email})", 'warning'))
        conn.commit(); c2.close()
    except Exception as ne:
        print(f"[WARN] admin notify (instructor signup) failed: {ne}")
    cursor.close()
    conn.close()
    return {'message': 'Signup successful. Please wait for admin approval.', 'user': {'email': req.email, 'userType': 'instructor', 'status': 'pending'}}

@router.post('/instructor/login')
def instructor_login(req: InstructorLoginRequest):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    ensure_users_table(cursor)
    cursor.execute('SELECT * FROM users WHERE email=%s AND userType=%s', (req.email, 'instructor'))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    if not user:
        raise HTTPException(status_code=404, detail='Email not found')
    if not check_password_hash(user['password_hash'], req.password):
        raise HTTPException(status_code=401, detail='Incorrect password')
    if user['status'] != 'approved':
        raise HTTPException(status_code=403, detail='Instructor account not approved yet.')
    token = create_access_token({
        'sub': str(user['id']),
        'role': user['userType'],
        'email': user['email'],
        'name': user['name']
    })
    return {
        'message': 'Login successful',
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'role': user['userType'],
            'status': user['status']
        },
        'access_token': token,
        'token_type': 'bearer'
    }

@router.post('/instructor/change-password')
def change_instructor_password(req: ChangePasswordRequest):
    print(f"[DEBUG] Instructor password change request: email={getattr(req, 'email', None)}, old_password={req.old_password}, new_password={req.new_password}")
    if not hasattr(req, 'email') or not req.email:
        print("[DEBUG] No email provided in request body.")
        raise HTTPException(status_code=400, detail='Email is required to change password.')
    email = req.email
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    ensure_users_table(cursor)
    cursor.execute('SELECT id, password_hash, userType FROM users WHERE email=%s', (email,))
    user = cursor.fetchone()
    print(f"[DEBUG] DB user lookup: {user}")
    if not user:
        print("[DEBUG] No user found for email.")
        cursor.close()
        conn.close()
        raise HTTPException(status_code=401, detail='Current password is incorrect (user not found)')
    if user.get('userType') != 'instructor':
        print(f"[DEBUG] User found but userType is not instructor: {user.get('userType')}")
        cursor.close()
        conn.close()
        raise HTTPException(status_code=401, detail='Current password is incorrect (not an instructor)')
    if not check_password_hash(user['password_hash'], req.old_password):
        print("[DEBUG] Password check failed.")
        cursor.close()
        conn.close()
        raise HTTPException(status_code=401, detail='Current password is incorrect')
    new_hash = generate_password_hash(req.new_password)
    print(f"[DEBUG] Updating password hash for user id {user['id']}")
    cursor.execute('UPDATE users SET password_hash=%s WHERE id=%s', (new_hash, user['id']))
    conn.commit()
    cursor.close()
    conn.close()
    print("[DEBUG] Password updated successfully.")
    return {"status": "success", "message": "Password changed."}

@router.get('/instructor/profile', response_model=InstructorProfileOut)
def get_instructor_profile(request: Request):
    """Return the authenticated instructor's profile with joinDate and avatar (DB-backed)."""
    payload = require_role(request, 'instructor')
    instr_id = int(payload.get('sub')) if payload and payload.get('sub') else None
    if not instr_id:
        raise HTTPException(status_code=401, detail='Unauthorized')
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    try:
        ensure_instructor_profiles_table(cursor)
        cursor.execute('SELECT name, email FROM users WHERE id=%s AND userType=%s', (instr_id, 'instructor'))
        base = cursor.fetchone() or {}
        cursor.execute('SELECT join_date, avatar_url FROM instructor_profiles WHERE instructor_id=%s', (instr_id,))
        prof = cursor.fetchone() or {}
        jd = prof.get('join_date')
        jd_str = ''
        if jd:
            try:
                jd_str = jd.strftime('%Y-%m-%d')
            except Exception:
                jd_str = str(jd)
        # Normalize avatar URL to absolute if needed
        avatar_url = prof.get('avatar_url')
        if isinstance(avatar_url, str) and avatar_url.startswith('/'):
            try:
                base_url = str(request.base_url).rstrip('/')
                avatar_url = f"{base_url}{avatar_url}"
            except Exception:
                pass
        return InstructorProfileOut(
            name=base.get('name') or '',
            email=base.get('email') or '',
            instructorId=str(instr_id),
            joinDate=jd_str,
            avatar=avatar_url
        )
    finally:
        cursor.close(); conn.close()

@router.put("/instructor/profile", response_model=InstructorProfileOut)
def update_instructor_profile(request: Request, profile: Dict[str, Any] = Body(...)):
    """Persist name,email into users and joinDate,avatar into instructor_profiles (joinDate immutable)."""
    payload = require_role(request, 'instructor')
    instr_id = int(payload.get('sub')) if payload and payload.get('sub') else None
    if not instr_id:
        raise HTTPException(status_code=401, detail='Unauthorized')
    from datetime import date, datetime
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    try:
        # users table (update only provided fields)
        name_in = profile.get('name')
        email_in = profile.get('email')
        join_in = profile.get('joinDate')
        avatar_in = profile.get('avatar')
        if name_in is not None or email_in is not None:
            cursor.execute('SELECT name, email FROM users WHERE id=%s AND userType=%s', (instr_id, 'instructor'))
            current = cursor.fetchone() or {}
            new_name = name_in if name_in is not None else current.get('name')
            new_email = email_in if email_in is not None else current.get('email')
            cursor.execute('UPDATE users SET name=%s, email=%s WHERE id=%s AND userType=%s', (new_name, new_email, instr_id, 'instructor'))
        # profiles table
        ensure_instructor_profiles_table(cursor)
        cursor.execute('SELECT join_date FROM instructor_profiles WHERE instructor_id=%s', (instr_id,))
        row = cursor.fetchone()
        existing_jd = row.get('join_date') if row else None
        # Parse incoming joinDate (YYYY-MM-DD preferred)
        parsed_jd = None
        if join_in:
            try:
                s = str(join_in).strip()
                if 'T' in s:
                    s = s.split('T', 1)[0]
                def _to_iso(dstr: str) -> Optional[str]:
                    for fmt in ('%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y'):
                        try:
                            return datetime.strptime(dstr, fmt).date().isoformat()
                        except Exception:
                            continue
                    if dstr and len(dstr) >= 8:
                        return dstr
                    return None
                parsed_jd = _to_iso(s) if s else None
            except Exception:
                parsed_jd = None
        if not existing_jd and not parsed_jd:
            parsed_jd = date.today().isoformat()
        effective_jd = existing_jd or parsed_jd
        # Upsert; join_date immutable once set
        cursor2 = conn.cursor()
        avatar_val = avatar_in.strip() if isinstance(avatar_in, str) else avatar_in
        if isinstance(avatar_val, str) and len(avatar_val) > 512:
            avatar_val = avatar_val[:512]
        cursor2.execute(
            'INSERT INTO instructor_profiles (instructor_id, join_date, avatar_url) VALUES (%s, %s, %s) '
            'ON DUPLICATE KEY UPDATE join_date=COALESCE(join_date, VALUES(join_date)), avatar_url=VALUES(avatar_url)',
            (instr_id, effective_jd, avatar_val)
        )
        conn.commit(); cursor2.close()
    finally:
        cursor.close(); conn.close()
    # Return the fresh, full profile
    conn2 = get_db_connection(); cur2 = conn2.cursor(dictionary=True)
    try:
        cur2.execute('SELECT name, email FROM users WHERE id=%s', (instr_id,))
        base = cur2.fetchone() or {}
        cur2.execute('SELECT join_date, avatar_url FROM instructor_profiles WHERE instructor_id=%s', (instr_id,))
        prof = cur2.fetchone() or {}
        jd = prof.get('join_date')
        jd_str = ''
        if jd:
            try:
                jd_str = jd.strftime('%Y-%m-%d')
            except Exception:
                jd_str = str(jd)
        return InstructorProfileOut(
            name=base.get('name') or '',
            email=base.get('email') or '',
            instructorId=str(instr_id),
            joinDate=jd_str,
            avatar=prof.get('avatar_url')
        )
    finally:
        cur2.close(); conn2.close()

@router.get('/instructor/settings', response_model=InstructorSettings)
def get_instructor_settings(request: Request):
    payload = require_role(request, 'instructor')
    instr_id = int(payload.get('sub')) if payload and payload.get('sub') else None
    if not instr_id:
        raise HTTPException(status_code=401, detail='Unauthorized')
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    try:
        ensure_instructor_settings_table(cursor)
        cursor.execute('SELECT notifications_text FROM instructor_settings WHERE instructor_id=%s', (instr_id,))
        row = cursor.fetchone()
        if not row or not row.get('notifications_text'):
            return InstructorSettings(notifications={"email": True, "browser": True})
        try:
            data = json.loads(row['notifications_text'])
            if not isinstance(data, dict):
                data = {}
        except Exception:
            data = {}
        defaults = {"email": True, "browser": True}
        defaults.update(data)
        return InstructorSettings(notifications=defaults)
    finally:
        cursor.close(); conn.close()

@router.put("/instructor/settings", response_model=InstructorSettings)
def update_instructor_settings(request: Request, settings: InstructorSettings):
    payload = require_role(request, 'instructor')
    instr_id = int(payload.get('sub')) if payload and payload.get('sub') else None
    if not instr_id:
        raise HTTPException(status_code=401, detail='Unauthorized')
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        ensure_instructor_settings_table(cursor)
        try:
            serialized = json.dumps(settings.notifications or {})
        except Exception:
            serialized = '{}'
        cursor.execute('REPLACE INTO instructor_settings (instructor_id, notifications_text) VALUES (%s, %s)', (instr_id, serialized))
        conn.commit()
        return settings
    finally:
        cursor.close(); conn.close()

# ---- Avatar Upload (Instructor) ----
@router.post('/instructor/profile/avatar')
def upload_instructor_avatar(request: Request, file: UploadFile = File(...)):
    payload = require_role(request, 'instructor')
    instr_id = int(payload.get('sub')) if payload and payload.get('sub') else None
    if not instr_id:
        raise HTTPException(status_code=401, detail='Unauthorized')
    ct = (file.content_type or '').lower()
    if not ct.startswith('image/'):
        raise HTTPException(status_code=400, detail='Only image files are allowed')
    base_dir = os.path.dirname(__file__)
    upload_root = os.path.join(base_dir, 'uploads', 'avatars', 'instructors')
    os.makedirs(upload_root, exist_ok=True)
    ext = os.path.splitext(file.filename or '')[1] or '.png'
    safe_ext = ext if len(ext) <= 6 else '.png'
    fname = f"{instr_id}_{uuid.uuid4().hex}{safe_ext}"
    fpath = os.path.join(upload_root, fname)
    data = file.file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail='File too large. Max size is 5 MB.')
    with open(fpath, 'wb') as out:
        out.write(data)
    public_path = f"/uploads/avatars/instructors/{fname}"
    try:
        base_url = str(request.base_url).rstrip('/')
        public_url = f"{base_url}{public_path}"
    except Exception:
        public_url = public_path
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        ensure_instructor_profiles_table(cursor)
        cursor.execute(
            'INSERT INTO instructor_profiles (instructor_id, avatar_url) VALUES (%s, %s) '
            'ON DUPLICATE KEY UPDATE avatar_url=VALUES(avatar_url)',
            (instr_id, public_path)
        )
        conn.commit()
    finally:
        cursor.close(); conn.close()
    return {"url": public_url}

@router.get('/instructor/progress', response_model=List[StudentProgressOut])
def get_all_student_progress():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute('SELECT student_name as studentName, module_name as moduleName, lessons_completed as lessonsCompleted, total_lessons as totalLessons, last_lesson as lastLesson, time_spent as timeSpent, engagement_score as engagementScore FROM student_progress')
    rows = cursor.fetchall()
    # Fix: ensure engagementScore is a string or None
    for row in rows:
        if row['engagementScore'] is not None:
            row['engagementScore'] = str(row['engagementScore'])
    cursor.close()
    conn.close()
    return rows

@router.get('/instructor/modules')
def instructor_modules():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute('''
        SELECT 
            module_name AS name,
            COUNT(DISTINCT student_id) AS students,
            ROUND(AVG(lessons_completed / total_lessons * 100)) AS completion
        FROM student_progress
        GROUP BY module_name
    ''')
    modules = cursor.fetchall()
    cursor.close()
    conn.close()
    return modules

@router.get('/instructor/stats')
def instructor_stats():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    # Count only approved students from users table
    ensure_users_table(cursor)
    cursor.execute("SELECT COUNT(*) AS totalStudents FROM users WHERE userType = 'student' AND status = 'approved'")
    total_students = cursor.fetchone()['totalStudents']

    cursor.execute('SELECT COUNT(DISTINCT module_name) AS activeModules FROM student_progress')
    active_modules = cursor.fetchone()['activeModules']

    cursor.execute('SELECT AVG(lessons_completed / total_lessons) * 100 AS avgCompletion FROM student_progress')
    avg_completion = round(cursor.fetchone()['avgCompletion'] or 0)

    feedback_count = 0  # No feedback table

    cursor.close()
    conn.close()
    return {
        "totalStudents": total_students,
        "activeModules": active_modules,
        "avgCompletion": avg_completion,
        "feedbackCount": feedback_count
    }

@router.get('/instructor/students')
def list_students(request: Request):
    """Return a simple list of approved students for selection in assignments UI."""
    # Enforce instructor role
    try:
        require_role(request, 'instructor')
    except HTTPException as e:
        # For now, allow if token missing to not break dev, but prefer secured
        if e.status_code not in (401, 403):
            raise
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            ensure_users_table(cursor)
            cursor.execute("SELECT id, name, email FROM users WHERE userType='student' AND status='approved' ORDER BY name ASC")
            items = cursor.fetchall()
            return items or []
        finally:
            cursor.close(); conn.close()
    except Exception as e:
        # If DB is unavailable or any unexpected error occurs, log and return empty list
        print(f"[ERROR] list_students connection/query failure: {e}")
        return []

# -------------------- Feedback Endpoints --------------------

@router.post('/instructor/feedback')
def create_feedback(request: Request, req: FeedbackCreate):
    """Create feedback from instructor to student and notify the student.
    Adds input validation and clearer error reporting to help diagnose 500s.
    """
    # Auth (tolerant in dev like other endpoints, but prefer secured)
    try:
        require_role(request, 'instructor')
    except HTTPException as e:
        if e.status_code not in (401, 403):
            raise

    # Validate inputs early
    try:
        instr_id = int(req.instructor_id)
        stud_id = int(req.student_id)
    except Exception:
        raise HTTPException(status_code=400, detail='instructor_id and student_id must be integers')
    if instr_id <= 0 or stud_id <= 0:
        raise HTTPException(status_code=400, detail='Invalid instructor_id or student_id')
    msg = (req.message or '').strip()
    if not msg:
        raise HTTPException(status_code=400, detail='Message is required')

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ensure_feedback_table(cursor)
        cursor.execute(
            '''
            INSERT INTO feedback (instructor_id, student_id, submission_id, assignment_id, message)
            VALUES (%s, %s, %s, %s, %s)
            ''', (instr_id, stud_id, req.submission_id, req.assignment_id, msg)
        )
        feedback_id = cursor.lastrowid

        # Create a notification for the student
        try:
            ensure_notifications_table(cursor)
            cursor.execute(
                'INSERT INTO notifications (recipient_id, recipient_role, message, type) VALUES (%s, %s, %s, %s)',
                (stud_id, 'student', 'New feedback from instructor', 'info')
            )
        except Exception as ne:
            print(f"[WARN] Could not insert notification: {ne}")

        conn.commit()
        return {"status": "success", "id": int(feedback_id)}
    except HTTPException:
        # Pass through explicit HTTP errors
        conn.rollback()
        raise
    except Exception as e:
        # Log and surface limited diagnostic info for easier debugging
        import traceback
        traceback.print_exc()
        print(f"[ERROR] create_feedback: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f'Failed to create feedback: {str(e)}')
    finally:
        cursor.close(); conn.close()

@router.get('/instructor/notifications')
def instructor_notifications():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        ensure_notifications_table(cursor)
        # Return unread notifications targeted at instructors (broadcast if recipient_id is NULL)
        cursor.execute(
            '''
            SELECT id, message, time, type, `read`
            FROM notifications
            WHERE (recipient_role = 'instructor' AND (recipient_id IS NULL OR recipient_id > 0))
              AND `read` = 0
            ORDER BY time DESC
            LIMIT 10
            '''
        )
        notifications = cursor.fetchall()
        return notifications if notifications else []
    except Exception as e:
        print(f"[ERROR] Failed to fetch notifications: {e}")
        return []
    finally:
        cursor.close(); conn.close()

@router.get('/instructor/notifications/count')
def instructor_notifications_count():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ensure_notifications_table(cursor)
        cursor.execute(
            '''
            SELECT COUNT(*) FROM notifications
            WHERE (recipient_role = 'instructor' AND (recipient_id IS NULL OR recipient_id > 0))
              AND `read` = 0
            '''
        )
        row = cursor.fetchone()
        return {"count": int(row[0]) if row else 0}
    except Exception as e:
        print(f"[ERROR] Failed to count notifications: {e}")
        return {"count": 0}
    finally:
        cursor.close(); conn.close()

@router.patch('/instructor/notifications/{notification_id}/read')
def instructor_mark_notification_read(notification_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ensure_notifications_table(cursor)
        cursor.execute(
            '''
            UPDATE notifications SET `read`=1
            WHERE id=%s AND (recipient_role='instructor' OR recipient_role IS NULL) AND `read`=0
            ''', (notification_id,)
        )
        conn.commit()
        if cursor.rowcount == 0:
            return {"status": "noop"}
        return {"status": "success"}
    except Exception as e:
        print(f"[ERROR] Failed to mark instructor notification read: {e}")
        raise HTTPException(status_code=500, detail='Failed to mark notification as read')
    finally:
        cursor.close(); conn.close()

@router.get('/instructor/feedback-trend')
def instructor_feedback_trend():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT WEEK(created_at) as week, COUNT(*) as count
            FROM feedback
            WHERE YEAR(created_at) = YEAR(CURDATE())
            GROUP BY week
            ORDER BY week DESC
            LIMIT 4
        ''')
        trend = [row[1] for row in cursor.fetchall()]
        cursor.close()
        conn.close()
        return trend[::-1] if trend else [0, 0, 0, 0]  # reverse to get chronological order
    except Exception as e:
        print(f"[ERROR] Failed to fetch feedback trend: {e}")
        cursor.close()
        conn.close()
        return [0, 0, 0, 0]

@router.get('/instructor/assessment-trend')
def instructor_assessment_trend():
    """Return recent weekly average quiz scores (0-100). Uses student_module_quiz table.
    We compute up to the last 8 ISO weeks with data; gaps are not filled to keep payload small.
    Frontend will display chronologically.
    """
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT YEARWEEK(attempted_at, 1) AS yw,
                   ROUND(AVG(score / NULLIF(total,0) * 100), 2) AS avg_pct
            FROM student_module_quiz
            WHERE attempted_at >= DATE_SUB(CURDATE(), INTERVAL 12 WEEK)
              AND total > 0
            GROUP BY yw
            ORDER BY yw DESC
            LIMIT 8
        ''')
        rows = cursor.fetchall() or []
        values = [float(r[1]) if r[1] is not None else 0.0 for r in rows]
        return values[::-1]  # chronological
    except Exception as e:
        print(f"[ERROR] instructor_assessment_trend: {e}")
        return []
    finally:
        cursor.close(); conn.close()

@router.get('/instructor/recent-activity')
def instructor_recent_activity():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute('SELECT id, activity, time FROM recent_activity ORDER BY time DESC LIMIT 10')
        activities = cursor.fetchall()
        cursor.close()
        conn.close()
        return activities if activities else []
    except Exception as e:
        print(f"[ERROR] Failed to fetch recent activity: {e}")
        cursor.close()
        conn.close()
        return []

@router.get('/instructor/submissions')
def list_submissions():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    # Best-effort ensure simulation_sessions exists for subqueries
    try:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS simulation_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT NOT NULL,
                student_name VARCHAR(255) NULL,
                role ENUM('attacker','defender') NOT NULL,
                score INT DEFAULT 0,
                lobby_code VARCHAR(64) NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_student_role_time (student_id, role, created_at),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """
        )
    except Exception:
        pass
    try:
        cursor.execute('''
            SELECT s.id,
                   s.student_id as studentId,
                   s.student_name as studentName,
                   s.module_slug as moduleSlug,
                   s.module_title as moduleTitle,
                   s.submission_type as submissionType,
                   s.totals_rule_count as ruleCount,
                   s.totals_total_matches as totalMatches,
                   s.created_at as createdAt,
                   (
                     SELECT ss.score FROM simulation_sessions ss
                     WHERE ss.student_id = s.student_id AND ss.role = 'attacker'
                     ORDER BY ss.created_at DESC
                     LIMIT 1
                   ) AS attackerScore,
                   (
                     SELECT ss.score FROM simulation_sessions ss
                     WHERE ss.student_id = s.student_id AND ss.role = 'defender'
                     ORDER BY ss.created_at DESC
                     LIMIT 1
                   ) AS defenderScore
            FROM submissions s
            ORDER BY s.created_at DESC
            LIMIT 200
        ''')
        rows = cursor.fetchall()
        cursor.close(); conn.close()
        return rows or []
    except Exception as e:
        print(f"[ERROR] list_submissions: {e}")
        cursor.close(); conn.close()
        raise HTTPException(status_code=500, detail='Failed to fetch submissions')

@router.get('/instructor/students-summary', response_model=List[StudentSummary])
def get_students_summary():
    """Get aggregated student progress data for instructor view"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        ensure_users_table(cursor)
        # Get all students with their aggregated progress
        cursor.execute('''
            SELECT 
                u.id,
                u.name,
                u.email,
                COALESCE(
                    ROUND(AVG(CASE WHEN sp.total_lessons > 0 THEN sp.lessons_completed / sp.total_lessons * 100 ELSE 0 END)), 0
                ) as progress,
                COUNT(CASE WHEN sp.lessons_completed = sp.total_lessons AND sp.total_lessons > 0 THEN 1 END) as completedModules,
                COUNT(sp.module_name) as totalModules,
                MAX(sp.updated_at) as lastActive,
                MAX(s.created_at) as lastSubmission
            FROM users u
            LEFT JOIN student_progress sp ON u.id = sp.student_id
            LEFT JOIN submissions s ON u.id = s.student_id
            WHERE u.userType = 'student' AND u.status = 'approved'
            GROUP BY u.id, u.name, u.email
            ORDER BY u.name ASC
        ''')
        
        students = cursor.fetchall()
        
        # Format the response
        student_summaries = []
        for student in students:
            # Format last active date
            last_active = "Never"
            if student['lastActive']:
                try:
                    if isinstance(student['lastActive'], str):
                        # Handle string datetime
                        from datetime import datetime
                        date_obj = datetime.fromisoformat(student['lastActive'].replace('Z', '+00:00'))
                    else:
                        # Handle datetime object
                        date_obj = student['lastActive']
                    
                    # Format to readable date
                    last_active = date_obj.strftime('%Y-%m-%d')
                except Exception as e:
                    print(f"[DEBUG] Error formatting date: {e}")
                    last_active = str(student['lastActive'])[:10] if student['lastActive'] else "Never"
            
            # Create details string based on progress
            total_modules = int(student['totalModules'])
            completed_modules = int(student['completedModules'])
            progress = int(student['progress'])
            
            if total_modules == 0:
                details = "New student - no modules started yet."
            elif progress >= 80:
                details = f"Excellent progress with {completed_modules} completed modules out of {total_modules}."
            elif progress >= 50:
                details = f"Good progress with {completed_modules} completed modules out of {total_modules}."
            else:
                details = f"Student needs encouragement - {completed_modules} completed modules out of {total_modules}."
            
            student_summaries.append({
                "id": student['id'],
                "name": student['name'],
                "email": student['email'],
                "progress": progress,
                "completedModules": completed_modules,
                "totalModules": total_modules,
                "lastActive": last_active,
                "details": details
            })
        
        return student_summaries
        
    except Exception as e:
        print(f"[ERROR] Failed to fetch student summaries: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail='Failed to fetch student data')
    finally:
        cursor.close()
        conn.close()

@router.delete('/instructor/notifications/{notification_id}')
def delete_notification(notification_id: int):
    """Delete a specific notification"""
    print(f"[DEBUG] Received request to delete notification with ID: {notification_id}")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ensure_notifications_table(cursor)
        cursor.execute('DELETE FROM notifications WHERE id = %s', (notification_id,))
        conn.commit()
        
        if cursor.rowcount == 0:
            print(f"[DEBUG] Notification with ID {notification_id} not found")
            raise HTTPException(status_code=404, detail='Notification not found')
        
        print(f"[DEBUG] Notification with ID {notification_id} deleted successfully")
        return {"message": "Notification deleted successfully"}
    except Exception as e:
        print(f"[ERROR] Failed to delete notification: {e}")
        raise HTTPException(status_code=500, detail='Failed to delete notification')
    finally:
        cursor.close()
        conn.close()

@router.post('/instructor/notifications/mark-all-read')
def mark_all_notifications_read():
    """Mark all notifications as read (delete them for simplicity)"""
    print(f"[DEBUG] Received request to mark all notifications as read")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ensure_notifications_table(cursor)
        cursor.execute("UPDATE notifications SET `read` = 1 WHERE recipient_role = 'instructor' OR recipient_role IS NULL")
        conn.commit()
        updated = cursor.rowcount
        print(f"[DEBUG] Marked {updated} instructor notifications as read")
        return {"message": f"Marked {updated} notifications as read"}
    except Exception as e:
        print(f"[ERROR] Failed to mark notifications as read: {e}")
        raise HTTPException(status_code=500, detail='Failed to mark notifications as read')
    finally:
        cursor.close()
        conn.close()

class NotificationRequest(BaseModel):
    message: str
    notification_type: str = 'info'

@router.post('/instructor/notifications/create')
def create_notification(req: NotificationRequest):
    """Create a new notification"""
    print(f"[DEBUG] Creating notification: {req.message}, type: {req.notification_type}")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ensure_notifications_table(cursor)
        cursor.execute(
            'INSERT INTO notifications (recipient_role, message, type) VALUES (%s, %s, %s)', 
            ('instructor', req.message, req.notification_type)
        )
        conn.commit()
        notification_id = cursor.lastrowid
        
        print(f"[DEBUG] Notification created with ID: {notification_id}")
        return {"message": "Notification created successfully", "id": notification_id}
    except Exception as e:
        print(f"[ERROR] Failed to create notification: {e}")
        raise HTTPException(status_code=500, detail='Failed to create notification')
    finally:
        cursor.close()
        conn.close()

# -------------------- Module Requests --------------------

class ModuleRequestCreate(BaseModel):
    instructor_id: int
    module_name: str
    category: str
    details: Optional[str] = None
    content: Optional[Dict[str, Any]] = None  # full module content/payload

# Accept any category (frontend controlled); could later restrict if needed
ALLOWED_MODULE_REQUEST_CATEGORIES: Optional[set] = None

def ensure_module_requests_table(cursor):
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
    # Backfill/migration safety: ensure content_json exists
    try:
        cursor.execute("SHOW COLUMNS FROM module_requests LIKE 'content_json'")
        if cursor.fetchone() is None:
            cursor.execute("ALTER TABLE module_requests ADD COLUMN content_json LONGTEXT NULL")
    except Exception as me:
        print(f"[WARN] Could not ensure content_json column: {me}")

@router.post('/instructor/module-request')
def create_module_request(request: Request, req: ModuleRequestCreate):
    """Create a module request (instructor -> admin)."""
    try:
        require_role(request, 'instructor')
    except HTTPException as e:
        # Allow creation even if token missing? No – enforce role except 401/403 bypass pattern used elsewhere
        if e.status_code not in (401, 403):
            raise
    # Normalize category (lower snake-case-ish)
    cat = (req.category or '').strip()
    if not cat:
        raise HTTPException(status_code=400, detail='category required')
    cat_norm = cat.lower().replace(' ', '_')[:100]
    if not req.module_name.strip():
        raise HTTPException(status_code=400, detail='module_name required')
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ensure_module_requests_table(cursor)
        payload_json = None
        if req.content is not None:
            try:
                payload_json = json.dumps(req.content, ensure_ascii=False)
            except Exception as je:
                print(f"[WARN] Failed serializing module content: {je}")
        cursor.execute(
            'INSERT INTO module_requests (instructor_id, module_name, category, details, content_json) VALUES (%s, %s, %s, %s, %s)',
            (req.instructor_id, req.module_name.strip(), cat_norm, (req.details or '').strip() or None, payload_json)
        )
        conn.commit()
        new_id = cursor.lastrowid
        # (Optional) Create an admin notification if admin notifications are supported.
        try:
            ensure_notifications_table(cursor)
            msg = f"Module request: {req.category} - {req.module_name}"
            cursor.execute(
                'INSERT INTO notifications (recipient_role, message, type) VALUES (%s, %s, %s)',
                ('admin', msg, 'info')  # notify admins now that admin workflow exists
            )
            conn.commit()
        except Exception as ne:
            print(f"[WARN] Could not create notification for module request {new_id}: {ne}")
        return {"status": "success", "id": new_id}
    except HTTPException:
        conn.rollback(); raise
    except Exception as e:
        print(f"[ERROR] create_module_request: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail='Failed to create module request')
    finally:
        cursor.close(); conn.close()

@router.get('/instructor/module-requests')
def list_instructor_module_requests(request: Request, status: Optional[str] = None, module_name: Optional[str] = None):
    """List module requests for the authenticated instructor. Optional status/module_name filters."""
    from auth import require_role
    payload = require_role(request, 'instructor')
    instructor_id = int(payload.get('sub')) if payload.get('sub') else payload.get('id') or payload.get('instructor_id')
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    try:
        ensure_module_requests_table(cursor)
        clauses = ['instructor_id=%s']
        params: list = [instructor_id]
        if status:
            clauses.append('status=%s'); params.append(status)
        if module_name:
            clauses.append('module_name=%s'); params.append(module_name)
        where_sql = ' AND '.join(clauses)
        cursor.execute(f"SELECT id, module_name, category, details, status, created_at, admin_comment, decided_at FROM module_requests WHERE {where_sql} ORDER BY created_at DESC", tuple(params))
        rows = cursor.fetchall()
        return rows
    finally:
        cursor.close(); conn.close()

# -------------------- Assignments CRUD --------------------

@router.get('/instructor/assignments')
def get_assignments(request: Request, instructor_id: Optional[int] = None):
    """List assignments, optionally filtered by instructor_id."""
    try:
        require_role(request, 'instructor')
    except HTTPException as e:
        if e.status_code not in (401, 403):
            raise
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        ensure_assignments_table(cursor)
        if instructor_id:
            cursor.execute(
                '''
                SELECT a.id, a.instructor_id as instructorId, a.student_id as studentId,
                       a.module_name as moduleName, a.module_slug as moduleSlug,
                       a.due_date as dueDate, a.status, a.notes, a.created_at as createdAt,
                       u.name as studentName, u.email as studentEmail
                FROM assignments a
                LEFT JOIN users u ON u.id = a.student_id
                WHERE a.instructor_id = %s
                ORDER BY a.created_at DESC
                ''', (instructor_id,)
            )
        else:
            cursor.execute(
                '''
                SELECT a.id, a.instructor_id as instructorId, a.student_id as studentId,
                       a.module_name as moduleName, a.module_slug as moduleSlug,
                       a.due_date as dueDate, a.status, a.notes, a.created_at as createdAt,
                       u.name as studentName, u.email as studentEmail
                FROM assignments a
                LEFT JOIN users u ON u.id = a.student_id
                ORDER BY a.created_at DESC
                '''
            )
        rows = cursor.fetchall() or []
        # Normalize status and compute overdue
        from datetime import datetime, timezone
        now = datetime.utcnow()
        for r in rows:
            r['status'] = _normalize_assignment_status(r.get('status'))
            # Compute overdue if dueDate passed and not completed
            try:
                due = r.get('dueDate')
                if due and r['status'] != 'completed':
                    if isinstance(due, str):
                        try:
                            due_dt = datetime.fromisoformat(due.replace('Z', '+00:00').replace(' ', 'T'))
                        except Exception:
                            due_dt = None
                    else:
                        due_dt = due
                    # Normalize to UTC-naive for safe comparison
                    if due_dt and getattr(due_dt, 'tzinfo', None) is not None:
                        try:
                            due_dt = due_dt.astimezone(timezone.utc).replace(tzinfo=None)
                        except Exception:
                            due_dt = due_dt.replace(tzinfo=None)
                    if due_dt and due_dt < now:
                        r['status'] = 'overdue'
            except Exception:
                pass
        return rows
    except Exception as e:
        print(f"[ERROR] get_assignments: {e}")
        raise HTTPException(status_code=500, detail='Failed to fetch assignments')
    finally:
        cursor.close(); conn.close()

@router.post('/instructor/assignments')
def create_assignments(request: Request, req: AssignmentCreate):
    """Create assignments for one module to multiple students in a single call."""
    try:
        require_role(request, 'instructor')
    except HTTPException as e:
        if e.status_code not in (401, 403):
            raise
    if not req.student_ids:
        raise HTTPException(status_code=400, detail='student_ids is required')
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ensure_assignments_table(cursor)
        created = 0
        due_str = _normalize_datetime_str(req.due_date)
        for sid in req.student_ids:
            cursor.execute(
                '''
                INSERT INTO assignments (instructor_id, student_id, module_name, module_slug, due_date, status, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ''',
                (
                    req.instructor_id,
                    sid,
                    req.module_name,
                    req.module_slug,
                    due_str,
                    _normalize_assignment_status('assigned'),
                    req.notes
                )
            )
            created += 1
            # Create a notification for the student about the new assignment
            try:
                ensure_notifications_table(cursor)
                msg = f"New assignment: {req.module_name}"
                if due_str:
                    msg += f" due {due_str}"
                cursor.execute(
                    'INSERT INTO notifications (recipient_id, recipient_role, message, type) VALUES (%s, %s, %s, %s)',
                    (sid, 'student', msg, 'info')
                )
            except Exception as ne:
                print(f"[WARN] Could not create student assignment notification: {ne}")
        conn.commit()
        return {"status": "success", "created": created}
    except Exception as e:
        print(f"[ERROR] create_assignments: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail='Failed to create assignments')
    finally:
        cursor.close(); conn.close()

@router.put('/instructor/assignments/{assignment_id}')
def update_assignment(request: Request, assignment_id: int, req: AssignmentUpdate):
    """Update fields of an assignment."""
    try:
        require_role(request, 'instructor')
    except HTTPException as e:
        if e.status_code not in (401, 403):
            raise
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ensure_assignments_table(cursor)
        # Build dynamic update
        fields: List[str] = []
        values: List[Any] = []
        mapping: Dict[str, str] = {
            'module_name': 'module_name',
            'module_slug': 'module_slug',
            'due_date': 'due_date',
            'status': 'status',
            'notes': 'notes'
        }
        for key, col in mapping.items():
            val = getattr(req, key, None)
            if val is not None:
                if key == 'due_date':
                    val = _normalize_datetime_str(val)
                if key == 'status':
                    val = _normalize_assignment_status(val)
                fields.append(f"{col}=%s")
                values.append(val)
        if not fields:
            return {"status": "noop"}
        values.append(assignment_id)
        sql = f"UPDATE assignments SET {', '.join(fields)} WHERE id=%s"
        cursor.execute(sql, tuple(values))
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        print(f"[ERROR] update_assignment: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail='Failed to update assignment')
    finally:
        cursor.close(); conn.close()

@router.post('/instructor/assignments/deadline-sweep')
def assignments_deadline_sweep():
    """Simple sweep to notify due-soon/overdue status. Intended for cron-style triggering."""
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    try:
        ensure_assignments_table(cursor); ensure_notifications_table(cursor)
        cursor.execute('SELECT a.id, a.instructor_id, a.student_id, a.module_name, a.due_date FROM assignments a ORDER BY a.due_date ASC')
        rows = cursor.fetchall() or []
        from datetime import datetime, timedelta
        now = datetime.utcnow()
        soon = now + timedelta(days=2)
        updated = 0
        for r in rows:
            due = r.get('due_date')
            if not due:
                continue
            try:
                due_dt = due if isinstance(due, datetime) else datetime.fromisoformat(str(due).replace('Z',''))
            except Exception:
                continue
            mod = r.get('module_name') or 'Module'
            # Overdue
            if due_dt < now:
                _notify_once(cursor, 'instructor', r['instructor_id'], f"Assignment overdue: {mod} → student {r['student_id']}", 'warning'); updated += 1
                _notify_once(cursor, 'student', r['student_id'], f"Assignment overdue: {mod}", 'warning'); updated += 1
                continue
            # Due soon (within 2 days)
            if now <= due_dt <= soon:
                _notify_once(cursor, 'instructor', r['instructor_id'], f"Assignment due soon (2d): {mod} → student {r['student_id']}", 'info'); updated += 1
                _notify_once(cursor, 'student', r['student_id'], f"Assignment due soon: {mod}", 'info'); updated += 1
        conn.commit()
        return {'status':'ok','emitted': updated}
    except Exception as e:
        print(f"[ERROR] assignments_deadline_sweep: {e}")
        raise HTTPException(status_code=500, detail='deadline sweep failed')
    finally:
        cursor.close(); conn.close()

@router.delete('/instructor/assignments/{assignment_id}')
def delete_assignment(request: Request, assignment_id: int):
    try:
        require_role(request, 'instructor')
    except HTTPException as e:
        if e.status_code not in (401, 403):
            raise
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ensure_assignments_table(cursor)
        cursor.execute('DELETE FROM assignments WHERE id=%s', (assignment_id,))
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail='Assignment not found')
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] delete_assignment: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail='Failed to delete assignment')
    finally:
        cursor.close(); conn.close()