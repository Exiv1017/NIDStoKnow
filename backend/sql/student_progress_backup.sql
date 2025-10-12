CREATE TABLE IF NOT EXISTS student_progress_backup (
  id INT NOT NULL AUTO_INCREMENT,
  student_id INT NOT NULL,
  student_name VARCHAR(255) DEFAULT NULL,
  module_name VARCHAR(255) DEFAULT NULL,
  lessons_completed INT DEFAULT NULL,
  total_lessons INT DEFAULT NULL,
  last_lesson VARCHAR(255) DEFAULT NULL,
  time_spent INT DEFAULT NULL,
  engagement_score INT DEFAULT NULL,
  overview_completed TINYINT(1) DEFAULT 0,
  practical_completed TINYINT(1) DEFAULT 0,
  assessment_completed TINYINT(1) DEFAULT 0,
  quizzes_passed INT DEFAULT 0,
  total_quizzes INT DEFAULT 0,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_student_module (student_id, module_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
