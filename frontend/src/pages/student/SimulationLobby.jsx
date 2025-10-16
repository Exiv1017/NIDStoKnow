import React, { useState, useRef, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';

const roles = ['Attacker', 'Defender', 'Observer'];

const SimulationLobby = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [lobbyCode, setLobbyCode] = useState('');
  const [joined, setJoined] = useState(false);
  const [participants, setParticipants] = useState([]); // [{name, role, ready}]
  const [name, setName] = useState('');
  const [role, setRole] = useState(roles[0]);
  const [isReady, setIsReady] = useState(false);
  const [isInstructor, setIsInstructor] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [chat, setChat] = useState([]); // [{sender, message}]
  const [chatInput, setChatInput] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState(6);
  // difficulty removed from student lobby UI
  const [lobbyError, setLobbyError] = useState('');
  const [simulationStarted, setSimulationStarted] = useState(false);
  const chatEndRef = useRef(null);
  const wsRef = useRef(null);
  const isInstructorRef = useRef(false);
  const participantsRef = useRef([]);
  const roleRef = useRef(role);

  // Keep refs in sync to avoid stale values inside WebSocket callbacks
  useEffect(() => { isInstructorRef.current = isInstructor; }, [isInstructor]);
  useEffect(() => { participantsRef.current = participants; }, [participants]);
  useEffect(() => { roleRef.current = role; }, [role]);

  // --- WebSocket Integration ---
  useEffect(() => {
    if (!joined || !lobbyCode) return;
    
    console.log('Student connecting to WebSocket for lobby:', lobbyCode); // Debug log
    const ws = new WebSocket(
      `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/ws/lobby/${lobbyCode}${user?.token ? `?token=${encodeURIComponent(user.token)}` : ''}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Student WebSocket connected, sending join request'); // Debug log
      ws.send(JSON.stringify({ action: 'join', payload: { name, role } }));
    };

    ws.onerror = (error) => {
      console.error('Student WebSocket error:', error);
      setLobbyError('Connection error. Please try again.');
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Student WebSocket received:', data); // Debug log
        setLobbyError('');
        
        switch (data.type) {
          case 'join_success':
            setJoined(true);
            setParticipants(data.participants);
            setIsInstructor(data.isInstructor);
            break;
          case 'participant_update':
            setParticipants(data.participants);
            break;
          case 'chat_message':
            setChat(prev => [...prev, { sender: data.sender, message: data.message }]);
            break;
          case 'settings_update':
            setMaxParticipants(data.maxParticipants);
            break;
          case 'simulation_started':
            setSimulationStarted(true);
            // Navigate to role-specific simulation interface using latest refs
            if (isInstructorRef.current) {
              navigate('/instructor/simulation', {
                state: { lobbyCode, participants: participantsRef.current }
              });
            } else {
              navigateToSimulation(roleRef.current);
            }
            break;
          case 'error':
            setLobbyError(data.message);
            break;
          default:
            console.warn('Unknown WebSocket message type:', data.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        setLobbyError('Error processing server message');
      }
    };
    ws.onclose = (e) => {
      if (e && (e.code === 4401 || e.code === 4403)) {
        setLobbyError('Session expired. Please log in again.');
      }
      // If the lobby was closed by the instructor, already handled
      // If not, and the socket closes, also leave the lobby
      if (joined) {
        setLobbyError('The lobby has been closed or lost connection.');
        setJoined(false);
        setLobbyCode('');
        setParticipants([]);
        setChat([]);
      }
    };
    return () => {
      ws.close();
    };
  }, [joined, lobbyCode, name, role]);

  const sendWS = (action, payload) => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ action, payload }));
    }
  };

  // Update handlers to use sendWS
  const handleJoinLobby = () => {
    if (!name || !lobbyCode) return;
    joinLobby();
  };
  const handleReady = () => {
    setIsReady(true);
    sendWS('ready', { name, ready: true });
  };
  const handleUnready = () => {
    setIsReady(false);
    sendWS('ready', { name, ready: false });
  };
  const handleRoleChange = (e) => {
    setRole(e.target.value);
    sendWS('role', { name, role: e.target.value });
  };
  const handleLeaveLobby = () => {
    sendWS('leave', { name });
    setJoined(false);
    setIsReady(false);
    setIsInstructor(false);
    setLobbyCode('');
    setGeneratedCode('');
    setParticipants([]);
    setName('');
    setRole(roles[0]);
    setChat([]);
  try { sessionStorage.removeItem('simCtx'); } catch {}
  };
  const handleRemoveParticipant = (participantName) => {
    sendWS('remove', { name: participantName });
  };
  const handleResetLobby = () => {
    sendWS('reset', {});
  };
  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendWS('chat', { sender: isInstructor ? 'Instructor' : name, message: chatInput });
    setChatInput('');
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // Invite by email (frontend only, just UI)
  const handleSendInvite = () => {
    if (!inviteEmail.includes('@')) {
      setLobbyError('Please enter a valid email.');
      return;
    }
    setLobbyError('');
    setShowInvite(false);
    setInviteEmail('');
    // In real app, would send invite here
  };

  // Settings save (frontend only)
  const handleSaveSettings = () => {
    setShowSettings(false);
  };

  // Prevent overfilling lobby
  const canJoin = participants.length < maxParticipants;

  const handleCopyCode = async () => {
    try {
      if (document.hasFocus() && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(lobbyCode);
      } else {
        await navigator.clipboard.writeText(lobbyCode);
      }
    } catch (err) {
      try {
        const ta = document.createElement('textarea');
        ta.value = lobbyCode;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {}
    }
  };

  const handleStartSimulation = () => {
    // Ask server to start; navigation will also work locally as a fallback
    // Set difficulty before starting via instructor ws channel quickly
    try {
      sessionStorage.setItem('simDifficulty', difficulty);
    } catch {}
    // Fire-and-forget: open a transient instructor ws to set difficulty, then start
    try {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    const isw = new WebSocket(`${proto}://${host}/instructor/simulation/${lobbyCode}${user?.token ? `?token=${encodeURIComponent(user.token)}` : ''}`);
      isw.onopen = () => {
        isw.send(JSON.stringify({ action: 'set_difficulty', payload: { difficulty } }));
        // small delay to ensure room updates
        setTimeout(() => {
          isw.close();
          sendWS('start_simulation', {});
          navigateToSimulation(role);
        }, 150);
      };
      isw.onerror = () => {
        // fallback: just start
        sendWS('start_simulation', {});
        navigateToSimulation(role);
      };
      isw.onclose = (e) => {
        if (e && (e.code === 4401 || e.code === 4403)) {
          setLobbyError('Session expired. Please log in again.');
        }
      };
    } catch {
      sendWS('start_simulation', {});
      navigateToSimulation(role);
    }
  };

  const navigateToSimulation = (userRole) => {
    // Persist context so role screens can restore after refresh
    try {
      sessionStorage.setItem('simCtx', JSON.stringify({
        lobbyCode,
        participants: participantsRef.current,
  role: userRole,
  name,
        isInstructor: isInstructorRef.current
      }));
    } catch (e) {
      // ignore storage errors
    }
    switch (userRole) {
      case 'Attacker':
        navigate('/simulation/attack', { 
          state: { 
            lobbyCode, 
            participants,
            role: userRole,
            name
          } 
        });
        break;
      case 'Defender':
        navigate('/simulation/defend', { 
          state: { 
            lobbyCode, 
            participants,
            role: userRole,
            name
          } 
        });
        break;
      case 'Observer':
        navigate('/simulation/observe', { 
          state: { 
            lobbyCode, 
            participants,
            role: userRole,
            name
          } 
        });
        break;
      default:
        console.error('Unknown role:', userRole);
    }
  };

  const joinLobby = () => {
    if (!name || !lobbyCode) return;
    setJoined(true);
    // Do NOT setParticipants or setChat here; let WebSocket update it
  };

  // Auto-scroll chat on new messages
  useEffect(() => {
    if (chat.length > 0) {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [chat]);

  return (
    <div className="min-h-screen bg-white">
      {/* Page content */}
      <div className="w-full max-w-7xl mx-auto px-6 pt-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Simulation Lobby</h1>
            <p className="text-gray-600 mt-1">Join your simulation session</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              <span>Online</span>
            </div>
            {joined && (
              <span className="text-sm text-gray-600">
                {participants.length} participant{participants.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Main content */}
        {!joined ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start mt-8 pb-12">
            {/* Left: small explainer */}
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">How it works</h3>
                <p className="text-gray-600">Enter your name, the lobby code shared by your instructor, and select your role. You’ll see who has joined and when the simulation starts.</p>
              </div>
              <ul className="space-y-3">
                {[
                  'Use the join code provided by your instructor',
                  'Pick a role: Attacker, Defender, or Observer',
                  'Mark yourself ready and wait for the start signal'
                ].map((t, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{i+1}</span>
                    <span className="text-gray-700">{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: Join card */}
            <div className="w-full lg:ml-auto">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Join Lobby</h2>
                <p className="text-gray-600 mb-6">Enter your name and the code to join a simulation session.</p>
                <div className="mb-4 flex flex-col gap-3">
                  <input
                    type="text"
                    placeholder="Enter your name"
                    className="border px-3 py-2 rounded"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Lobby Code"
                    className="border px-3 py-2 rounded"
                    value={lobbyCode}
                    onChange={e => setLobbyCode(e.target.value.toUpperCase())}
                  />
                  <select
                    className="border px-2 py-2 rounded"
                    value={role}
                    onChange={handleRoleChange}
                  >
                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <button
                  className="w-full bg-[#1E5780] hover:bg-[#164666] text-white py-3 px-6 rounded-lg font-semibold text-base transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleJoinLobby}
                  disabled={!canJoin || !name.trim() || !lobbyCode.trim()}
                >
                  Join Lobby
                </button>
                {(!canJoin || !name.trim() || !lobbyCode.trim()) && (
                  <div className="text-red-600 text-xs mt-2">
                    {!canJoin ? 'Lobby is full. Please wait for a slot.' : !name.trim() ? 'Please enter your name.' : 'Please enter a lobby code.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full mt-6 pb-12">
              {/* Lobby Code Section */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Lobby Code</h3>
                    <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 mb-4">
                      <div className="text-4xl font-mono font-bold text-gray-900 tracking-wider">{lobbyCode}</div>
                    </div>
                    <button
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2"
                      onClick={handleCopyCode}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Code
                    </button>
                    <p className="text-sm text-gray-500 mt-3">Share this code with others to join</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <div className="text-sm text-gray-600">Difficulty: <span className="font-semibold">{difficulty}</span></div>
                    {!isReady && !isInstructor && (
                      <button className="w-full bg-green-50 hover:bg-green-100 text-green-700 py-2 px-4 rounded-lg font-medium transition-colors duration-200 text-left" onClick={handleReady}>
                        I am Ready
                      </button>
                    )}
                    {isReady && !isInstructor && (
                      <button className="w-full bg-yellow-50 hover:bg-yellow-100 text-yellow-700 py-2 px-4 rounded-lg font-medium transition-colors duration-200 text-left" onClick={handleUnready}>
                        Unready
                      </button>
                    )}
                    <button className="w-full bg-red-50 hover:bg-red-100 text-red-700 py-2 px-4 rounded-lg font-medium transition-colors duration-200 text-left" onClick={handleLeaveLobby}>
                      Leave Lobby
                    </button>
                  </div>
                </div>
              </div>
              {/* Participants Section */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 h-full">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Participants</h3>
                    <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
                      {participants.length}
                    </span>
                  </div>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {participants.length === 0 ? (
                      <div className="text-center py-8">
                        <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.196-2.12M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.196-2.12M7 20v-2m0 0v-5a2 2 0 012-2h6a2 2 0 012 2v5m0 0v2" />
                        </svg>
                        <p className="text-gray-500 text-sm">Waiting for others to join...</p>
                      </div>
                    ) : (
                      participants.map((p, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 font-semibold text-sm">
                                {p.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{p.name}</div>
                              <div className="text-xs text-gray-500">{p.role}</div>
                            </div>
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${p.ready ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {p.ready ? 'Ready' : 'Not Ready'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              {/* Chat Section */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Lobby Chat</h3>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-lg p-4 mb-4 overflow-y-auto min-h-[300px] max-h-[400px]">
                    {chat.length === 0 ? (
                      <div className="text-center text-gray-500 text-sm py-8">
                        <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        No messages yet. Start the conversation!
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {chat.map((msg, idx) => (
                          <div key={idx} className="flex gap-3">
                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-blue-600 font-semibold text-xs">
                                {msg.sender.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-gray-900 text-sm">{msg.sender}</span>
                                <span className="text-xs text-gray-500">now</span>
                              </div>
                              <p className="text-gray-700 text-sm">{msg.message}</p>
                            </div>
                          </div>
                        ))}
                        <div ref={chatEndRef} />
                      </div>
                    )}
                  </div>
                  <form className="flex gap-2 mt-2" onSubmit={handleSendChat}>
                    <input
                      type="text"
                      className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="Type a message..."
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      disabled={!joined}
                      style={{ minWidth: 0 }}
                    />
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                      disabled={!chatInput.trim()}
                      style={{ minWidth: '48px' }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </form>
                </div>
              </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default SimulationLobby;
