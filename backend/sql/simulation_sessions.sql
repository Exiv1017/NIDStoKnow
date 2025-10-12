CREATE TABLE IF NOT EXISTS simulation_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  student_name VARCHAR(255) NULL,
  role ENUM('attacker','defender') NOT NULL,
  score INT DEFAULT 0,
  lobby_code VARCHAR(64) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_student_role_time (student_id, role, created_at),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
