-- Migration: Bring notifications table up to canonical schema by adding missing columns/indexes if they don't exist
-- Safe to run multiple times.

SET @db := DATABASE();

-- recipient_id
SELECT COUNT(*) INTO @exists FROM information_schema.columns
  WHERE table_schema=@db AND table_name='notifications' AND column_name='recipient_id';
SET @sql := IF(@exists=0,
  'ALTER TABLE notifications ADD COLUMN recipient_id INT NULL AFTER id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- recipient_role
SELECT COUNT(*) INTO @exists FROM information_schema.columns
  WHERE table_schema=@db AND table_name='notifications' AND column_name='recipient_role';
SET @sql := IF(@exists=0,
  "ALTER TABLE notifications ADD COLUMN recipient_role VARCHAR(20) NULL AFTER recipient_id",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- read flag
SELECT COUNT(*) INTO @exists FROM information_schema.columns
  WHERE table_schema=@db AND table_name='notifications' AND column_name='read';
SET @sql := IF(@exists=0,
  'ALTER TABLE notifications ADD COLUMN `read` TINYINT(1) DEFAULT 0 AFTER type',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ensure time column exists (older schema may have it already)
SELECT COUNT(*) INTO @exists FROM information_schema.columns
  WHERE table_schema=@db AND table_name='notifications' AND column_name='time';
SET @sql := IF(@exists=0,
  'ALTER TABLE notifications ADD COLUMN `time` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP AFTER `read`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- idx_recipient (recipient_role, recipient_id)
SELECT COUNT(*) INTO @exists FROM information_schema.statistics
  WHERE table_schema=@db AND table_name='notifications' AND index_name='idx_recipient';
SET @sql := IF(@exists=0,
  'CREATE INDEX idx_recipient ON notifications (recipient_role, recipient_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- idx_time on time
SELECT COUNT(*) INTO @exists FROM information_schema.statistics
  WHERE table_schema=@db AND table_name='notifications' AND index_name='idx_time';
SET @sql := IF(@exists=0,
  'CREATE INDEX idx_time ON notifications (`time`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
