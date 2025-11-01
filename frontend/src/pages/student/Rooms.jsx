import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';

const StudentRooms = () => {
  const { user } = useContext(AuthContext);
  const [rooms, setRooms] = useState([]);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const navigate = useNavigate();

  const fetchRooms = async () => {
    try {
      const headers = user?.token ? { Authorization: `Bearer ${user.token}` } : {};
      const res = await fetch('/api/student/rooms/all', { headers });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setRooms(data);
    } catch (err) {
      console.error('fetchRooms', err);
      setRooms([]);
    }
  };

  useEffect(() => { fetchRooms(); }, []);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const headers = {'Content-Type':'application/json'};
      if (user?.token) headers.Authorization = `Bearer ${user.token}`;
      const res = await fetch('/api/student/rooms/join', { method: 'POST', headers, body: JSON.stringify({ code: code.trim().toUpperCase() }) });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Join failed');
      }
      await fetchRooms();
      setCode('');
      // After successfully joining a room, show confirmation then go to dashboard
      setSuccessMessage('Joined room — redirecting to dashboard...');
      setTimeout(() => navigate('/dashboard'), 700);
    } catch (err) {
      console.error('join', err);
      alert('Failed to join room: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async (roomId) => {
    if (!window.confirm('Leave this room?')) return;
    try {
      const headers = {};
      if (user?.token) headers.Authorization = `Bearer ${user.token}`;
      const res = await fetch(`/api/student/rooms/${roomId}`, { method: 'DELETE', headers });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to leave');
      }
      await fetchRooms();
    } catch (err) {
      console.error('leave', err);
      alert('Failed to leave room: ' + (err.message || ''));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">My Rooms</h1>
          <p className="text-gray-600 text-lg">Join rooms with instructor codes and access your learning environments</p>
        </div>

        {/* Join Room Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex items-start gap-6">
            <div className="p-4 rounded-full bg-blue-100">
              <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Join a Room</h2>
              <p className="text-gray-600 mb-6">Enter the room code provided by your instructor to access the simulation environment</p>
              
              {successMessage && (
                <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-green-700 font-medium">{successMessage}</p>
                  </div>
                </div>
              )}
              
              <form onSubmit={handleJoin} className="flex gap-3">
                <div className="flex-1 relative">
                  <input 
                    value={code} 
                    onChange={e => setCode(e.target.value)} 
                    placeholder="Enter room code (e.g. ABC123)" 
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm font-mono text-lg tracking-wider uppercase"
                    maxLength={10}
                  />
                </div>
                <button 
                  disabled={loading || !code.trim()} 
                  className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Joining...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      Join Room
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Rooms Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-semibold text-gray-900">Your Rooms</h3>
              <p className="text-gray-600 mt-1">Rooms you've joined and their current status</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {rooms.length} room{rooms.length === 1 ? '' : 's'}
            </div>
          </div>

          {rooms.length === 0 ? (
            <div className="text-center py-16">
              <svg className="mx-auto h-24 w-24 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V7a2 2 0 00-2-2h-2V3H8v2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0H4" />
              </svg>
              <h3 className="text-xl font-medium text-gray-900 mb-2">No rooms yet</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                You haven't joined any rooms yet. Use the form above to enter a room code provided by your instructor.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {rooms.map(r => (
                <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
                  {/* Room Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-lg font-semibold text-gray-900 truncate">{r.name}</h4>
                      <div className="flex items-center gap-2 mt-2">
                        {r.joined ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Joined
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Not Joined
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-2m-2 0H7m12 0V7a2 2 0 00-2-2H9a2 2 0 00-2 2v14m2 0h2m-2 0h-2" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Room Details */}
                  <div className="space-y-3 mb-6">
                    {r.joined ? (
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <svg className="h-4 w-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                          <span className="text-sm font-medium text-gray-700">Room Code:</span>
                        </div>
                        <button
                          onClick={() => { 
                            try { 
                              navigator.clipboard.writeText(r.code); 
                              // Could add a toast notification here
                            } catch {} 
                          }}
                          className="font-mono text-sm font-semibold px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                          title="Click to copy code"
                        >
                          {r.code}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <svg className="h-4 w-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          <span className="text-sm text-gray-500">Room Code:</span>
                        </div>
                        <span className="text-sm text-gray-400 italic">Hidden until you join</span>
                      </div>
                    )}
                    
                    {r.joined && (
                      <div className="flex items-center text-sm text-gray-600">
                        <svg className="h-4 w-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Joined: {r.joined_at || 'Recently'}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3">
                    {r.joined ? (
                      <>
                        <button 
                          onClick={() => navigate('/dashboard', { state: { roomCode: r.code } })} 
                          className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center gap-2"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                          </svg>
                          Enter Room
                        </button>
                        <button 
                          onClick={() => handleLeave(r.id)} 
                          className="px-4 py-2 border border-red-200 text-red-700 font-medium rounded-lg hover:bg-red-50 transition-colors duration-200 flex items-center gap-2"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                          </svg>
                          Leave
                        </button>
                      </>
                    ) : (
                      <div className="w-full p-3 text-center text-sm text-gray-500 bg-gray-50 rounded-lg">
                        Use the form above to join this room with your instructor's code
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentRooms;
