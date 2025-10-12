-- Migration: create student_module_quiz table
CREATE TABLE IF NOT EXISTS student_module_quiz (
  student_id INT NOT NULL,
  module_name VARCHAR(255) NOT NULL,
  passed TINYINT(1) NOT NULL DEFAULT 0,
  score INT DEFAULT 0,
  total INT DEFAULT 0,
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id, module_name)
);
