-- Ensure module_requests has admin_comment and decided_at columns (portable way)

-- admin_comment
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'module_requests' AND COLUMN_NAME = 'admin_comment'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE module_requests ADD COLUMN admin_comment TEXT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- decided_at
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'module_requests' AND COLUMN_NAME = 'decided_at'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE module_requests ADD COLUMN decided_at DATETIME NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
