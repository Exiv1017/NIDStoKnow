CREATE TABLE student_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    student_name VARCHAR(255),
    module_name VARCHAR(255),
    lessons_completed INT,
    total_lessons INT,
    last_lesson VARCHAR(255),
    time_spent INT, -- in minutes
    engagement_score VARCHAR(32),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
