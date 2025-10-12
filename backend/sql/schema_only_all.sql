-- Schema-only initializer for NIDSToKnow
-- Creates all required tables if they do not exist. No DROPs. No INSERTs.
-- Safe to run multiple times.

-- Core identity tables
CREATE TABLE IF NOT EXISTS admins (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash TEXT,
  PRIMARY KEY (id),
  UNIQUE KEY email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Seed required admin if missing (idempotent)
INSERT INTO admins (id, name, email, password_hash)
SELECT 1, 'NIDSToKnow Admin', 'nidstoknowadmin@admin.com', 'scrypt:32768:8:1$R0ReVnsr4r7dtV7P$f6a43b797c2784b0b2e52175b02dbe429557c99c6f16c3e122a7036906ad3da805b6199af17ed6a776c8536c6a085af282e8f059fb88468ed94bfbf8a752f990'
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE email='nidstoknowadmin@admin.com');

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

-- Notifications and activity
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

CREATE TABLE IF NOT EXISTS recent_activity (
  id INT NOT NULL AUTO_INCREMENT,
  activity VARCHAR(512) NOT NULL,
  time TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Feedback
CREATE TABLE IF NOT EXISTS feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  instructor_id INT NULL,
  student_id INT NULL,
  submission_id INT NULL,
  assignment_id INT NULL,
  message TEXT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Instructor profile/settings
CREATE TABLE IF NOT EXISTS instructor_profiles (
  instructor_id INT NOT NULL,
  join_date DATE NULL,
  avatar_url VARCHAR(512) NULL,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (instructor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS instructor_settings (
  instructor_id INT NOT NULL,
  notifications_text LONGTEXT NULL,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (instructor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Student profiles/settings
CREATE TABLE IF NOT EXISTS student_profiles (
  student_id INT NOT NULL,
  join_date DATE NULL,
  avatar_url VARCHAR(512) NULL,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS student_settings (
  student_id INT NOT NULL,
  notifications_text LONGTEXT NULL,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Assignments and requests
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

CREATE TABLE IF NOT EXISTS module_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  instructor_id INT NOT NULL,
  module_name VARCHAR(255) NOT NULL,
  category VARCHAR(255) DEFAULT 'General',
  details TEXT NULL,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  decided_at TIMESTAMP NULL,
  admin_comment TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Signatures (rules)
CREATE TABLE IF NOT EXISTS signatures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_name VARCHAR(255) NOT NULL,
  pattern TEXT NOT NULL,
  severity ENUM('low','medium','high') DEFAULT 'low',
  category VARCHAR(100) DEFAULT 'general',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Isolation Forest related tables
CREATE TABLE IF NOT EXISTS isolation_forest_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  n_estimators INT DEFAULT 100,
  max_samples INT DEFAULT 256,
  contamination FLOAT DEFAULT 0.1,
  random_state INT DEFAULT 42,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS anomaly_feature_patterns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  feature_name VARCHAR(255) NOT NULL,
  pattern JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS isolation_forest_training_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  feature_vector JSON,
  label VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS anomaly_boost_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  feature_name VARCHAR(255) NOT NULL,
  boost_factor FLOAT DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Student progress and lessons
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

CREATE TABLE IF NOT EXISTS student_module_unit_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  module_slug VARCHAR(255) NOT NULL,
  unit VARCHAR(255) NOT NULL,
  event VARCHAR(100) NOT NULL,
  occurred_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_student_unit_time (student_id, unit, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Student section progress & backup
CREATE TABLE IF NOT EXISTS student_section_progress (
  id INT NOT NULL AUTO_INCREMENT,
  student_id INT NOT NULL,
  module_name VARCHAR(255) NOT NULL,
  section_name VARCHAR(255) NOT NULL,
  completed TINYINT(1) DEFAULT 0,
  unlocked TINYINT(1) DEFAULT 0,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_student_module_section (student_id, module_name, section_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS student_progress_backup (
  id INT NOT NULL AUTO_INCREMENT,
  student_id INT NOT NULL,
  student_name VARCHAR(255) DEFAULT NULL,
  module_name VARCHAR(255) DEFAULT NULL,
  lessons_completed INT DEFAULT NULL,
  total_lessons INT DEFAULT NULL,
  last_lesson VARCHAR(255) DEFAULT NULL,
  time_spent INT DEFAULT NULL,
  engagement_score INT DEFAULT NULL,
  overview_completed TINYINT(1) DEFAULT 0,
  practical_completed TINYINT(1) DEFAULT 0,
  assessment_completed TINYINT(1) DEFAULT 0,
  quizzes_passed INT DEFAULT 0,
  total_quizzes INT DEFAULT 0,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_student_module (student_id, module_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Submissions
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

-- Simulation
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
