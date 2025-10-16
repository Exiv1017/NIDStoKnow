import React, { useState, useEffect, useRef, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import { MessageTypes } from '../../simulation/messages';
import { buildWsUrl, safeSend } from '../../simulation/ws';

const InstructorSimulation = () => {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  let { lobbyCode, participants } = location.state || {};
  if (!lobbyCode && typeof window !== 'undefined') {
    try {
      const saved = JSON.parse(sessionStorage.getItem('simCtx'));
      if (saved) {
        lobbyCode = saved.lobbyCode;
        participants = saved.participants;
      }
    } catch {}
  }
  
  const [simulationStatus, setSimulationStatus] = useState('running');
  const [eventLogs, setEventLogs] = useState([]);
  const [participantScores, setParticipantScores] = useState({});
  const [simulationTime, setSimulationTime] = useState(0);
  const [selectedView] = useState('overview');
  const [simulationMetrics, setSimulationMetrics] = useState({
    totalEvents: 0,
    attacksLaunched: 0,
    detectionsTriggered: 0,
    successfulBlocks: 0
  });
  const [participantsList, setParticipantsList] = useState(participants || []);
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  // difficulty removed from instructor simulation header
  const wsRef = useRef(null);
  
  // Helpers and actions
  function getStatusColor(status) {
    switch ((status || '').toLowerCase()) {
      case 'running':
        return 'text-emerald-400';
      case 'paused':
        return 'text-yellow-400';
      case 'ended':
      case 'stopped':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  }

  function formatTime(totalSeconds) {
    totalSeconds = Math.round(totalSeconds || 0);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}h ${m}m ${s}s`;
  }

  const addLogEvent = (type, description, participant) => {
    setEventLogs(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        type: type || 'info',
        description: description || '',
        participant: participant,
        timestamp: new Date()
      }
    ]);
    setSimulationMetrics(prev => ({ ...prev, totalEvents: (prev.totalEvents || 0) + 1 }));
  };

  const handleSimulationEvent = (data) => {
    // Backend sends { type: 'simulation_event', eventType, description, participantName }
    const evtType = (data.eventType || '').toLowerCase();
    const desc = data.description || '';
    const who = data.participantName;
    let t = 'info';
    if (evtType.includes('attack')) t = 'attack';
    else if (evtType.includes('detect')) t = 'detection';
    else if (evtType.includes('block')) t = 'block';
    else if (evtType.includes('pause')) t = 'warning';
    else if (evtType.includes('resume')) t = 'info';
    else if (evtType.includes('end')) t = 'warning';
    addLogEvent(t, desc, who);
  };

  const pauseSimulation = () => {
    setSimulationStatus('paused');
    try { wsRef.current?.send(JSON.stringify({ type: MessageTypes.INSTRUCTOR_CONTROL, action: 'pause' })); } catch {}
    addLogEvent('warning', 'Simulation paused by instructor');
  };

  const resumeSimulation = () => {
    setSimulationStatus('running');
    try { wsRef.current?.send(JSON.stringify({ type: MessageTypes.INSTRUCTOR_CONTROL, action: 'resume' })); } catch {}
    addLogEvent('info', 'Simulation resumed by instructor');
  };

  const endSimulation = () => {
    setSimulationStatus('ended');
    try { wsRef.current?.send(JSON.stringify({ type: MessageTypes.INSTRUCTOR_CONTROL, action: 'end' })); } catch {}
    addLogEvent('warning', 'Simulation ended by instructor');
  };

  // Broadcast removed per spec

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    const msg = chatInput;
    try { wsRef.current?.send(JSON.stringify({ type: MessageTypes.CHAT_MESSAGE, sender: 'Instructor', message: msg })); } catch {}
    setChat(prev => [
      ...prev,
      { id: Date.now() + Math.random(), sender: 'Instructor', message: msg, timestamp: new Date() }
    ]);
    setChatInput('');
  };
  
  useEffect(() => {
    if (!lobbyCode) {
      navigate('/simulation-lobby');
      return;
    }
    
  // Connect to instructor simulation WebSocket using current origin
  wsRef.current = new WebSocket(buildWsUrl(`/instructor/simulation/${lobbyCode}`, user?.token));
    // Difficulty handling removed - instructor config not shown in lobby
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case MessageTypes.SIMULATION_EVENT:
          handleSimulationEvent(data);
          break;
        case MessageTypes.PARTICIPANT_SCORE_UPDATE:
          setParticipantScores(prev => ({
            ...prev,
            [data.participantId]: data.score
          }));
          break;
        case MessageTypes.SCORE_UPDATE:
          // Backend broadcasts { type: 'score_update', name, score }
          setParticipantScores(prev => ({
            ...prev,
            [data.name]: data.score
          }));
          break;
        case MessageTypes.CHAT_MESSAGE:
          setChat(prev => [...prev, {
            id: Date.now(),
            sender: data.sender,
            message: data.message,
            timestamp: new Date()
          }]);
          break;
        case MessageTypes.BROADCAST:
          setChat(prev => [...prev, {
            id: Date.now(),
            sender: 'Broadcast',
            message: data.message,
            timestamp: new Date()
          }]);
          break;
        case MessageTypes.SIMULATION_METRICS:
          setSimulationMetrics(data.metrics);
          break;
        case 'metrics_update': // alias support
          setSimulationMetrics(data.metrics);
          break;
        case 'participant_update':
          setParticipantsList(Array.isArray(data.participants) ? data.participants : []);
          break;
        case MessageTypes.PARTICIPANT_DISCONNECTED:
          addLogEvent('warning', `${data.participantName} disconnected`);
          break;
        case MessageTypes.PARTICIPANT_RECONNECTED:
          addLogEvent('info', `${data.participantName} reconnected`);
          break;
      }
    };
    wsRef.current.onclose = (e) => {
      if (e && (e.code === 4401 || e.code === 4403)) {
        alert('Session expired. Please log in again.');
      }
    };
    
    // Start simulation timer (pause-aware)
    let timer;
    const startTimer = () => {
      if (timer) clearInterval(timer);
      if (simulationStatus !== 'paused') {
        timer = setInterval(() => {
          setSimulationTime(prev => prev + 1);
        }, 1000);
      }
    };
    startTimer();
    
    return () => {
      if (timer) clearInterval(timer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [lobbyCode, navigate, simulationStatus]);

  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100">
      <main className="overflow-y-auto">
        <div className="p-4 sm:p-8">
          {/* Header Card */}
          <div className="bg-[#111827] shadow-sm border border-slate-800 rounded-xl px-6 sm:px-8 py-5 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">Simulation Control</h1>
                <p className="text-slate-400 mt-1">Lobby {lobbyCode || '-'} • <span className={getStatusColor(simulationStatus)}>{simulationStatus.toUpperCase()}</span></p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-slate-300 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5">
                  <label htmlFor="difficulty" className="text-slate-400">Difficulty</label>
                  <select
                    id="difficulty"
                    value={difficulty}
                    onChange={(e) => {
                      const next = e.target.value;
                      setDifficulty(next);
                      try {
                        wsRef.current?.send(JSON.stringify({ type: MessageTypes.INSTRUCTOR_CONTROL, action: 'set_difficulty', payload: { difficulty: next } }));
                      } catch {}
                    }}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 focus:outline-none"
                  >
                    <option>Beginner</option>
                    <option>Intermediate</option>
                    <option>Hard</option>
                  </select>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-sm text-slate-300 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5">
                  <span className="text-sky-400 font-semibold">Time</span>
                  <span className="font-mono text-slate-200">{formatTime(simulationTime)}</span>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-sm text-slate-300 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5">
                  <span className="text-emerald-400 font-semibold">Events</span>
                  <span className="font-mono text-slate-200">{simulationMetrics.totalEvents}</span>
                </div>
                <div className="flex items-center gap-2">
                  {simulationStatus === 'running' && (
                    <button onClick={pauseSimulation} className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400/90 text-black rounded-lg font-semibold transition-colors">Pause</button>
                  )}
                  {simulationStatus === 'paused' && (
                    <button onClick={resumeSimulation} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition-colors">Resume</button>
                  )}
                  <button onClick={endSimulation} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold transition-colors">End</button>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#111827] rounded-xl shadow-sm border border-slate-800 p-5">
              <h3 className="text-sm font-medium text-slate-400">Participants</h3>
              <div className="text-3xl font-extrabold text-sky-400 mt-1">{(simulationMetrics?.participantsCount ?? participantsList?.length ?? 0)}</div>
            </div>
            <div className="bg-[#111827] rounded-xl shadow-sm border border-slate-800 p-5">
              <h3 className="text-sm font-medium text-slate-400">Attacks</h3>
              <div className="text-3xl font-extrabold text-red-400 mt-1">{simulationMetrics.attacksLaunched}</div>
            </div>
            <div className="bg-[#111827] rounded-xl shadow-sm border border-slate-800 p-5">
              <h3 className="text-sm font-medium text-slate-400">Detections</h3>
              <div className="text-3xl font-extrabold text-yellow-400 mt-1">{simulationMetrics.detectionsTriggered}</div>
            </div>
            <div className="bg-[#111827] rounded-xl shadow-sm border border-slate-800 p-5">
              <h3 className="text-sm font-medium text-slate-400">Session Time</h3>
              <div className="text-3xl font-extrabold text-slate-100 mt-1">{formatTime(simulationTime)}</div>
            </div>
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Events and Metrics */}
            <div className="lg:col-span-2 space-y-6">
              {/* Recent Events */}
              <div className="bg-[#111827] rounded-xl shadow-sm border border-slate-800">
                <div className="p-5 border-b border-slate-800"><h3 className="text-lg font-semibold text-slate-100">Recent Events</h3></div>
                <div className="p-5 space-y-3 max-h-72 overflow-y-auto">
                  {eventLogs.length === 0 ? (
                    <div className="text-slate-400 text-sm">No events yet.</div>
                  ) : (
                    eventLogs.slice(-30).reverse().map(event => (
                      <div
                        key={event.id}
                        className={`p-3 rounded-lg border ${
                          event.type === 'attack' ? 'border-red-500/30 bg-red-500/10' :
                          event.type === 'detection' ? 'border-yellow-500/30 bg-yellow-500/10' :
                          event.type === 'block' ? 'border-emerald-500/30 bg-emerald-500/10' :
                          event.type === 'warning' ? 'border-orange-500/30 bg-orange-500/10' :
                          'border-sky-500/30 bg-sky-500/10'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-slate-100">{event.description}</div>
                            {event.participant && (
                              <div className="text-xs text-slate-400 mt-0.5">by {event.participant}</div>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">{event.timestamp.toLocaleTimeString()}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Metrics */}
              <div className="bg-[#111827] rounded-xl shadow-sm border border-slate-800">
                <div className="p-5 border-b border-slate-800"><h3 className="text-lg font-semibold text-slate-100">Simulation Metrics</h3></div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-slate-400">Total Events</span><span className="font-semibold text-slate-200">{simulationMetrics.totalEvents}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-400">Attacks Launched</span><span className="font-semibold text-red-400">{simulationMetrics.attacksLaunched}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-400">Detections Triggered</span><span className="font-semibold text-yellow-400">{simulationMetrics.detectionsTriggered}</span></div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-slate-400">Detection Rate</span><span className="font-semibold text-slate-200">{simulationMetrics.attacksLaunched > 0 ? Math.round((simulationMetrics.detectionsTriggered / simulationMetrics.attacksLaunched) * 100) : 0}%</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-400">Session Duration</span><span className="font-semibold text-slate-200">{formatTime(simulationTime)}</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Participants and Chat */}
            <div className="space-y-6">
              {/* Participants */}
              <div className="bg-[#111827] rounded-xl shadow-sm border border-slate-800">
                <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-100">Participants</h3>
                  <span className="bg-sky-500/10 text-sky-300 text-xs font-medium px-2.5 py-0.5 rounded-full">{(simulationMetrics?.participantsCount ?? participantsList?.length ?? 0)}</span>
                </div>
                <div className="p-5 space-y-3 max-h-72 overflow-y-auto">
                  {(participantsList?.length ? participantsList : []).map((participant, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-sky-500/10 rounded-full flex items-center justify-center">
                          <span className="text-sky-300 font-semibold text-sm">{participant.name?.[0]?.toUpperCase() || '?'}</span>
                        </div>
                        <div>
                          <div className="font-medium text-slate-100">{participant.name}</div>
                          <div className="text-xs text-slate-400">{participant.role}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-300">Score: {participantScores[participant.name] ?? participantScores[participant.id] ?? 0}</span>
                        <span className={`w-2.5 h-2.5 rounded-full ${participant.connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      </div>
                    </div>
                  ))}
                  {(!participantsList || participantsList.length === 0) && (
                    <div className="text-slate-400 text-sm">No participants connected.</div>
                  )}
                </div>
              </div>

              {/* Chat (broadcast removed per spec) */}
              <div className="bg-[#111827] rounded-xl shadow-sm border border-slate-800">
                <div className="p-5 border-b border-slate-800"><h3 className="text-lg font-semibold text-slate-100">Communication</h3></div>
                <div className="p-5">
                  {/* Broadcast removed */}

                  <div className="space-y-3 max-h-48 overflow-y-auto mb-4">
                    {chat.map(message => (
                      <div key={message.id} className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                        <div className="font-semibold text-sky-400">{message.sender}</div>
                        <div className="text-slate-200">{message.message}</div>
                        <div className="text-xs text-slate-500 mt-1">{message.timestamp.toLocaleTimeString()}</div>
                      </div>
                    ))}
                    {chat.length === 0 && (
                      <div className="text-slate-400 text-sm">No messages yet.</div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 border border-slate-700 bg-slate-900 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                    />
                    <button onClick={sendChatMessage} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition-colors">Send</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default InstructorSimulation;
