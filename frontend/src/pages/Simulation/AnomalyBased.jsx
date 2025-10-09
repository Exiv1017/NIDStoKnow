import React, { useState, useRef, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js';
import { Link } from 'react-router-dom';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import RealTerminal from '../../components/RealTerminal';

// Simple sequence similarity helper used by behavioral analyzer
function calculateSequenceSimilarity(a, b) {
  try {
    if (!Array.isArray(a) || !Array.isArray(b) || (a.length === 0 && b.length === 0)) return 0;
    const setA = new Set(a.map(String));
    const setB = new Set(b.map(String));
    const intersection = [...setA].filter(x => setB.has(x)).length;
    const union = new Set([...setA, ...setB]).size || 1;
    return intersection / union; // Jaccard similarity 0..1
  } catch {
    return 0;
  }
}

// Anomaly Detection Parameters
const algorithmParameters = {
  statistical: {
    sensitivity: 0.8, // Anomaly detection sensitivity (0-1)
    windowSize: 100, // Number of commands in sliding window
    threshold: 2.0, // Standard deviations from mean
    updateInterval: 60, // Seconds between model updates
  },
  behavioral: {
    commandFrequency: true, // Track command frequency
    timePatterns: true, // Track time-based patterns
    sequenceAnalysis: true, // Track command sequences
    userProfiles: true, // Maintain user behavior profiles
  },
  machineLearning: {
    modelType: 'isolation_forest', // 'isolation_forest' or 'one_class_svm'
    contamination: 0.1, // Expected proportion of anomalies
    nEstimators: 100, // Number of trees for isolation forest
    kernel: 'rbf', // Kernel for SVM
  }
};

// Training Dataset - Normal Behavior Patterns
const trainingDataset = {
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
      workingHours: [9, 17], // 9 AM to 5 PM
      breakPatterns: [12, 13], // Lunch break
      sessionLength: 1800 // Average session length in seconds
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
      workingHours: [0, 6], // Midnight to 6 AM
      breakPatterns: [],
      sessionLength: 300 // Short sessions
    },
    commandSequences: [
      ['wget', 'chmod', './'],
      ['nmap', 'ssh', 'cat'],
      ['curl', 'chmod', 'rm']
    ]
  }
};

// Anomaly Detection Algorithms
const anomalyAlgorithms = {
  statistical: {
    // Moving Average and Standard Deviation
    calculateStats: (window) => {
      const values = window.map(cmd => cmd.frequency);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
      return {
        mean,
        stdDev: Math.sqrt(variance)
      };
    },
    // Z-score calculation
    calculateZScore: (value, mean, stdDev) => {
      return (value - mean) / stdDev;
    }
  },
  behavioral: {
    // Command sequence analysis
    analyzeSequence: (sequence, normalSequences) => {
      const maxSimilarity = Math.max(...normalSequences.map(normal => 
        calculateSequenceSimilarity(sequence, normal)
      ));
      return 1 - maxSimilarity; // Lower similarity = higher anomaly score
    },
    // Time pattern analysis
    analyzeTimePattern: (timestamp, normalPatterns) => {
      const hour = new Date(timestamp).getHours();
      const isWorkingHour = hour >= normalPatterns.workingHours[0] && 
                           hour <= normalPatterns.workingHours[1];
      return isWorkingHour ? 0 : 1;
    }
  },
  machineLearning: {
    // Isolation Forest implementation
    isolationForest: {
      trees: [],
      trained: false,
      maxDepth: 8,
      
      // Initialize the forest with random trees
      initializeForest: function() {
        this.trees = [];
        for (let i = 0; i < algorithmParameters.machineLearning.nEstimators; i++) {
          this.trees.push(this.createTree());
        }
        this.trained = true;
      },
      
      // Create a single isolation tree
      createTree: function() {
        return {
          maxDepth: this.maxDepth,
          split: function(data, depth = 0) {
            if (depth >= this.maxDepth || data.length <= 1) {
              return { isLeaf: true, size: data.length };
            }
            
            // Randomly select feature and split value
            const featureIndex = Math.floor(Math.random() * data[0].length);
            const values = data.map(d => d[featureIndex]);
            const minVal = Math.min(...values);
            const maxVal = Math.max(...values);
            const splitValue = minVal + Math.random() * (maxVal - minVal);
            
            const leftData = data.filter(d => d[featureIndex] < splitValue);
            const rightData = data.filter(d => d[featureIndex] >= splitValue);
            
            return {
              isLeaf: false,
              featureIndex,
              splitValue,
              left: this.split(leftData, depth + 1),
              right: this.split(rightData, depth + 1)
            };
          }
        };
      },
      
      // Calculate path length for a single sample in a tree
      pathLength: function(sample, node, depth = 0) {
        if (node.isLeaf) {
          // Estimate path length for leaf node
          return depth + this.averagePathLength(node.size);
        }
        
        if (sample[node.featureIndex] < node.splitValue) {
          return this.pathLength(sample, node.left, depth + 1);
        } else {
          return this.pathLength(sample, node.right, depth + 1);
        }
      },
      
      // Average path length of unsuccessful search in BST
      averagePathLength: function(n) {
        if (n <= 1) return 0;
        return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
      },
      
      // Train the forest with normal behavior data
      train: function(normalData) {
        if (!this.trained) {
          this.initializeForest();
        }
        
        // Build trees with normal training data
        this.trees = this.trees.map(tree => {
          const sampleSize = Math.min(normalData.length, 256); // Subsample for efficiency
          const sample = this.sampleData(normalData, sampleSize);
          return {
            ...tree,
            root: tree.split(sample)
          };
        });
      },

      // Random subsample without replacement
      sampleData: function(data, sampleSize) {
        if (!Array.isArray(data) || data.length === 0) return [];
        const size = Math.max(1, Math.min(sampleSize ?? 256, data.length));
        const copy = data.slice();
        const result = [];
        for (let i = 0; i < size; i++) {
          const idx = Math.floor(Math.random() * copy.length);
          result.push(copy.splice(idx, 1)[0]);
        }
        return result;
      },

      // Compute anomaly score using average path length across trees
      getAnomalyScore: function(sample) {
        try {
          if (!this.trained || !this.trees || this.trees.length === 0) return 0.2;
          if (!Array.isArray(sample)) return 0.2;
          const validTrees = this.trees.filter(t => t && t.root);
          if (validTrees.length === 0) return 0.2;
          const avgPath = validTrees.reduce((sum, t) => sum + this.pathLength(sample, t.root, 0), 0) / validTrees.length;
          const c = this.averagePathLength(256);
          let score = Math.pow(2, -avgPath / (c || 1)); // 0..1
          if (!Number.isFinite(score)) score = 0.2;
          return Math.max(0, Math.min(1, score));
        } catch (e) {
          return 0.2;
        }
      },

      // Predict anomaly boolean from score
      predict: function(sample) {
        const s = this.getAnomalyScore(sample);
        // conservative raw threshold; UI applies boosted threshold later
        return s > 0.6;
      }
    }
  }
};

const AnomalyBased = () => {
  const [activeTab, setActiveTab] = useState('theory');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [detectionResults, setDetectionResults] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [parameters, setParameters] = useState(algorithmParameters);
  const containerRef = useRef(null);
  const terminalRef = useRef(null);

  // --- UI/UX polish states (simulation only) ---
  const [paused, setPaused] = useState(false);              // pause live anomaly processing
  const [filterText, setFilterText] = useState('');         // filter detection log
  const [detectionLog, setDetectionLog] = useState([]);     // historical list
  const [showLivePanel, setShowLivePanel] = useState(true); // collapsible live
  const [showAnalytics, setShowAnalytics] = useState(true); // collapsible analytics
  const MAX_LIVE = 5;
  const [anomalySeries, setAnomalySeries] = useState([]); // time series of anomaly scores
  const [selectedAnomaly, setSelectedAnomaly] = useState(null); // currently inspected anomaly
  const [modelMeta, setModelMeta] = useState(null); // isolation forest model metadata
  const [showRaw, setShowRaw] = useState(true); // toggle raw vs boosted series
  const [showPatternLibrary, setShowPatternLibrary] = useState(false); // collapsible drawer
  const [patterns, setPatterns] = useState([]); // anomaly feature patterns
  const [patternFilter, setPatternFilter] = useState('');
  const [patternFallbackUsed, setPatternFallbackUsed] = useState(false);

  // Handle tab switch between theory and simulation
  const handleTabChange = (tab) => {
    try {
      setActiveTab(tab);
      if (tab === 'simulation') {
        setDetectionResults([]);
        setDetectionLog([]);
        setAnomalySeries([]);
        setSelectedAnomaly(null);
        setPaused(false);
      }
      // Exit fullscreen when switching tabs to avoid UI getting stuck in full view
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      }
    } catch (e) {
      console.warn('Tab change failed, forcing state update', e);
      setActiveTab(tab);
    }
  };

  // Feature labels corresponding to generated feature vector order
  const featureLabels = [
    'Session Cmd Volume',
    'Command Diversity',
    'Avg Interval',
    'Hour of Day',
    'Command Length',
    'Word Count',
    'Special Chars',
    'Has Path',
    'Has URL',
    'Cmd Frequency',
    'Suspicious Cmd',
    'Sensitive File Access',
    'Network Activity',
    'Script Execution'
  ];

  // State for anomaly detection
  const [commandWindow, setCommandWindow] = useState([]);
  const [behaviorProfile, setBehaviorProfile] = useState({
    commandFrequency: {},
    timePatterns: {},
    sequences: []
  });

  // Anomaly detection patterns for interactive mode
  const anomalyPatterns = [
    { 
      type: 'Timing Anomaly',
      check: (command, prevCommand, timeSinceLastCommand) => timeSinceLastCommand < 500,
      severity: 'High',
      description: 'Command executed too quickly'
    },
    {
      type: 'Sequence Anomaly',
      check: (command, prevCommand) => {
        const suspiciousSequences = [
          ['uname', 'cat /etc/passwd'],
          ['wget', 'chmod'],
          ['netstat', 'cat /etc/shadow']
        ];
        return suspiciousSequences.some(seq => 
          prevCommand?.includes(seq[0]) && command.includes(seq[1])
        );
      },
      severity: 'High',
      description: 'Suspicious command sequence detected'
    },
    {
      type: 'Frequency Anomaly',
      check: (command, commandHistory) => {
        const commandCount = commandHistory.filter(cmd => cmd === command).length;
        return commandCount > 5;
      },
      severity: 'Medium',
      description: 'Unusual command repetition detected'
    }
  ];

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

  // Initialize and train Isolation Forest
  useEffect(() => {
    // Generate training data from normal behavior patterns
    const generateTrainingData = () => {
      const trainingData = [];
      
      // Generate normal command patterns (300 samples)
      for (let i = 0; i < 300; i++) {
        // Normal working patterns - 14 features to match detection
        const features = [
          Math.random() * 0.4, // sessionCommands / 50 (low session activity)
          Math.random() * 0.5 + 0.3, // uniqueCommands / 15 (good diversity)
          Math.random() * 0.6 + 0.3, // avgTimeBetweenCommands / 3000 (normal pace)
          (Math.random() * 8 + 9) / 24, // currentHour / 24 (working hours 9-17)
          Math.random() * 0.6 + 0.2, // commandLength / 50 (normal commands)
          Math.random() * 0.5 + 0.3, // wordCount / 8 (normal complexity)
          Math.random() < 0.3 ? 1.5 : 0, // hasSpecialChars (occasional)
          Math.random() < 0.4 ? 1 : 0, // hasPath (occasional)
          0, // hasURL (rare in normal usage)
          Math.random() * 0.2, // commandFrequency (low repetition)
          0, // hasSuspiciousCommands (none)
          0, // hasFileAccess (none)
          0, // hasNetworkActivity (none)
          0  // hasScriptExecution (none)
        ];
        trainingData.push(features);
      }
      
      // Generate suspicious/anomalous patterns (200 samples)
      for (let i = 0; i < 200; i++) {
        const features = [
          Math.random() * 1.5 + 0.5, // Higher session activity
          Math.random() * 1.2 + 0.2, // Variable diversity
          Math.random() * 0.8 + 0.1, // Faster or erratic timing
          Math.random() < 0.3 ? Math.random() * 6 / 24 : Math.random(), // Off-hours bias
          Math.random() * 2 + 0.5, // Longer commands
          Math.random() * 1.5 + 0.5, // More complex commands
          Math.random() < 0.8 ? 1.5 : 0, // Frequent special chars
          Math.random() < 0.7 ? 1 : 0, // Frequent paths
          Math.random() < 0.4 ? 2 : 0, // Some URLs
          Math.random() * 1.5 + 0.3, // Higher repetition
          Math.random() < 0.7 ? 2.5 : 0, // Suspicious commands
          Math.random() < 0.3 ? 3 : 0, // Some file access
          Math.random() < 0.5 ? 2 : 0, // Network activity
          Math.random() < 0.4 ? 2 : 0  // Script execution
        ];
        trainingData.push(features);
      }
      
      console.log(`Generated ${trainingData.length} training samples (${300} normal, ${200} anomalous)`);
      return trainingData;
    };

    // Train the Isolation Forest
    const trainingData = generateTrainingData();
    anomalyAlgorithms.machineLearning.isolationForest.train(trainingData);
    
    console.log('Isolation Forest trained with', trainingData.length, 'samples');
  }, []);

  // Enhanced anomaly detection
  const detectAnomalies = (command) => {
    console.log('Starting anomaly detection for:', command);
    const now = Date.now();
    const anomalies = [];

    // Derive features from current session and command
    const base = (command || '').trim();
    if (!base) {
      return anomalies;
    }
    const words = base.split(/\s+/).filter(Boolean);
    const primary = words[0] || '';

    // Session/window-derived metrics
    const sessionCount = commandWindow.length;
    const uniqueCount = new Set(commandWindow.map(c => (c.command || '').split(' ')[0])).size;
    const lastEntry = commandWindow[commandWindow.length - 1];
    const timeSinceLast = lastEntry?.timestamp ? Math.max(0, now - lastEntry.timestamp) : 5000; // default to 5s when unknown
    const currentHour = new Date(now).getHours();

    // Command-derived metrics
    const commandLength = base.length;
    const wordCount = words.length;
    const hasSpecialChars = /[;&|`$><*{}()[\]\\!]/.test(base);
    const hasPath = /(\/|~)/.test(base);
    const hasURL = /(https?:\/\/|ftp:\/\/|www\.)/i.test(base);

    // Domain indicators
    const suspiciousCmdList = ['wget','curl','nmap','chmod','base64','nc','netcat','sshpass','telnet','scp','ftp','sudo','dd','mount','python','python3','bash','sh','perl','php','node'];
    const networkCmdList = ['nmap','netstat','ss','ifconfig','ip','tcpdump','nc','netcat','curl','wget','ping','traceroute','nslookup','dig','ssh','scp','telnet'];
    const fileSensitiveRegex = /(\/etc\/(passwd|shadow|hosts|hostname)|\.ssh\/|id_rsa|authorized_keys|\/var\/log)/i;
    const scriptExecRegex = /\b(python|python3|bash|sh|perl|php|node)\b\s+(-c|-e)|(\.\/\S+)|\bchmod\s+\+x\b|\bsh\s+-c\b/i;

    const hasSuspiciousCommands = suspiciousCmdList.some(k => primary.includes(k));
    const hasNetworkActivity = networkCmdList.some(k => base.includes(k));
    const hasFileAccess = /(^|\s)(cat|less|tail|more|head|grep)\b/i.test(base) && fileSensitiveRegex.test(base);
    const hasScriptExecution = scriptExecRegex.test(base);

    // Frequency of primary command in window
    const primaryCount = commandWindow.filter(c => (c.command || '').startsWith(primary)).length;

    // Normalize features to roughly match training generation (14 features)
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const features = [
      clamp(sessionCount / 50, 0, 2),              // 0: Session Cmd Volume
      clamp(uniqueCount / 15, 0, 2),               // 1: Command Diversity
      clamp(timeSinceLast / 3000, 0, 3),           // 2: Avg Interval
      clamp(currentHour / 24, 0, 1),               // 3: Hour of Day
      clamp(commandLength / 50, 0, 3),             // 4: Command Length
      clamp(wordCount / 8, 0, 3),                  // 5: Word Count
      hasSpecialChars ? 1.5 : 0,                   // 6: Special Chars
      hasPath ? 1 : 0,                             // 7: Has Path
      hasURL ? 2 : 0,                              // 8: Has URL
      clamp((primaryCount / Math.max(1, sessionCount)) * 2, 0, 2), // 9: Cmd Frequency
      hasSuspiciousCommands ? 2.5 : 0,             // 10: Suspicious Cmd
      hasFileAccess ? 3 : 0,                       // 11: Sensitive File Access
      hasNetworkActivity ? 2 : 0,                  // 12: Network Activity
      hasScriptExecution ? 2 : 0                   // 13: Script Execution
    ];

    console.log('Feature vector:', features);

    // Compute anomaly score (with safe fallback)
    let anomalyScore = 0;
    let isAnomaly = false;
    const iso = anomalyAlgorithms?.machineLearning?.isolationForest;
    if (iso && typeof iso.getAnomalyScore === 'function' && typeof iso.predict === 'function') {
      anomalyScore = iso.getAnomalyScore(features);
      isAnomaly = iso.predict(features);
    } else {
      // Heuristic fallback if model API not present
      const weights = (
        (hasSuspiciousCommands ? 0.3 : 0) +
        (hasFileAccess ? 0.35 : 0) +
        (hasNetworkActivity ? 0.25 : 0) +
        (hasScriptExecution ? 0.2 : 0) +
        (hasURL ? 0.1 : 0) +
        ((hasSpecialChars && commandLength > 50) ? 0.1 : 0)
      );
      anomalyScore = clamp(weights, 0, 0.95);
      isAnomaly = anomalyScore > 0.3;
    }

    // Educational boost for detected patterns
    let boostedScore = anomalyScore;
    if (hasSuspiciousCommands) boostedScore = Math.min(0.9, boostedScore + 0.20);
    if (hasNetworkActivity) boostedScore = Math.min(0.9, boostedScore + 0.15);
    if (hasFileAccess) boostedScore = Math.min(0.9, boostedScore + 0.25);
    if (hasScriptExecution) boostedScore = Math.min(0.9, boostedScore + 0.12);
    if (hasURL) boostedScore = Math.min(0.9, boostedScore + 0.10);
    if (hasSpecialChars && commandLength > 50) boostedScore = Math.min(0.9, boostedScore + 0.08);

    console.log('Original anomaly score:', anomalyScore, 'Boosted score:', boostedScore, 'Is anomaly:', isAnomaly);

    // Decision threshold + direct pattern triggers
    const adjustedThreshold = 0.3;
    const isAnomalyAdjusted = boostedScore > adjustedThreshold;
    const isPatternBasedAnomaly = hasSuspiciousCommands || hasFileAccess || hasNetworkActivity || hasScriptExecution || hasURL;

    console.log('Adjusted threshold check:', isAnomalyAdjusted, 'threshold:', adjustedThreshold);
    console.log('Pattern-based anomaly:', isPatternBasedAnomaly);

    if (isAnomalyAdjusted || isPatternBasedAnomaly) {
      let severity = 'Low';
      let description = `Command pattern anomaly detected (score: ${(boostedScore * 100).toFixed(1)}%)`;

      if (hasFileAccess || (hasURL && hasScriptExecution)) {
        severity = 'High';
        description += ' - Sensitive file access or malicious script execution detected';
      } else if (hasSuspiciousCommands || hasNetworkActivity || boostedScore > 0.8) {
        severity = 'High';
        description += ' - Suspicious commands or network activity detected';
      } else if (hasSpecialChars && commandLength > 30) {
        severity = 'Medium';
        description += ' - Complex command with special characters';
      } else if (currentHour < 6 || currentHour > 22) {
        severity = 'Medium';
        description += ' - Activity during unusual hours';
      }

      const triggered = [];
      if (hasSuspiciousCommands) triggered.push('Suspicious Cmd');
      if (hasNetworkActivity) triggered.push('Network');
      if (hasFileAccess) triggered.push('Sensitive File');
      if (hasScriptExecution) triggered.push('Script');
      if (hasURL) triggered.push('URL');
      if (hasSpecialChars && commandLength > 50) triggered.push('Complex');

      anomalies.push({
        type: 'Isolation Forest Detection',
        severity,
        description,
        rawScore: anomalyScore,
        boostedScore,
        featureVector: features,
        indicators: {
          hasSuspiciousCommands,
          hasFileAccess,
          hasNetworkActivity,
          hasScriptExecution,
          hasURL,
          hasSpecialChars,
          hasPath,
        },
        triggered
      });
    }

    console.log('Final anomalies:', anomalies);
    return anomalies;
  };

  const handleTerminalCommand = async (command) => {
    console.log('Processing command for anomaly detection:', command);
    if (paused) return; // skip when paused
    
    // Implement anomaly detection logic for command
    const anomalies = detectAnomalies(command);
    console.log('Detected anomalies:', anomalies);
    
    if (anomalies.length > 0) {
      console.log('Adding anomalies to detection results');
      setDetectionResults(prev => [...prev, ...anomalies.map(anomaly => ({
        ...anomaly,
        timestamp: new Date().toLocaleTimeString(),
        command,
        _id: Date.now() + Math.random()
      }))]);

      // Update anomaly score series (use first anomaly for simplicity)
      const first = anomalies[0];
      if (first.rawScore !== undefined) {
        setAnomalySeries(prev => [...prev, {
          t: new Date().toLocaleTimeString(),
          raw: first.rawScore,
          boosted: first.boostedScore ?? first.rawScore
        }]);
      }
    } else {
      console.log('No anomalies detected for command:', command);
    }
  };

  // Build detection log (deduplicate simple key pattern timestamp+command+type)
  useEffect(() => {
    if (detectionResults.length === 0) return;
    setDetectionLog(prev => {
      const next = [...prev];
      detectionResults.forEach(r => {
        if (!next.some(e => e.timestamp === r.timestamp && e.command === r.command && e.type === r.type)) {
          next.push(r);
        }
      });
      return next;
    });
  }, [detectionResults]);

  // Fetch model meta once
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const res = await fetch('/api/anomaly/model-meta');
        const data = await res.json();
        if (data.success) setModelMeta(data.meta);
      } catch (e) {
        console.warn('Failed to fetch model meta', e);
      }
    };
    fetchMeta();
  }, []);

  // Fetch patterns (on first open or initial mount for faster UX)
  useEffect(() => {
    const fetchPatterns = async () => {
      try {
        let res = await fetch('/api/anomaly/patterns');
        if (res.status === 404) {
          // Fallback to legacy endpoint if new route not available on running backend
          res = await fetch('/api/isolation-forest/patterns');
        }
        const data = await res.json().catch(()=>({}));
        if (data.success && Array.isArray(data.patterns)) {
          // Normalize possible legacy field names
          const normalized = data.patterns.map(p => ({
            id: p.id || p.pattern_name || p.name,
            name: p.pattern_name || p.name,
            regex: p.pattern_regex || p.regex,
            type: p.feature_type || p.type,
            boost: parseFloat(p.boost_value ?? p.boost ?? 0),
            severity: p.severity || 'Medium',
            active: p.is_active !== undefined ? !!p.is_active : true,
            description: p.description
          }));
          setPatterns(normalized);
          setPatternFallbackUsed(false);
        }
      } catch (e) {
        console.warn('Failed to fetch anomaly patterns', e);
        if (patterns.length === 0) {
          // Provide demo only when API outright fails
          setPatterns([
            { name: 'demo_network_scanning', regex: 'nmap\\s+.*', type: 'network_activity', boost: 0.20, severity: 'High', description: 'DEMO: network scanning' }
          ]);
          setPatternFallbackUsed(true);
        }
      }
    };
    fetchPatterns();
  }, []);

  // Export anomalies (client side)
  const exportAnomalies = () => {
    const payload = JSON.stringify(detectionLog, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g,'-');
    a.download = `anomalies-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  const liveSlice = detectionResults.slice(-MAX_LIVE);

  const severityBadge = (sev) => {
    switch (sev) {
      case 'High': return 'bg-red-100 text-red-700';
      case 'Medium': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  // Prepare data for line chart
  let chartData;
  if (anomalySeries.length > 0) {
    chartData = {
      labels: anomalySeries.map(p => p.t),
      datasets: [
        ...(showRaw ? [{
          label: 'Raw Score',
          data: anomalySeries.map(p => (p.raw * 100).toFixed(2)),
          borderColor: 'rgba(59,130,246,0.9)',
          backgroundColor: 'rgba(59,130,246,0.15)',
          tension: 0.25,
          fill: true,
          pointRadius: 2
        }] : []),
        {
          label: 'Boosted Score',
          data: anomalySeries.map(p => (p.boosted * 100).toFixed(2)),
          borderColor: 'rgba(220,38,38,0.9)',
          backgroundColor: 'rgba(220,38,38,0.10)',
          tension: 0.25,
          fill: true,
          pointRadius: 2
        }
      ]
    };
  }

  // Simple session metrics
  const sessionCommands = commandWindow.length;
  const uniqueCommands = new Set(commandWindow.map(c => c.command.split(' ')[0])).size;
  const anomalyCount = detectionLog.length;
  const lastAnomaly = selectedAnomaly || detectionResults[detectionResults.length - 1];

  // Chart.js Registration (guarded)
  if (!ChartJS.registry.getPlugin('legend')) {
    ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);
  }

  return (
    <div ref={containerRef} className="bg-[#FFFFFF] p-4"> {/* Removed min-h-screen */}
      <div className="max-w-6xl mx-auto bg-white rounded-lg p-4">
        <div className="bg-white rounded-lg">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-[#1E5780] to-blue-600 bg-clip-text text-transparent">Anomaly-Based Detection</h1>
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
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">What is Anomaly-Based Detection in Cowrie?</h2>
                <p className="text-gray-600 mb-4">
                  Cowrie's anomaly detection focuses on identifying unusual patterns in SSH and Telnet sessions. 
                  It establishes a baseline of normal user behavior and flags deviations that might indicate 
                  malicious activity, such as unusual command sequences or timing patterns.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">How Cowrie Detects Anomalies</h2>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <ol className="list-decimal list-inside space-y-3 text-gray-600">
                    <li>Monitors session timing and patterns</li>
                    <li>Analyzes command sequences and frequencies</li>
                    <li>Identifies unusual login patterns</li>
                    <li>Detects abnormal file operations</li>
                    <li>Flags suspicious command combinations</li>
                  </ol>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Advantages</h2>
                <ul className="list-disc list-inside space-y-2 text-gray-600">
                  <li>Can detect new attack patterns</li>
                  <li>Identifies unusual session behavior</li>
                  <li>Effective against automated attacks</li>
                  <li>Provides insights into attacker techniques</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Limitations</h2>
                <ul className="list-disc list-inside space-y-2 text-gray-600">
                  <li>Requires time to establish baseline</li>
                  <li>May generate false positives</li>
                  <li>Limited to SSH and Telnet protocols</li>
                  <li>Cannot detect attacks on other services</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Common Anomalies Detected by Cowrie</h2>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-800">Session Timing Anomalies</h3>
                      <p className="text-gray-600">Unusual timing between commands or rapid command execution</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Command Sequence Anomalies</h3>
                      <p className="text-gray-600">Unusual combinations of commands or non-standard command usage</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Login Pattern Anomalies</h3>
                      <p className="text-gray-600">Unusual login attempts or credential patterns</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Add new section for Parameters and Algorithms */}
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">Detection Parameters and Algorithms</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Statistical Analysis</h3>
                    <ul className="list-disc pl-5 space-y-2 text-gray-700">
                      <li>Sensitivity: {parameters.statistical.sensitivity}</li>
                      <li>Window Size: {parameters.statistical.windowSize} commands</li>
                      <li>Threshold: {parameters.statistical.threshold}σ</li>
                      <li>Update Interval: {parameters.statistical.updateInterval}s</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Machine Learning</h3>
                    <ul className="list-disc pl-5 space-y-2 text-gray-700">
                      <li>Model: {parameters.machineLearning.modelType}</li>
                      <li>Contamination: {parameters.machineLearning.contamination}</li>
                      <li>Estimators: {parameters.machineLearning.nEstimators}</li>
                      <li>Kernel: {parameters.machineLearning.kernel}</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Add new section for Isolation Forest Algorithm */}
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">Isolation Forest Algorithm (Machine Learning)</h2>
                <p className="text-gray-600 mb-4">
                  Isolation Forest is an unsupervised anomaly detection algorithm that isolates anomalies by randomly selecting features and split values. 
                  Anomalies are more susceptible to isolation and have shorter average path lengths in the trees.
                </p>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">How It Works</h3>
                      <div className="space-y-2">
                        <div className="pl-4 border-l-2 border-gray-200">
                          <h4 className="font-medium">Random Forest Creation</h4>
                          <p className="text-sm text-gray-600">Build multiple isolation trees with random feature splits</p>
                        </div>
                        <div className="pl-4 border-l-2 border-gray-200">
                          <h4 className="font-medium">Path Length Calculation</h4>
                          <p className="text-sm text-gray-600">Measure average path length for each data point</p>
                        </div>
                        <div className="pl-4 border-l-2 border-gray-200">
                          <h4 className="font-medium">Anomaly Scoring</h4>
                          <p className="text-sm text-gray-600">Shorter paths indicate anomalous behavior</p>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Feature Extraction</h3>
                      <div className="space-y-2">
                        <div className="pl-4 border-l-2 border-gray-200">
                          <h4 className="font-medium">Session Features</h4>
                          <p className="text-sm text-gray-600">Command count, diversity, timing</p>
                        </div>
                        <div className="pl-4 border-l-2 border-gray-200">
                          <h4 className="font-medium">Command Features</h4>
                          <p className="text-sm text-gray-600">Length, word count, special characters</p>
                        </div>
                        <div className="pl-4 border-l-2 border-gray-200">
                          <h4 className="font-medium">Pattern Features</h4>
                          <p className="text-sm text-gray-600">URLs, file paths, executables</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
               {/* Add new section for Anomaly Dataset */}
              <div>
                <div>
                  <div className="bg-white p-6 rounded-lg shadow-md">
                    <h4 className="font-medium text-green-800">Try It: Sample Predictions</h4>
                    <p className="text-sm text-green-700 mb-3">Click to see how Isolation Forest scores different commands:</p>
                    <div className="space-y-2">
                      <button 
                        className="text-left w-full p-2 bg-white border rounded text-xs hover:bg-gray-50"
                        onClick={() => {
                          const features = [0.05, 5, 35, 14, 8, 0.8, 0, 0, 0, 0.15]; // Normal command features
                          const score = anomalyAlgorithms.machineLearning.isolationForest.getAnomalyScore(features);
                          alert(`Normal Command: "ls -la"\nAnomaly Score: ${(score * 100).toFixed(1)}%\n\nThis represents typical file listing during normal work hours with standard parameters.`);
                        }}
                      >
                        📁 Normal: <code>ls -la</code> → <span className="text-green-600">Low Score</span>
                      </button>
                      <button 
                        className="text-left w-full p-2 bg-white border rounded text-xs hover:bg-gray-50"
                        onClick={() => {
                          const features = [0.3, 3, 15, 2, 35, 0.4, 1, 1, 1, 0.6]; // Suspicious command features
                          const score = anomalyAlgorithms.machineLearning.isolationForest.getAnomalyScore(features);
                          alert(`Suspicious Command: "wget http://example.com/test.sh"\nAnomaly Score: ${(score * 100).toFixed(1)}%\n\nThis represents downloading executable files, especially during off-hours with unusual patterns.`);
                        }}
                      >
                        ⚠️ Suspicious: <code>wget http://example.com/test.sh</code> → <span className="text-orange-600">Medium Score</span>
                      </button>
                      <button 
                        className="text-left w-full p-2 bg-white border rounded text-xs hover:bg-gray-50"
                        onClick={() => {
                          const features = [0.8, 1, 5, 3, 85, 0.9, 1, 1, 1, 0.9]; // Highly suspicious features
                          const score = anomalyAlgorithms.machineLearning.isolationForest.getAnomalyScore(features);
                          alert(`Highly Suspicious: "python -c \\"import os; os.system('rm -rf /tmp')\\""\nAnomaly Score: ${(score * 100).toFixed(1)}%\n\nThis represents very long commands with special characters, executed rapidly during unusual hours.`);
                        }}
                      >
                        🚨 High Risk: <code>python -c "import os; os.system('cmd')"</code> → <span className="text-red-600">High Score</span>
                      </button>
                      <button 
                        className="text-left w-full p-2 bg-white border rounded text-xs hover:bg-gray-50"
                        onClick={() => {
                          const features = [0.9, 2, 10, 23, 45, 0.2, 1, 0, 0, 0.8]; // Late night activity
                          const score = anomalyAlgorithms.machineLearning.isolationForest.getAnomalyScore(features);
                          alert(`Late Night Activity: "nmap -sS 192.168.1.0/24"\nAnomaly Score: ${(score * 100).toFixed(1)}%\n\nThis represents network scanning tools used during unusual hours (11 PM) with repetitive patterns.`);
                        }}
                      >
                        🌙 Off-Hours: <code>nmap -sS 192.168.1.0/24</code> → <span className="text-red-600">High Score</span>
                      </button>
                    </div>
                    
                    <div className="mt-4 p-3 bg-gray-50 rounded">
                      <h5 className="font-medium text-sm text-gray-700 mb-2">Test Commands in Terminal:</h5>
                      <div className="grid grid-cols-1 gap-2 text-xs">
                        <div>
                          <strong className="text-green-700">Normal:</strong> <code className="bg-white px-1 rounded">ls -la</code>, <code className="bg-white px-1 rounded">cd /home</code>, <code className="bg-white px-1 rounded">pwd</code>
                        </div>
                        <div>
                          <strong className="text-orange-700">Suspicious:</strong> <code className="bg-white px-1 rounded">wget http://example.com/test.sh</code>, <code className="bg-white px-1 rounded">netstat -tulpn</code>
                        </div>
                        <div>
                          <strong className="text-red-700">High Risk:</strong> <code className="bg-white px-1 rounded">base64 /etc/hostname</code>, <code className="bg-white px-1 rounded">python -c "print('test')"</code>
                        </div>
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
                  <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-800 text-sm tracking-wide uppercase">Interactive Terminal</h3>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setPaused(p=>!p)} className={`px-3 py-1 rounded text-xs font-semibold ${paused ? 'bg-yellow-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>{paused ? 'Resume' : 'Pause'}</button>
                        <button onClick={clearAll} className="px-3 py-1 rounded text-xs font-semibold bg-red-500 text-white hover:bg-red-600">Clear</button>
                        <button onClick={exportAnomalies} className="px-3 py-1 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700">Export</button>
                        <button onClick={() => setShowPatternLibrary(s=>!s)} className="px-3 py-1 rounded text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700">{showPatternLibrary ? 'Hide Patterns' : 'Patterns'}</button>
                      </div>
                    </div>
                    <RealTerminal onCommand={handleTerminalCommand} simulationType="anomaly" />
                  </div>

                  {showPatternLibrary && (
                    <div className="bg-white border border-indigo-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-indigo-800 text-sm tracking-wide uppercase">Pattern Library</h4>
                        <div className="flex items-center gap-2">
                          {patternFallbackUsed && <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded" title="Fallback demo patterns (API error)">DEMO</span>}
                          <span className="text-[10px] text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded" title="Total patterns loaded">{patterns.length}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <input value={patternFilter} onChange={e=>setPatternFilter(e.target.value)} placeholder="Filter (name, type, severity)..." className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-500" />
                        {patternFilter && <button onClick={()=>setPatternFilter('')} className="text-[10px] text-gray-500 hover:text-gray-700">Clear</button>}
                      </div>
                      <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
                        {patterns
                          .filter(p => {
                            if (!patternFilter) return true;
                            const t = patternFilter.toLowerCase();
                            return (p.name && p.name.toLowerCase().includes(t)) || (p.type && p.type.toLowerCase().includes(t)) || (p.severity && p.severity.toLowerCase().includes(t));
                          })
                          .map(p => (
                            <div key={p.name+String(p.boost)} className="py-2 text-[11px]">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`px-1.5 py-0.5 rounded font-semibold text-[9px] ${p.severity==='High' ? 'bg-red-100 text-red-700' : p.severity==='Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{p.severity}</span>
                                <span className="font-medium text-gray-800 truncate" title={p.name}>{p.name}</span>
                                <span className="ml-auto text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">+{p.boost.toFixed(2)}</span>
                              </div>
                              <div className="text-gray-500 truncate" title={p.regex}><span className="text-gray-400">/</span>{p.regex}<span className="text-gray-400">/</span></div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] uppercase tracking-wide text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">{p.type}</span>
                                {p.description && <span className="text-[9px] text-gray-500 truncate" title={p.description}>{p.description}</span>}
                              </div>
                            </div>
                          ))}
                        {patterns.length === 0 && (
                          <div className="text-xs text-gray-400 italic py-4 text-center">No active patterns</div>
                        )}
                      </div>
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
                          placeholder="Filter anomalies (command, type, description)..."
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <div className="text-xs text-gray-500">Showing {filteredLog.length} / {detectionLog.length}</div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                        <div className="p-2 rounded bg-indigo-50 text-indigo-700 text-center text-xs font-semibold">Cmd: {sessionCommands}</div>
                        <div className="p-2 rounded bg-blue-50 text-blue-700 text-center text-xs font-semibold">Unique: {uniqueCommands}</div>
                        <div className="p-2 rounded bg-yellow-50 text-yellow-700 text-center text-xs font-semibold">Anoms: {anomalyCount}</div>
                        <div className="p-2 rounded bg-green-50 text-green-700 text-center text-xs font-semibold">Paused: {paused ? 'Yes' : 'No'}</div>
                      </div>
                      {filteredLog.length === 0 ? (
                        <div className="text-center py-6 text-sm text-gray-500 italic">No anomalies recorded</div>
                      ) : (
                        <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                          {filteredLog.slice().reverse().map((item, idx) => (
                            <div key={idx} className={`py-2 text-sm cursor-pointer ${selectedAnomaly && selectedAnomaly._id === item._id ? 'bg-blue-50/70 rounded' : ''}`} onClick={() => setSelectedAnomaly(item)}>
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
                              {item.rawScore !== undefined && (
                                <div className="mt-1 text-[10px] text-gray-500 flex gap-2">
                                  <span>raw {(item.rawScore*100).toFixed(1)}%</span>
                                  <span>boost {(item.boostedScore*100).toFixed(1)}%</span>
                                  {item.triggered && item.triggered.length>0 && <span className="truncate">[{item.triggered.join(', ')}]</span>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Score Trend & Inspector Panel */}
                  {anomalySeries.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-800 text-sm tracking-wide uppercase">Score Trend & Inspector</h4>
                        {lastAnomaly && <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${severityBadge(lastAnomaly.severity)}`}>{lastAnomaly.severity}</span>}
                        <div className="ml-auto flex items-center gap-2">
                          <label className="flex items-center gap-1 text-[10px] text-gray-500"><input type="checkbox" checked={showRaw} onChange={e=>setShowRaw(e.target.checked)} /> Raw</label>
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
                      {lastAnomaly ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h5 className="text-xs font-semibold text-gray-600 mb-2">Score Breakdown</h5>
                            <div className="text-[11px] space-y-1">
                              <div>Raw Score: {(lastAnomaly.rawScore*100).toFixed(2)}%</div>
                              <div>Boosted Score: {(lastAnomaly.boostedScore*100).toFixed(2)}%</div>
                              <div>Triggered: {lastAnomaly.triggered && lastAnomaly.triggered.length>0 ? lastAnomaly.triggered.join(', ') : 'None'}</div>
                              <div className="mt-2 font-semibold text-gray-700">Why flagged:</div>
                              <ul className="list-disc ml-4 text-[10px] text-gray-600">
                                {lastAnomaly.triggered && lastAnomaly.triggered.map(t => <li key={t}>{t} pattern present</li>)}
                                {lastAnomaly.triggered && lastAnomaly.triggered.length===0 && <li>No explicit pattern – statistical deviation</li>}
                              </ul>
                            </div>
                          </div>
                          <div>
                            <h5 className="text-xs font-semibold text-gray-600 mb-2">Feature Vector</h5>
                            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                              {lastAnomaly.featureVector && lastAnomaly.featureVector.map((v,i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <span className="text-[10px] text-gray-500 w-40 truncate" title={featureLabels[i]}>{featureLabels[i]}</span>
                                  <div className="flex-1 h-2 bg-gray-100 rounded overflow-hidden">
                                    <div className="h-full bg-blue-500" style={{width: Math.min(100, (v/3)*100)+'%'}}></div>
                                  </div>
                                  <span className="text-[10px] text-gray-600 w-10 text-right">{v.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 italic">No anomaly selected</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Live Panel */}
                <div className="xl:col-span-1 space-y-6">
                  {showLivePanel && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center mb-3">
                        <div className={`w-3 h-3 rounded-full mr-2 ${paused ? 'bg-gray-400' : 'bg-red-500 animate-pulse'}`}></div>
                        <h3 className="font-semibold text-gray-800 text-sm tracking-wide uppercase">Live Anomalies</h3>
                        <button onClick={() => setShowLivePanel(false)} className="ml-auto text-xs text-gray-400 hover:text-gray-600">Hide</button>
                      </div>
                      {detectionResults.length === 0 ? (
                        <div className="text-gray-500 text-center py-4 italic text-sm">No anomalies detected</div>
                      ) : (
                        <div className="space-y-3">
                          {liveSlice.map(det => (
                            <div key={det._id} className={`bg-white border border-red-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer ${selectedAnomaly && selectedAnomaly._id===det._id ? 'ring-2 ring-blue-300' : ''}`} onClick={() => setSelectedAnomaly(det)}>
                              <div className="flex items-start gap-2">
                                <div className="flex-shrink-0 mt-0.5"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${severityBadge(det.severity)}`}>{det.severity}</span></div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="font-semibold text-gray-800 text-xs truncate" title={det.type}>{det.type}</span>
                                    <span className="text-[10px] text-gray-400 ml-auto">{det.timestamp}</span>
                                  </div>
                                  <div className="text-[11px] text-gray-600 line-clamp-2 leading-snug" title={det.description}>{det.description}</div>
                                  <div className="text-[11px] text-gray-600 truncate">cmd: <code className="bg-yellow-100 px-1 rounded" title={det.command}>{det.command}</code></div>
                                  {det.rawScore !== undefined && (
                                    <div className="text-[10px] text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                                      <span>raw {(det.rawScore*100).toFixed(1)}%</span>
                                      <span>boost {(det.boostedScore*100).toFixed(1)}%</span>
                                      {det.triggered && det.triggered.length>0 && <span className="truncate">[{det.triggered.join(', ')}]</span>}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {modelMeta && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center mb-2">
                        <h3 className="font-semibold text-gray-800 text-sm tracking-wide uppercase">Model Metadata</h3>
                      </div>
                      <div className="text-[11px] space-y-1">
                        <div><span className="text-gray-500">Version:</span> <code className="bg-gray-100 px-1 rounded">{modelMeta.version}</code></div>
                        <div><span className="text-gray-500">Trained:</span> {new Date(modelMeta.trained_at).toLocaleString()}</div>
                        {modelMeta.config && (
                          <div className="mt-2">
                            <div className="font-semibold text-gray-600 mb-1">Config</div>
                            <ul className="space-y-0.5">
                              {Object.entries(modelMeta.config).map(([k,v]) => (
                                <li key={k} className="flex justify-between"><span className="text-gray-500">{k}</span><span className="text-gray-700 font-mono">{String(v)}</span></li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {modelMeta.feature_names && (
                          <div className="mt-2">
                            <div className="font-semibold text-gray-600 mb-1">Features</div>
                            <div className="flex flex-wrap gap-1">
                              {modelMeta.feature_names.map(fn => (
                                <span key={fn} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px]">{fn}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="mt-2 text-[10px] text-gray-500">Decision Fn Range: {modelMeta.min_df?.toFixed?.(3)} → {modelMeta.max_df?.toFixed?.(3)}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-between mt-8">
            <Link
              to="/simulation/signature"
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Previous: Signature-Based Detection
            </Link>
            <Link 
              to="/simulation/hybrid"
              className="px-6 py-2 bg-[#1E5780] text-white rounded-lg hover:bg-[#164666] transition-colors"
            >
              Next: Hybrid Detection
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnomalyBased;