import React, { useState, useEffect, useRef, useContext } from 'react';
import ChatPanel from '../../components/ChatPanel';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import { MessageTypes } from '../../simulation/messages';
import { buildWsUrl, safeSend } from '../../simulation/ws';

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
  
  // Detection Profile replaces old IDS tuning
  const [detectionProfile, setDetectionProfile] = useState('hybrid'); // 'signature' | 'anomaly' | 'hybrid'
  const [liveDetections, setLiveDetections] = useState([]);
  const [selectedDetectionId, setSelectedDetectionId] = useState(null);
  const [attackEvents, setAttackEvents] = useState([]);
  const [defendActions, setDefendActions] = useState([]);
  const [score, setScore] = useState(0);
  const [simulationTime, setSimulationTime] = useState(0);
  const [systemStats, setSystemStats] = useState({
    totalEvents: 0,
    detectedThreats: 0,
    falsePositives: 0,
    truePositives: 0
  });
  const [difficulty, setDifficulty] = useState('Beginner');
  const [markingFP, setMarkingFP] = useState(false);
  const wsRef = useRef(null);
  const [lastClfResult, setLastClfResult] = useState(null);
  const [showGuide, setShowGuide] = useState(true);
  const [paused, setPaused] = useState(false);
  const [toast, setToast] = useState(null);
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const lastSubmittedRef = useRef(null);

  const showToast = (message, type='info', duration=2000) => {
    setToast({ message, type });
    if (duration > 0) setTimeout(() => setToast(null), duration);
  };
  
  useEffect(() => {
    if (!lobbyCode) {
      navigate('/student/lobby');
      return;
    }
    
    // Connect to simulation WebSocket using current origin
  wsRef.current = new WebSocket(buildWsUrl(`/simulation/${lobbyCode}`, user?.token));
    wsRef.current.onopen = () => {
      try {
        safeSend(wsRef.current, { type: MessageTypes.JOIN, name, role });
      } catch {}
    };
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case MessageTypes.SESSION_STATE:
          if (data.status === 'paused') setPaused(true);
          if (data.status === 'running') setPaused(false);
          if (data.status === 'ended') {
            showToast('Simulation ended', 'warning');
            setTimeout(() => navigate('/student/lobby'), 1200);
          }
          break;
        case MessageTypes.JOIN_ACK:
          if (data.difficulty) setDifficulty(data.difficulty);
          break;
        case MessageTypes.SIMULATION_PAUSED:
          setPaused(true);
          break;
        case MessageTypes.SIMULATION_RESUMED:
          setPaused(false);
          break;
        case MessageTypes.SIMULATION_ENDED:
          showToast('Simulation ended', 'warning');
          setTimeout(() => navigate('/student/lobby'), 1200);
          break;
        case MessageTypes.ATTACK_EVENT:
          handleNewAttackEvent(data.event);
          break;
        case MessageTypes.OFF_OBJECTIVE_THREAT:
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
        case MessageTypes.DETECTION_RESULT:
          handleDetectionResult(data.result);
          break;
        case MessageTypes.CLASSIFICATION_RESULT:
          setLastClfResult({ award: data.awarded, total: data.total, correct: data.correct, cooldown: data.cooldown, message: data.message, confidence: data.confidence_used });
          if (typeof data.total === 'number') {
            setScore(data.total);
            try {
              const payload = { role: 'Defender', score: data.total, lobbyCode, updatedAt: new Date().toISOString() };
              localStorage.setItem('student_last_simulation_score', JSON.stringify(payload));
            } catch {}
          }
          try {
            const award = (typeof data.awarded === 'number') ? data.awarded : (typeof data.award === 'number' ? data.award : undefined);
            const submitted = lastSubmittedRef.current ? `Category: ${lastSubmittedRef.current}` : '';
            const target = `${submitted}${submitted && (award !== undefined || data.total !== undefined) ? ' | ' : ''}${award !== undefined ? `Award ${award}` : ''}${typeof data.total === 'number' ? `${award !== undefined ? ' | ' : ''}Total ${data.total}` : ''}`;
            setDefendActions(prev => [...prev, {
              id: Date.now(),
              action: data.correct ? 'classification_correct' : 'classification_incorrect',
              target: data.message ? `${target} | ${data.message}` : target,
              timestamp: new Date()
            }]);
          } catch {}
          break;
        case MessageTypes.DEFENSE_RESULT:
          // Typed variant; update score and append action if needed
          if (typeof data.total === 'number') {
            setScore(data.total);
            try {
              const payload = { role: 'Defender', score: data.total, lobbyCode, updatedAt: new Date().toISOString() };
              localStorage.setItem('student_last_simulation_score', JSON.stringify(payload));
            } catch {}
          }
          try {
            const target = `${typeof data.award === 'number' ? `Award ${data.award}` : ''}${typeof data.total === 'number' ? `${typeof data.award === 'number' ? ' | ' : ''}Total ${data.total}` : ''}`;
            setDefendActions(prev => [...prev, {
              id: Date.now(),
              action: data.correct ? 'classification_correct' : 'classification_incorrect',
              target: data.message ? `${target} | ${data.message}` : target,
              timestamp: new Date()
            }]);
          } catch {}
          break;
        case MessageTypes.SCORE_UPDATE:
          // scoreboard broadcast from server
          // if this is for me, update
          if (data.name === name && typeof data.score === 'number') {
            setScore(data.score);
            try {
              const payload = { role: 'Defender', score: data.score, lobbyCode, updatedAt: new Date().toISOString() };
              localStorage.setItem('student_last_simulation_score', JSON.stringify(payload));
            } catch {}
          }
          break;
        case MessageTypes.BROADCAST:
          setChat(prev => [...prev, { id: Date.now(), sender: 'Broadcast', message: data.message, timestamp: new Date() }]);
          break;
        case 'instructor_broadcast':
          setChat(prev => [...prev, { id: Date.now(), sender: 'Instructor', message: data.message, timestamp: new Date() }]);
          break;
        case MessageTypes.CHAT_MESSAGE:
          setChat(prev => [...prev, { id: Date.now(), sender: data.sender || 'Message', message: data.message, timestamp: new Date() }]);
          break;
      }
    };
    wsRef.current.onclose = (e) => {
      if (e && (e.code === 4401 || e.code === 4403)) {
        alert('Session expired. Please log in again.');
      }
    };
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [lobbyCode, navigate]);

  // Pause-aware timer
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setSimulationTime(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [paused]);
  
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
  
  const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
  const runDetectionAnalysis = async (event) => {
    try {
      // Simulate detection analysis using your existing APIs
      const response = await fetch(`${API_BASE}/api/hybrid/detect`.replace(/([^:]?)\/\/+/g,'$1/'), {
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
    const detId = Date.now();
    setLiveDetections(prev => [...prev, {
      id: detId,
      ...result,
      timestamp: new Date(),
      triage: null
    }]);
    // Auto-select the newest detection to streamline choosing which to classify
    setSelectedDetectionId(detId);
    
    const profileThreshold = detectionProfile === 'signature' ? 0.75 : (detectionProfile === 'anomaly' ? 0.65 : 0.7);
    if (result.detected && result.confidence >= profileThreshold) {
      setSystemStats(prev => ({
        ...prev,
        detectedThreats: prev.detectedThreats + 1
      }));
      
  // IDS only: no automatic blocking
    }
  };

  // Allow IDS triage: mark detection as true/false positive
  const triageDetection = (id, type) => {
    const det = liveDetections.find(d => d.id === id);
    setLiveDetections(prev => {
      let changed = false;
      // Remove the triaged detection from the list
      const next = [];
      for (const d of prev) {
        if (d.id === id && !d.triage) {
          changed = true;
          // skip adding this one (removed)
          continue;
        }
        next.push(d);
      }
      if (changed) {
        if (type === 'fp') {
          setSystemStats(prevStats => ({ ...prevStats, falsePositives: prevStats.falsePositives + 1 }));
        } else if (type === 'tp') {
          setSystemStats(prevStats => ({ ...prevStats, truePositives: prevStats.truePositives + 1 }));
        }
      }
      // Update selection to the newest remaining detection if needed
      if (changed && next.length) {
        setSelectedDetectionId(next[next.length - 1].id);
      } else if (!next.length) {
        setSelectedDetectionId(null);
      }
      return next;
    });
    try {
      const isFP = type === 'fp';
      const action = isFP ? 'false_positive' : 'true_positive';
      const target = det ? (det.threats && det.threats.length ? `Threats: ${det.threats.join(', ')}` : (det.method ? `Method: ${det.method}` : 'Detection')) : 'Detection';
      setDefendActions(prev => [...prev, { id: Date.now(), action, target, timestamp: new Date() }]);
    } catch {}
  };

  
  // IDS tuning removed
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChat(prev => [...prev, { id: Date.now(), sender: name, message: msg, timestamp: new Date() }]);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      safeSend(wsRef.current, { type: MessageTypes.CHAT_MESSAGE, sender: name, message: msg });
    }
    setChatInput('');
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
                  <li>Select a Detection Profile (Signature-focused, Anomaly-focused, Hybrid) that matches what you're seeing.</li>
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
          <div className="flex items-center gap-2 mt-1">
            {paused && (
              <span className="text-xs px-2 py-0.5 rounded bg-yellow-800 text-yellow-200 border border-yellow-600">Paused</span>
            )}
          </div>
        </div>
        <div className="flex space-x-4 items-center">
          <div className="bg-gray-800 px-4 py-2 rounded">
            <span className="text-yellow-400">Defender Score {score}</span>
          </div>
          <div className="bg-gray-800 px-4 py-2 rounded">
            <span className="text-blue-400">Time {formatTime(simulationTime)}</span>
          </div>
          <button
            onClick={() => { if (confirm('Leave the simulation? Progress in this session may be lost.')) navigate('/student/lobby'); }}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm border border-gray-500"
          >Leave</button>
        </div>
      </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-3 mb-2">
                  <div className="text-sm text-gray-300 mb-1">Select detection to classify</div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {liveDetections.slice(-8).map(d => (
                      <button
                        key={d.id}
                        title={d.threats && d.threats.length ? d.threats.join(', ') : (d.detected ? 'Threat detected' : 'Clean')}
                        onClick={() => setSelectedDetectionId(d.id)}
                        className={`px-2 py-1 rounded border text-xs whitespace-nowrap ${selectedDetectionId === d.id ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600'}`}
                      >
                        #{d.id % 10000} · {d.detected ? 'Threat' : 'Clean'} · {(d.confidence * 100).toFixed(0)}%
                      </button>
                    ))}
                    {!liveDetections.length && (
                      <span className="text-xs text-gray-500">No detections yet</span>
                    )}
                  </div>
                </div>
        {/* Main Detection Dashboard */}
        <div className="lg:col-span-2 space-y-6">
          {/* Classification Console */}
          <div className="bg-[#111827] rounded-xl border border-slate-800 p-4">
            <h3 className="text-lg font-semibold mb-4 text-green-400">Classify Attack</h3>
            {difficulty === 'Beginner' && (
              <div className="mb-3 p-3 rounded bg-gray-700 border border-gray-600 text-sm text-gray-200">
                <div className="font-semibold text-green-300 mb-1">Beginner mode</div>
                <div className="text-xs text-gray-300 mb-2">Unsure about categories? Use simple triage instead:</div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        safeSend(wsRef.current, { type: MessageTypes.DEFENSE_TRIAGE, label: 'tp', name });
                      }
                      setSystemStats(prev => ({ ...prev, truePositives: prev.truePositives + 1 }));
                      setDefendActions(prev => [...prev, { id: Date.now(), action: 'triage', target: 'Marked True Positive', timestamp: new Date() }]);
                    }}
                    className="px-3 py-1 rounded border bg-green-700 hover:bg-green-600 border-green-500 text-white"
                  >Mark as True Positive</button>
                  <button
                    onClick={() => {
                      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        safeSend(wsRef.current, { type: MessageTypes.DEFENSE_TRIAGE, label: 'fp', name });
                      }
                      setSystemStats(prev => ({ ...prev, falsePositives: prev.falsePositives + 1 }));
                      setDefendActions(prev => [...prev, { id: Date.now(), action: 'triage', target: 'Marked False Positive', timestamp: new Date() }]);
                    }}
                    className="px-3 py-1 rounded border bg-yellow-700 hover:bg-yellow-600 border-yellow-500 text-white"
                  >Mark as False Positive</button>
                </div>
                <div className="mt-2 text-xs text-gray-400">TP = real attack; FP = false alarm. This awards a small score in Beginner when a real attack is pending.</div>
                <div className="mt-3">
                  <div className="text-xs text-gray-300 mb-1">Or pick a category and submit a classification:</div>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      {k:'recon', l:'Recon'},
                      {k:'brute', l:'Brute Force'},
                      {k:'priv', l:'Privilege Escalation'},
                      {k:'persistence', l:'Persistence'},
                    ].map(opt => (
                      <button key={opt.k}
                        onClick={() => {
                          const elm = document.getElementById('clf_type');
                          if (elm) elm.value = opt.k;
                        }}
                        className="px-2 py-1 rounded border text-xs bg-gray-600 hover:bg-gray-500 border-gray-500">
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
              <input className="bg-gray-700 border border-gray-600 rounded px-3 py-2" placeholder="Attack category (recon, brute, priv, persistence)" id="clf_type" />
              <button
                type="button"
                onClick={() => { const elm = document.getElementById('clf_type'); if (elm) elm.value = ''; }}
                className="text-sm text-green-400 hover:text-green-300 underline-offset-2"
              >clear</button>
            </div>
            <div className="mt-3">
              <div className="text-sm text-gray-300 mb-1">Detection Profile</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'signature', label: 'Signature-focused' },
                  { key: 'anomaly', label: 'Anomaly-focused' },
                  { key: 'hybrid', label: 'Hybrid' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setDetectionProfile(opt.key)}
                    className={`px-3 py-1 rounded border text-sm ${
                      detectionProfile === opt.key
                        ? 'bg-green-700 border-green-500 text-white'
                        : 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600'
                    }`}
                  >{opt.label}</button>
                ))}
              </div>
              <div className="text-xs text-gray-400 mt-1">Choosing a profile can give a small bonus when your classification is correct and aligns with the attack style.</div>
            </div>
            <div className="mt-3">
              <button
                onClick={() => {
                  const classification = document.getElementById('clf_type').value;
                  if (!classification || !classification.trim()) { showToast('Enter an attack category before submitting', 'warning'); return; }
                  const sel = liveDetections.find(d => d.id === selectedDetectionId);
                  lastSubmittedRef.current = classification.trim();
                  setDefendActions(prev => [...prev, { id: Date.now(), action: 'submission', target: `Submitted classification: ${lastSubmittedRef.current}${sel ? ` (for #${sel.id % 10000})` : ''}`, timestamp: new Date() }]);
                  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    safeSend(wsRef.current, { type: MessageTypes.DEFENDER_CLASSIFY, classification, name, detection_profile: detectionProfile, attackId: sel?.eventId || sel?.id });
                  }
                }}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
              >Submit Classification</button>
              {lastClfResult && (
                <div className="mt-2 text-sm text-gray-300">
                  {lastClfResult.cooldown ? (
                    <span>Cooldown: {lastClfResult.message}</span>
                  ) : (
                    <span>Result: +{lastClfResult.award || 0}{lastClfResult.bonus ? ` +${lastClfResult.bonus}` : ''} (total {lastClfResult.total || 0}) {lastClfResult.correct ? '✓' : ''}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* System Stats - 4 cards, align with Detections width */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#111827] p-4 rounded-xl border border-slate-800 text-center">
              <div className="text-2xl font-bold text-blue-400">{systemStats.totalEvents}</div>
              <div className="text-sm text-gray-400">Total Events</div>
            </div>
            <div className="bg-[#111827] p-4 rounded-xl border border-slate-800 text-center">
              <div className="text-2xl font-bold text-red-400">{systemStats.detectedThreats}</div>
              <div className="text-sm text-gray-400">Threats Detected</div>
            </div>
            <div className="bg-[#111827] p-4 rounded-xl border border-slate-800 text-center">
              <div className="text-2xl font-bold text-yellow-400">{systemStats.falsePositives}</div>
              <div className="text-sm text-gray-400">False Positives</div>
            </div>
            <div className="bg-[#111827] p-4 rounded-xl border border-slate-800 text-center">
              <div className="text-2xl font-bold text-green-400">{systemStats.truePositives}</div>
              <div className="text-sm text-gray-400">True Positives</div>
            </div>
          </div>

          {/* Live Detection Feed */}
          <div className="bg-[#111827] rounded-xl border border-slate-800 p-4">
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
                        <div className="text-xs text-gray-400">ID: #{detection.id % 10000}</div>
                        {detection.threats && detection.threats.length > 0 && (
                          <div className="text-sm text-red-300">
                            Threats: {detection.threats.join(', ')}
                          </div>
                        )}
                        {detection.triage && (
                          <div className={`mt-1 inline-block text-xs px-2 py-0.5 rounded border ${detection.triage === 'fp' ? 'bg-yellow-800 border-yellow-500 text-yellow-100' : 'bg-green-800 border-green-500 text-green-100'}`}>
                            Marked {detection.triage === 'fp' ? 'False Positive' : 'True Positive'}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        {detection.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                    {/* TP/FP triage controls removed from detection items */}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Attack Events moved to right column */}
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* IDS tuning removed */}

          {/* IDS only: removed IP blocking panel */}

          {/* Participants removed per spec; right column focuses on Config and Communication */}

          {/* Defense Actions Log (manual notes) */}
          <div className="bg-[#111827] rounded-xl border border-slate-800 p-4">
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

          {/* Attack Events Log - moved here */}
          <div className="bg-[#111827] rounded-xl border border-slate-800 p-4">
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
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Communication (moved to right sidebar) */}
          <ChatPanel
            messages={chat}
            input={chatInput}
            onInputChange={(e) => setChatInput(e.target.value)}
            onSend={sendChat}
            disabled={paused}
          />
        </div>

      </div>
      {paused && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-gray-800 border border-yellow-500 rounded-lg p-6 text-center">
            <div className="text-yellow-300 text-xl font-bold mb-2">Paused by instructor</div>
            <div className="text-gray-300 text-sm">Please wait until the instructor resumes the simulation.</div>
          </div>
        </div>
      )}
      {toast && (
        <div className="fixed top-4 right-4 z-[60]">
          <div className={`px-4 py-2 rounded shadow border ${toast.type === 'warning' ? 'bg-yellow-900 border-yellow-600 text-yellow-100' : 'bg-gray-800 border-gray-600 text-gray-100'}`}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
};

export default DefendSimulation;
