import React, { useState, useRef, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import InstructorSidebar from '../../components/InstructorSidebar';
import AuthContext from '../../context/AuthContext';

const roles = ['Instructor'];

const InstructorLobby = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [lobbyCode, setLobbyCode] = useState('');
  const [generated, setGenerated] = useState(false);
  const [participants, setParticipants] = useState([]);
  // difficulty/configuration removed from instructor lobby UI
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);
  const wsRef = useRef(null);
  // Config modal/state removed

  const handleGenerateLobby = async () => {
    // Ask backend to create a simulation room (server-generated code), then create a lobby with that same code.
    try {
      const headers = user?.token ? { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
      // Create a simulation room on the server so the room code is authoritative
      const resRoom = await fetch('/api/instructor/rooms', { method: 'POST', headers, body: JSON.stringify({ name: 'Lobby' }) });
      if (!resRoom.ok) throw new Error('failed to create simulation room');
      const roomData = await resRoom.json();
      const code = (roomData && roomData.code) ? roomData.code : (Math.random().toString(36).substring(2, 8).toUpperCase());
      // Now persist a lobby entry that maps to this room code
      const resLobby = await fetch(`/api/create_lobby/${code}`, { method: 'POST', headers });
      if (!resLobby.ok) throw new Error('create lobby failed');
      setLobbyCode(code);
      setGenerated(true);
    } catch (err) {
      console.error('handleGenerateLobby', err);
      alert('Failed to generate lobby');
    }
  };

  useEffect(() => {
    if (!generated || !lobbyCode) return;
    const ws = new WebSocket(
      `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/ws/lobby/${lobbyCode}${user?.token ? `?token=${encodeURIComponent(user.token)}` : ''}`
    );
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ action: 'join', payload: { name: 'Instructor', role: 'Instructor' } }));
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Instructor WebSocket received:', data); // Debug log
        
        switch (data.type) {
          case 'join_success':
              setParticipants(data.participants);
              break;
          case 'participant_update':
            setParticipants(data.participants);
            break;
          case 'chat_message':
            setChat(prev => [...prev, { sender: data.sender, message: data.message }]);
            break;
          case 'simulation_started':
            // Navigate instructor to simulation control panel
            navigate('/instructor/simulation', {
              state: {
                lobbyCode,
                participants
              }
            });
            break;
          case 'error':
            console.error('Lobby error:', data.message);
            break;
          default:
            // Handle legacy format for backward compatibility
            if (data.participants) setParticipants(data.participants);
            if (data.chat) setChat(data.chat);
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    ws.onclose = (e) => {
      if (e && (e.code === 4401 || e.code === 4403)) {
        alert('Your session expired or is invalid. Please log in again.');
      }
    };
    return () => ws.close();
  }, [generated, lobbyCode]);

  const sendWS = (action, payload) => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ action, payload }));
    }
  };

  // Check if simulation can be started
  const checkSimulationReadiness = () => {
    const roles = participants.reduce((acc, p) => {
      if (p.role !== 'Instructor') {
        acc[p.role] = (acc[p.role] || 0) + 1;
      }
      return acc;
    }, {});
    
    const hasAttacker = (roles.Attacker || 0) >= 1;
    const hasDefender = (roles.Defender || 0) >= 1;
    const allReady = participants.filter(p => p.role !== 'Instructor').every(p => p.ready);
    const hasMinimumParticipants = participants.filter(p => p.role !== 'Instructor').length >= 2;
    
    return {
      canStart: hasAttacker && hasDefender && allReady && hasMinimumParticipants,
      hasAttacker,
      hasDefender,
      allReady,
      hasMinimumParticipants,
      roles
    };
  };

  const handleStartSimulation = () => {
    const readiness = checkSimulationReadiness();
    
    if (!readiness.canStart) {
      // Show specific error message
      let message = "Cannot start simulation:\n";
      if (!readiness.hasAttacker) message += "• Need at least 1 Attacker\n";
      if (!readiness.hasDefender) message += "• Need at least 1 Defender\n";
      if (!readiness.allReady) message += "• All participants must be ready\n";
      if (!readiness.hasMinimumParticipants) message += "• Need minimum 2 participants\n";
      
      alert(message);
      return;
    }
    
    // Confirm before starting
    const studentCount = participants.filter(p => p.role !== 'Instructor').length;
    const confirmation = confirm(
      `Start simulation with ${studentCount} participants?\n\n` +
      `Roles: ${readiness.roles.Attacker || 0} Attacker(s), ${readiness.roles.Defender || 0} Defender(s), ${readiness.roles.Observer || 0} Observer(s)\n\n` +
      `All participants will be redirected to their role-specific interfaces.`
    );
    
    if (confirmation) {
      sendWS('start_simulation', {});
      // Instructor will be redirected via WebSocket message handler
    }
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendWS('chat', { sender: 'Instructor', message: chatInput });
    setChatInput('');
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleCloseLobby = async () => {
    if (!lobbyCode) return;
    const headers = user?.token ? { 'Authorization': `Bearer ${user.token}` } : {};
    await fetch(`/api/close_lobby/${lobbyCode}`, { method: 'POST', headers });
    setLobbyCode('');
    setGenerated(false);
    setParticipants([]);
    setChat([]);
    if (wsRef.current) wsRef.current.close();
  };

  return (
    <div className="min-h-screen bg-white">
      <InstructorSidebar />
      <div className="ml-64 min-h-screen">
        {/* Header */}
        <div className="w-full max-w-6xl mx-auto px-6 pt-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Simulation Lobby</h1>
              <p className="text-gray-600 mt-1">Create and manage your simulation sessions</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                <span>Online</span>
              </div>
              {generated && (
                <span className="text-sm text-gray-600">
                  {participants.length} participant{participants.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="w-full max-w-6xl mx-auto px-6 pb-12">
          {!generated ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center mt-8">
              {/* Left: Overview */}
              <div className="space-y-5">
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">What is a lobby?</h3>
                  <p className="text-gray-600">A lobby is a waiting room where participants gather before starting the simulation. You’ll see who’s joined, chat, and start when everyone’s ready.</p>
                </div>
                <ul className="space-y-3">
                  {[
                    'Generate a unique join code to share with students',
                    'Track who has joined and who is ready in real time',
                    'Start the simulation when minimum requirements are met'
                  ].map((text, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{i+1}</span>
                      <span className="text-gray-700">{text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right: Primary action card */}
              <div className="max-w-md w-full lg:ml-auto">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Create New Lobby</h2>
                  <p className="text-gray-600 mb-8">Generate a unique code for students to join your simulation session.</p>
                  <button
                    className="w-full bg-[#1E5780] hover:bg-[#164666] text-white py-4 px-6 rounded-lg font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                    onClick={handleGenerateLobby}
                  >
                    Generate Lobby Code
                  </button>
                  <p className="text-xs text-gray-500 mt-4">You can close the lobby anytime. Students won’t be able to join after it’s closed.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full mt-6">
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
                      onClick={async () => {
                        try {
                          // Prefer modern clipboard API when focused/allowed
                          if (document.hasFocus() && navigator.clipboard && navigator.clipboard.writeText) {
                            await navigator.clipboard.writeText(lobbyCode);
                          } else {
                            // Fallback: attempt regardless; may throw NotAllowedError if unfocused
                            await navigator.clipboard.writeText(lobbyCode);
                          }
                        } catch (err) {
                          // Ultimate fallback using a hidden textarea + execCommand
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
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Code
                    </button>
                    <p className="text-sm text-gray-500 mt-3">Share this code with your students</p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    {/* difficulty removed from instructor quick actions */}
                    {(() => {
                      const readiness = checkSimulationReadiness();
                      return (
                        <div>
                          <button 
                            className={`w-full py-2 px-4 rounded-lg font-medium transition-colors duration-200 text-left ${
                              readiness.canStart 
                                ? 'bg-green-50 hover:bg-green-100 text-green-700' 
                                : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                            }`}
                            onClick={handleStartSimulation}
                            disabled={!readiness.canStart}
                          >
                            {readiness.canStart ? '🚀 Start Simulation' : '⏳ Waiting for Requirements'}
                          </button>
                          
                          {/* Simulation Requirements Status */}
                          <div className="mt-2 text-xs space-y-1">
                            <div className={`flex items-center gap-2 ${readiness.hasAttacker ? 'text-green-600' : 'text-red-600'}`}>
                              <span>{readiness.hasAttacker ? '✓' : '✗'}</span>
                              <span>At least 1 Attacker ({readiness.roles.Attacker || 0})</span>
                            </div>
                            <div className={`flex items-center gap-2 ${readiness.hasDefender ? 'text-green-600' : 'text-red-600'}`}>
                              <span>{readiness.hasDefender ? '✓' : '✗'}</span>
                              <span>At least 1 Defender ({readiness.roles.Defender || 0})</span>
                            </div>
                            <div className={`flex items-center gap-2 ${readiness.allReady ? 'text-green-600' : 'text-red-600'}`}>
                              <span>{readiness.allReady ? '✓' : '✗'}</span>
                              <span>All participants ready</span>
                            </div>
                            <div className={`flex items-center gap-2 ${readiness.hasMinimumParticipants ? 'text-green-600' : 'text-red-600'}`}>
                              <span>{readiness.hasMinimumParticipants ? '✓' : '✗'}</span>
                              <span>Minimum 2 participants</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* Configure Settings removed */}
                    <button className="w-full bg-red-50 hover:bg-red-100 text-red-700 py-2 px-4 rounded-lg font-medium transition-colors duration-200 text-left" onClick={handleCloseLobby}>
                      Close Lobby
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
                        <p className="text-gray-500 text-sm">Waiting for students to join...</p>
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
                          {/* Only show ready status for students */}
                          {p.role !== 'Instructor' && (
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                p.ready 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {p.ready ? 'Ready' : 'Not Ready'}
                              </span>
                            </div>
                          )}
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
                      disabled={!generated}
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
          {/* Settings modal removed */}
  </div>
      </div>
    </div>
  );
};

export default InstructorLobby;
