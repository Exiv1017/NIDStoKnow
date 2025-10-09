import React, { useState, useEffect, useRef, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import InstructorSidebar from '../../components/InstructorSidebar';
import AuthContext from '../../context/AuthContext';

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
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [difficulty, setDifficulty] = useState('Beginner');
  const wsRef = useRef(null);
  
  // Helpers and actions
  function getStatusColor(status) {
    switch ((status || '').toLowerCase()) {
      case 'running':
        return 'text-green-600';
      case 'paused':
        return 'text-yellow-600';
      case 'ended':
      case 'stopped':
        return 'text-red-600';
      default:
        return 'text-gray-600';
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
    try { wsRef.current?.send(JSON.stringify({ action: 'pause_simulation' })); } catch {}
    addLogEvent('warning', 'Simulation paused by instructor');
  };

  const resumeSimulation = () => {
    setSimulationStatus('running');
    try { wsRef.current?.send(JSON.stringify({ action: 'resume_simulation' })); } catch {}
    addLogEvent('info', 'Simulation resumed by instructor');
  };

  const endSimulation = () => {
    setSimulationStatus('ended');
    try { wsRef.current?.send(JSON.stringify({ action: 'end_simulation' })); } catch {}
    addLogEvent('warning', 'Simulation ended by instructor');
  };

  const broadcastToAll = () => {
    if (!broadcastMessage.trim()) return;
    try { wsRef.current?.send(JSON.stringify({ action: 'broadcast', payload: { message: broadcastMessage } })); } catch {}
    setChat(prev => [
      ...prev,
      { id: Date.now() + Math.random(), sender: 'Instructor', message: broadcastMessage, timestamp: new Date() }
    ]);
    setBroadcastMessage('');
  };

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    const msg = chatInput;
    try { wsRef.current?.send(JSON.stringify({ action: 'chat', payload: { sender: 'Instructor', message: msg } })); } catch {}
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
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.hostname;
  wsRef.current = new WebSocket(`${proto}://${host}:8000/instructor/simulation/${lobbyCode}${user?.token ? `?token=${encodeURIComponent(user.token)}` : ''}`);
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'simulation_event':
          handleSimulationEvent(data);
          break;
        case 'participant_score_update':
          setParticipantScores(prev => ({
            ...prev,
            [data.participantId]: data.score
          }));
          break;
        case 'chat_message':
          setChat(prev => [...prev, {
            id: Date.now(),
            sender: data.sender,
            message: data.message,
            timestamp: new Date()
          }]);
          break;
        case 'simulation_metrics':
          setSimulationMetrics(data.metrics);
          break;
        case 'participant_disconnected':
          addLogEvent('warning', `${data.participantName} disconnected`);
          break;
        case 'participant_reconnected':
          addLogEvent('info', `${data.participantName} reconnected`);
          break;
      }
    };
    wsRef.current.onclose = (e) => {
      if (e && (e.code === 4401 || e.code === 4403)) {
        alert('Session expired. Please log in again.');
      }
    };
    
    // Start simulation timer
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

  return (
    <div className="min-h-screen bg-white">
      <InstructorSidebar />
      <main className="ml-64 overflow-y-auto">
        <div className="p-4 sm:p-8">
          {/* Header Card */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-xl px-6 sm:px-8 py-5 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Simulation Control</h1>
                <p className="text-gray-600 mt-1">Lobby {lobbyCode || '-'} • <span className={getStatusColor(simulationStatus)}>{simulationStatus.toUpperCase()}</span></p>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600 bg-gray-50 border rounded-lg px-3 py-1.5">
                  <span className="text-[#1E5780] font-semibold">Time</span>
                  <span className="font-mono">{formatTime(simulationTime)}</span>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600 bg-gray-50 border rounded-lg px-3 py-1.5">
                  <span className="text-green-700 font-semibold">Events</span>
                  <span className="font-mono">{simulationMetrics.totalEvents}</span>
                </div>
                <div className="flex items-center gap-2">
                  {simulationStatus === 'running' && (
                    <button onClick={pauseSimulation} className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold transition-colors">Pause</button>
                  )}
                  {simulationStatus === 'paused' && (
                    <button onClick={resumeSimulation} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors">Resume</button>
                  )}
                  <button onClick={endSimulation} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors">End</button>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-sm font-medium text-gray-500">Participants</h3>
              <div className="text-3xl font-extrabold text-[#1E5780] mt-1">{participants?.length || 0}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-sm font-medium text-gray-500">Attacks</h3>
              <div className="text-3xl font-extrabold text-red-600 mt-1">{simulationMetrics.attacksLaunched}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-sm font-medium text-gray-500">Detections</h3>
              <div className="text-3xl font-extrabold text-yellow-600 mt-1">{simulationMetrics.detectionsTriggered}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-sm font-medium text-gray-500">Session Time</h3>
              <div className="text-3xl font-extrabold text-gray-900 mt-1">{formatTime(simulationTime)}</div>
            </div>
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Events and Metrics */}
            <div className="lg:col-span-2 space-y-6">
              {/* Recent Events */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-5 border-b"><h3 className="text-lg font-semibold text-gray-900">Recent Events</h3></div>
                <div className="p-5 space-y-3 max-h-72 overflow-y-auto">
                  {eventLogs.length === 0 ? (
                    <div className="text-gray-500 text-sm">No events yet.</div>
                  ) : (
                    eventLogs.slice(-30).reverse().map(event => (
                      <div
                        key={event.id}
                        className={`p-3 rounded-lg border ${
                          event.type === 'attack' ? 'border-red-200 bg-red-50' :
                          event.type === 'detection' ? 'border-yellow-200 bg-yellow-50' :
                          event.type === 'block' ? 'border-green-200 bg-green-50' :
                          event.type === 'warning' ? 'border-orange-200 bg-orange-50' :
                          'border-blue-200 bg-blue-50'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-gray-900">{event.description}</div>
                            {event.participant && (
                              <div className="text-xs text-gray-600 mt-0.5">by {event.participant}</div>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">{event.timestamp.toLocaleTimeString()}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Metrics */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-5 border-b"><h3 className="text-lg font-semibold text-gray-900">Simulation Metrics</h3></div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Total Events</span><span className="font-semibold">{simulationMetrics.totalEvents}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Attacks Launched</span><span className="font-semibold text-red-600">{simulationMetrics.attacksLaunched}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Detections Triggered</span><span className="font-semibold text-yellow-600">{simulationMetrics.detectionsTriggered}</span></div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Detection Rate</span><span className="font-semibold">{simulationMetrics.attacksLaunched > 0 ? Math.round((simulationMetrics.detectionsTriggered / simulationMetrics.attacksLaunched) * 100) : 0}%</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Session Duration</span><span className="font-semibold">{formatTime(simulationTime)}</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Participants and Chat */}
            <div className="space-y-6">
              {/* Participants */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-5 border-b flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Participants</h3>
                  <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">{participants?.length || 0}</span>
                </div>
                <div className="p-5 space-y-3 max-h-72 overflow-y-auto">
                  {participants?.length ? participants.map((participant, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold text-sm">{participant.name?.[0]?.toUpperCase() || '?'}</span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{participant.name}</div>
                          <div className="text-xs text-gray-500">{participant.role}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-700">Score: {participantScores[participant.id] || 0}</span>
                        <span className={`w-2.5 h-2.5 rounded-full ${participant.connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      </div>
                    </div>
                  )) : (
                    <div className="text-gray-500 text-sm">No participants connected.</div>
                  )}
                </div>
              </div>

              {/* Chat & Broadcast */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-5 border-b"><h3 className="text-lg font-semibold text-gray-900">Communication</h3></div>
                <div className="p-5">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Broadcast to All</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        placeholder="Send message to all participants..."
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1E5780] focus:border-transparent outline-none"
                        onKeyDown={(e) => e.key === 'Enter' && broadcastToAll()}
                      />
                      <button onClick={broadcastToAll} className="px-4 py-2 bg-[#1E5780] hover:bg-[#164666] text-white rounded-lg font-semibold transition-colors">Broadcast</button>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-48 overflow-y-auto mb-4">
                    {chat.map(message => (
                      <div key={message.id} className="p-3 bg-gray-50 border rounded-lg">
                        <div className="font-semibold text-[#1E5780]">{message.sender}</div>
                        <div className="text-gray-800">{message.message}</div>
                        <div className="text-xs text-gray-500 mt-1">{message.timestamp.toLocaleTimeString()}</div>
                      </div>
                    ))}
                    {chat.length === 0 && (
                      <div className="text-gray-500 text-sm">No messages yet.</div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1E5780] focus:border-transparent outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                    />
                    <button onClick={sendChatMessage} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors">Send</button>
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
