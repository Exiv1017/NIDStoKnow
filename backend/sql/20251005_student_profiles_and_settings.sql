-- Migration: Student profiles (join_date, avatar_url) and student settings (notifications JSON)
-- Date: 2025-10-05

-- Create profiles table if missing
CREATE TABLE IF NOT EXISTS student_profiles (
  student_id INT NOT NULL,
  join_date DATE NULL,
  avatar_url VARCHAR(512) NULL,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create settings table if missing
CREATE TABLE IF NOT EXISTS student_settings (
  student_id INT NOT NULL,
  notifications_text LONGTEXT NULL,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Optional: best-effort schema alignment for existing installs (idempotent)
-- Use IF NOT EXISTS so re-running doesn't error if columns already exist (requires MySQL 8.0+).
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS join_date DATE NULL;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512) NULL;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE student_settings ADD COLUMN IF NOT EXISTS notifications_text LONGTEXT NULL;
ALTER TABLE student_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
