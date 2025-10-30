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
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="w-full max-w-6xl mx-auto px-6">
        <h1 className="text-3xl font-extrabold">My Rooms</h1>
        <p className="text-gray-600 mt-1">Create and manage your classroom rooms. Share the generated code with students.</p>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="font-semibold text-lg mb-3">Create Room</h3>
            <p className="text-sm text-gray-500 mb-4">Give your room a descriptive name so students know which class this is for.</p>
            <form onSubmit={handleCreate} className="space-y-3">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Network Security - Section A" className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0E6BA8]" />
              <button disabled={loading} className="w-full bg-[#0E6BA8] text-white py-2 rounded hover:bg-[#0B4F75] transition">{loading? 'Creating...' : 'Create Room'}</button>
            </form>
          </div>

          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rooms.length === 0 ? (
                <div className="col-span-2 bg-white rounded-xl border p-6 text-center text-gray-500">No rooms yet. Create one to get started.</div>
              ) : (
                rooms.map(r => (
                  <div key={r.id} className="bg-white border rounded-lg p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <div className="text-lg font-semibold text-slate-800 truncate">{r.name}</div>
                          <div className="text-xs text-gray-400 mt-1">Created: {r.created_at || ''}</div>
                          <div className="mt-3 text-sm text-gray-600">Room ID: {r.id}</div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className="inline-flex items-center gap-2">
                            <div
                              role="button"
                              onClick={() => copyCode(r.code)}
                              className="bg-slate-100 px-3 py-1 rounded-full font-mono text-sm font-semibold cursor-pointer select-none border border-slate-200"
                              title="Click to copy code"
                              aria-label={`Copy code ${r.code}`}
                            >
                              {r.code}
                            </div>
                            <button onClick={() => copyCode(r.code)} className="text-sm text-[#0E6BA8] hover:text-[#0B4F75]">{copiedCode === r.code ? 'Copied' : 'Copy'}</button>
                          </div>
                          <div className="mt-2">
                            { (r.member_count || r.memberCount || 0) > 0 ? (
                              <span className="inline-block px-2 py-0.5 text-xs bg-green-50 text-green-700 rounded">Students: {r.member_count || r.memberCount || 0}</span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 text-xs bg-gray-50 text-gray-500 rounded">No students yet</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-3">
                        <button onClick={() => navigate(`/instructor-dashboard?room_id=${encodeURIComponent(r.id)}`)} className="px-4 py-2 bg-white border border-sky-200 text-sky-700 rounded hover:bg-sky-50 transition">Enter</button>
                        <button onClick={() => handleDelete(r.id)} className="px-4 py-2 bg-red-50 text-red-700 rounded hover:bg-red-100 transition">Delete</button>
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
