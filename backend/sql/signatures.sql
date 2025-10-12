-- SQL schema for signatures table
CREATE TABLE IF NOT EXISTS signatures (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pattern VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    type VARCHAR(64) DEFAULT NULL,
    regex BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Example insert
INSERT INTO signatures (pattern, description, type, regex) VALUES
('nmap', 'Nmap scan detected', 'Recon', 0),
('cat\\s+.*\\/etc\\/passwd', 'Sensitive file access', 'File Access', 1),
('cat\\s+.*\\/etc\\/shadow', 'Shadow file access', 'File Access', 1),
('wget\\s+.*', 'Wget download', 'Download', 1),
('curl\\s+.*', 'Curl download', 'Download', 1),
('chmod\\s+\\+x\\s+.*', 'Chmod +x execution', 'Execution', 1),
('rm\\s+-rf\\s+.*', 'Dangerous file removal', 'Destruction', 1);
