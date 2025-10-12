-- Ensure helpful indexes on assignments for instructor/student queries

-- idx_assignments_student
SET @idx_exists := (
	SELECT COUNT(*) FROM information_schema.STATISTICS
	WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignments' AND INDEX_NAME = 'idx_assignments_student'
);
SET @ddl := IF(@idx_exists = 0,
	'CREATE INDEX idx_assignments_student ON assignments (student_id, created_at)',
	'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- idx_assignments_instructor
SET @idx_exists := (
	SELECT COUNT(*) FROM information_schema.STATISTICS
	WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignments' AND INDEX_NAME = 'idx_assignments_instructor'
);
SET @ddl := IF(@idx_exists = 0,
	'CREATE INDEX idx_assignments_instructor ON assignments (instructor_id, created_at)',
	'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
