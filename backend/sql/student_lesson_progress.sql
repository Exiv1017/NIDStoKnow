-- Add per-lesson progress tracking
CREATE TABLE IF NOT EXISTS student_lesson_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    module_name VARCHAR(255) NOT NULL,
    lesson_id VARCHAR(255) NOT NULL,
    completed TINYINT(1) DEFAULT 1,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_student_module_lesson (student_id, module_name, lesson_id)
);
