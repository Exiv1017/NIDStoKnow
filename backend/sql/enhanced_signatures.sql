-- Enhanced signatures database with Aho-Corasick optimized patterns
INSERT INTO signatures (pattern, description, type, regex) VALUES
-- SSH Attack Patterns (exact string matches for Aho-Corasick)
('ssh ', 'SSH connection attempt', 'SSH', 0),
('ssh -L', 'SSH local port forwarding', 'SSH Port Forwarding', 0),
('ssh -R', 'SSH remote port forwarding', 'SSH Port Forwarding', 0),
('ssh -D', 'SSH dynamic port forwarding', 'SSH Port Forwarding', 0),

-- File Operations (regex patterns)
('cat\\s+.*\\/etc\\/passwd', 'Access to passwd file', 'File Access', 1),
('cat\\s+.*\\/etc\\/shadow', 'Access to shadow file', 'File Access', 1),
('cat\\s+.*\\/etc\\/hosts', 'Access to hosts file', 'File Access', 1),
('cat\\s+.*\\/etc\\/hostname', 'Access to hostname file', 'File Access', 1),
('cat\\s+.*\\/etc\\/resolv\\.conf', 'Access to DNS config', 'File Access', 1),

-- Downloads (regex patterns)
('wget\\s+.*http[s]?:\\/\\/.*\\.(sh|py|exe|bin|tar\\.gz)', 'Suspicious file download', 'Download', 1),
('curl\\s+.*http[s]?:\\/\\/.*\\.(sh|py|exe|bin|tar\\.gz)', 'Suspicious file download', 'Download', 1),

-- Network Scanning (Aho-Corasick + regex)
('nmap', 'Network mapping tool', 'Reconnaissance', 0),
('nmap\\s+.*-[sS]', 'Nmap stealth scan', 'Port Scanning', 1),
('netstat', 'Network statistics command', 'Reconnaissance', 0),
('netstat\\s+.*-[tulpn]', 'Network port enumeration', 'Reconnaissance', 1),
('ss\\s+.*-[tulpn]', 'Socket statistics enumeration', 'Reconnaissance', 1),
('lsof\\s+.*-i', 'List open files network', 'Reconnaissance', 1),

-- Network Tools
('ping', 'Network ping command', 'Reconnaissance', 0),
('traceroute', 'Network trace route', 'Reconnaissance', 0),
('dig', 'DNS lookup tool', 'Reconnaissance', 0),
('nslookup', 'DNS lookup command', 'Reconnaissance', 0),

-- System Information
('uname', 'System information', 'Reconnaissance', 0),
('whoami', 'Current user query', 'Reconnaissance', 0),
('id', 'User ID information', 'Reconnaissance', 0),
('ps', 'Process listing', 'Reconnaissance', 0),

-- Privilege Escalation
('sudo', 'Sudo command usage', 'Privilege Escalation', 0),
('su ', 'Switch user command', 'Privilege Escalation', 0),
('chmod\\s+\\+x', 'Make file executable', 'Execution', 1),

-- Cleanup/Evasion
('history\\s+-c', 'Clear command history', 'Evasion', 1),
('rm\\s+.*\\.bash_history', 'Remove bash history', 'Evasion', 1),
('unset\\s+HISTFILE', 'Disable history logging', 'Evasion', 1);
