import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';

const Rooms = () => {
  const { user } = useContext(AuthContext);
  const [rooms, setRooms] = useState([]);
  const [copiedCode, setCopiedCode] = useState(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchRooms = async () => {
    try {
      const headers = user?.token ? { Authorization: `Bearer ${user.token}` } : {};
      const res = await fetch('/api/instructor/rooms', { headers });
      if (!res.ok) throw new Error('Failed to fetch rooms');
      const data = await res.json();
      // Show all rooms created by the instructor. Rooms with zero members are shown
      // with a 'No students yet' indicator so instructors can see the room and copy the code.
      setRooms(data || []);
    } catch (err) {
      console.error('fetchRooms', err);
      setRooms([]);
    }
  };

  useEffect(() => { fetchRooms(); }, []);

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (e) {
      console.warn('copy failed', e);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (user?.token) headers.Authorization = `Bearer ${user.token}`;
      const res = await fetch('/api/instructor/rooms', { method: 'POST', headers, body: JSON.stringify({ name }) });
      if (!res.ok) throw new Error('create failed');
      const body = await res.json();
      setName('');
      // prepend to list so instructor sees it immediately. New rooms start with 0 members.
      setRooms(prev => [{ ...body, member_count: 0 }, ...prev]);
      // Keep instructor on the Rooms page so they can copy/share the code; do not navigate away.
    } catch (err) {
      console.error('create room', err);
      alert('Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (roomId) => {
    if (!window.confirm('Delete this room? This will remove all memberships.')) return;
    try {
      const headers = {};
      if (user?.token) headers.Authorization = `Bearer ${user.token}`;
      const res = await fetch(`/api/instructor/rooms/${roomId}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('delete failed');
      // refresh list
      await fetchRooms();
    } catch (err) {
      console.error('delete room', err);
      alert('Failed to delete room');
    }
  };

  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12">
      <div className="w-full max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">My Rooms</h1>
          <p className="text-gray-600 text-lg">Create and manage your classroom simulation rooms. Share codes with students to get them started.</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V7a2 2 0 00-2-2h-2V3H8v2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0H4" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{rooms.length}</p>
                <p className="text-gray-600 text-sm">Total Rooms</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{rooms.reduce((sum, r) => sum + (r.member_count || r.memberCount || 0), 0)}</p>
                <p className="text-gray-600 text-sm">Total Students</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100">
                <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{rooms.filter(r => (r.member_count || r.memberCount || 0) > 0).length}</p>
                <p className="text-gray-600 text-sm">Active Rooms</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-amber-100">
                <svg className="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{Math.round(rooms.reduce((sum, r) => sum + (r.member_count || r.memberCount || 0), 0) / Math.max(rooms.length, 1) * 10) / 10}</p>
                <p className="text-gray-600 text-sm">Avg Students/Room</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Create Room Card */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 sticky top-8">
              <div className="text-center mb-6">
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Create New Room</h3>
                <p className="text-gray-600 text-sm">Set up a new simulation environment for your students</p>
              </div>
              
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Room Name</label>
                  <input 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="e.g. Network Security - Section A" 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">Give your room a descriptive name so students know which class this is for</p>
                </div>
                
                <button 
                  disabled={loading || !name.trim()} 
                  className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Creating...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Create Room
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
          {/* Rooms Grid */}
          <div className="xl:col-span-3">
            {rooms.length === 0 ? (
              <div className="text-center py-16">
                <svg className="mx-auto h-24 w-24 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V7a2 2 0 00-2-2h-2V3H8v2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0H4" />
                </svg>
                <h3 className="text-2xl font-medium text-gray-900 mb-2">No rooms yet</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Create your first room to get started. Students will be able to join using the generated room code.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {rooms.map(r => (
                  <div key={r.id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                    {/* Room Header */}
                    <div className="p-6 border-b border-gray-100">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-lg font-semibold text-gray-900 truncate">{r.name}</h4>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Room #{r.id}
                            </span>
                            {(r.member_count || r.memberCount || 0) > 0 ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {r.member_count || r.memberCount} student{(r.member_count || r.memberCount) === 1 ? '' : 's'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                No students yet
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Room Details */}
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center">
                          <svg className="h-4 w-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Created: {r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Recently'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Room Code Section */}
                    <div className="p-6 bg-gray-50">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h5 className="text-sm font-medium text-gray-900 mb-1">Room Code</h5>
                          <p className="text-xs text-gray-600">Share this code with your students</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-lg font-bold px-4 py-2 bg-white border-2 border-gray-200 rounded-lg text-gray-900 select-all">
                            {r.code}
                          </div>
                          <button 
                            onClick={() => copyCode(r.code)} 
                            className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors duration-200 flex items-center gap-1"
                            title="Copy room code"
                          >
                            {copiedCode === r.code ? (
                              <>
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Copied!
                              </>
                            ) : (
                              <>
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="p-6 pt-0 flex items-center gap-3">
                      <button 
                        onClick={() => navigate(`/instructor-dashboard?room_id=${encodeURIComponent(r.id)}`)} 
                        className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center gap-2"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        Enter Room
                      </button>
                      <button 
                        onClick={() => handleDelete(r.id)} 
                        className="px-4 py-2 border border-red-200 text-red-700 font-medium rounded-lg hover:bg-red-50 transition-colors duration-200 flex items-center gap-2"
                        title="Delete room"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Rooms;
