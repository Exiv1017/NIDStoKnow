import React, { useState, useEffect, useRef, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';

const AttackSimulation = () => {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  let { lobbyCode, participants, role } = location.state || {};
  const [name, setName] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('simCtx'));
      return saved?.name || 'Attacker';
    } catch { return 'Attacker'; }
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
  
  const [terminal, setTerminal] = useState('');
  const [commandHistory, setCommandHistory] = useState([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const inputRef = useRef(null);
  const [objectives, setObjectives] = useState([]);
  const [score, setScore] = useState(0);
  const [detectionAlerts, setDetectionAlerts] = useState([]);
  const [simulationTime, setSimulationTime] = useState(0);
  const wsRef = useRef(null);
  const objectivesRef = useRef([]);
  const [serverMessage, setServerMessage] = useState('');
  const [hints, setHints] = useState([]);
  const [hintsEnabled, setHintsEnabled] = useState(false);
  const [difficulty, setDifficulty] = useState('');
  const [passScore, setPassScore] = useState(0);
  const [showGuide, setShowGuide] = useState(false);
  useEffect(() => {
    objectivesRef.current = objectives;
  }, [objectives]);
  
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
      // announce join with name/role
      wsRef.current?.send(JSON.stringify({ type: 'join', name, role }));
      // Fallback: if objectives don't arrive shortly, request them
      setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && objectivesRef.current.length === 0) {
          wsRef.current.send(JSON.stringify({ type: 'request_objectives', name }));
        }
      }, 800);
    };
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'error':
          setTerminal(prev => prev + '\n[server error] ' + (data.message || 'Unknown error'));
          break;
        case 'join_ack':
          setServerMessage(`Difficulty: ${data.difficulty}`);
          setHintsEnabled(!!data.hints_enabled);
          setDifficulty(data.difficulty || '');
          if (typeof data.pass_score === 'number') setPassScore(data.pass_score);
          setShowGuide(true);
          if (data.hints_enabled && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'request_hints', name }));
          }
          break;
        case 'detection_alert':
          setDetectionAlerts(prev => [...prev, {
            id: Date.now(),
            message: data.message,
            severity: data.severity,
            timestamp: new Date()
          }]);
          break;
        case 'command_result':
          setTerminal(prev => prev + '\n' + data.output);
          break;
        case 'objectives':
          // initial randomized objectives from server (preserve server id)
          setObjectives(data.objectives.map((o) => ({
            id: o.id,
            description: o.description,
            completed: !!o.completed,
            points: o.points
          })));
          break;
        case 'objectives_update':
          // mark completed and update score, also notify about new completions
          {
            const completedIds = data.completed || [];
            const newlyCompleted = objectivesRef.current
              .filter(o => !o.completed && completedIds.includes(o.id));
            if (newlyCompleted.length > 0) {
              const msg = newlyCompleted
                .map(o => `✓ Objective completed: ${o.description} (+${o.points} pts)`) 
                .join('\n');
              setTerminal(prev => prev + '\n' + msg);
            }
          }
          setObjectives(prev => prev.map(o => ({
            ...o,
            completed: o.completed || (data.completed || []).includes(o.id)
          })));
          if (typeof data.score === 'number') setScore(data.score);
          break;
        case 'hints':
          // Capture hints for rendering under Commands instead of terminal output
          {
            const hs = (data.hints || []).map(h => ({ id: h.id, hint: h.hint }));
            setHints(hs);
          }
          break;
        case 'score_update':
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

  // Request objectives again when tab regains focus and list is empty
  useEffect(() => {
    const onFocus = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && objectivesRef.current.length === 0) {
        wsRef.current.send(JSON.stringify({ type: 'request_objectives', name }));
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [name]);

  const requestObjectivesNow = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'request_objectives', name }));
    }
  };

  const requestHintsNow = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'request_hints', name }));
    }
  };
  
  const executeCommand = () => {
    if (!currentCommand.trim()) return;
    
    const newEntry = `attacker@target:~$ ${currentCommand}`;
    setTerminal(prev => prev + '\n' + newEntry);
    setCommandHistory(prev => [...prev, currentCommand]);
    
    // Send command to backend for processing
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'execute_command',
        command: currentCommand,
        role: 'attacker',
        name
      }));
    }
    
    setCurrentCommand('');
  };
  
  // Objective completion and scoring are handled by the server via 'objectives_update'.
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      executeCommand();
    } else if (e.key === 'ArrowUp' && commandHistory.length > 0) {
      setCurrentCommand(commandHistory[commandHistory.length - 1]);
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
                <span className="bg-gray-700 px-2 py-1 rounded">Role: Attacker</span>
                {difficulty && <span className="bg-blue-700 px-2 py-1 rounded">Difficulty: {difficulty}</span>}
                {passScore > 0 && <span className="bg-yellow-700 px-2 py-1 rounded">Pass at: {passScore} pts</span>}
              </div>
              <div>
                <div className="font-semibold text-green-300 mb-1">How to play</div>
                <ul className="list-disc list-inside text-gray-200 space-y-1">
                  <li>Use the terminal to execute attack commands and complete objectives.</li>
                  <li>Check your objectives via the Objectives panel or type "status".</li>
                  <li>Use Commands shortcuts and Hints (if enabled) under the terminal.</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold text-green-300 mb-1">Scoring</div>
                <ul className="list-disc list-inside text-gray-200 space-y-1">
                  <li>Objectives: +10 pts each; certain objectives are hard: +20 pts.</li>
                  <li>Beginner: 6 objectives, 1 hard (20 pts), up to 12 hints available.</li>
                  <li>Intermediate: 8 objectives, hints disabled.</li>
                  <li>Hard: 10 objectives, 2 hard (20 pts), hints disabled, irrelevant/typo commands: −3 pts.</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold text-green-300 mb-1">Tips</div>
                <ul className="list-disc list-inside text-gray-200 space-y-1">
                  <li>Hard mode: non-objective threats you trigger are visible to defenders.</li>
                  <li>Reach the pass threshold shown above to complete this difficulty.</li>
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
          <h1 className="text-2xl font-bold text-red-400">Attacker</h1>
          <p className="text-gray-400">Lobby {lobbyCode} · {role}</p>
          {serverMessage && <p className="text-xs text-gray-500 mt-1">{serverMessage}</p>}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        {/* Terminal */}
        <div className="lg:col-span-2">
          <div className="bg-black border border-green-400 rounded-lg h-96 overflow-y-auto p-4 font-mono text-sm">
            <div className="text-green-400 mb-2">=== Terminal ===</div>
            <pre className="whitespace-pre-wrap text-green-400 mb-2">{terminal}</pre>
            <div className="flex items-center">
              <span className="text-red-400">attacker@target:~$</span>
              <input
                type="text"
                value={currentCommand}
                onChange={(e) => setCurrentCommand(e.target.value)}
                onKeyPress={handleKeyPress}
                ref={inputRef}
                className="bg-transparent border-none outline-none text-green-400 ml-2 flex-1"
                placeholder="Enter attack command..."
              />
            </div>
          </div>
          
          {/* Command Suggestions */}
          <div className="mt-4 bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2 text-red-400">Commands</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <button
                onClick={() => setCurrentCommand('nmap -sS 192.168.1.0/24')}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-left"
              >
                nmap -sS 192.168.1.0/24
              </button>
              <button
                onClick={() => setCurrentCommand('ssh admin@192.168.1.100')}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-left"
              >
                ssh admin@192.168.1.100
              </button>
              <button
                onClick={() => setCurrentCommand('hydra -l admin -P passwords.txt ssh://192.168.1.100')}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-left"
              >
                hydra (brute force)
              </button>
              <button
                onClick={() => setCurrentCommand('sudo -l')}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-left"
              >
                sudo -l
              </button>
            </div>

            {/* Dynamic Hints (Beginner mode) */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-yellow-400">Hints</h4>
                <button
                  onClick={() => requestHintsNow()}
                  className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded"
                >Refresh</button>
              </div>
              {hints.length === 0 ? (
                <div className="text-xs text-gray-400">No hints yet. Use Refresh to fetch available hints.</div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {hints.map((h) => {
                    // Extract the keyword after 'Try using: '
                    const kw = (h.hint || '').split('Try using:').pop()?.trim() || h.hint;
                    return (
                      <button
                        key={h.id}
                        onClick={() => setCurrentCommand(kw + ' ')}
                        className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-left"
                        title={`Hint for ${h.id}`}
                      >
                        {kw}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Objectives */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-red-400">Objectives</h3>
            <div className="space-y-2">
              {objectives.length === 0 && (
                <div>
                  <div className="p-3 rounded bg-gray-700 border border-gray-600 text-gray-300 text-sm mb-2">
                    Waiting for objectives...
                  </div>
                  <button onClick={requestObjectivesNow} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded">
                    Fetch Objectives
                  </button>
                  <button onClick={requestHintsNow} className="ml-2 text-xs bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded">
                    Hints
                  </button>
                </div>
              )}
              {objectives.map(obj => (
                <div
                  key={obj.id}
                  className={`p-3 rounded ${obj.completed ? 'bg-green-900 border-green-400' : 'bg-gray-700'} border`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <div className={`w-5 h-5 mr-2 rounded-full border flex items-center justify-center ${obj.completed ? 'bg-green-500 border-green-300 text-black' : 'border-gray-400 text-transparent'}`}>✓</div>
                      <span className={`${obj.completed ? 'text-green-300' : 'text-gray-300'}`}>
                        {obj.description}
                      </span>
                    </div>
                    <span className="text-yellow-400">{obj.points}pts</span>
                  </div>
                  {obj.completed && (
                    <div className="text-green-400 text-sm mt-1">✓ Completed</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Detection Alerts */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-yellow-400">Detection Alerts</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {detectionAlerts.length === 0 ? (
                <p className="text-gray-400 text-sm">No detections yet...</p>
              ) : (
                detectionAlerts.map(alert => (
                  <div key={alert.id} className={`p-2 rounded text-sm ${
                    alert.severity === 'high' ? 'bg-red-900 text-red-200' :
                    alert.severity === 'medium' ? 'bg-yellow-900 text-yellow-200' :
                    'bg-blue-900 text-blue-200'
                  }`}>
                    <div className="font-semibold">{alert.message}</div>
                    <div className="text-xs opacity-75">
                      {alert.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

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
        </div>
      </div>
    </div>
  );
};

export default AttackSimulation;
