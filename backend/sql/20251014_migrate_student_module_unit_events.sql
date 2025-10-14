-- Migration: Align student_module_unit_events schema with backend expectations
-- Safe for MySQL 8.x variants that may not support ADD COLUMN IF NOT EXISTS
-- New schema columns: id, student_id, module_name, unit_type, unit_code, completed, duration_seconds, created_at
-- Indexes: idx_student_module (student_id, module_name), idx_unit_type (unit_type)

SET @db := DATABASE();

-- Does the table exist?
SELECT COUNT(*) INTO @tbl_exists
FROM information_schema.tables
WHERE table_schema=@db AND table_name='student_module_unit_events';

-- Helper to run conditional DDL
-- Usage: set @stmt := IF(<cond>, 'SQL', 'SELECT 1'); PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- If table does not exist, create with new schema
SET @stmt := IF(@tbl_exists=0,
  'CREATE TABLE student_module_unit_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      module_name VARCHAR(255) NOT NULL,
      unit_type ENUM("overview","lesson","quiz","practical","assessment") NOT NULL,
      unit_code VARCHAR(64) NULL,
      completed TINYINT(1) DEFAULT 1,
      duration_seconds INT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_student_module (student_id, module_name),
      INDEX idx_unit_type (unit_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
  'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- If table exists and appears to be legacy (has module_slug), migrate by recreate/swap
SELECT COUNT(*) INTO @has_legacy
FROM information_schema.columns
WHERE table_schema=@db AND table_name='student_module_unit_events' AND column_name='module_slug';

SET @stmt := IF(@tbl_exists=1 AND @has_legacy>0,
  'CREATE TABLE IF NOT EXISTS student_module_unit_events_new (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      module_name VARCHAR(255) NOT NULL,
      unit_type ENUM("overview","lesson","quiz","practical","assessment") NOT NULL,
      unit_code VARCHAR(64) NULL,
      completed TINYINT(1) DEFAULT 1,
      duration_seconds INT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_student_module (student_id, module_name),
      INDEX idx_unit_type (unit_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
  'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- Copy data from legacy to new if legacy detected
SET @stmt := IF(@tbl_exists=1 AND @has_legacy>0,
  'INSERT INTO student_module_unit_events_new (student_id, module_name, unit_type, unit_code, completed, duration_seconds, created_at)
     SELECT 
       student_id,
       COALESCE(module_slug, "") AS module_name,
       CASE LOWER(COALESCE(event, ""))
         WHEN "overview" THEN "overview"
         WHEN "practical" THEN "practical"
         WHEN "assessment" THEN "assessment"
         WHEN "quiz" THEN "quiz"
         ELSE "lesson"
       END AS unit_type,
       unit AS unit_code,
       1 AS completed,
       0 AS duration_seconds,
       occurred_at AS created_at
     FROM student_module_unit_events',
  'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- Replace legacy table with new if we populated the temp table
SET @stmt := IF(@tbl_exists=1 AND @has_legacy>0,
  'DROP TABLE student_module_unit_events', 'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := IF(@tbl_exists=1 AND @has_legacy>0,
  'RENAME TABLE student_module_unit_events_new TO student_module_unit_events', 'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- Ensure required columns exist (for environments where table existed but wasn''t legacy, just missing some cols)
-- module_name
SELECT COUNT(*) INTO @has_col FROM information_schema.columns 
WHERE table_schema=@db AND table_name='student_module_unit_events' AND column_name='module_name';
SET @stmt := IF(@has_col=0, 'ALTER TABLE student_module_unit_events ADD COLUMN module_name VARCHAR(255) NOT NULL AFTER student_id', 'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- unit_type
SELECT COUNT(*) INTO @has_col FROM information_schema.columns 
WHERE table_schema=@db AND table_name='student_module_unit_events' AND column_name='unit_type';
SET @stmt := IF(@has_col=0, 'ALTER TABLE student_module_unit_events ADD COLUMN unit_type ENUM("overview","lesson","quiz","practical","assessment") NOT NULL AFTER module_name', 'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- unit_code
SELECT COUNT(*) INTO @has_col FROM information_schema.columns 
WHERE table_schema=@db AND table_name='student_module_unit_events' AND column_name='unit_code';
SET @stmt := IF(@has_col=0, 'ALTER TABLE student_module_unit_events ADD COLUMN unit_code VARCHAR(64) NULL AFTER unit_type', 'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- completed
SELECT COUNT(*) INTO @has_col FROM information_schema.columns 
WHERE table_schema=@db AND table_name='student_module_unit_events' AND column_name='completed';
SET @stmt := IF(@has_col=0, 'ALTER TABLE student_module_unit_events ADD COLUMN completed TINYINT(1) DEFAULT 1 AFTER unit_code', 'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- duration_seconds (add after completed if possible)
SELECT COUNT(*) INTO @has_col FROM information_schema.columns 
WHERE table_schema=@db AND table_name='student_module_unit_events' AND column_name='duration_seconds';
SET @stmt := IF(@has_col=0, 'ALTER TABLE student_module_unit_events ADD COLUMN duration_seconds INT NULL DEFAULT 0 AFTER completed', 'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- created_at
SELECT COUNT(*) INTO @has_col FROM information_schema.columns 
WHERE table_schema=@db AND table_name='student_module_unit_events' AND column_name='created_at';
SET @stmt := IF(@has_col=0, 'ALTER TABLE student_module_unit_events ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- Ensure indexes
SELECT COUNT(*) INTO @has_idx FROM information_schema.statistics
WHERE table_schema=@db AND table_name='student_module_unit_events' AND index_name='idx_student_module';
SET @stmt := IF(@has_idx=0, 'ALTER TABLE student_module_unit_events ADD INDEX idx_student_module (student_id, module_name)', 'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SELECT COUNT(*) INTO @has_idx2 FROM information_schema.statistics
WHERE table_schema=@db AND table_name='student_module_unit_events' AND index_name='idx_unit_type';
SET @stmt := IF(@has_idx2=0, 'ALTER TABLE student_module_unit_events ADD INDEX idx_unit_type (unit_type)', 'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- Done-- Migrate student_module_unit_events to the schema expected by the backend
-- Safe and idempotent: add missing columns and indexes; do not drop legacy ones.

-- Ensure table exists (no-op if it already does)
CREATE TABLE IF NOT EXISTS student_module_unit_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  module_name VARCHAR(255) NOT NULL,
  unit_type ENUM('overview','lesson','quiz','practical','assessment') NOT NULL,
  unit_code VARCHAR(64) NULL,
  completed TINYINT(1) DEFAULT 1,
  duration_seconds INT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Columns (MySQL 8.0 supports IF NOT EXISTS for ADD COLUMN)
ALTER TABLE student_module_unit_events ADD COLUMN IF NOT EXISTS module_name VARCHAR(255) NULL;
ALTER TABLE student_module_unit_events ADD COLUMN IF NOT EXISTS unit_type ENUM('overview','lesson','quiz','practical','assessment') NULL;
ALTER TABLE student_module_unit_events ADD COLUMN IF NOT EXISTS unit_code VARCHAR(64) NULL;
ALTER TABLE student_module_unit_events ADD COLUMN IF NOT EXISTS completed TINYINT(1) DEFAULT 1;
ALTER TABLE student_module_unit_events ADD COLUMN IF NOT EXISTS duration_seconds INT NULL DEFAULT 0;
ALTER TABLE student_module_unit_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP;

-- Indexes if missing (use information_schema + dynamic SQL)
SET @db := DATABASE();
SET @have_idx_student_module := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema=@db AND table_name='student_module_unit_events' AND index_name='idx_student_module'
);
SET @have_idx_unit_type := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema=@db AND table_name='student_module_unit_events' AND index_name='idx_unit_type'
);
SET @sql := IF(@have_idx_student_module=0, 'ALTER TABLE student_module_unit_events ADD INDEX idx_student_module (student_id, module_name)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF(@have_idx_unit_type=0, 'ALTER TABLE student_module_unit_events ADD INDEX idx_unit_type (unit_type)', 'SELECT 1');
PREPARE stmt2 FROM @sql; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- Note: We intentionally keep any legacy columns (module_slug, unit, event, occurred_at) for now.
