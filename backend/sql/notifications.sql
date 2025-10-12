-- Notifications table canonical schema
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipient_id INT NULL,
  recipient_role VARCHAR(20) NULL,
  message VARCHAR(512) NOT NULL,
  type VARCHAR(50) DEFAULT 'info',
  `read` TINYINT(1) DEFAULT 0,
  `time` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_recipient (recipient_role, recipient_id),
  INDEX idx_time (`time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
