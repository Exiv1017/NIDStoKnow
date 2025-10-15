import React, { useState, useEffect, useRef, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import ChatPanel from '../../components/ChatPanel';
import { MessageTypes } from '../../simulation/messages';
import { buildWsUrl, safeSend } from '../../simulation/ws';

const AttackSimulation = () => {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  let { lobbyCode, role } = location.state || {};
  const [name] = useState(() => {
    try { const saved = JSON.parse(sessionStorage.getItem('simCtx')); return saved?.name || 'Attacker'; } catch { return 'Attacker'; }
  });
  if (!lobbyCode && typeof window !== 'undefined') {
    try { const saved = JSON.parse(sessionStorage.getItem('simCtx')); if (saved) { lobbyCode = saved.lobbyCode; role = saved.role; } } catch {}
  }

  // UI state
  const [terminal, setTerminal] = useState('');
  const [commandHistory, setCommandHistory] = useState([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [objectives, setObjectives] = useState([]);
  const [score, setScore] = useState(0);
  const [detectionAlerts, setDetectionAlerts] = useState([]);
  const [simulationTime, setSimulationTime] = useState(0);
  const [serverMessage, setServerMessage] = useState('');
  const [hints, setHints] = useState([]);
  const [passScore, setPassScore] = useState(0);
  const [showGuide, setShowGuide] = useState(false);
  const [paused, setPaused] = useState(false);
  const [toast, setToast] = useState(null);
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState('');

  const wsRef = useRef(null);
  const inputRef = useRef(null);
  const objectivesRef = useRef([]);

  const showToast = (message, type = 'info', duration = 2000) => {
    setToast({ message, type });
    if (duration > 0) setTimeout(() => setToast(null), duration);
  };

  useEffect(() => { objectivesRef.current = objectives; }, [objectives]);

  // Connect WS
  useEffect(() => {
    if (!lobbyCode) { navigate('/student/lobby'); return; }
    wsRef.current = new WebSocket(buildWsUrl(`/simulation/${lobbyCode}`, user?.token));
    wsRef.current.onopen = () => {
      safeSend(wsRef.current, { type: MessageTypes.JOIN, name, role });
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN && objectivesRef.current.length === 0) {
          safeSend(wsRef.current, { type: MessageTypes.REQUEST_OBJECTIVES, name });
        }
      }, 800);
    };
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case MessageTypes.ERROR:
          setTerminal((p) => p + '\n[server error] ' + (data.message || 'Unknown error'));
          break;
        case MessageTypes.JOIN_ACK:
          setServerMessage(`Difficulty: ${data.difficulty}`);
          if (typeof data.pass_score === 'number') setPassScore(data.pass_score);
          setShowGuide(true);
          break;
        case MessageTypes.HINTS:
          // Backend may send {hints:[{id,hint}], remaining?} or {items: [...]}
          {
            const items = data.hints || data.items || [];
            setHints(Array.isArray(items) ? items : []);
          }
          break;
        case MessageTypes.DETECTION_ALERT:
          setDetectionAlerts((prev) => [...prev, { id: Date.now(), message: data.message, severity: data.severity, timestamp: new Date() }]);
          break;
        case MessageTypes.COMMAND_RESULT:
          setTerminal((p) => p + '\n' + data.output);
          break;
        case MessageTypes.OBJECTIVES:
          setObjectives((data.objectives || []).map((o) => ({ id: o.id, description: o.description, completed: !!o.completed, points: o.points })));
          // Ensure the quick-start guide is visible once objectives arrive
          setShowGuide(true);
          break;
        case MessageTypes.OBJECTIVES_UPDATE:
          {
            const completedIds = data.completed || [];
            const newly = objectivesRef.current.filter((o) => !o.completed && completedIds.includes(o.id));
            if (newly.length) {
              const msg = newly.map((o) => `✓ Objective completed: ${o.description} (+${o.points} pts)`).join('\n');
              setTerminal((p) => p + '\n' + msg);
            }
          }
          setObjectives((prev) => prev.map((o) => ({ ...o, completed: o.completed || (data.completed || []).includes(o.id) })));
          if (typeof data.score === 'number') {
            setScore(data.score);
            try {
              const payload = { role: 'Attacker', score: data.score, lobbyCode, updatedAt: new Date().toISOString() };
              localStorage.setItem('student_last_simulation_score', JSON.stringify(payload));
            } catch {}
          }
          break;
        case MessageTypes.SCORE_UPDATE:
          if (data.name === name && typeof data.score === 'number') {
            setScore(data.score);
            try {
              const payload = { role: 'Attacker', score: data.score, lobbyCode, updatedAt: new Date().toISOString() };
              localStorage.setItem('student_last_simulation_score', JSON.stringify(payload));
            } catch {}
          }
          break;
        case MessageTypes.SESSION_STATE:
          if ((data.status || '').toLowerCase() === 'paused') setPaused(true);
          if ((data.status || '').toLowerCase() === 'running') { setPaused(false); setShowGuide(true); }
          if ((data.status || '').toLowerCase() === 'ended') { showToast('Simulation ended', 'warning'); setTimeout(() => navigate('/student/lobby'), 1200); }
          break;
        case MessageTypes.SIMULATION_PAUSED: setPaused(true); break;
        case MessageTypes.SIMULATION_RESUMED: setPaused(false); break;
        case MessageTypes.SIMULATION_ENDED:
        case MessageTypes.SIMULATION_END:
          try {
            // Persist completion for instructor reports/notifications using latest stored score (fallback to state)
            const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
            const rawUser = localStorage.getItem('user');
            const u = rawUser ? JSON.parse(rawUser) : (user || {});
            const sid = u?.id || user?.id;
            const tok = u?.token || user?.token;
            let finalScore = score;
            try { const ls = JSON.parse(localStorage.getItem('student_last_simulation_score') || 'null'); if (ls && typeof ls.score === 'number') finalScore = ls.score; } catch {}
            if (sid && tok) {
              fetch(`${API_BASE}/api/student/${sid}/simulation-completed`.replace(/([^:]?)\/\/+/g,'$1/'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tok}` },
                body: JSON.stringify({ role: 'attacker', score: finalScore, lobby_code: lobbyCode })
              }).then(() => {
                // notify bell in same tab and any other tabs
                try { localStorage.setItem('notify_refresh', String(Date.now())); } catch {}
                try { window.dispatchEvent(new CustomEvent('student-notify-refresh')); } catch {}
              }).catch(() => {});
            }
          } catch {}
          showToast('Simulation ended', 'warning'); setTimeout(() => navigate('/student/lobby'), 1200); break;
        case MessageTypes.BROADCAST:
          setChat((prev) => [...prev, { id: Date.now(), sender: 'Broadcast', message: data.message, timestamp: new Date() }]);
          break;
        case 'instructor_broadcast':
          setChat((prev) => [...prev, { id: Date.now(), sender: 'Instructor', message: data.message, timestamp: new Date() }]);
          break;
        case MessageTypes.CHAT_MESSAGE:
          setChat((prev) => [...prev, { id: Date.now(), sender: data.sender || 'Message', message: data.message, timestamp: new Date() }]);
          break;
        default:
          break;
      }
    };
    return () => { try { wsRef.current?.close(); } catch {} };
  }, [lobbyCode, navigate, role, user?.token, name]);

  // Timer (pause-aware)
  useEffect(() => {
    if (paused) return; const t = setInterval(() => setSimulationTime((p) => p + 1), 1000); return () => clearInterval(t);
  }, [paused]);

  const requestObjectivesNow = () => { if (wsRef.current?.readyState === WebSocket.OPEN) safeSend(wsRef.current, { type: MessageTypes.REQUEST_OBJECTIVES, name }); };
  const requestHintsNow = () => { if (wsRef.current?.readyState === WebSocket.OPEN) safeSend(wsRef.current, { type: MessageTypes.REQUEST_HINTS, name }); };

  const executeCommand = () => {
    if (!currentCommand.trim()) return;
    setTerminal((p) => p + '\n' + `attacker@target:~$ ${currentCommand}`);
    setCommandHistory((p) => [...p, currentCommand]);
    if (wsRef.current?.readyState === WebSocket.OPEN) safeSend(wsRef.current, { type: MessageTypes.EXECUTE_COMMAND, command: currentCommand, role: 'attacker', name });
    setCurrentCommand('');
  };

  const formatTime = (s) => { const m = Math.floor(s / 60); const sec = s % 60; return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`; };
  const handleKeyPress = (e) => { if (e.key === 'Enter') executeCommand(); else if (e.key === 'ArrowUp' && commandHistory.length) setCurrentCommand(commandHistory[commandHistory.length - 1]); };
  useEffect(() => { inputRef.current?.focus(); }, []);

  const sendChat = () => {
    if (!chatInput.trim()) return; const msg = chatInput;
    setChat((p) => [...p, { id: Date.now(), sender: name, message: msg, timestamp: new Date() }]);
    if (wsRef.current?.readyState === WebSocket.OPEN) safeSend(wsRef.current, { type: MessageTypes.CHAT_MESSAGE, sender: name, message: msg });
    setChatInput('');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-green-400 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-red-400">Attacker</h1>
          <p className="text-gray-400">Lobby {lobbyCode} · {role}</p>
          <div className="flex items-center gap-2 mt-1">
            {serverMessage && <p className="text-xs text-gray-500">{serverMessage}</p>}
            {paused && (<span className="text-xs px-2 py-0.5 rounded bg-yellow-800 text-yellow-200 border border-yellow-600">Paused</span>)}
          </div>
        </div>
        <div className="flex space-x-4 items-center">
          <div className="bg-gray-800 px-4 py-2 rounded"><span className="text-yellow-400">Attacker Score {score}</span></div>
          <div className="bg-gray-800 px-4 py-2 rounded"><span className="text-blue-400">Time {formatTime(simulationTime)}</span></div>
          <button onClick={() => { if (confirm('Leave the simulation? Progress in this session may be lost.')) navigate('/student/lobby'); }} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm border border-gray-500">Leave</button>
        </div>
      </div>

  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        {/* Left: Terminal + Helpers */}
        <div className="lg:col-span-2">
          <div className="bg-black border border-green-400 rounded-lg h-96 overflow-y-auto p-4 font-mono text-sm">
            <div className="text-green-400 mb-2">=== Terminal ===</div>
            <pre className="whitespace-pre-wrap text-green-400 mb-2 bg-black p-3 rounded border border-green-800">{terminal}</pre>
            <div className="flex items-center">
              <span className="text-red-400">attacker@target:~$</span>
              <input type="text" value={currentCommand} onChange={(e) => setCurrentCommand(e.target.value)} onKeyPress={handleKeyPress} ref={inputRef} className="bg-transparent border-none outline-none text-green-400 ml-2 flex-1" placeholder="Enter attack command..." disabled={paused} />
            </div>
          </div>

          <div className="mt-4 bg-[#111827] rounded-xl border border-slate-800 p-4">
            <h3 className="text-lg font-semibold mb-2 text-red-400">Commands</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <button onClick={() => setCurrentCommand('nmap -sS 192.168.1.0/24')} className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-left">nmap -sS 192.168.1.0/24</button>
              <button onClick={() => setCurrentCommand('ssh admin@192.168.1.100')} className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-left">ssh admin@192.168.1.100</button>
              <button onClick={() => setCurrentCommand('hydra -l admin -P passwords.txt ssh://192.168.1.100')} className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-left">hydra (brute force)</button>
              <button onClick={() => setCurrentCommand('sudo -l')} className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-left">sudo -l</button>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-yellow-400">Hints</h4>
                <button onClick={requestHintsNow} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded">Refresh</button>
              </div>
              {hints.length === 0 ? (
                <div className="text-xs text-gray-400">No hints yet. Use Refresh to fetch available hints.</div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {hints.map((h) => {
                    const kw = (h.hint || '').split('Try using:').pop()?.trim() || h.hint;
                    return <button key={h.id} onClick={() => setCurrentCommand(kw + ' ')} className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-left" title={`Hint for ${h.id}`}>{kw}</button>;
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Objectives + Alerts + Communication */}
        <div className="space-y-6">
          <div className="bg-[#111827] rounded-xl border border-slate-800 p-4">
            <h3 className="text-lg font-semibold mb-4 text-red-400">Objectives</h3>
            <div className="space-y-2">
              {objectives.length === 0 && (
                <div>
                  <div className="p-3 rounded bg-gray-700 border border-gray-600 text-gray-300 text-sm mb-2">Waiting for objectives...</div>
                  <button onClick={requestObjectivesNow} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded">Fetch Objectives</button>
                  <button onClick={requestHintsNow} className="ml-2 text-xs bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded">Hints</button>
                </div>
              )}
              {objectives.map((obj) => (
                <div key={obj.id} className={`p-3 rounded ${obj.completed ? 'bg-green-900 border-green-400' : 'bg-gray-700'} border`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <div className={`w-5 h-5 mr-2 rounded-full border flex items-center justify-center ${obj.completed ? 'bg-green-500 border-green-300 text-black' : 'border-gray-400 text-transparent'}`}>✓</div>
                      <span className={`${obj.completed ? 'text-green-300' : 'text-gray-300'}`}>{obj.description}</span>
                    </div>
                    <span className="text-yellow-400">{obj.points}pts</span>
                  </div>
                  {obj.completed && <div className="text-green-400 text-sm mt-1">✓ Completed</div>}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#111827] rounded-xl border border-slate-800 p-4">
            <h3 className="text-lg font-semibold mb-4 text-yellow-400">Detection Alerts</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {detectionAlerts.length === 0 ? (
                <p className="text-gray-400 text-sm">No detections yet...</p>
              ) : (
                detectionAlerts.map((alert) => (
                  <div key={alert.id} className={`p-2 rounded text-sm ${alert.severity === 'high' ? 'bg-red-900 text-red-200' : alert.severity === 'medium' ? 'bg-yellow-900 text-yellow-200' : 'bg-blue-900 text-blue-200'}`}>
                    <div className="font-semibold">{alert.message}</div>
                    <div className="text-xs opacity-75">{alert.timestamp.toLocaleTimeString()}</div>
                  </div>
                ))
              )}
            </div>
          </div>

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
          <div className={`px-4 py-2 rounded shadow border ${toast.type === 'warning' ? 'bg-yellow-900 border-yellow-600 text-yellow-100' : 'bg-gray-800 border-gray-600 text-gray-100'}`}>{toast.message}</div>
        </div>
      )}
    </div>
  );
};

export default AttackSimulation;
