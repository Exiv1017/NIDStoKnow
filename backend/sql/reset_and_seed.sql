-- Reset users/instructors/students and progress, then seed a new admin
-- Run inside MySQL after selecting the database: USE nids_to_know;

SET FOREIGN_KEY_CHECKS = 0;

-- Progress/data tables (ignore if not exist)
DROP TABLE IF EXISTS student_lesson_progress;
DROP TABLE IF EXISTS student_module_quiz;
DROP TABLE IF EXISTS student_progress;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS recent_activity;
DROP TABLE IF EXISTS feedback;
DROP TABLE IF EXISTS submissions;

-- Users and related
DROP TABLE IF EXISTS admin_notifications;
DROP TABLE IF EXISTS admin_system_settings;
DROP TABLE IF EXISTS admin_audit_logs;
DROP TABLE IF EXISTS instructor_settings;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS admins;

-- Recreate minimal tables required to log in again
CREATE TABLE IF NOT EXISTS admins (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash TEXT,
  PRIMARY KEY (id),
  UNIQUE KEY email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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

-- Progress tables (empty definitions)
CREATE TABLE IF NOT EXISTS student_progress (
  id INT NOT NULL AUTO_INCREMENT,
  student_id INT NOT NULL,
  student_name VARCHAR(255) DEFAULT NULL,
  module_name VARCHAR(255) DEFAULT NULL,
  lessons_completed INT DEFAULT NULL,
  total_lessons INT DEFAULT NULL,
  last_lesson VARCHAR(255) DEFAULT NULL,
  time_spent INT DEFAULT NULL,
  engagement_score INT DEFAULT NULL,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_student_module (student_id, module_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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

CREATE TABLE IF NOT EXISTS student_module_quiz (
  student_id INT NOT NULL,
  module_name VARCHAR(255) NOT NULL,
  passed TINYINT(1) NOT NULL DEFAULT 0,
  score INT DEFAULT 0,
  total INT DEFAULT 0,
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id, module_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Seed the requested admin. Note: generate a fresh hash using the app if needed.
-- Replace <PASSWORD_HASH> with the actual hash if running purely via SQL.
-- Example only (won't work as-is):
-- INSERT INTO admins (name, email, password_hash) VALUES ('NIDSToKnow Admin', 'nidstoknowadmin@admin.com', '<PASSWORD_HASH>');

-- Activity feed for instructors
CREATE TABLE IF NOT EXISTS recent_activity (
  id INT NOT NULL AUTO_INCREMENT,
  activity VARCHAR(512) NOT NULL,
  time TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Student submissions (practicals, assessments)
CREATE TABLE IF NOT EXISTS submissions (
  id INT NOT NULL AUTO_INCREMENT,
  student_id INT NOT NULL,
  student_name VARCHAR(255) NOT NULL,
  module_slug VARCHAR(255) NOT NULL,
  module_title VARCHAR(255) NOT NULL,
  submission_type ENUM('practical','assessment') NOT NULL,
  payload JSON,
  totals_rule_count INT DEFAULT 0,
  totals_total_matches INT DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_student_id (student_id),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
