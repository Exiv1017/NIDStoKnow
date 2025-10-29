import React, { useEffect, useState, useContext } from 'react';
import InstructorSidebar from '../../components/InstructorSidebar';
import AuthContext from '../../context/AuthContext';

const Rooms = () => {
  const { user } = useContext(AuthContext);
  const [rooms, setRooms] = useState([]);
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
      // prepend to list
      setRooms(prev => [body, ...prev]);
    } catch (err) {
      console.error('create room', err);
      alert('Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <InstructorSidebar />
      <div className="ml-64 min-h-screen">
        <div className="w-full max-w-6xl mx-auto px-6 pt-8">
          <h1 className="text-3xl font-extrabold">My Rooms</h1>
          <p className="text-gray-600 mt-1">Create and manage your classroom rooms. Share the generated code with students.</p>
        </div>
        <div className="w-full max-w-6xl mx-auto px-6 pb-12 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-lg mb-3">Create Room</h3>
              <form onSubmit={handleCreate} className="space-y-3">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Room name" className="w-full border rounded px-3 py-2" />
                <button disabled={loading} className="w-full bg-[#1E5780] text-white py-2 rounded">{loading? 'Creating...' : 'Create'}</button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-lg mb-3">Rooms you created</h3>
              <div className="space-y-3">
                {rooms.length === 0 ? (
                    <div className="text-sm text-gray-500">No rooms yet. Create one to get started.</div>
                  ) : (
                    rooms.map(r => (
                      <div key={r.id} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-gray-500">Code: <span className="font-mono font-bold">{r.code}</span></div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right text-xs text-gray-400">{r.created_at || ''}</div>
                          <button onClick={() => window.history.pushState({}, '', `/instructor/rooms/${r.code}`) || window.location.reload()} className="px-3 py-1 bg-gray-100 rounded">Details</button>
                          <button onClick={() => window.location.href = `/instructor/lobby?code=${encodeURIComponent(r.code)}`} className="px-3 py-1 bg-blue-50 text-blue-700 rounded">Open Lobby</button>
                        </div>
                      </div>
                    ))
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Rooms;
