import React, { useState, useEffect, useRef, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';

const DefendSimulation = () => {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  let { lobbyCode, participants, role } = location.state || {};
  const [name, setName] = useState(() => {
    try { const saved = JSON.parse(sessionStorage.getItem('simCtx')); return saved?.name || 'Defender'; } catch { return 'Defender'; }
  });
  if (!lobbyCode && typeof window !== 'undefined') {
    try {
      const saved = JSON.parse(sessionStorage.getItem('simCtx'));
      if (saved) {
        lobbyCode = saved.lobbyCode;
        participants = saved.participants;
        role = saved.role;
      }
    } catch {}
  }
  
  const [detectionConfig, setDetectionConfig] = useState({
    sensitivityLevel: 'medium',
    enabledDetectors: ['aho_corasick', 'isolation_forest'],
    alertThreshold: 0.7
  });
  const [liveDetections, setLiveDetections] = useState([]);
  const [attackEvents, setAttackEvents] = useState([]);
  const [defendActions, setDefendActions] = useState([]);
  const [score, setScore] = useState(0);
  const [simulationTime, setSimulationTime] = useState(0);
  const [systemStats, setSystemStats] = useState({
    totalEvents: 0,
    detectedThreats: 0,
    falsePositives: 0
  });
  const wsRef = useRef(null);
  const [lastClfResult, setLastClfResult] = useState(null);
  const [showGuide, setShowGuide] = useState(true);
  
  useEffect(() => {
    if (!lobbyCode) {
      navigate('/simulation-lobby');
      return;
    }
    
    // Connect to simulation WebSocket using current origin
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.hostname;
  wsRef.current = new WebSocket(`${proto}://${host}:8000/simulation/${lobbyCode}${user?.token ? `?token=${encodeURIComponent(user.token)}` : ''}`);
    wsRef.current.onopen = () => {
      wsRef.current?.send(JSON.stringify({ type: 'join', name, role }));
    };
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'attack_event':
          handleNewAttackEvent(data.event);
          break;
        case 'off_objective_threat':
          // Hard mode: off-objective threats surfaced by backend
          try {
            setAttackEvents(prev => [...prev, {
              id: Date.now(),
              command: data.command,
              sourceIP: data.sourceIP || 'Unknown',
              offObjective: true,
              timestamp: new Date()
            }]);
            setLiveDetections(prev => [...prev, {
              id: Date.now(),
              detected: true,
              confidence: 0.75,
              threats: data.threats || [],
              method: 'signature',
              offObjective: true,
              timestamp: new Date()
            }]);
            setSystemStats(prev => ({ ...prev, totalEvents: prev.totalEvents + 1, detectedThreats: prev.detectedThreats + 1 }));
          } catch {}
          break;
        case 'detection_result':
          handleDetectionResult(data.result);
          break;
        case 'classification_result':
          setLastClfResult({ award: data.awarded, total: data.total, correct: data.correct, cooldown: data.cooldown, message: data.message, confidence: data.confidence_used });
          if (typeof data.total === 'number') setScore(data.total);
          break;
        case 'score_update':
          // scoreboard broadcast from server
          // if this is for me, update
          if (data.name === name && typeof data.score === 'number') setScore(data.score);
          break;
        case 'simulation_end':
          alert('Simulation ended!');
          navigate('/simulation-lobby');
          break;
      }
    };
    wsRef.current.onclose = (e) => {
      if (e && (e.code === 4401 || e.code === 4403)) {
        alert('Session expired. Please log in again.');
      }
    };
    
    // Start timer
    const timer = setInterval(() => {
      setSimulationTime(prev => prev + 1);
    }, 1000);
    
    return () => {
      clearInterval(timer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [lobbyCode, navigate]);
  
  const handleNewAttackEvent = (event) => {
    setAttackEvents(prev => [...prev, {
      id: Date.now(),
      ...event,
      timestamp: new Date(),
      status: 'analyzing'
    }]);
    
    setSystemStats(prev => ({
      ...prev,
      totalEvents: prev.totalEvents + 1
    }));
    
    // Run detection on the event
    runDetectionAnalysis(event);
  };
  
  const runDetectionAnalysis = async (event) => {
    try {
      // Simulate detection analysis using your existing APIs
      const response = await fetch('http://localhost:8000/api/hybrid/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: event.command || event.content,
          timestamp: new Date().toISOString()
        })
      });
      
      const result = await response.json();
      handleDetectionResult({
        eventId: event.id,
        detected: result.threats_detected > 0,
        confidence: result.confidence || 0,
        threats: result.detected_threats || [],
        method: result.detection_method
      });
      
    } catch (error) {
      console.error('Detection analysis failed:', error);
    }
  };
  
  const handleDetectionResult = (result) => {
    setLiveDetections(prev => [...prev, {
      id: Date.now(),
      ...result,
      timestamp: new Date()
    }]);
    
    if (result.detected && result.confidence >= detectionConfig.alertThreshold) {
      setSystemStats(prev => ({
        ...prev,
        detectedThreats: prev.detectedThreats + 1
      }));
      
  // IDS only: no automatic blocking
    }
  };

  
  const updateDetectionConfig = (newConfig) => {
    setDetectionConfig(newConfig);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'update_detection_config',
  config: newConfig,
  role: 'defender',
  name
      }));
    }
  };
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-green-400 p-6">
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-gray-800 border border-green-400 rounded-lg w-full max-w-2xl p-6 text-white">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-bold text-yellow-300">Simulation Guide</h2>
              <button onClick={() => setShowGuide(false)} className="text-gray-300 hover:text-white">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <span className="bg-gray-700 px-2 py-1 rounded">Role: Defender</span>
              </div>
              <div>
                <div className="font-semibold text-green-300 mb-1">How to play</div>
                <ul className="list-disc list-inside text-gray-200 space-y-1">
                  <li>Watch Attack Events and Detections.</li>
                  <li>Classify attacks by guessing the category/objective (e.g., recon, brute, priv, persistence).</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold text-green-300 mb-1">Scoring</div>
                <ul className="list-disc list-inside text-gray-200 space-y-1">
                  <li>Correct classification awards the objective's points (10 or 20).</li>
                  <li>Cooldown prevents spam; focus on accuracy.</li>
                  <li>Hard mode: Off-objective threats are visible for awareness (no auto-blocking).</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold text-green-300 mb-1">Tips</div>
                <ul className="list-disc list-inside text-gray-200 space-y-1">
                  <li>Use tool names and context (nmap, hydra, sudo) to infer categories.</li>
                  <li>Adjust alert threshold in Detection Config to tune sensitivity.</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 text-right">
              <button onClick={() => setShowGuide(false)} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded">Got it</button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-green-400">Defender</h1>
          <p className="text-gray-400">Lobby {lobbyCode} · {role}</p>
        </div>
        <div className="flex space-x-4">
          <div className="bg-gray-800 px-4 py-2 rounded">
            <span className="text-yellow-400">Score {score}</span>
          </div>
          <div className="bg-gray-800 px-4 py-2 rounded">
            <span className="text-blue-400">Time {formatTime(simulationTime)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Detection Dashboard */}
        <div className="lg:col-span-2 space-y-6">
          {/* Classification Console */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-green-400">Classify Attack</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input className="bg-gray-700 border border-gray-600 rounded px-3 py-2" placeholder="Attack type (e.g., brute, recon)" id="clf_type" />
              <input className="bg-gray-700 border border-gray-600 rounded px-3 py-2" placeholder="Objective (e.g., recon, priv, persist)" id="clf_obj" />
              <div className="grid grid-cols-2 gap-2">
                <input className="bg-gray-700 border border-gray-600 rounded px-3 py-2" placeholder="Command/tool (e.g., nmap, hydra)" id="clf_cmd" />
                <input className="bg-gray-700 border border-gray-600 rounded px-3 py-2" placeholder="Confidence 0.0-1.0 (default 0.7)" id="clf_conf" />
              </div>
            </div>
            <div className="mt-3">
              <button
                onClick={() => {
                  const classification = document.getElementById('clf_type').value;
                  const objective = document.getElementById('clf_obj').value;
                  const command_type = document.getElementById('clf_cmd').value;
                  const confidenceStr = document.getElementById('clf_conf').value;
                  const confidence = confidenceStr ? Math.max(0, Math.min(1, parseFloat(confidenceStr))) : undefined;
                  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: 'defender_classify', classification, objective, command_type, confidence, name }));
                  }
                }}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
              >Submit Classification</button>
              {lastClfResult && (
                <div className="mt-2 text-sm text-gray-300">
                  {lastClfResult.cooldown ? (
                    <span>Cooldown: {lastClfResult.message}</span>
                  ) : (
                    <span>Result: +{lastClfResult.award || 0} (total {lastClfResult.total || 0}) {lastClfResult.correct ? '✓' : ''} {lastClfResult.confidence ? `(conf ${lastClfResult.confidence})` : ''}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* System Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-800 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-400">{systemStats.totalEvents}</div>
              <div className="text-sm text-gray-400">Total Events</div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-400">{systemStats.detectedThreats}</div>
              <div className="text-sm text-gray-400">Threats Detected</div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-400">{systemStats.falsePositives}</div>
              <div className="text-sm text-gray-400">False Positives</div>
            </div>
          </div>

          {/* Live Detection Feed */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-green-400">Detections</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {liveDetections.length === 0 ? (
                <p className="text-gray-400">No detections yet...</p>
              ) : (
                liveDetections.slice(-10).reverse().map(detection => (
                  <div
                    key={detection.id}
                    className={`p-3 rounded border-l-4 ${
                      detection.detected
                        ? detection.confidence > 0.8
                          ? 'bg-red-900 border-red-400'
                          : 'bg-yellow-900 border-yellow-400'
                        : 'bg-gray-700 border-gray-400'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold">
                          {detection.detected ? '🚨 THREAT DETECTED' : '✅ Clean'}
                        </div>
                        <div className="text-sm text-gray-300">
                          Confidence: {(detection.confidence * 100).toFixed(1)}%
                        </div>
                        {detection.threats && detection.threats.length > 0 && (
                          <div className="text-sm text-red-300">
                            Threats: {detection.threats.join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        {detection.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Attack Events Log */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-blue-400">Attack Events</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {attackEvents.length === 0 ? (
                <p className="text-gray-400">No attack events detected...</p>
              ) : (
                attackEvents.slice(-5).reverse().map(event => (
                  <div key={event.id} className="bg-gray-700 p-3 rounded">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-mono text-sm text-yellow-400">
                          {event.command || event.content}
                        </div>
                        <div className="text-xs text-gray-400">
                          Source: {event.sourceIP || 'Unknown'}
                        </div>
                      </div>
                      {/* IDS only: no block action */}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Detection Configuration */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-green-400">Detection Config</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Sensitivity Level</label>
                <select
                  value={detectionConfig.sensitivityLevel}
                  onChange={(e) => updateDetectionConfig({
                    ...detectionConfig,
                    sensitivityLevel: e.target.value
                  })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Alert Threshold</label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={detectionConfig.alertThreshold}
                  onChange={(e) => updateDetectionConfig({
                    ...detectionConfig,
                    alertThreshold: parseFloat(e.target.value)
                  })}
                  className="w-full"
                />
                <div className="text-sm text-gray-400 text-center">
                  {(detectionConfig.alertThreshold * 100).toFixed(0)}%
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Enabled Detectors</label>
                <div className="space-y-2">
                  {['aho_corasick', 'isolation_forest'].map(detector => (
                    <label key={detector} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={detectionConfig.enabledDetectors.includes(detector)}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          const newDetectors = enabled
                            ? [...detectionConfig.enabledDetectors, detector]
                            : detectionConfig.enabledDetectors.filter(d => d !== detector);
                          updateDetectionConfig({
                            ...detectionConfig,
                            enabledDetectors: newDetectors
                          });
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">{detector.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* IDS only: removed IP blocking panel */}

          {/* Participants */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-blue-400">Participants</h3>
            <div className="space-y-2">
              {participants?.map((participant, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className={
                    participant.role === 'Attacker' ? 'text-red-400' :
                    participant.role === 'Defender' ? 'text-green-400' :
                    'text-blue-400'
                  }>
                    {participant.name}
                  </span>
                  <span className="text-gray-400 text-sm">{participant.role}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Defense Actions Log */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-yellow-400">Defense Actions</h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {defendActions.length === 0 ? (
                <p className="text-gray-400 text-sm">No actions taken yet...</p>
              ) : (
                defendActions.slice(-5).reverse().map(action => (
                  <div key={action.id} className="bg-gray-700 p-2 rounded text-sm">
                    <div className="font-semibold text-green-400">
                      {action.action.replace('_', ' ')}
                    </div>
                    <div className="text-xs text-gray-400">
                      Target: {action.target} | {action.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DefendSimulation;
