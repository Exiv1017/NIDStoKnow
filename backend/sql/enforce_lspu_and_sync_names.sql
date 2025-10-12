-- Enforce LSPU email domain and keep student_progress.student_name in sync
-- Requires MySQL 8.0.16+ for CHECK constraints.

START TRANSACTION;

-- Normalize existing emails to lowercase (idempotent)
UPDATE users SET email = LOWER(email);

-- Enforce LSPU domain (will fail if any row violates it)
ALTER TABLE users
  ADD CONSTRAINT chk_users_lspu_email CHECK (email LIKE '%@lspu.edu.ph');

COMMIT;

-- Keep student_progress.student_name synchronized when a student's name changes
DROP TRIGGER IF EXISTS trg_sync_student_name;
DELIMITER //
CREATE TRIGGER trg_sync_student_name
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  IF NEW.userType = 'student' AND NEW.name <> OLD.name THEN
    UPDATE student_progress
      SET student_name = NEW.name
      WHERE student_id = NEW.id;
  END IF;
END //
DELIMITER ;

-- Verification helpers (optional):
-- SELECT SUM(email LIKE '%@lspu.edu.ph') AS lspu_ok, SUM(email NOT LIKE '%@lspu.edu.ph') AS lspu_bad FROM users;