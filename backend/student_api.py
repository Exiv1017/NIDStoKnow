from fastapi import APIRouter, HTTPException, Body, Request, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import mysql.connector
from werkzeug.security import generate_password_hash, check_password_hash
from auth import create_access_token, require_role
# Added for unified RBAC + optional auditing
from auth import rbac_required

# DB/config and stdlib imports
from config import MYSQL_CONFIG, get_db_connection, DEV_MODE
import os
import uuid

# FastAPI router for this module
router = APIRouter()

# Simple audit logger stub; can be replaced by a more robust implementation injected elsewhere.
def _audit_log(payload, action, ctx):
    try:
        print(f"[AUDIT] actor_role={payload.get('role')} actor_id={payload.get('sub')} action={action} ctx={ctx}")
    except Exception:
        pass

def ensure_notifications_table(cursor):
    """Create notifications table if it doesn't exist yet. Mirrors instructor_api schema."""
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

def _get_student_name_by_id(cursor, student_id: int) -> str:
    """Resolve a student's display name from users table. Fallback to 'Student {id}'."""
    try:
        ensure_users_table_and_migrate_password_hash(cursor)
        cursor.execute('SELECT name FROM users WHERE id=%s', (student_id,))
        row = cursor.fetchone()
        if row and row[0]:
            return str(row[0])
    except Exception:
        pass
    return f"Student {student_id}"

def ensure_base_progress_tables(cursor):
        """Create core progress tables if they don't exist yet.
        Safe to call on every request path that touches student progress.
        """
        try:
                # student_progress
                cursor.execute(
                        '''
                        CREATE TABLE IF NOT EXISTS student_progress (
                            id INT NOT NULL AUTO_INCREMENT,
                            student_id INT NOT NULL,
                            student_name VARCHAR(255) DEFAULT NULL,
                            module_name VARCHAR(255) DEFAULT NULL,
                            lessons_completed INT DEFAULT 0,
                            total_lessons INT DEFAULT 0,
                            last_lesson VARCHAR(255) DEFAULT '',
                            time_spent INT DEFAULT 0,
                            engagement_score INT DEFAULT 0,
                            updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                            PRIMARY KEY (id),
                            UNIQUE KEY unique_student_module (student_id, module_name)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
                        '''
                )
                # student_lesson_progress
                cursor.execute(
                        '''
                        CREATE TABLE IF NOT EXISTS student_lesson_progress (
                            id INT NOT NULL AUTO_INCREMENT,
                            student_id INT NOT NULL,
                            module_name VARCHAR(255) NOT NULL,
                            lesson_id VARCHAR(255) NOT NULL,
                            completed TINYINT(1) DEFAULT 1,
                            completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE KEY unique_student_module_lesson (student_id, module_name, lesson_id),
                            PRIMARY KEY (id)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
                        '''
                )
                # student_module_quiz
                cursor.execute(
                        '''
                        CREATE TABLE IF NOT EXISTS student_module_quiz (
                            student_id INT NOT NULL,
                            module_name VARCHAR(255) NOT NULL,
                            passed TINYINT(1) NOT NULL DEFAULT 0,
                            score INT DEFAULT 0,
                            total INT DEFAULT 0,
                            attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                            PRIMARY KEY (student_id, module_name)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
                        '''
                )
                # unit events table (newer schema variant used by runtime)
                ensure_unit_events_table(cursor)
        except Exception as e:
                print(f"[WARN] ensure_base_progress_tables failed (will continue): {e}")

def ensure_users_table_and_migrate_password_hash(cursor):
    """Ensure users table exists and password_hash column can hold long hashes (TEXT).
    On older schemas, this may have been VARCHAR(255); upgrade it in-place if needed.
    """
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        '''
    )
    try:
        cursor.execute("SHOW COLUMNS FROM users LIKE 'password_hash'")
        row = cursor.fetchone()
        if row:
            # Row format: Field, Type, Null, Key, Default, Extra
            col_type = str(row[1]).lower()
            if 'varchar' in col_type:
                cursor.execute('ALTER TABLE users MODIFY COLUMN password_hash TEXT NOT NULL')
    except Exception as e:
        print(f"[WARN] users.password_hash migrate failed or unnecessary: {e}")


def ensure_student_profiles_table(cursor):
    """Ensure student_profiles exists to store join_date and avatar_url per student."""
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS student_profiles (
            student_id INT NOT NULL,
            join_date DATE NULL,
            avatar_url VARCHAR(512) NULL,
            updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (student_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        '''
    )


def ensure_student_settings_table(cursor):
    """Ensure student_settings exists; stores notifications as JSON text for portability."""
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS student_settings (
            student_id INT NOT NULL,
            notifications_text LONGTEXT NULL,
            updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (student_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        '''
    )

def _find_instructor_ids_for_student_module(cursor, student_id: int, module_slug: str, module_name_raw: str) -> List[int]:
    """Return instructor_ids who assigned this module to the student, if any."""
    try:
        cursor.execute(
            """
            SELECT DISTINCT instructor_id FROM assignments
            WHERE student_id=%s AND (
              LOWER(COALESCE(module_slug,'')) = LOWER(%s) OR LOWER(COALESCE(module_name,'')) = LOWER(%s)
            )
            """,
            (student_id, module_slug, (module_name_raw or '').strip().lower())
        )
        rows = cursor.fetchall() or []
        return [int(r[0]) for r in rows if r and r[0] is not None]
    except Exception:
        return []

def _normalize_assignment_status(val: Optional[str]) -> str:
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
    return 'assigned'

# Removed in-memory demo constants for student profile/dashboard/notifications to prevent stale hardcoded data.

class StudentProfile(BaseModel):
    name: str
    email: str
    studentId: str
    department: str
    joinDate: str
    completedModules: int
    currentProgress: str
    currentGrade: str
    avatar: Optional[str] = None

class StudentSettings(BaseModel):
    notifications: dict

class Notification(BaseModel):
    id: int
    message: str
    time: str

# Minimal payload for updating a student's own profile
class StudentProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    joinDate: Optional[str] = None
    avatar: Optional[str] = None
    type: str
    read: bool

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
    email: str

class StudentSignupRequest(BaseModel):
    name: str
    email: str
    password: str

class StudentLoginRequest(BaseModel):
    email: str
    password: str

class StudentProgressRequest(BaseModel):
    student_id: int
    student_name: str
    module_name: str
    lessons_completed: int
    total_lessons: int
    last_lesson: str
    time_spent: Optional[int] = None
    time_spent_seconds: Optional[int] = None
    engagement_score: Optional[int] = None


class LessonCompletionRequest(BaseModel):
    lesson_id: str
    completed: Optional[bool] = True
    lesson_title: Optional[str] = None
    # When true, only update last_lesson on student_progress; do not change student_lesson_progress
    touch_only: Optional[bool] = False
    # Optional legacy fields to avoid 422 if an older frontend still sends them
    student_id: Optional[int] = None
    module_name: Optional[str] = None

class BulkLessonCompletionRequest(BaseModel):
    lesson_ids: List[str]
    completed: Optional[bool] = True

class SubmissionPayload(BaseModel):
    student_id: int
    student_name: str
    module_slug: str
    module_title: str
    submission_type: str
    payload: Dict
    totals_rule_count: int = 0
    totals_total_matches: int = 0

@router.post('/student/submissions')
def create_submission(sub: SubmissionPayload):
    """Persist a student submission and add a recent_activity entry for instructors."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            '''
            INSERT INTO submissions (student_id, student_name, module_slug, module_title, submission_type, payload, totals_rule_count, totals_total_matches)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ''',
            (
                sub.student_id,
                sub.student_name,
                sub.module_slug,
                sub.module_title,
                sub.submission_type,
                json.dumps(sub.payload),
                sub.totals_rule_count,
                sub.totals_total_matches,
            )
        )
        submission_id = cursor.lastrowid
        # Insert recent activity
        activity = f"{sub.student_name} submitted {sub.submission_type.capitalize()} — {sub.module_title}"
        cursor.execute('INSERT INTO recent_activity (activity) VALUES (%s)', (activity,))
        conn.commit()
        cursor.close(); conn.close()
        return {"status": "success", "id": int(submission_id)}
    except Exception as e:
        print(f"[ERROR] create_submission: {e}")
        try:
            cursor.close(); conn.close()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail='Failed to save submission')

@router.get("/student/profile", response_model=StudentProfile)
def get_profile(request: Request):
    try:
        payload = require_role(request, 'student')
        student_id = int(payload.get('sub')) if payload and payload.get('sub') else None
    except HTTPException as e:
        if DEV_MODE and e.status_code in (401, 403):
            # Minimal safe default for dev only
            return StudentProfile(
                name="",
                email="",
                studentId="",
                department="",
                joinDate="",
                completedModules=0,
                currentProgress="0%",
                currentGrade="",
                avatar=None
            )
        raise
    if not student_id:
        raise HTTPException(status_code=401, detail='Unauthorized')
    # Map identity from users and enrich with student_profiles (joinDate, avatar)
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    try:
        ensure_student_profiles_table(cursor)
        cursor.execute('SELECT name, email FROM users WHERE id=%s', (student_id,))
        base = cursor.fetchone() or {}
        cursor.execute('SELECT join_date, avatar_url FROM student_profiles WHERE student_id=%s', (student_id,))
        prof = cursor.fetchone() or {}
        jd = prof.get('join_date')
        jd_str = ''
        if jd:
            try:
                jd_str = jd.strftime('%Y-%m-%d')
            except Exception:
                jd_str = str(jd)
        # Normalize avatar to absolute URL if it's stored as a relative path
        avatar_url = prof.get('avatar_url')
        if isinstance(avatar_url, str) and avatar_url.startswith('/'):
            try:
                base_url = str(request.base_url).rstrip('/')
                avatar_url = f"{base_url}{avatar_url}"
            except Exception:
                pass
        return StudentProfile(
            name=base.get('name') or '',
            email=base.get('email') or '',
            studentId=str(student_id),
            department='',
            joinDate=jd_str,
            completedModules=0,
            currentProgress='0%',
            currentGrade='',
            avatar=avatar_url
        )
    finally:
        cursor.close(); conn.close()

@router.put("/student/profile", response_model=StudentProfile)
def update_profile(request: Request, profile: Dict[str, Any] = Body(...)):
    """Persist name,email into users and joinDate,avatar into student_profiles."""
    payload = require_role(request, 'student')
    student_id = int(payload.get('sub')) if payload and payload.get('sub') else None
    if not student_id:
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
            # Fetch current to fill missing
            cursor.execute('SELECT name, email FROM users WHERE id=%s AND userType=%s', (student_id, 'student'))
            current = cursor.fetchone() or {}
            new_name = name_in if name_in is not None else current.get('name')
            new_email = email_in if email_in is not None else current.get('email')
            cursor.execute('UPDATE users SET name=%s, email=%s WHERE id=%s AND userType=%s', (new_name, new_email, student_id, 'student'))
        # profiles table
        ensure_student_profiles_table(cursor)
        # Determine existing join_date to enforce immutability
        cursor.execute('SELECT join_date FROM student_profiles WHERE student_id=%s', (student_id,))
        row = cursor.fetchone()
        existing_jd = row.get('join_date') if row else None
        # Parse incoming joinDate (YYYY-MM-DD preferred) and fallback to today if setting first time and not provided
        parsed_jd = None
        if join_in:
            try:
                s = str(join_in).strip()
                if 'T' in s:
                    s = s.split('T', 1)[0]
                # Try ISO first
                def _to_iso(dstr: str) -> Optional[str]:
                    for fmt in ('%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y'):
                        try:
                            return datetime.strptime(dstr, fmt).date().isoformat()
                        except Exception:
                            continue
                    # as-is, hope DB can coerce
                    if dstr and len(dstr) >= 8:
                        return dstr
                    return None
                parsed_jd = _to_iso(s) if s else None
            except Exception:
                parsed_jd = None
        if not existing_jd and not parsed_jd:
            parsed_jd = date.today().isoformat()
        # Effective join_date (immutable once set)
        effective_jd = existing_jd or parsed_jd
        # Upsert using INSERT ... ON DUPLICATE KEY UPDATE; join_date only set if NULL
        cursor2 = conn.cursor()
        avatar_val = avatar_in.strip() if isinstance(avatar_in, str) else avatar_in
        if isinstance(avatar_val, str) and len(avatar_val) > 512:
            avatar_val = avatar_val[:512]
        cursor2.execute(
            'INSERT INTO student_profiles (student_id, join_date, avatar_url) VALUES (%s, %s, %s) '
            'ON DUPLICATE KEY UPDATE join_date=COALESCE(join_date, VALUES(join_date)), avatar_url=VALUES(avatar_url)',
            (student_id, effective_jd, avatar_val)
        )
        conn.commit(); cursor2.close()
    finally:
        cursor.close(); conn.close()
    # Return the fresh, full profile
    conn2 = get_db_connection(); cur2 = conn2.cursor(dictionary=True)
    try:
        cur2.execute('SELECT name, email FROM users WHERE id=%s', (student_id,))
        base = cur2.fetchone() or {}
        cur2.execute('SELECT join_date, avatar_url FROM student_profiles WHERE student_id=%s', (student_id,))
        prof = cur2.fetchone() or {}
        jd = prof.get('join_date')
        jd_str = ''
        if jd:
            try:
                jd_str = jd.strftime('%Y-%m-%d')
            except Exception:
                jd_str = str(jd)
        # Normalize avatar to absolute URL if relative
        avatar_url = prof.get('avatar_url')
        if isinstance(avatar_url, str) and avatar_url.startswith('/'):
            try:
                base_url = str(request.base_url).rstrip('/')
                avatar_url = f"{base_url}{avatar_url}"
            except Exception:
                pass
        return StudentProfile(
            name=base.get('name') or '',
            email=base.get('email') or '',
            studentId=str(student_id),
            department='',
            joinDate=jd_str,
            completedModules=0,
            currentProgress='0%',
            currentGrade='',
            avatar=avatar_url
        )
    finally:
        cur2.close(); conn2.close()

@router.get("/student/settings", response_model=StudentSettings)
def get_settings(request: Request):
    try:
        require_role(request, 'student')
    except HTTPException as e:
        if DEV_MODE and e.status_code in (401, 403):
            return StudentSettings(notifications={"email": True, "browser": True, "moduleUpdates": True, "assessmentResults": True})
        raise
    # Load per-student settings from DB
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    try:
        ensure_student_settings_table(cursor)
        payload = require_role(request, 'student')
        student_id = int(payload.get('sub')) if payload and payload.get('sub') else None
        if not student_id:
            raise HTTPException(status_code=401, detail='Unauthorized')
        cursor.execute('SELECT notifications_text FROM student_settings WHERE student_id=%s', (student_id,))
        row = cursor.fetchone()
        if not row or not row.get('notifications_text'):
            return StudentSettings(notifications={"email": True, "browser": True, "moduleUpdates": True, "assessmentResults": True})
        try:
            data = json.loads(row['notifications_text'])
            if not isinstance(data, dict):
                data = {}
        except Exception:
            data = {}
        # Defaults overlay
        defaults = {"email": True, "browser": True, "moduleUpdates": True, "assessmentResults": True}
        defaults.update(data)
        return StudentSettings(notifications=defaults)
    finally:
        cursor.close(); conn.close()

@router.put("/student/settings", response_model=StudentSettings)
def update_settings(request: Request, settings: StudentSettings):
    payload = require_role(request, 'student')
    student_id = int(payload.get('sub')) if payload and payload.get('sub') else None
    if not student_id:
        raise HTTPException(status_code=401, detail='Unauthorized')
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        ensure_student_settings_table(cursor)
        # Validate JSON serializable dict
        try:
            serialized = json.dumps(settings.notifications or {})
        except Exception:
            serialized = '{}'
        cursor.execute('REPLACE INTO student_settings (student_id, notifications_text) VALUES (%s, %s)', (student_id, serialized))
        conn.commit()
        return settings
    finally:
        cursor.close(); conn.close()

# ---- Avatar Upload (Student) ----
@router.post("/student/profile/avatar")
def upload_student_avatar(request: Request, file: UploadFile = File(...)):
    payload = require_role(request, 'student')
    student_id = int(payload.get('sub')) if payload and payload.get('sub') else None
    if not student_id:
        raise HTTPException(status_code=401, detail='Unauthorized')
    # Validate basic content type
    ct = (file.content_type or '').lower()
    if not any(ct.startswith(x) for x in ("image/",)):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    # Persist file
    base_dir = os.path.dirname(__file__)
    upload_root = os.path.join(base_dir, 'uploads', 'avatars', 'students')
    os.makedirs(upload_root, exist_ok=True)
    ext = os.path.splitext(file.filename or '')[1] or '.png'
    safe_ext = ext if len(ext) <= 6 else '.png'
    fname = f"{student_id}_{uuid.uuid4().hex}{safe_ext}"
    fpath = os.path.join(upload_root, fname)
    data = file.file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max size is 5 MB.")
    with open(fpath, 'wb') as out:
        out.write(data)
    # Build public URL path relative to mounted /uploads
    public_path = f"/uploads/avatars/students/{fname}"
    # Build absolute URL for client convenience
    try:
        base_url = str(request.base_url).rstrip('/')
        public_url = f"{base_url}{public_path}"
    except Exception:
        public_url = public_path
    # Update profile avatar_url
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        ensure_student_profiles_table(cursor)
        cursor.execute(
            'INSERT INTO student_profiles (student_id, avatar_url) VALUES (%s, %s) '
            'ON DUPLICATE KEY UPDATE avatar_url=VALUES(avatar_url)',
            (student_id, public_path)
        )
        conn.commit()
    finally:
        cursor.close(); conn.close()
    return {"url": public_url}

@router.get("/student/notifications", response_model=List[Notification])
def get_notifications(request: Request):
    """Return unread notifications for the authenticated student from DB."""
    # Enforce student role; allow dev fallback similar to other student endpoints
    student_id: Optional[int] = None
    try:
        payload = require_role(request, 'student')
        student_id = int(payload.get('sub')) if payload and payload.get('sub') else None
    except HTTPException as e:
        # If DEV_MODE, allow soft fallback; otherwise, propagate auth error
        if DEV_MODE and e.status_code in (401, 403):
            return []
        raise
    if not student_id:
        if DEV_MODE:
            return []
        raise HTTPException(status_code=401, detail='Unauthorized')
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        ensure_notifications_table(cursor)
        cursor.execute(
            '''
            SELECT id, message, time, type, `read`
            FROM notifications
            WHERE recipient_role = 'student' AND recipient_id = %s AND `read` = 0
            ORDER BY time DESC
            LIMIT 50
            ''', (student_id,)
        )
        rows = cursor.fetchall() or []
        # Convert types as needed for response model
        return [
            {
                'id': int(r['id']),
                'message': r.get('message', ''),
                'time': str(r.get('time') or ''),
                'type': r.get('type') or 'info',
                'read': bool(r.get('read') or 0)
            }
            for r in rows
        ]
    except Exception as e:
        print(f"[ERROR] get_notifications: {e}")
        return []
    finally:
        cursor.close(); conn.close()

@router.post("/student/notifications/mark_all_read")
def mark_all_notifications_read(request: Request):
    """Mark all notifications for the authenticated student as read in DB."""
    try:
        payload = require_role(request, 'student')
        student_id = int(payload.get('sub')) if payload and payload.get('sub') else None
    except HTTPException as e:
        if DEV_MODE and e.status_code in (401, 403):
            return {"status": "skipped"}
        raise
    if not student_id:
        if DEV_MODE:
            return {"status": "skipped"}
        raise HTTPException(status_code=401, detail='Unauthorized')
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ensure_notifications_table(cursor)
        cursor.execute("UPDATE notifications SET `read` = 1 WHERE recipient_role = 'student' AND recipient_id = %s AND `read` = 0", (student_id,))
        conn.commit()
        return {"status": "success", "updated": cursor.rowcount}
    except Exception as e:
        print(f"[ERROR] mark_all_notifications_read (student): {e}")
        raise HTTPException(status_code=500, detail='Failed to mark notifications as read')
    finally:
        cursor.close(); conn.close()

@router.get('/student/notifications/count')
def get_student_notifications_count(request: Request):
    """Return unread notifications count for authenticated student."""
    try:
        payload = require_role(request, 'student')
        student_id = int(payload.get('sub')) if payload and payload.get('sub') else None
    except HTTPException as e:
        if DEV_MODE and e.status_code in (401, 403):
            return {"count": 0}
        raise
    if not student_id:
        if DEV_MODE:
            return {"count": 0}
        raise HTTPException(status_code=401, detail='Unauthorized')
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ensure_notifications_table(cursor)
        cursor.execute("""
            SELECT COUNT(*) FROM notifications
            WHERE recipient_role='student' AND recipient_id=%s AND `read`=0
        """, (student_id,))
        row = cursor.fetchone()
        return {"count": int(row[0]) if row else 0}
    except Exception as e:
        print(f"[ERROR] get_student_notifications_count: {e}")
        return {"count": 0}
    finally:
        cursor.close(); conn.close()

@router.patch('/student/notifications/{notification_id}/read')
def mark_student_notification_read(request: Request, notification_id: int):
    """Mark a single notification as read for the authenticated student (ownership enforced)."""
    try:
        payload = require_role(request, 'student')
        student_id = int(payload.get('sub')) if payload and payload.get('sub') else None
    except HTTPException as e:
        if DEV_MODE and e.status_code in (401, 403):
            return {"status": "skipped"}
        raise
    if not student_id:
        if DEV_MODE:
            return {"status": "skipped"}
        raise HTTPException(status_code=401, detail='Unauthorized')
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ensure_notifications_table(cursor)
        cursor.execute(
            """
            UPDATE notifications
            SET `read`=1
            WHERE id=%s AND recipient_role='student' AND recipient_id=%s AND `read`=0
            """,
            (notification_id, student_id)
        )
        conn.commit()
        if cursor.rowcount == 0:
            return {"status": "noop"}
        return {"status": "success"}
    except Exception as e:
        print(f"[ERROR] mark_student_notification_read: {e}")
        raise HTTPException(status_code=500, detail='Failed to mark notification read')
    finally:
        cursor.close(); conn.close()
@router.get("/student/dashboard")
def get_dashboard(request: Request):
    """Return dynamic dashboard for the authenticated student.

    Reuses the existing DB-backed aggregation from get_real_dashboard(student_id).
    Falls back to empty aggregates if unauthorized in DEV_MODE.
    """
    try:
        payload = require_role(request, 'student')
        student_id = int(payload.get('sub')) if payload and payload.get('sub') else None
    except HTTPException as e:
        if DEV_MODE and e.status_code in (401, 403):
            # In dev, return a minimal empty structure rather than static demo
            return {"modules": [], "assigned_modules": [], "stats": {"total_modules": 0, "completed_modules": 0, "average_progress": 0, "total_time_spent": 0}}
        raise
    if not student_id:
        if DEV_MODE:
            return {"modules": [], "assigned_modules": [], "stats": {"total_modules": 0, "completed_modules": 0, "average_progress": 0, "total_time_spent": 0}}
        raise HTTPException(status_code=401, detail='Unauthorized')
    # Delegate to the DB-backed variant
    return get_real_dashboard(student_id)

@router.get("/student/dashboard/{student_id}")
def get_real_dashboard(student_id: int):
    print(f"[DEBUG] Fetching dashboard for student_id={student_id}")
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Ensure required tables exist to avoid 1146 errors on fresh DBs
        ensure_base_progress_tables(cursor)
        # Get student progress data (ignore blank module names)
        cursor.execute(
            '''
            SELECT module_name, lessons_completed, total_lessons, last_lesson,
                   time_spent, engagement_score, updated_at
            FROM student_progress
            WHERE student_id = %s
              AND module_name IS NOT NULL
              AND TRIM(module_name) <> ''
            ORDER BY updated_at DESC
            ''',
            (student_id,)
        )
        progress_data = cursor.fetchall()
        print(f"[DEBUG] Progress data: {progress_data}")

        # Get student info
        cursor.execute('SELECT name, email FROM users WHERE id = %s', (student_id,))
        student_info = cursor.fetchone()
        print(f"[DEBUG] Student info: {student_info}")

        # Normalize and aggregate module entries so slug + Title Case variants don't duplicate.
        from datetime import datetime

        def _slugify(val: str) -> str:
            if not val:
                return ''
            v = val.strip().lower().replace(' nids', '').replace(' ', '-')
            while '--' in v:
                v = v.replace('--', '-')
            return v

        DISPLAY_TITLES = {
            'signature-based-detection': 'Signature-Based Detection',
            'anomaly-based-detection': 'Anomaly-Based Detection',
            'hybrid-detection': 'Hybrid Detection',
        }

        aggregate = {}
        now = datetime.now()
        for progress in progress_data:
            raw_name = progress.get('module_name') or ''
            slug = _slugify(raw_name)
            if slug not in DISPLAY_TITLES:
                # Ignore unknown modules for now (or could include raw)
                continue
            # Compute percentage
            if progress['total_lessons'] and progress['total_lessons'] > 0:
                pct = int((progress['lessons_completed'] / progress['total_lessons']) * 100)
            else:
                pct = 0
            # Last accessed formatting
            last_accessed = "Never"
            updated = progress.get('updated_at')
            if updated:
                if isinstance(updated, str):
                    try:
                        updated_dt = datetime.fromisoformat(updated.replace('Z', '+00:00'))
                    except Exception:
                        updated_dt = None
                else:
                    updated_dt = updated
                if updated_dt:
                    diff = now - updated_dt
                    if diff.days == 0:
                        last_accessed = "Today"
                    elif diff.days == 1:
                        last_accessed = "1 day ago"
                    else:
                        last_accessed = f"{diff.days} days ago"
            existing = aggregate.get(slug)
            if not existing:
                aggregate[slug] = {
                    "slug": slug,
                    "name": DISPLAY_TITLES[slug],
                    "progress": pct,
                    "lastAccessed": last_accessed,
                    "lessonsCompleted": progress['lessons_completed'],
                    "totalLessons": progress['total_lessons'],
                    "lastLesson": progress['last_lesson'],
                    "timeSpent": progress['time_spent'] or 0,
                    "engagementScore": progress['engagement_score'] or 0,
                }
            else:
                # Merge duplicate variant: take maxima / latest / sums where appropriate
                existing['progress'] = max(existing['progress'], pct)
                existing['lessonsCompleted'] = max(existing['lessonsCompleted'], progress['lessons_completed'])
                existing['totalLessons'] = max(existing['totalLessons'], progress['total_lessons'])
                existing['timeSpent'] += progress['time_spent'] or 0
                existing['engagementScore'] = max(existing['engagementScore'], progress['engagement_score'] or 0)
                # Prefer a more recent lastAccessed if one is Today
                if existing['lastAccessed'] != 'Today' and last_accessed == 'Today':
                    existing['lastAccessed'] = last_accessed
                # Preserve last lesson if currently None
                if not existing.get('lastLesson') and progress.get('last_lesson'):
                    existing['lastLesson'] = progress['last_lesson']

        # Ensure the three core modules always appear once
        for core_slug, display in DISPLAY_TITLES.items():
            if core_slug not in aggregate:
                aggregate[core_slug] = {
                    "slug": core_slug,
                    "name": display,
                    "progress": 0,
                    "lastAccessed": "Never",
                    "lessonsCompleted": 0,
                    "totalLessons": 0,
                    "lastLesson": None,
                    "timeSpent": 0,
                    "engagementScore": 0,
                }

        # Stable ordering
        order = ['signature-based-detection', 'anomaly-based-detection', 'hybrid-detection']
        modules = [aggregate[s] for s in order if s in aggregate]

        print(f"[DEBUG] Modules: {modules}")

        # Calculate overall stats
        total_modules = len(modules) if modules else 3
        completed_modules = len([m for m in modules if m['progress'] == 100])
        average_progress = sum([m['progress'] for m in modules]) / len(modules) if modules else 0
        total_time_spent = sum([m['timeSpent'] for m in modules])

        # Create assigned modules based on progress
        assigned_modules = []
        for module in modules:
            if module['progress'] == 100:
                status = "Completed"
                date_key = "completedDate"
                date_value = "Recently"
            elif module['progress'] > 0:
                status = "In Progress"
                date_key = "startDate"
                date_value = module['lastAccessed']
            else:
                status = "Not Started"
                date_key = "startDate"
                date_value = "Not started"
            assigned_modules.append({
                "name": module['name'],
                date_key: date_value,
                "status": status,
                "progress": module['progress'],
                "lastLesson": module.get('lastLesson', None)
            })

        print(f"[DEBUG] Assigned modules: {assigned_modules}")

        dashboard_data = {
            "studentName": student_info['name'] if student_info else "Student",
            "modules": modules,
            "assignedModules": assigned_modules,
            "stats": {
                "totalModules": total_modules,
                "completedModules": completed_modules,
                "averageProgress": round(average_progress),
                "totalTimeSpent": total_time_spent,
                "engagementScore": round(sum([m['engagementScore'] for m in modules]) / len(modules)) if modules else 0
            }
        }
        print(f"[DEBUG] Dashboard data: {dashboard_data}")
        return dashboard_data
    except Exception as e:
        print(f"[ERROR] Failed to fetch dashboard data: {e}")
        return {
            "studentName": student_info['name'] if 'student_info' in locals() and student_info else "Student",
            "modules": [
                {"name": "Signature-Based Detection", "progress": 0, "lastAccessed": "Never", "timeSpent": 0, "engagementScore": 0},
                {"name": "Anomaly-Based Detection", "progress": 0, "lastAccessed": "Never", "timeSpent": 0, "engagementScore": 0},
                {"name": "Hybrid Detection", "progress": 0, "lastAccessed": "Never", "timeSpent": 0, "engagementScore": 0},
            ],
            "assignedModules": [
                {"name": "Signature-Based Detection", "startDate": "Not started", "status": "Not Started"},
                {"name": "Anomaly-Based Detection", "startDate": "Not started", "status": "Not Started"},
                {"name": "Hybrid Detection", "startDate": "Not started", "status": "Not Started"},
            ],
            "stats": {
                "totalModules": 3,
                "completedModules": 0,
                "averageProgress": 0,
                "totalTimeSpent": 0,
                "engagementScore": 0
            }
        }
    finally:
        cursor.close()
        conn.close()

@router.get("/student/notifications/{student_id}")
def get_real_notifications(request: Request, student_id: int):
    """Get notifications for a specific student (path form). Enforces student ownership."""
    try:
        payload = require_role(request, 'student')
        if str(student_id) != payload.get('sub'):
            raise HTTPException(status_code=403, detail='Forbidden')
    except HTTPException as e:
        if e.status_code not in (401, 403):
            raise
        # Dev fallback: empty
        return []
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        ensure_notifications_table(cursor)
        cursor.execute(
            '''
            SELECT id, message, time, type, `read`
            FROM notifications
            WHERE recipient_role = 'student' AND recipient_id = %s AND `read` = 0
            ORDER BY time DESC
            LIMIT 50
            ''', (student_id,)
        )
        rows = cursor.fetchall() or []
        return [
            {
                'id': int(r['id']),
                'message': r.get('message', ''),
                'time': str(r.get('time') or ''),
                'type': r.get('type') or 'info',
                'read': bool(r.get('read') or 0)
            }
            for r in rows
        ]
    except Exception as e:
        print(f"[ERROR] get_real_notifications: {e}")
        return []
    finally:
        cursor.close(); conn.close()

@router.post("/student/change-password")
def change_password(req: ChangePasswordRequest):
    print(f"[DEBUG] Password change request: email={getattr(req, 'email', None)}, old_password={req.old_password}, new_password={req.new_password}")
    if not hasattr(req, 'email') or not req.email:
        print("[DEBUG] No email provided in request body.")
        raise HTTPException(status_code=400, detail='Email is required to change password.')
    email = req.email
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute('SELECT id, password_hash, userType FROM users WHERE email=%s', (email,))
    user = cursor.fetchone()
    print(f"[DEBUG] DB user lookup: {user}")
    if not user:
        print("[DEBUG] No user found for email.")
        cursor.close()
        conn.close()
        raise HTTPException(status_code=401, detail='Current password is incorrect (user not found)')
    if user.get('userType') != 'student':
        print(f"[DEBUG] User found but userType is not student: {user.get('userType')}")
        cursor.close()
        conn.close()
        raise HTTPException(status_code=401, detail='Current password is incorrect (not a student)')
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

@router.post('/student/signup')
def student_signup(req: StudentSignupRequest):
    # Enforce LSPU email domain
    if not req.email.lower().endswith('@lspu.edu.ph'):
        raise HTTPException(status_code=400, detail='Email must be an LSPU email (firstname.lastname@lspu.edu.ph)')
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    # Ensure schema is present and compatible before insert
    try:
        ensure_users_table_and_migrate_password_hash(cursor)
        conn.commit()
    except Exception as e:
        print(f"[WARN] ensure users table/migrate failed: {e}")
    cursor.execute('SELECT id FROM users WHERE email=%s', (req.email,))
    if cursor.fetchone():
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail='Email already registered')
    password_hash = generate_password_hash(req.password)
    cursor.execute(
        'INSERT INTO users (name, email, password_hash, userType, status) VALUES (%s, %s, %s, %s, %s)',
        (req.name, req.email, password_hash, 'student', 'approved')
    )
    conn.commit()
    # Notify admins (broadcast) of new student signup
    try:
        c2 = conn.cursor()
        ensure_notifications_table(c2)
        c2.execute(
            'INSERT INTO notifications (recipient_role, message, type) VALUES (%s,%s,%s)',
            ('admin', f"New student signup: {req.name} ({req.email})", 'info')
        )
        conn.commit(); c2.close()
    except Exception as ne:
        print(f"[WARN] admin notify (student signup) failed: {ne}")
    cursor.close()
    conn.close()
    return {'message': 'Signup successful', 'user': {'email': req.email, 'userType': 'student', 'status': 'approved'}}

@router.post('/student/login')
def student_login(req: StudentLoginRequest):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute('SELECT * FROM users WHERE email=%s AND userType=%s', (req.email, 'student'))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    if not user or not check_password_hash(user['password_hash'], req.password):
        raise HTTPException(status_code=401, detail='Invalid email or password')
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

@router.get('/student/assignments')
def get_student_assignments(request: Request, student_id: int):
    """List assignments for a specific student."""
    # Optional role check: allow student role only
    try:
        payload = require_role(request, 'student')
        # If token exists and sub doesn't match student_id, forbid
        if str(student_id) != payload.get('sub'):
            raise HTTPException(status_code=403, detail='Forbidden')
    except HTTPException as e:
        # For development, if no token provided, continue
        if e.status_code not in (401, 403):
            raise
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute('''
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
        ''')
        cursor.execute(
            '''
            SELECT id, instructor_id as instructorId, student_id as studentId, module_name as moduleName,
                   module_slug as moduleSlug, due_date as dueDate, status, notes, created_at as createdAt
            FROM assignments
            WHERE student_id = %s
            ORDER BY created_at DESC
            ''', (student_id,)
        )
        rows = cursor.fetchall() or []
        # Normalize status and compute overdue on the fly
        from datetime import datetime, timezone
        now = datetime.utcnow()
        for r in rows:
            r['status'] = _normalize_assignment_status(r.get('status'))
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
        print(f"[ERROR] get_student_assignments: {e}")
        raise HTTPException(status_code=500, detail='Failed to fetch assignments')
    finally:
        cursor.close(); conn.close()

# Alias route using path parameter for clients that call /student/{id}/assignments
@router.get('/student/{student_id}/assignments')
def get_student_assignments_by_path(request: Request, student_id: int):
    return get_student_assignments(request, student_id)

# Additional alias to avoid path conflicts in some setups
@router.get('/student/assignments/list')
def get_student_assignments_alias(request: Request, student_id: int):
    return get_student_assignments(request, student_id)

@router.get('/student/feedback')
def get_student_feedback(request: Request, student_id: int):
    """List feedback for a specific student."""
    try:
        payload = require_role(request, 'student')
        if str(student_id) != payload.get('sub'):
            raise HTTPException(status_code=403, detail='Forbidden')
    except HTTPException as e:
        if e.status_code not in (401, 403):
            raise
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Ensure feedback table and columns exist (auto-migrate if legacy)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS feedback (
                id INT AUTO_INCREMENT PRIMARY KEY,
                instructor_id INT NULL,
                student_id INT NULL,
                submission_id INT NULL,
                assignment_id INT NULL,
                message TEXT NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ''')
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
                ('created_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP')
            ]
            for col, sql_type in required_defs:
                if col not in existing:
                    try:
                        cursor.execute(f"ALTER TABLE feedback ADD COLUMN {col} {sql_type}")
                    except Exception as ae:
                        print(f"[WARN] Could not add missing column {col} to feedback: {ae}")
        except Exception as se:
            print(f"[WARN] Could not verify/alter feedback schema (student_api): {se}")
        cursor.execute(
            'SELECT id, instructor_id as instructorId, message, submission_id as submissionId, assignment_id as assignmentId, created_at as createdAt FROM feedback WHERE student_id=%s ORDER BY created_at DESC',
            (student_id,)
        )
        rows = cursor.fetchall()
        return rows or []
    except Exception as e:
        print(f"[ERROR] get_student_feedback: {e}")
        raise HTTPException(status_code=500, detail='Failed to fetch feedback')
    finally:
        cursor.close(); conn.close()

@router.post('/student/progress')
@rbac_required('student', audit_action='update_progress', audit_logger=_audit_log)
def update_student_progress(request: Request, progress: StudentProgressRequest):
    print(f"[DEBUG] Received progress: {progress}")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Ensure core tables exist for empty databases
        ensure_base_progress_tables(cursor)
        _ensure_student_progress_unit_columns(cursor)
        # Guard against empty/blank module names creating junk rows
        mod_name = (getattr(progress, 'module_name', None) or '').strip()
        if not mod_name:
            print("[DEBUG] Empty module_name received; ignoring progress update")
            return {"status": "ignored", "reason": "empty module_name"}
        new_seconds = getattr(progress, 'time_spent_seconds', None)
        if new_seconds is not None:
            new_time_spent = int(new_seconds)
        else:
            minutes = getattr(progress, 'time_spent', 0)
            new_time_spent = int(minutes * 60) if minutes is not None else 0
        if new_time_spent is None:
            new_time_spent = 0
        # Defensive: avoid None for engagement_score
        engagement_score = progress.engagement_score if progress.engagement_score is not None else 0
        print(f"[DEBUG] Attempting upsert: student_id={progress.student_id}, module_name={progress.module_name}, delta_seconds={new_time_spent}")
        print(f"[DEBUG] SQL params: {progress.student_id}, {progress.student_name}, {progress.module_name}, {progress.lessons_completed}, {progress.total_lessons}, {progress.last_lesson}, {new_time_spent}, {engagement_score}")
        
        # Check if this is a new enrollment (student doesn't exist for this module)
        cursor.execute(
            'SELECT lessons_completed, total_lessons FROM student_progress WHERE student_id=%s AND module_name=%s',
            (progress.student_id, mod_name)
        )
        existing_record = cursor.fetchone()
        
        is_new_enrollment = existing_record is None
        # Detect theory completion (lessons reach total for first time)
        theory_completed_now = False
        
        if existing_record:
            old_lessons_completed = int(existing_record[0] or 0)
            total = int(progress.total_lessons or 0)
            new_lessons = int(progress.lessons_completed or 0)
            theory_completed_now = (old_lessons_completed < total and new_lessons >= total and total > 0)
        
        try:
            cursor.execute('''
                INSERT INTO student_progress (student_id, student_name, module_name, lessons_completed, total_lessons, last_lesson, time_spent, engagement_score)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    student_name=VALUES(student_name),
                    lessons_completed=VALUES(lessons_completed),
                    total_lessons=VALUES(total_lessons),
                    last_lesson=VALUES(last_lesson),
                    time_spent=time_spent + VALUES(time_spent),
                    engagement_score=VALUES(engagement_score)
            ''', (
                progress.student_id,
                progress.student_name,
                mod_name,
                progress.lessons_completed,
                progress.total_lessons,
                progress.last_lesson,
                new_time_spent,
                engagement_score
            ))
            conn.commit()
            print(f"[DEBUG] Progress upserted successfully. Rows affected: {cursor.rowcount}")
            
            # Notifications: new enrollment + theory completed (targeted if possible)
            try:
                ensure_notifications_table(cursor)
                # Target instructors by assignments if available
                instr_ids = _find_instructor_ids_for_student_module(cursor, progress.student_id, mod_name, progress.module_name)
                if is_new_enrollment:
                    nmsg = f"New student enrolled in {progress.module_name}"
                    if instr_ids:
                        for iid in instr_ids:
                            cursor.execute('INSERT INTO notifications (recipient_id, recipient_role, message, type) VALUES (%s,%s,%s,%s)', (iid, 'instructor', nmsg, 'info'))
                    else:
                        cursor.execute('INSERT INTO notifications (recipient_role, message, type) VALUES (%s,%s,%s)', ('instructor', nmsg, 'info'))
                if theory_completed_now:
                    # Notify instructors
                    tmsg = f"Theory completed: {progress.module_name}"
                    if instr_ids:
                        for iid in instr_ids:
                            cursor.execute('INSERT INTO notifications (recipient_id, recipient_role, message, type) VALUES (%s,%s,%s,%s)', (iid, 'instructor', tmsg, 'success'))
                    else:
                        cursor.execute('INSERT INTO notifications (recipient_role, message, type) VALUES (%s,%s,%s)', ('instructor', tmsg, 'success'))
                    # Notify student
                    try:
                        cursor.execute('INSERT INTO notifications (recipient_id, recipient_role, message, type) VALUES (%s,%s,%s,%s)', (progress.student_id, 'student', tmsg, 'success'))
                    except Exception:
                        pass
            except Exception as ne:
                print(f"[WARN] Could not insert notifications: {ne}")
            
            conn.commit()
            
            # Fetch the updated value for confirmation
            cursor.execute('SELECT time_spent FROM student_progress WHERE student_id=%s AND module_name=%s', (progress. student_id, mod_name))
            row = cursor.fetchone()
            print(f"[DEBUG] DB value after upsert: time_spent={row[0] if row else 'N/A'}")
        except Exception as sql_e:
            print(f"[DEBUG] SQL error: {sql_e}")
            raise
    except Exception as e:
        print(f"[DEBUG] Error upserting progress: {e}")
        raise HTTPException(status_code=500, detail='Failed to update student progress')
    finally:
        cursor.close()
        conn.close()
    return {"status": "success"}


@router.get('/student/{student_id}/module/{module_name}/lessons')
def get_student_module_lessons(student_id: int, module_name: str):
    """Return list of completed lesson_ids for a student in a module."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ensure_base_progress_tables(cursor)
        cursor.execute('SELECT lesson_id FROM student_lesson_progress WHERE student_id=%s AND module_name=%s AND completed=1', (student_id, module_name))
        rows = cursor.fetchall()
        lesson_ids = [r[0] for r in rows]
        return {"lesson_ids": lesson_ids}
    except Exception as e:
        print(f"[ERROR] get_student_module_lessons: {e}")
        raise HTTPException(status_code=500, detail='Failed to fetch lesson progress')
    finally:
        cursor.close()
        conn.close()


@router.post('/student/{student_id}/module/{module_name}/lesson')
@rbac_required('student', audit_action='lesson_completion', audit_logger=_audit_log)
def set_student_lesson_completion(request: Request, student_id: int, module_name: str, req: LessonCompletionRequest = Body(...)):
    """Mark a lesson complete or incomplete for a student."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ensure_base_progress_tables(cursor)
        # Normalize module and ensure progress row exists so we can update last_lesson
        norm_mod = _normalize_module_key(module_name)
        _upsert_progress_row(cursor, student_id, norm_mod)
        # If touch_only, skip changing completion state; just update last_lesson below
        if not req.touch_only:
            completed_val = 1 if req.completed else 0
            # Upsert into student_lesson_progress
            cursor.execute('''
                INSERT INTO student_lesson_progress (student_id, module_name, lesson_id, completed)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE completed=VALUES(completed), completed_at=CURRENT_TIMESTAMP
            ''', (student_id, norm_mod, req.lesson_id, completed_val))
            conn.commit()
        # Persist the last_lesson field on the aggregate progress row using provided title when available
        try:
            last_label = (req.lesson_title or '').strip() or req.lesson_id
            cursor.execute('UPDATE student_progress SET last_lesson=%s WHERE student_id=%s AND module_name=%s', (last_label, student_id, norm_mod))
            conn.commit()
        except Exception as le:
            print(f"[WARN] could not update last_lesson: {le}")
        # Optional: log practical completion as recent activity when relevant
        try:
            if (req.completed or (not req.touch_only and (req.completed is None or req.completed))) and (req.lesson_id or '').lower().startswith('practical'):
                # Include student name for instructor view
                sname = _get_student_name_by_id(cursor, student_id)
                cursor.execute('INSERT INTO recent_activity (activity) VALUES (%s)', (f"{sname} marked Practical complete for {norm_mod}",))
                conn.commit()
        except Exception as _:
            pass
        resp = {"status": "success", "lesson_id": req.lesson_id}
        if not req.touch_only:
            resp["completed"] = bool(1 if req.completed else 0)
        return resp
    except Exception as e:
        print(f"[ERROR] set_student_lesson_completion: {e}")
        raise HTTPException(status_code=500, detail='Failed to set lesson completion')
    finally:
        cursor.close()
        conn.close()

@router.post('/student/{student_id}/module/{module_name}/lessons/bulk')
@rbac_required('student', audit_action='bulk_lesson_completion', audit_logger=_audit_log)
def set_student_lessons_bulk(request: Request, student_id: int, module_name: str, req: BulkLessonCompletionRequest = Body(...)):
    """Bulk mark multiple lessons complete/incomplete. Idempotent per lesson."""
    if not req.lesson_ids:
        raise HTTPException(status_code=400, detail='lesson_ids required')
    conn = get_db_connection(); cursor = conn.cursor()
    completed_val = 1 if (req.completed is None or req.completed) else 0
    try:
        ensure_base_progress_tables(cursor)
        for lid in req.lesson_ids:
            cursor.execute('''
                INSERT INTO student_lesson_progress (student_id, module_name, lesson_id, completed)
                VALUES (%s,%s,%s,%s)
                ON DUPLICATE KEY UPDATE completed=VALUES(completed), completed_at=CURRENT_TIMESTAMP
            ''', (student_id, module_name, lid, completed_val))
        conn.commit()
        return {'status':'success','count':len(req.lesson_ids),'completed':bool(completed_val)}
    except Exception as e:
        print(f"[ERROR] set_student_lessons_bulk: {e}")
        raise HTTPException(status_code=500, detail='Failed to set bulk lessons')
    finally:
        cursor.close(); conn.close()


class ModuleQuizRequest(BaseModel):
    student_id: int
    module_name: str
    passed: bool
    score: int
    total: int

class ModuleUnitRequest(BaseModel):
    unit_type: str  # overview | practical | assessment | quiz
    unit_code: Optional[str] = None  # e.g., m1, m2, summary (for quiz) or None for overview/practical/assessment
    completed: bool = True
    duration_seconds: Optional[int] = None  # optional time spent during this unit completion (added)

class TimeEventRequest(BaseModel):
    unit_type: str  # overview | practical | assessment | quiz | lesson
    unit_code: Optional[str] = None
    delta_seconds: int

def _ensure_unit_event_columns(cursor):
    """Ensure student_module_unit_events has all required columns.

    Handles legacy tables missing some columns without assuming column order. Adds:
      - module_name VARCHAR(255) NOT NULL
      - unit_type ENUM('overview','lesson','quiz','practical','assessment') NOT NULL
      - unit_code VARCHAR(64) NULL
      - completed TINYINT(1) DEFAULT 1
      - duration_seconds INT DEFAULT 0
      - created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    """
    try:
        cursor.execute(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema=%s AND table_name='student_module_unit_events'
            """,
            (MYSQL_CONFIG['database'],)
        )
        rows = cursor.fetchall() or []
        cols = { (r['column_name'] if isinstance(r, dict) else r[0]) for r in rows }
        # column -> SQL type
        required = [
            ('module_name', "VARCHAR(255) NOT NULL"),
            ('unit_type', "ENUM('overview','lesson','quiz','practical','assessment') NOT NULL"),
            ('unit_code', "VARCHAR(64) NULL"),
            ('completed', "TINYINT(1) DEFAULT 1"),
            ('duration_seconds', "INT NULL DEFAULT 0"),
            ('created_at', "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP"),
        ]
        for col, typ in required:
            if col in cols:
                continue
            try:
                cursor.execute(f"ALTER TABLE student_module_unit_events ADD COLUMN {col} {typ}")
            except Exception as e:
                print(f"[WARN] Could not add column {col} to student_module_unit_events: {e}")
    except Exception as e:
        print(f"[WARN] _ensure_unit_event_columns failed: {e}")

def _migrate_unit_events_legacy(cursor):
    """Rebuild student_module_unit_events to the expected schema when legacy structure is detected.

    Strategy:
    - If table doesn't exist, create fresh with the new schema.
    - If table exists but is missing critical columns (module_name, completed, unit_type, unit_code, duration_seconds, created_at),
      create a new table with correct schema, copy forward any legacy data if recognizable, swap tables atomically.
    """
    try:
        # Detect table existence
        cursor.execute("SHOW TABLES LIKE 'student_module_unit_events'")
        exists = cursor.fetchone() is not None
        if not exists:
            ensure_unit_events_table(cursor)
            return
        # Inspect existing columns
        cursor.execute("SHOW COLUMNS FROM student_module_unit_events")
        existing_cols = {r[0] if isinstance(r, tuple) else (r.get('Field') if isinstance(r, dict) else None) for r in (cursor.fetchall() or [])}
        required_core = { 'module_name', 'unit_type', 'unit_code', 'completed', 'duration_seconds', 'created_at' }
        if required_core.issubset(existing_cols):
            return  # already compatible
        # Create new table with correct schema
        cursor.execute(
            '''
            CREATE TABLE IF NOT EXISTS student_module_unit_events__new (
              id INT AUTO_INCREMENT PRIMARY KEY,
              student_id INT NOT NULL,
              module_name VARCHAR(255) NOT NULL,
              unit_type ENUM('overview','lesson','quiz','practical','assessment') NOT NULL,
              unit_code VARCHAR(64) NULL,
              completed TINYINT(1) DEFAULT 1,
              duration_seconds INT NULL DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              INDEX idx_student_module (student_id, module_name),
              INDEX idx_unit_type (unit_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            '''
        )
        # Try to copy recognizable legacy data forward
        try:
            # Heuristics: common legacy columns were (module_slug, event, unit, occurred_at)
            legacy_has = existing_cols
            if {'student_id','module_slug','event','unit','occurred_at'}.issubset(legacy_has):
                cursor.execute(
                    '''
                    INSERT INTO student_module_unit_events__new (student_id, module_name, unit_type, unit_code, completed, duration_seconds, created_at)
                    SELECT student_id,
                           COALESCE(module_slug, '') AS module_name,
                           CASE LOWER(COALESCE(event,''))
                               WHEN 'overview' THEN 'overview'
                               WHEN 'practical' THEN 'practical'
                               WHEN 'assessment' THEN 'assessment'
                               WHEN 'quiz' THEN 'quiz'
                               ELSE 'lesson'
                           END AS unit_type,
                           unit AS unit_code,
                           1 AS completed,
                           0 AS duration_seconds,
                           occurred_at AS created_at
                    FROM student_module_unit_events
                    '''
                )
            else:
                # Best-effort shallow copy if columns already align partially
                common_cols = []
                # Build a copy statement for whatever subset exists
                for c in ['student_id','module_name','unit_type','unit_code','completed','duration_seconds','created_at']:
                    if c in legacy_has:
                        common_cols.append(c)
                if common_cols:
                    cols_csv = ', '.join(common_cols)
                    cursor.execute(f"INSERT INTO student_module_unit_events__new ({cols_csv}) SELECT {cols_csv} FROM student_module_unit_events")
        except Exception as ce:
            print(f"[WARN] unit_events legacy copy failed: {ce}")
        # Swap tables
        try:
            cursor.execute('DROP TABLE student_module_unit_events')
        except Exception as de:
            print(f"[WARN] drop legacy unit_events failed (continuing): {de}")
        cursor.execute('RENAME TABLE student_module_unit_events__new TO student_module_unit_events')
    except Exception as e:
        print(f"[WARN] _migrate_unit_events_legacy failed: {e}")

def ensure_unit_events_table(cursor):
    """Create student_module_unit_events table if it does not exist (runtime safety)."""
    try:
        cursor.execute(
            '''
            CREATE TABLE IF NOT EXISTS student_module_unit_events (
              id INT AUTO_INCREMENT PRIMARY KEY,
              student_id INT NOT NULL,
              module_name VARCHAR(255) NOT NULL,
              unit_type ENUM('overview','lesson','quiz','practical','assessment') NOT NULL,
              unit_code VARCHAR(64) NULL,
              completed TINYINT(1) DEFAULT 1,
              duration_seconds INT NULL DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              INDEX idx_student_module (student_id, module_name),
              INDEX idx_unit_type (unit_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            '''
        )
        # Also ensure any missing columns on existing legacy tables
        _ensure_unit_event_columns(cursor)
        # If legacy structure persists (missing core cols), rebuild table and copy forward
        _migrate_unit_events_legacy(cursor)
    except Exception as e:
        print(f"[WARN] ensure_unit_events_table failed: {e}")

def _ensure_student_progress_unit_columns(cursor):
    """Idempotently add new unit columns if they do not yet exist (for runtime safety).
    Compatible with both tuple and dict cursors and with MySQL versions that may not support IF NOT EXISTS.
    """
    try:
        cursor.execute(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema=%s AND table_name='student_progress'
            """,
            (MYSQL_CONFIG['database'],)
        )
        rows = cursor.fetchall() or []
        # Support dict and tuple rows
        def _colname(r):
            try:
                return (r['column_name'] if isinstance(r, dict) else r[0])
            except Exception:
                return None
        cols = {c for c in (_colname(r) for r in rows) if c}
        needed = [
            ('overview_completed', 'TINYINT(1) DEFAULT 0'),
            ('practical_completed', 'TINYINT(1) DEFAULT 0'),
            ('assessment_completed', 'TINYINT(1) DEFAULT 0'),
            ('quizzes_passed', 'INT DEFAULT 0'),
            ('total_quizzes', 'INT DEFAULT 0'),
        ]
        for (col, sqltype) in needed:
            if col in cols:
                continue
            # Try modern IF NOT EXISTS first
            try:
                cursor.execute(f"ALTER TABLE student_progress ADD COLUMN IF NOT EXISTS {col} {sqltype}")
            except Exception as e1:
                # Fallback: attempt without IF NOT EXISTS; ignore duplicate-column errors
                try:
                    cursor.execute(f"ALTER TABLE student_progress ADD COLUMN {col} {sqltype}")
                except Exception as e2:
                    print(f"[WARN] Could not add column {col} to student_progress: {e2}")
        # No explicit commit; caller controls transaction.
    except Exception as e:
        # When called with a dict cursor, a KeyError(0) previously surfaced as '0'; fix by handling above.
        print(f"[WARN] _ensure_student_progress_unit_columns failed: {e}")

def _ensure_student_progress_unique_index(cursor):
    """Ensure (student_id, module_name) is unique. Merge duplicates before adding index.
    Safe to call on every summary request (cheap once index present)."""
    try:
        cursor.execute("SHOW INDEX FROM student_progress WHERE Key_name='uniq_student_module'")
        if cursor.fetchone():
            return  # already exists
        # Find duplicate groups
        cursor.execute("""
            SELECT student_id, module_name, COUNT(*) AS c
            FROM student_progress
            WHERE module_name IS NOT NULL AND TRIM(module_name)<>''
            GROUP BY student_id, module_name HAVING c>1
        """)
        dup_groups = cursor.fetchall() or []
        for (student_id, module_name, _cnt) in dup_groups:
            try:
                cursor.execute("""
                    SELECT id, lessons_completed, total_lessons, overview_completed, practical_completed, assessment_completed,
                           quizzes_passed, total_quizzes, time_spent, engagement_score
                    FROM student_progress
                    WHERE student_id=%s AND module_name=%s
                    ORDER BY id ASC
                """, (student_id, module_name))
                rows = cursor.fetchall() or []
                if len(rows) <= 1:
                    continue
                canonical = rows[0]
                maxima = {
                    'lessons_completed': 0,
                    'total_lessons': 0,
                    'overview_completed': 0,
                    'practical_completed': 0,
                    'assessment_completed': 0,
                    'quizzes_passed': 0,
                    'total_quizzes': 0,
                    'time_spent': 0,
                    'engagement_score': 0
                }
                for r in rows:
                    maxima['lessons_completed'] = max(maxima['lessons_completed'], r[1] or 0)
                    maxima['total_lessons'] = max(maxima['total_lessons'], r[2] or 0)
                    maxima['overview_completed'] = max(maxima['overview_completed'], r[3] or 0)
                    maxima['practical_completed'] = max(maxima['practical_completed'], r[4] or 0)
                    maxima['assessment_completed'] = max(maxima['assessment_completed'], r[5] or 0)
                    maxima['quizzes_passed'] = max(maxima['quizzes_passed'], r[6] or 0)
                    maxima['total_quizzes'] = max(maxima['total_quizzes'], r[7] or 0)
                    maxima['time_spent'] = max(maxima['time_spent'], r[8] or 0)
                    maxima['engagement_score'] = max(maxima['engagement_score'], r[9] or 0)
                cursor.execute(
                    '''UPDATE student_progress SET lessons_completed=%s,total_lessons=%s,overview_completed=%s,practical_completed=%s,
                       assessment_completed=%s,quizzes_passed=%s,total_quizzes=%s,time_spent=%s,engagement_score=%s WHERE id=%s''',
                    (
                        maxima['lessons_completed'], maxima['total_lessons'], maxima['overview_completed'], maxima['practical_completed'],
                        maxima['assessment_completed'], maxima['quizzes_passed'], maxima['total_quizzes'], maxima['time_spent'], maxima['engagement_score'], canonical[0]
                    )
                )
                for r in rows[1:]:
                    cursor.execute('DELETE FROM student_progress WHERE id=%s', (r[0],))
            except Exception as de:
                print(f"[WARN] duplicate merge failed for ({student_id},{module_name}): {de}")
        # Add index last
        try:
            cursor.execute('ALTER TABLE student_progress ADD UNIQUE KEY uniq_student_module (student_id, module_name)')
        except Exception as ie:
            print(f"[WARN] add unique index failed (may already exist): {ie}")
    except Exception as e:
        print(f"[WARN] _ensure_student_progress_unique_index error: {e}")

def _upsert_progress_row(cursor, student_id: int, module_name: str):
    """Ensure a row exists for (student,module) so we can update unit columns safely."""
    # Normalize module_name to slug-style (lowercase hyphen) for consistency
    norm = module_name.strip().lower().replace(' ', '-'); module_name = norm
    cursor.execute('SELECT id FROM student_progress WHERE student_id=%s AND module_name=%s', (student_id, module_name))
    row = cursor.fetchone()
    if not row:
        cursor.execute('''
            INSERT INTO student_progress (student_id, student_name, module_name, lessons_completed, total_lessons, last_lesson, time_spent, engagement_score,
                                          overview_completed, practical_completed, assessment_completed, quizzes_passed, total_quizzes)
            VALUES (%s, '', %s, 0, 0, '', 0, 0, 0, 0, 0, 0, 0)
        ''', (student_id, module_name))

def _normalize_module_key(raw: str) -> str:
    if not raw:
        return ''
    return raw.strip().lower().replace(' ', '-')

# Expected static curriculum metadata per module (slug keys).
# These drive denominator for percent calculations to ensure consistent 19/19 or 21/21 style progress.
EXPECTED_MODULE_METADATA = {
    'signature-based-detection': {
        'lessons': 11,
        'quizzes': 5
    },
    'anomaly-based-detection': {
        'lessons': 13,
        'quizzes': 5
    },
    'hybrid-detection': {
        'lessons': 13,
        'quizzes': 5
    }
}

# Preferred display titles (professional Title Case) separate from stored canonical slug.
DISPLAY_MODULE_TITLES = {
    'signature-based-detection': 'Signature-Based Detection',
    'anomaly-based-detection': 'Anomaly-Based Detection',
    'hybrid-detection': 'Hybrid Detection'
}

def _display_title(slug: str) -> str:
    if not slug:
        return ''
    return DISPLAY_MODULE_TITLES.get(slug, ' '.join([p.capitalize() for p in slug.split('-')]))

def _expected_module_meta(slug: str):
    """Return expected curriculum meta for a module slug or None."""
    return EXPECTED_MODULE_METADATA.get(slug)

@router.post('/student/{student_id}/module/{module_name}/unit')
@rbac_required('student', audit_action='unit_completion', audit_logger=_audit_log)
def set_student_module_unit(request: Request, student_id: int, module_name: str, req: ModuleUnitRequest = Body(...)):
    """Mark a high-level unit complete (overview, practical, assessment, quiz). Quizzes increment counters if first pass."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ensure_base_progress_tables(cursor)
        _ensure_student_progress_unit_columns(cursor)
        ensure_unit_events_table(cursor)
        _ensure_unit_event_columns(cursor)
        module_name = _normalize_module_key(module_name)
        _upsert_progress_row(cursor, student_id, module_name)
        unit_type = (req.unit_type or '').lower().strip()
        if unit_type not in ('overview', 'practical', 'assessment', 'quiz'):
            raise HTTPException(status_code=400, detail='Invalid unit_type')
        if unit_type == 'quiz':
            cursor.execute(
                '''
                SELECT id FROM student_module_unit_events
                WHERE student_id=%s AND module_name=%s AND unit_type='quiz' AND unit_code=%s
                ''',
                (student_id, module_name, req.unit_code)
            )
            existing = cursor.fetchone()
            if not existing and req.completed:
                try:
                    cursor.execute(
                        '''INSERT INTO student_module_unit_events (student_id, module_name, unit_type, unit_code, completed)
                           VALUES (%s,%s,'quiz',%s,1)''',
                        (student_id, module_name, req.unit_code)
                    )
                except Exception as ie:
                    # Attempt schema self-heal and retry once if unknown column
                    msg = str(ie)
                    if '1054' in msg or 'Unknown column' in msg:
                        _migrate_unit_events_legacy(cursor)
                        _ensure_unit_event_columns(cursor)
                        cursor.execute(
                            '''INSERT INTO student_module_unit_events (student_id, module_name, unit_type, unit_code, completed)
                               VALUES (%s,%s,'quiz',%s,1)''',
                            (student_id, module_name, req.unit_code)
                        )
                    else:
                        raise
                # Increment quizzes_passed (capped later in summary) and set total_quizzes if unset & we have expected meta
                cursor.execute(
                    'UPDATE student_progress SET quizzes_passed = quizzes_passed + 1 WHERE student_id=%s AND module_name=%s',
                    (student_id, module_name)
                )
                meta = _expected_module_meta(module_name)
                if meta:
                    cursor.execute(
                        'UPDATE student_progress SET total_quizzes = IFNULL(NULLIF(total_quizzes,0), %s) WHERE student_id=%s AND module_name=%s',
                        (meta['quizzes'], student_id, module_name)
                    )
        else:
            col_map = {
                'overview': 'overview_completed',
                'practical': 'practical_completed',
                'assessment': 'assessment_completed',
            }
            target_col = col_map[unit_type]
            cursor.execute(
                f'UPDATE student_progress SET {target_col}=%s WHERE student_id=%s AND module_name=%s',
                (1 if req.completed else 0, student_id, module_name)
            )
            try:
                cursor.execute(
                    '''INSERT INTO student_module_unit_events (student_id, module_name, unit_type, unit_code, completed, duration_seconds)
                       VALUES (%s,%s,%s,%s,%s,%s)''',
                    (student_id, module_name, unit_type, req.unit_code, 1 if req.completed else 0, req.duration_seconds or 0)
                )
            except Exception as ie:
                msg = str(ie)
                if '1054' in msg or 'Unknown column' in msg:
                    _migrate_unit_events_legacy(cursor)
                    _ensure_unit_event_columns(cursor)
                    cursor.execute(
                        '''INSERT INTO student_module_unit_events (student_id, module_name, unit_type, unit_code, completed, duration_seconds)
                           VALUES (%s,%s,%s,%s,%s,%s)''',
                        (student_id, module_name, unit_type, req.unit_code, 1 if req.completed else 0, req.duration_seconds or 0)
                    )
                else:
                    raise
            # Emit notifications when a unit flips to completed
            if req.completed:
                try:
                    ensure_notifications_table(cursor)
                    pretty = unit_type.capitalize()
                    cursor.execute(
                        'INSERT INTO notifications (recipient_id, recipient_role, message, type) VALUES (%s,%s,%s,%s)',
                        (student_id, 'student', f"{pretty} completed: {module_name}", 'success')
                    )
                    instr_ids = _find_instructor_ids_for_student_module(cursor, student_id, module_name, module_name)
                    if instr_ids:
                        for iid in instr_ids:
                            cursor.execute(
                                'INSERT INTO notifications (recipient_id, recipient_role, message, type) VALUES (%s,%s,%s,%s)',
                                (iid, 'instructor', f"Student {pretty.lower()} completed: {module_name}", 'info')
                            )
                except Exception as ne:
                    print(f"[WARN] unit completion notify failed: {ne}")
        # If duration provided, add to aggregate module time_spent
        if req.duration_seconds and req.duration_seconds > 0:
            try:
                cursor.execute(
                    'UPDATE student_progress SET time_spent = time_spent + %s WHERE student_id=%s AND module_name=%s',
                    (int(req.duration_seconds), student_id, module_name)
                )
            except Exception as te:
                print(f"[WARN] Could not increment time_spent from unit duration: {te}")
        conn.commit()
        return {'status': 'success'}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] set_student_module_unit: {e}")
        raise HTTPException(status_code=500, detail='Failed to update module unit')
    finally:
        try:
            cursor.close()
        finally:
            conn.close()

@router.get('/student/{student_id}/module/{module_name}/unit')
def get_student_module_unit_placeholder(student_id: int, module_name: str):
    """Placeholder GET to avoid 405 noise from accidental GET calls on /unit.

    Returns the latest unit event summary for this module if available; otherwise, a noop object.
    """
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        ensure_unit_events_table(cursor)
        module_name = _normalize_module_key(module_name)
        # Count distinct quiz events and check unit flags from student_progress
        cursor.execute('''SELECT COUNT(DISTINCT unit_code) FROM student_module_unit_events WHERE student_id=%s AND module_name=%s AND unit_type='quiz' ''', (student_id, module_name))
        q = cursor.fetchone(); quiz_events = int(q[0] if q else 0)
        cursor.execute('''SELECT overview_completed, practical_completed, assessment_completed FROM student_progress WHERE student_id=%s AND module_name=%s''', (student_id, module_name))
        row = cursor.fetchone() or (0,0,0)
        return {
            'student_id': student_id,
            'module': module_name,
            'overview_completed': bool(row[0] if isinstance(row, tuple) else (row.get('overview_completed') if row else 0)),
            'practical_completed': bool(row[1] if isinstance(row, tuple) else (row.get('practical_completed') if row else 0)),
            'assessment_completed': bool(row[2] if isinstance(row, tuple) else (row.get('assessment_completed') if row else 0)),
            'quizzes_passed_events': quiz_events
        }
    except Exception:
        return {'student_id': student_id, 'module': _normalize_module_key(module_name)}
    finally:
        cursor.close(); conn.close()

@router.post('/student/{student_id}/module/{module_name}/time_event')
@rbac_required('student', audit_action='time_event', audit_logger=_audit_log)
def record_time_event(request: Request, student_id: int, module_name: str, body: TimeEventRequest):
    """Increment time spent for a module and record a granular time event.

    unit_type may include 'lesson' in addition to higher-level units. This does NOT mark a unit complete;
    it only aggregates duration so dashboards can show accurate total time.
    """
    if body.delta_seconds is None or body.delta_seconds <= 0:
        raise HTTPException(status_code=400, detail='delta_seconds must be > 0')
    unit_type = (body.unit_type or '').lower().strip()
    if unit_type not in ('lesson','overview','practical','assessment','quiz'):
        raise HTTPException(status_code=400, detail='Invalid unit_type')
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        ensure_base_progress_tables(cursor)
        _ensure_student_progress_unit_columns(cursor)
        ensure_unit_events_table(cursor)
        _ensure_unit_event_columns(cursor)
        norm_mod = _normalize_module_key(module_name)
        _upsert_progress_row(cursor, student_id, norm_mod)
        # Insert time event (completed flag 0 for pure time tracking)
        try:
            cursor.execute('''INSERT INTO student_module_unit_events (student_id, module_name, unit_type, unit_code, completed, duration_seconds)
                              VALUES (%s,%s,%s,%s,0,%s)''', (student_id, norm_mod, unit_type, body.unit_code, body.delta_seconds))
        except Exception as ie:
            msg = str(ie)
            if '1054' in msg or 'Unknown column' in msg:
                _migrate_unit_events_legacy(cursor)
                _ensure_unit_event_columns(cursor)
                cursor.execute('''INSERT INTO student_module_unit_events (student_id, module_name, unit_type, unit_code, completed, duration_seconds)
                                  VALUES (%s,%s,%s,%s,0,%s)''', (student_id, norm_mod, unit_type, body.unit_code, body.delta_seconds))
            else:
                print(f"[WARN] could not insert time event: {ie}")
        # Increment aggregate time_spent on module
        cursor.execute('UPDATE student_progress SET time_spent = time_spent + %s WHERE student_id=%s AND module_name=%s', (body.delta_seconds, student_id, norm_mod))
        conn.commit()
        return {'status':'success','added_seconds': body.delta_seconds}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] add_time_event: {e}")
        raise HTTPException(status_code=500, detail='Failed to add time event')
    finally:
        cursor.close(); conn.close()


class SimulationCompletedRequest(BaseModel):
    role: str  # 'defender' or 'attacker'
    score: Optional[int] = None
    lobby_code: Optional[str] = None

def ensure_simulation_sessions_table(cursor):
    """Ensure a simple table exists to record per-student simulation completions and scores."""
    cursor.execute(
        '''
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
        '''
    )

@router.post('/student/{student_id}/simulation-completed')
@rbac_required('student', audit_action='simulation_completed', audit_logger=_audit_log)
def simulation_completed(request: Request, student_id: int, body: SimulationCompletedRequest):
    """Record completion of a simulation session and notify the student."""
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        ensure_notifications_table(cursor)
        ensure_simulation_sessions_table(cursor)
        role = (body.role or '').strip().lower()
        if role not in ('defender','attacker'):
            role = 'defender'
        msg = f"Simulation completed as {role.capitalize()}" + (f": Score {int(body.score)}" if body.score is not None else '')
        cursor.execute('INSERT INTO notifications (recipient_id, recipient_role, message, type) VALUES (%s,%s,%s,%s)', (student_id, 'student', msg, 'success'))
        # Persist simulation score snapshot for instructor reports
        try:
            # Try to get student name if available
            sname = None
            try:
                c2 = conn.cursor(); c2.execute('SELECT name FROM users WHERE id=%s', (student_id,)); row = c2.fetchone();
                if row:
                    # row can be tuple or dict depending on cursor type
                    sname = row[0] if isinstance(row, tuple) else (row.get('name') if isinstance(row, dict) else None)
            except Exception as _e:
                sname = None
            cursor.execute(
                'INSERT INTO simulation_sessions (student_id, student_name, role, score, lobby_code) VALUES (%s,%s,%s,%s,%s)',
                (student_id, sname, role, int(body.score or 0), body.lobby_code)
            )
        except Exception as se:
            print(f"[WARN] failed to record simulation session: {se}")
        conn.commit()
        return {'status':'success'}
    except Exception as e:
        print(f"[ERROR] simulation_completed: {e}")
        raise HTTPException(status_code=500, detail='Failed to record simulation completion')
    finally:
        cursor.close(); conn.close()

@router.get('/student/{student_id}/modules/summary')
def get_student_modules_summary(student_id: int, seed: bool = True, cleanup: bool = True):
    """Return aggregated progress for all modules for dashboard cards.

    If the student has no existing progress rows and `seed` is True (default), this will
    automatically create empty progress rows for each known module in EXPECTED_MODULE_METADATA
    so the frontend can immediately display module cards at 0% instead of an empty list.
    Disable by calling with ?seed=false if raw empty response is desired.
    """
    # Acquire DB connection defensively – return empty list (200) if DB unavailable so frontend doesn't spam errors
    try:
        # Use buffered cursor to avoid mysql.connector.errors.InternalError: Unread result found
        conn = get_db_connection(); cursor = conn.cursor(dictionary=True, buffered=True)
    except Exception as e:
        print(f"[ERROR] get_student_modules_summary DB connect failed: {e}")
        return []
    try:
        # Ensure tables exist before attempting to add columns or query
        ensure_base_progress_tables(cursor)
        _ensure_student_progress_unit_columns(cursor)
        _ensure_student_progress_unique_index(cursor)
        # Defensive: ensure student_progress table exists (in case migration not applied)
        try:
            cursor.execute("SHOW TABLES LIKE 'student_progress'")
            if not cursor.fetchone():
                print('[WARN] student_progress table missing; returning empty summary list')
                return []
        except Exception as te:
            print(f"[ERROR] pre-check student_progress existence failed: {te}")
            return []
        cursor.execute('''
            SELECT id, module_name,
                   COALESCE(lessons_completed,0) as lessons_completed,
                   COALESCE(total_lessons,0) as total_lessons,
                   COALESCE(overview_completed,0) as overview_completed,
                   COALESCE(practical_completed,0) as practical_completed,
                   COALESCE(assessment_completed,0) as assessment_completed,
                   COALESCE(quizzes_passed,0) as quizzes_passed,
                   COALESCE(total_quizzes,0) as total_quizzes,
                   COALESCE(time_spent,0) as time_spent_seconds,
                   COALESCE(engagement_score,0) as engagement_score
            FROM student_progress WHERE student_id=%s
        ''', (student_id,))
        base_rows = cursor.fetchall() or []
        # Optional cleanup: merge legacy/title variants into slug canonical rows.
        if cleanup and base_rows:
            try:
                groups = {}
                for r in base_rows:
                    slug = _normalize_module_key(r['module_name'])
                    if not slug:
                        continue
                    groups.setdefault(slug, []).append(r)
                changed = False
                for slug, rows in groups.items():
                    if len(rows) <= 1:
                        # Single row: if its module_name not slug, rename it
                        row = rows[0]
                        if row['module_name'] != slug:
                            cursor.execute('UPDATE student_progress SET module_name=%s WHERE id=%s', (slug, row['id']))
                            changed = True
                        continue
                    # Multiple variants: choose canonical row (prefer one already slugged)
                    canonical = None
                    for r in rows:
                        if _normalize_module_key(r['module_name']) == r['module_name']:
                            canonical = r; break
                    if not canonical:
                        canonical = rows[0]
                    # Aggregate maxima
                    agg_fields = ['lessons_completed','total_lessons','overview_completed','practical_completed','assessment_completed','quizzes_passed','total_quizzes','time_spent_seconds','engagement_score']
                    maxima = {f:0 for f in agg_fields}
                    for r in rows:
                        for f in agg_fields:
                            maxima[f] = max(maxima[f], r.get(f,0) or 0)
                    # Update canonical row values + ensure name is slug
                    cursor.execute('''UPDATE student_progress SET module_name=%s, lessons_completed=%s, total_lessons=%s,
                                      overview_completed=%s, practical_completed=%s, assessment_completed=%s,
                                      quizzes_passed=%s, total_quizzes=%s, time_spent=%s, engagement_score=%s
                                      WHERE id=%s''',
                                   (slug, maxima['lessons_completed'], maxima['total_lessons'],
                                    maxima['overview_completed'], maxima['practical_completed'], maxima['assessment_completed'],
                                    maxima['quizzes_passed'], maxima['total_quizzes'], maxima['time_spent_seconds'], maxima['engagement_score'], canonical['id']))
                    # Delete non-canonical rows
                    for r in rows:
                        if r['id'] != canonical['id']:
                            cursor.execute('DELETE FROM student_progress WHERE id=%s', (r['id'],))
                            changed = True
                if changed:
                    conn.commit()
                    # Re-query after cleanup
                    cursor.execute('''
                        SELECT id, module_name,
                               COALESCE(lessons_completed,0) as lessons_completed,
                               COALESCE(total_lessons,0) as total_lessons,
                               COALESCE(overview_completed,0) as overview_completed,
                               COALESCE(practical_completed,0) as practical_completed,
                               COALESCE(assessment_completed,0) as assessment_completed,
                               COALESCE(quizzes_passed,0) as quizzes_passed,
                               COALESCE(total_quizzes,0) as total_quizzes,
                               COALESCE(time_spent,0) as time_spent_seconds,
                               COALESCE(engagement_score,0) as engagement_score
                        FROM student_progress WHERE student_id=%s
                    ''', (student_id,))
                    base_rows = cursor.fetchall() or []
            except Exception as _:
                pass
        if seed and not base_rows:
            # Auto-seed empty rows for known modules so a brand-new student sees all modules.
            for mod_slug, meta in EXPECTED_MODULE_METADATA.items():
                try:
                        cursor.execute('''INSERT INTO student_progress (student_id, student_name, module_name, lessons_completed, total_lessons, last_lesson, time_spent, engagement_score,
                                         overview_completed, practical_completed, assessment_completed, quizzes_passed, total_quizzes)
                                      VALUES (%s,'',%s,0,0,'',0,0,0,0,0,0,0)''', (student_id, mod_slug))
                except Exception as _:
                    # Ignore duplicates or race conditions
                    pass
            conn.commit()
            cursor.execute('''
                SELECT module_name,
                       COALESCE(lessons_completed,0) as lessons_completed,
                       COALESCE(total_lessons,0) as total_lessons,
                       COALESCE(overview_completed,0) as overview_completed,
                       COALESCE(practical_completed,0) as practical_completed,
                       COALESCE(assessment_completed,0) as assessment_completed,
                       COALESCE(quizzes_passed,0) as quizzes_passed,
                       COALESCE(total_quizzes,0) as total_quizzes,
                       COALESCE(time_spent,0) as time_spent_seconds,
                       COALESCE(engagement_score,0) as engagement_score
                FROM student_progress WHERE student_id=%s
            ''', (student_id,))
            base_rows = cursor.fetchall() or []
        # Fallback reconciliation: recompute quiz pass count from distinct quiz unit events if higher than stored value.
        try:
            cursor.execute('''SELECT module_name, COUNT(DISTINCT unit_code) as quiz_events
                              FROM student_module_unit_events
                              WHERE student_id=%s AND unit_type='quiz'
                              GROUP BY module_name''', (student_id,))
            quiz_counts = { _normalize_module_key(r[0] if not isinstance(r, dict) else r['module_name']): (r[1] if not isinstance(r, dict) else r['quiz_events'])
                             for r in (cursor.fetchall() or []) }
            # Apply reconciliation before building progress_map
            for r in base_rows:
                slug = _normalize_module_key(r['module_name'])
                qc = quiz_counts.get(slug)
                if qc and qc > (r.get('quizzes_passed') or 0):
                    r['quizzes_passed'] = qc
        except Exception as _:
            pass
        progress_map = {}
        for r in base_rows:
            key = r['module_name']
            slug = _normalize_module_key(key)
            existing = progress_map.get(slug) or progress_map.get(key)
            if existing:
                # Merge by taking max values (so a newer normalized slug row with units doesn't get hidden by legacy title row)
                for fld in ('lessons_completed','total_lessons','overview_completed','practical_completed','assessment_completed','quizzes_passed','total_quizzes','time_spent_seconds','engagement_score'):
                    existing[fld] = max(existing.get(fld,0), r.get(fld,0))
                progress_map[slug] = existing
                progress_map[key] = existing
            else:
                progress_map[key] = r
                progress_map[slug] = r
        # Merge live lesson counts (authoritative): overwrite lessons_completed from student_lesson_progress
        # Rationale: older rows in student_progress may contain stale lesson counts from prior experiments.
        # For consistency, we always trust student_lesson_progress as the source of truth.
        cursor.execute('''
            SELECT module_name, COUNT(*) as cnt FROM student_lesson_progress
            WHERE student_id=%s AND completed=1 GROUP BY module_name
        ''', (student_id,))
        lesson_counts = {}
        for row in cursor.fetchall() or []:
            m = row['module_name']
            slug = _normalize_module_key(m)
            lesson_counts[slug] = int(row['cnt'])
        # Apply counts to all known modules in progress_map; modules without entries default to 0
        for key, entry in list(progress_map.items()):
            slug = _normalize_module_key(entry.get('module_name', key))
            lc = int(lesson_counts.get(slug, 0))
            entry['lessons_completed'] = lc
            # Ensure total_lessons is at least the count so percent doesn't divide by smaller number
            if not entry.get('total_lessons') or entry['total_lessons'] < lc:
                entry['total_lessons'] = lc
        enriched = []
        seen = set()
        for val in progress_map.values():
            if id(val) in seen: continue
            seen.add(id(val))
            slug = _normalize_module_key(val['module_name'])
            meta = _expected_module_meta(slug) or {}
            # Enforce curriculum totals from metadata; fall back to stored values only if metadata absent
            expected_lessons = meta.get('lessons') if isinstance(meta.get('lessons'), int) else (val.get('total_lessons') or val.get('lessons_completed') or 0)
            expected_quizzes = meta.get('quizzes') if isinstance(meta.get('quizzes'), int) else (val.get('total_quizzes') or val.get('quizzes_passed') or 0)
            # Safeguard: infer overview completion if lessons were completed but overview flag never set (legacy browsers)
            if not val.get('overview_completed') and (val.get('lessons_completed') or 0) > 0:
                val['overview_completed'] = 1
            # Enforce totals in-memory (not persisted) so denominator matches curriculum even before all items started
            lesson_units = min(val['lessons_completed'], expected_lessons)
            quiz_units = min(val['quizzes_passed'], expected_quizzes)
            denom = 1 + expected_lessons + expected_quizzes + 2  # overview + lessons + quizzes + practical + assessment
            # Numerator counts only actually completed units; overview contributes ONLY when explicitly completed
            numer = (1 if val.get('overview_completed') else 0) + lesson_units + quiz_units + (1 if val.get('practical_completed') else 0) + (1 if val.get('assessment_completed') else 0)
            # Gating rules
            all_lessons_quizzes_done = (lesson_units == expected_lessons) and (quiz_units == expected_quizzes) and expected_lessons>0 and expected_quizzes>0
            can_start_practical = all_lessons_quizzes_done
            can_start_assessment = can_start_practical and bool(val['practical_completed'])  # assessment unlocks only after practical completed
            pct = int(round((numer/denom)*100)) if denom > 0 else 0
            # Force percent < 100 until assessment completed
            if pct == 100 and not val['assessment_completed']:
                # Max out just below 100 to signal pending assessment
                pct = 95 if denom > 0 else 0
            enriched.append({**val,
                             'raw_lessons_completed': val.get('lessons_completed',0),
                             'lessons_completed': lesson_units,  # clamp to expected
                             'total_lessons': expected_lessons,
                             'total_quizzes': expected_quizzes,
                             'units_total': denom,
                             'units_completed': numer,
                             'percent': pct,
                             'can_start_practical': can_start_practical,
                             'can_start_assessment': can_start_assessment})
        # Collapse duplicates: ensure only one row per canonical slug is returned to front-end.
        dedup = {}
        for row in enriched:
            slug = _normalize_module_key(row.get('module_name',''))
            if not slug:
                continue
            existing = dedup.get(slug)
            if not existing:
                dedup[slug] = row
            else:
                # Merge by taking max for numeric progress fields to be safe
                for fld in ['lessons_completed','raw_lessons_completed','total_lessons','overview_completed','practical_completed','assessment_completed','quizzes_passed','total_quizzes','units_completed','units_total','percent']:
                    if fld in row and isinstance(row[fld], (int,float)):
                        existing[fld] = max(existing.get(fld,0), row[fld])
                # Gating flags prefer True if any row True
                for gf in ['can_start_practical','can_start_assessment']:
                    if row.get(gf):
                        existing[gf] = True
        # Return stable ordering: expected metadata order then any extras
        ordered = []
        for slug in EXPECTED_MODULE_METADATA.keys():
            if slug in dedup:
                ordered.append(dedup.pop(slug))
        ordered.extend(dedup.values())
        # Inject professional display name field (without mutating canonical slug module_name)
        for r in ordered:
            slug = _normalize_module_key(r.get('module_name',''))
            r['display_name'] = _display_title(slug)
        return ordered
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[ERROR] get_student_modules_summary (student_id={student_id}): {e}")
        # Return 200 with empty list instead of 500 to prevent frontend infinite retries while we diagnose
        return []
    finally:
        cursor.close(); conn.close()

@router.get('/student/{student_id}/modules/summary/raw')
def debug_student_modules_raw(student_id: int):
    """Debug endpoint: return raw rows from student_progress for inspection (no cleanup/merge)."""
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    try:
        # Determine available optional timestamp columns (created_at / updated_at) safely.
        optional_cols = []
        try:
            cursor.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema=%s AND table_name='student_progress' AND column_name IN ('created_at','updated_at')
            """, (MYSQL_CONFIG['database'],))
            found = {r['column_name'] if isinstance(r, dict) else r[0] for r in cursor.fetchall() or []}
            if 'created_at' in found: optional_cols.append('created_at')
            if 'updated_at' in found: optional_cols.append('updated_at')
        except Exception as _:
            pass
        select_cols = [
            'id','module_name','lessons_completed','total_lessons','overview_completed','practical_completed',
            'assessment_completed','quizzes_passed','total_quizzes','time_spent','engagement_score'
        ] + optional_cols
        select_clause = ', '.join(select_cols)
        cursor.execute(f'''SELECT {select_clause} FROM student_progress WHERE student_id=%s ORDER BY module_name''', (student_id,))
        rows = cursor.fetchall() or []
        # Provide normalized slug + display title for clarity
        for r in rows:
            slug = _normalize_module_key(r['module_name'])
            r['normalized_slug'] = slug
            r['display_name'] = _display_title(slug)
        return rows
    except Exception as e:
        print(f"[DEBUG] debug_single_module_progress error: {e}")
        raise HTTPException(status_code=500, detail='debug failed')
    finally:
        cursor.close(); conn.close()

@router.get('/student/{student_id}/module/{module_name}/progress/debug')
def debug_single_module_progress(student_id: int, module_name: str):
    """Return detailed raw + derived progress information for a single module.

    This restores the previously orphaned debug code that caused an IndentationError
    by encapsulating it in a dedicated endpoint. Intended for troubleshooting only.
    """
    norm = _normalize_module_key(module_name)
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute('''SELECT id, student_id, module_name, lessons_completed, total_lessons, overview_completed,
                                 practical_completed, assessment_completed, quizzes_passed, total_quizzes, time_spent, engagement_score
                          FROM student_progress WHERE student_id=%s AND module_name=%s''', (student_id, norm))
        row = cursor.fetchone()
        cursor.execute('''SELECT COUNT(*) AS quiz_events FROM student_module_unit_events
                          WHERE student_id=%s AND module_name=%s AND unit_type='quiz' ''', (student_id, norm))
        quiz_events = cursor.fetchone() or {'quiz_events':0}
        meta = _expected_module_meta(norm) or {}
        cursor.execute('''SELECT COUNT(*) FROM student_lesson_progress
                          WHERE student_id=%s AND module_name=%s AND completed=1''', (student_id, norm))
        derived_lesson_count = cursor.fetchone()[0]
        return {
            'normalized_module': norm,
            'progress_row': row,
            'quiz_event_count': quiz_events['quiz_events'],
            'expected_lessons': meta.get('lessons'),
            'expected_quizzes': meta.get('quizzes'),
            'derived_completed_lessons': derived_lesson_count,
            'note': 'progress_row.total_lessons is a stored legacy field; summary endpoint replaces it with expected_lessons each response.'
        }
    except Exception as e:
        print(f"[DEBUG] debug_single_module_progress error: {e}")
        raise HTTPException(status_code=500, detail='debug failed')
    finally:
        cursor.close(); conn.close()

# --- Lesson completion endpoints (server-authoritative) ---
class SingleLessonCompletion(BaseModel):
    completed: bool = True

@router.get('/student/{student_id}/module/{module_name}/lessons/completed')
def get_completed_lessons(student_id: int, module_name: str):
    """Return the list of completed lesson IDs for this student+module (server-authoritative)."""
    module_name = _normalize_module_key(module_name)
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT lesson_id FROM student_lesson_progress
            WHERE student_id=%s AND module_name=%s AND completed=1
            ORDER BY lesson_id ASC
        ''', (student_id, module_name))
        rows = cursor.fetchall() or []
        lesson_ids = [r[0] for r in rows]
        return { 'student_id': student_id, 'module': module_name, 'lesson_ids': lesson_ids }
    except Exception as e:
        print(f"[ERROR] get_completed_lessons: {e}")
        raise HTTPException(status_code=500, detail='Failed to fetch completed lessons')
    finally:
        cursor.close(); conn.close()

@router.post('/student/{student_id}/module/{module_name}/lesson/{lesson_id}')
def set_single_lesson_completion(student_id: int, module_name: str, lesson_id: str, body: SingleLessonCompletion):
    """Mark one lesson complete/incomplete (idempotent)."""
    module_name = _normalize_module_key(module_name)
    lesson_id = str(lesson_id).strip()
    if not lesson_id:
        raise HTTPException(status_code=400, detail='lesson_id required')
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        completed_val = 1 if body.completed else 0
        cursor.execute('''
            INSERT INTO student_lesson_progress (student_id, module_name, lesson_id, completed)
            VALUES (%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE completed=VALUES(completed), completed_at=CURRENT_TIMESTAMP
        ''', (student_id, module_name, lesson_id, completed_val))
        conn.commit()
        return { 'status':'success', 'lesson_id': lesson_id, 'completed': bool(completed_val) }
    except Exception as e:
        print(f"[ERROR] set_single_lesson_completion: {e}")
        raise HTTPException(status_code=500, detail='Failed to update lesson')
    finally:
        cursor.close(); conn.close()


@router.get('/student/{student_id}/module/{module_name}/quiz')
def get_student_module_quiz(student_id: int, module_name: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ensure_base_progress_tables(cursor)
        cursor.execute('SELECT passed, score, total, attempted_at FROM student_module_quiz WHERE student_id=%s AND module_name=%s', (student_id, module_name))
        row = cursor.fetchone()
        if not row:
            return { 'passed': False, 'score': 0, 'total': 0 }
        return { 'passed': bool(row[0]), 'score': int(row[1]), 'total': int(row[2]), 'attempted_at': row[3] }
    except Exception as e:
        print(f"[ERROR] get_student_module_quiz: {e}")
        raise HTTPException(status_code=500, detail='Failed to fetch module quiz state')
    finally:
        cursor.close()
        conn.close()


@router.post('/student/{student_id}/module/{module_name}/quiz')
def set_student_module_quiz(student_id: int, module_name: str, req: ModuleQuizRequest = Body(...)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ensure_base_progress_tables(cursor)
        passed_val = 1 if req.passed else 0
        # Fetch previous row to compare score/pass for activity log
        prev_passed = 0
        prev_score = None
        try:
            cursor.execute('SELECT passed, score FROM student_module_quiz WHERE student_id=%s AND module_name=%s', (student_id, module_name))
            row_prev = cursor.fetchone()
            if row_prev:
                prev_passed = int(row_prev[0])
                prev_score = int(row_prev[1]) if row_prev[1] is not None else None
        except Exception as _:
            pass
        cursor.execute('''
            INSERT INTO student_module_quiz (student_id, module_name, passed, score, total)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE passed=VALUES(passed), score=VALUES(score), total=VALUES(total), attempted_at=CURRENT_TIMESTAMP
        ''', (student_id, module_name, passed_val, req.score, req.total))
        conn.commit()
        # Log activity only when: first pass OR improved score while already passed
        try:
            should_log = False
            if passed_val and not prev_passed:
                should_log = True
                # Resolve student name for nicer activity feed
                sname = _get_student_name_by_id(cursor, student_id)
                activity = f"{sname} passed quiz for {module_name} (score {req.score}/{req.total})"
            elif passed_val and prev_passed and prev_score is not None and req.score > prev_score:
                should_log = True
                sname = _get_student_name_by_id(cursor, student_id)
                activity = f"{sname} improved quiz score for {module_name} to {req.score}/{req.total}"
            if should_log:
                cursor.execute('INSERT INTO recent_activity (activity) VALUES (%s)', (activity,))
                conn.commit()
        except Exception as _:
            pass
        return { 'status': 'success', 'passed': bool(passed_val), 'score': req.score, 'total': req.total }
    except Exception as e:
        print(f"[ERROR] set_student_module_quiz: {e}")
        raise HTTPException(status_code=500, detail='Failed to set module quiz state')
    finally:
        cursor.close()
        conn.close()