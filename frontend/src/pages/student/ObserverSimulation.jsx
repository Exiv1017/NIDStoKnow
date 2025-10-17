import React, { useState, useEffect, useRef, useContext } from 'react';
import ChatPanel from '../../components/ChatPanel';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import { MessageTypes } from '../../simulation/messages';
import { buildWsUrl, safeSend } from '../../simulation/ws';

const ObserverSimulation = () => {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  let { lobbyCode, participants, role } = location.state || {};
  const [name, setName] = useState(() => {
    try { const saved = JSON.parse(sessionStorage.getItem('simCtx')); return saved?.name || 'Observer'; } catch { return 'Observer'; }
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
  
  const [attackerView, setAttackerView] = useState({
    commands: [],
    objectives: [],
    score: 0
  });
  const [defenderView, setDefenderView] = useState({
    detections: [],
    blockedIPs: [],
    config: {},
    score: 0
  });
  const [simulationTime, setSimulationTime] = useState(0);
  const [selectedView, setSelectedView] = useState('overview');
  const [learningNotes, setLearningNotes] = useState('');
  const [keyInsights, setKeyInsights] = useState([]);
  const [eventTimeline, setEventTimeline] = useState([]);
  const wsRef = useRef(null);
  const [scores, setScores] = useState({});
  const [obParticipants, setObParticipants] = useState(participants || []);
  const [rolesByName, setRolesByName] = useState(() => {
    const map = {};
    (participants || []).forEach(p => { if (p?.name) map[p.name] = p.role; });
    return map;
  });
  const [showGuide, setShowGuide] = useState(true);
  const [paused, setPaused] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState('');
  
  // Communication helper
  const sendChat = () => {
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChat(prev => [...prev, { id: Date.now(), sender: name, message: msg, timestamp: new Date() }]);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      safeSend(wsRef.current, { type: MessageTypes.CHAT_MESSAGE, sender: name, message: msg });
    }
    setChatInput('');
  };
  
  useEffect(() => {
    if (!lobbyCode) {
      navigate('/student/lobby');
      return;
    }
    
    // Connect to simulation WebSocket using current origin
  wsRef.current = new WebSocket(buildWsUrl(`/simulation/${lobbyCode}`, user?.token));
    wsRef.current.onopen = () => {
  safeSend(wsRef.current, { type: MessageTypes.JOIN, name, role });
    };
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'attacker_action':
          handleAttackerAction(data);
          break;
        case MessageTypes.ATTACK_EVENT:
          // Normalize to existing handler: data.event contains the command
          handleAttackerAction({
            command: data.event?.command,
            success: true,
            score: undefined
          });
          break;
        case MessageTypes.DEFENDER_ACTION:
          handleDefenderAction(data);
          break;
        case MessageTypes.DETECTION_EVENT:
          handleDetectionEvent(data);
          break;
        case MessageTypes.SESSION_STATE: {
          const s = (data.state || '').toLowerCase();
          if (s === 'paused') setPaused(true);
          if (s === 'running') setPaused(false);
          if (s === 'ended') {
            setPaused(false);
            // Non-blocking end notice
            setToastMsg('Simulation ended by instructor — leaving in 3s');
            setShowToast(true);
            generateFinalReport();
            setTimeout(() => navigate('/student/lobby'), 3000);
          }
          break;
        }
        case MessageTypes.SIMULATION_PAUSED:
          setPaused(true);
          break;
        case MessageTypes.SIMULATION_RESUMED:
          setPaused(false);
          break;
        case MessageTypes.SIMULATION_ENDED:
          setPaused(false);
          setToastMsg('Simulation ended by instructor — leaving in 3s');
          setShowToast(true);
          generateFinalReport();
          setTimeout(() => navigate('/student/lobby'), 3000);
          break;
        case MessageTypes.SCORE_UPDATE: {
          const pname = data.name;
          const pscore = data.score;
          setScores(prev => ({ ...prev, [pname]: pscore }));
          const role = rolesByName[pname];
          if (role === 'Attacker') {
            setAttackerView(prev => ({ ...prev, score: pscore }));
          } else if (role === 'Defender') {
            setDefenderView(prev => ({ ...prev, score: pscore }));
          }
          break;
        }
        case MessageTypes.SIMULATION_END:
          // Legacy end event compatibility
          setPaused(false);
          setToastMsg('Simulation ended');
          setShowToast(true);
          generateFinalReport();
          setTimeout(() => navigate('/student/lobby'), 2500);
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
        case MessageTypes.PARTICIPANT_JOINED: {
          const entry = { name: data.name, role: data.role };
          setObParticipants(prev => Array.isArray(prev) ? [...prev, entry] : [entry]);
          setRolesByName(prev => ({ ...prev, [entry.name]: entry.role }));
          break;
        }
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

  const handleLeave = () => {
    const ok = window.confirm('Leave the simulation?');
    if (!ok) return;
    try { wsRef.current?.close(); } catch {}
    navigate('/student/lobby');
  };
  
  const handleAttackerAction = (data) => {
    setAttackerView(prev => ({
      ...prev,
      commands: [...prev.commands, {
        id: Date.now(),
        command: data.command,
        timestamp: new Date(),
        success: data.success
      }],
      score: data.score || prev.score
    }));
    
    addToTimeline('attack', data.command, data.success);
    
    // Auto-generate learning insights
    if (data.command.includes('nmap')) {
      addInsight('Reconnaissance', 'Attacker is performing network scanning to discover targets');
    } else if (data.command.includes('ssh') || data.command.includes('hydra')) {
      addInsight('Brute Force', 'Attacker is attempting credential-based attacks');
    }
  };
  
  const handleDefenderAction = (data) => {
    setDefenderView(prev => ({
      ...prev,
      detections: [...prev.detections, {
        id: Date.now(),
        type: data.detectionType,
        confidence: data.confidence,
        timestamp: new Date()
      }],
      score: data.score || prev.score
    }));
    
    addToTimeline('defense', data.action, data.success);
    
    if (data.detectionType && data.confidence > 0.8) {
      addInsight('Detection', `High confidence ${data.detectionType} detection - effective monitoring`);
    }
  };
  
  const handleDetectionEvent = (data) => {
    addToTimeline('detection', `${data.method} detected threat`, data.detected);
    
    if (!data.detected && data.shouldHaveDetected) {
      addInsight('Missed Detection', 'Attack technique bypassed current detection methods');
    }
  };
  
  const addToTimeline = (type, description, success) => {
    setEventTimeline(prev => [...prev, {
      id: Date.now(),
      type,
      description,
      success,
      timestamp: new Date()
    }]);
  };
  
  const addInsight = (category, description) => {
    setKeyInsights(prev => {
      // Avoid duplicates
      if (prev.some(insight => insight.description === description)) {
        return prev;
      }
      
      return [...prev, {
        id: Date.now(),
        category,
        description,
        timestamp: new Date()
      }];
    });
  };
  
  const generateFinalReport = () => {
    const report = {
      simulationDuration: simulationTime,
      attackerScore: attackerView.score,
      defenderScore: defenderView.score,
      totalEvents: eventTimeline.length,
      successfulAttacks: eventTimeline.filter(e => e.type === 'attack' && e.success).length,
      successfulDefenses: eventTimeline.filter(e => e.type === 'defense' && e.success).length,
      keyInsights: keyInsights,
      learningNotes: learningNotes
    };
    
    // Could save this report or display it
    console.log('Simulation Report:', report);
  };
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-blue-400 p-6">
      {/* Toast */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-blue-400 text-white px-4 py-2 rounded shadow">
          {toastMsg}
        </div>
      )}
      {/* Paused overlay */}
      {paused && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="bg-gray-800 border border-yellow-400 rounded-lg px-6 py-4 text-center">
            <div className="text-yellow-300 font-semibold text-lg">Paused by instructor</div>
            <div className="text-gray-300 text-sm mt-1">You can continue observing when the session resumes.</div>
          </div>
        </div>
      )}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-gray-800 border border-blue-400 rounded-lg w-full max-w-2xl p-6 text-white">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-bold text-yellow-300">Simulation Guide</h2>
              <button onClick={() => setShowGuide(false)} className="text-gray-300 hover:text-white">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <span className="bg-gray-700 px-2 py-1 rounded">Role: Observer</span>
              </div>
              <div>
                <div className="font-semibold text-blue-300 mb-1">How to use</div>
                <ul className="list-disc list-inside text-gray-200 space-y-1">
                  <li>Switch views to monitor attacker, defender, and timeline.</li>
                  <li>Take learning notes; insights will auto-populate from events.</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold text-blue-300 mb-1">Scoring context</div>
                <ul className="list-disc list-inside text-gray-200 space-y-1">
                  <li>Attacker: objectives are 10 pts each; some are 20 pts (hard).</li>
                  <li>Defender: correct classification awards the objective’s points.</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 text-right">
              <button onClick={() => setShowGuide(false)} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded">Got it</button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-400">Observer</h1>
          <p className="text-gray-400">Lobby {lobbyCode} · {role}</p>
        </div>
        <div className="flex items-center space-x-3">
          {paused && (
            <span className="px-3 py-1 rounded bg-yellow-600/20 text-yellow-300 border border-yellow-500 text-sm">Paused</span>
          )}
          <div className="bg-gray-800 px-4 py-2 rounded">
            <span className="text-yellow-400">Events {eventTimeline.length}</span>
          </div>
          <div className="bg-gray-800 px-4 py-2 rounded">
            <span className="text-blue-400">Time {formatTime(simulationTime)}</span>
          </div>
          <button onClick={handleLeave} className="bg-gray-700 hover:bg-gray-600 text-gray-100 px-3 py-2 rounded border border-gray-600">Leave</button>
        </div>
      </div>

      {/* View Selector */}
      <div className="mb-6">
        <div className="flex space-x-2 bg-[#111827] border border-slate-800 p-2 rounded-xl">
          {['overview', 'attacker', 'defender', 'timeline', 'insights'].map(view => (
            <button
              key={view}
              onClick={() => setSelectedView(view)}
              className={`px-4 py-2 rounded capitalize ${
                selectedView === view
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {view}
            </button>
          ))}
        </div>
      </div>

      {/* Content Based on Selected View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {selectedView === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#111827] p-6 rounded-xl border border-slate-800">
                  <h3 className="text-xl font-bold text-red-400 mb-2">Attacker Progress</h3>
                  <div className="text-3xl font-bold text-white">{attackerView.score}</div>
                  <div className="text-red-200">Score Points</div>
                  <div className="mt-2 text-sm text-red-300">
                    Commands executed: {attackerView.commands.length}
                  </div>
                </div>
                
                <div className="bg-[#111827] p-6 rounded-xl border border-slate-800">
                  <h3 className="text-xl font-bold text-green-400 mb-2">Defender Progress</h3>
                  <div className="text-3xl font-bold text-white">{defenderView.score}</div>
                  <div className="text-green-200">Score Points</div>
                  <div className="mt-2 text-sm text-green-300">
                    Detections made: {defenderView.detections.length}
                  </div>
                </div>
              </div>
              
              <div className="bg-[#111827] p-6 rounded-xl border border-slate-800">
                <h3 className="text-lg font-semibold mb-4">Live Event Stream</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {eventTimeline.slice(-10).reverse().map(event => (
                    <div
                      key={event.id}
                      className={`p-3 rounded border-l-4 ${
                        event.type === 'attack' ? 'bg-red-900 border-red-400' :
                        event.type === 'defense' ? 'bg-green-900 border-green-400' :
                        'bg-blue-900 border-blue-400'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold capitalize">{event.type}</div>
                          <div className="text-sm text-gray-300">{event.description}</div>
                        </div>
                        <div className="text-xs text-gray-400">
                          {event.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Educational Tips under stream */}
                <div className="mt-6">
                  <h4 className="text-md font-semibold mb-3 text-purple-400">Educational Tips</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="bg-purple-900/50 border border-purple-700/60 p-3 rounded-xl">
                      <div className="font-semibold text-purple-300">Watch for Patterns</div>
                      <div className="text-purple-200">Notice how attackers and defenders adapt based on each other's actions.</div>
                    </div>
                    <div className="bg-purple-900/50 border border-purple-700/60 p-3 rounded-xl">
                      <div className="font-semibold text-purple-300">Detection Timing</div>
                      <div className="text-purple-200">Observe the delay between attack execution and detection alerts.</div>
                    </div>
                    <div className="bg-purple-900/50 border border-purple-700/60 p-3 rounded-xl">
                      <div className="font-semibold text-purple-300">False Positives</div>
                      <div className="text-purple-200">Notice when legitimate activity triggers security alerts.</div>
                    </div>
                  </div>
                </div>

                {/* Simulation Stats under stream */}
                <div className="mt-6">
                  <h4 className="text-md font-semibold mb-3 text-blue-400">Simulation Stats</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="bg-[#111827] border border-slate-800 p-3 rounded-xl flex justify-between"><span>Duration</span><span className="text-blue-300">{formatTime(simulationTime)}</span></div>
                    <div className="bg-[#111827] border border-slate-800 p-3 rounded-xl flex justify-between"><span>Total Events</span><span className="text-blue-300">{eventTimeline.length}</span></div>
                    <div className="bg-[#111827] border border-slate-800 p-3 rounded-xl flex justify-between"><span>Attack Actions</span><span className="text-red-300">{eventTimeline.filter(e => e.type === 'attack').length}</span></div>
                    <div className="bg-[#111827] border border-slate-800 p-3 rounded-xl flex justify-between"><span>Defense Actions</span><span className="text-green-300">{eventTimeline.filter(e => e.type === 'defense').length}</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedView === 'attacker' && (
            <div className="bg-[#111827] p-6 rounded-xl border border-slate-800">
              <h3 className="text-lg font-semibold mb-4 text-red-400">Attacker Activity</h3>
              <div className="space-y-3">
                {attackerView.commands.map(cmd => (
                  <div key={cmd.id} className="bg-red-900/40 border border-red-700/60 p-3 rounded-xl">
                    <div className="font-mono text-sm text-red-200">{cmd.command}</div>
                    <div className="flex justify-between text-xs text-red-300 mt-1">
                      <span>{cmd.success ? '✓ Success' : '✗ Failed'}</span>
                      <span>{cmd.timestamp.toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedView === 'defender' && (
            <div className="bg-[#111827] p-6 rounded-xl border border-slate-800">
              <h3 className="text-lg font-semibold mb-4 text-green-400">Defender Activity</h3>
              <div className="space-y-3">
                {defenderView.detections.map(detection => (
                  <div key={detection.id} className="bg-green-900/40 border border-green-700/60 p-3 rounded-xl">
                    <div className="font-semibold text-green-200">{detection.type}</div>
                    <div className="text-sm text-green-300">
                      Confidence: {(detection.confidence * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-green-400 mt-1">
                      {detection.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedView === 'timeline' && (
            <div className="bg-[#111827] p-6 rounded-xl border border-slate-800">
              <h3 className="text-lg font-semibold mb-4">Event Timeline</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {eventTimeline.map(event => (
                  <div
                    key={event.id}
                    className={`p-3 rounded-l-lg border-l-4 ${
                      event.type === 'attack' ? 'border-red-400 bg-red-900' :
                      event.type === 'defense' ? 'border-green-400 bg-green-900' :
                      'border-blue-400 bg-blue-900'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-semibold capitalize">{event.type}: </span>
                        <span>{event.description}</span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {event.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedView === 'insights' && (
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-4 text-yellow-400">Key Learning Insights</h3>
              <div className="space-y-3">
                {keyInsights.map(insight => (
                  <div key={insight.id} className="bg-yellow-900 p-4 rounded">
                    <div className="font-semibold text-yellow-400">{insight.category}</div>
                    <div className="text-yellow-200 mt-1">{insight.description}</div>
                    <div className="text-xs text-yellow-300 mt-2">
                      {insight.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                ))}
                
                {keyInsights.length === 0 && (
                  <p className="text-gray-400">No insights generated yet. Insights will appear as the simulation progresses.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Communication */}
          <ChatPanel
            messages={chat}
            input={chatInput}
            onInputChange={(e) => setChatInput(e.target.value)}
            onSend={sendChat}
            disabled={paused}
          />

          {/* Learning Notes */}
          <div className="bg-[#111827] rounded-xl border border-slate-800 p-4">
            <h3 className="text-lg font-semibold mb-4 text-purple-400">Learning Notes</h3>
            <textarea
              value={learningNotes}
              onChange={(e) => setLearningNotes(e.target.value)}
              placeholder="Take notes about what you're learning from this simulation..."
              className="w-full h-32 bg-gray-700 border border-gray-600 rounded-xl p-3 text-white resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ObserverSimulation;
