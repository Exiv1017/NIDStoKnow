CREATE TABLE IF NOT EXISTS student_section_progress (
  id INT NOT NULL AUTO_INCREMENT,
  student_id INT NOT NULL,
  module_name VARCHAR(255) NOT NULL,
  section_name VARCHAR(255) NOT NULL,
  completed TINYINT(1) DEFAULT 0,
  unlocked TINYINT(1) DEFAULT 0,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_student_module_section (student_id, module_name, section_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
