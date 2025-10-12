-- Migration: Add per-module unit completion & quiz counts (compatible with MySQL versions
-- that do NOT support "ADD COLUMN IF NOT EXISTS" inside a multi-column ALTER).
-- Each column added conditionally using information_schema & prepared statements.

SET @db := DATABASE();

-- overview_completed
SELECT COUNT(*) INTO @exists FROM information_schema.columns
  WHERE table_schema=@db AND table_name='student_progress' AND column_name='overview_completed';
SET @sql := IF(@exists=0,
  'ALTER TABLE student_progress ADD COLUMN overview_completed TINYINT(1) DEFAULT 0 AFTER engagement_score',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- practical_completed
SELECT COUNT(*) INTO @exists FROM information_schema.columns
  WHERE table_schema=@db AND table_name='student_progress' AND column_name='practical_completed';
SET @sql := IF(@exists=0,
  'ALTER TABLE student_progress ADD COLUMN practical_completed TINYINT(1) DEFAULT 0 AFTER overview_completed',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- assessment_completed
SELECT COUNT(*) INTO @exists FROM information_schema.columns
  WHERE table_schema=@db AND table_name='student_progress' AND column_name='assessment_completed';
SET @sql := IF(@exists=0,
  'ALTER TABLE student_progress ADD COLUMN assessment_completed TINYINT(1) DEFAULT 0 AFTER practical_completed',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- quizzes_passed
SELECT COUNT(*) INTO @exists FROM information_schema.columns
  WHERE table_schema=@db AND table_name='student_progress' AND column_name='quizzes_passed';
SET @sql := IF(@exists=0,
  'ALTER TABLE student_progress ADD COLUMN quizzes_passed INT DEFAULT 0 AFTER assessment_completed',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- total_quizzes
SELECT COUNT(*) INTO @exists FROM information_schema.columns
  WHERE table_schema=@db AND table_name='student_progress' AND column_name='total_quizzes';
SET @sql := IF(@exists=0,
  'ALTER TABLE student_progress ADD COLUMN total_quizzes INT DEFAULT 0 AFTER quizzes_passed',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Supporting events table for detailed unit completion audit (idempotent)
CREATE TABLE IF NOT EXISTS student_module_unit_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  module_name VARCHAR(255) NOT NULL,
  unit_type ENUM('overview','lesson','quiz','practical','assessment') NOT NULL,
  unit_code VARCHAR(64) NULL,
  completed TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_student_module (student_id, module_name),
  INDEX idx_unit_type (unit_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
