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
      setRooms(data);
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
      // prepend to list so instructor sees it immediately
      setRooms(prev => [body, ...prev]);
      // After creating a room, send to dashboard as part of the flow
      navigate('/instructor-dashboard');
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
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="w-full max-w-6xl mx-auto px-6">
        <h1 className="text-3xl font-extrabold">My Rooms</h1>
        <p className="text-gray-600 mt-1">Create and manage your classroom rooms. Share the generated code with students.</p>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="font-semibold text-lg mb-3">Create Room</h3>
            <p className="text-sm text-gray-500 mb-4">Give your room a descriptive name so students know which class this is for.</p>
            <form onSubmit={handleCreate} className="space-y-3">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Network Security - Section A" className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1E5780]" />
              <button disabled={loading} className="w-full bg-[#1E5780] text-white py-2 rounded hover:bg-[#154a63] transition">{loading? 'Creating...' : 'Create Room'}</button>
            </form>
          </div>

          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rooms.length === 0 ? (
                <div className="col-span-2 bg-white rounded-xl border p-6 text-center text-gray-500">No rooms yet. Create one to get started.</div>
              ) : (
                rooms.map(r => (
                  <div key={r.id} className="bg-white border rounded-lg p-4 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-lg font-semibold">{r.name}</div>
                          <div className="text-xs text-gray-500">Created: {r.created_at || ''}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="bg-gray-100 px-3 py-1 rounded-md font-mono text-sm font-semibold">{r.code}</div>
                          <button onClick={() => copyCode(r.code)} className="text-sm text-[#1E5780] hover:text-[#154a63]">{copiedCode === r.code ? 'Copied' : 'Copy'}</button>
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-gray-600">Room ID: {r.id}</div>
                    </div>

                    <div className="mt-4 flex items-center justify-end gap-3">
                      <button onClick={() => navigate(`/instructor/rooms/${r.code}`)} className="px-3 py-1 bg-gray-50 rounded hover:bg-gray-100">Details</button>
                      <button onClick={() => navigate('/instructor/lobby', { state: { code: r.code } })} className="px-3 py-1 bg-[#E6F6FF] text-[#0369A1] rounded hover:bg-[#dff4ff]">Open Lobby</button>
                      <button onClick={() => handleDelete(r.id)} className="px-3 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100">Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Rooms;
