-- Migrate student_module_unit_events to the schema expected by the backend
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
