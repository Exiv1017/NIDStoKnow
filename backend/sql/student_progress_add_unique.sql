-- Add unique constraint for upsert to work correctly
ALTER TABLE student_progress ADD UNIQUE KEY unique_student_module (student_id, module_name);
