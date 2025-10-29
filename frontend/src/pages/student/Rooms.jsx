import React, { useEffect, useState, useContext } from 'react';
import AuthContext from '../../context/AuthContext';
import ModuleLayout from '../../components/ModuleLayout';

const StudentRooms = () => {
  const { user } = useContext(AuthContext);
  const [rooms, setRooms] = useState([]);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchRooms = async () => {
    try {
      const headers = user?.token ? { Authorization: `Bearer ${user.token}` } : {};
      const res = await fetch('/api/student/rooms', { headers });
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
    } catch (err) {
      console.error('join', err);
      alert('Failed to join room: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModuleLayout title="Rooms">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded p-6 mb-6">
          <h2 className="text-xl font-semibold">Join a Room</h2>
          <p className="text-sm text-gray-500">Enter the code provided by your instructor</p>
          <form onSubmit={handleJoin} className="mt-3 flex gap-2">
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="Enter code (e.g. ABC123)" className="flex-1 border rounded px-3 py-2" />
            <button disabled={loading} className="bg-[#1E5780] text-white px-4 rounded">Join</button>
          </form>
        </div>

        <div className="bg-white rounded p-6">
          <h3 className="font-semibold text-lg mb-3">Rooms you joined</h3>
          {rooms.length === 0 ? (
            <div className="text-sm text-gray-500">You haven't joined any rooms yet.</div>
          ) : (
            <div className="space-y-3">
              {rooms.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-gray-500">Code: <span className="font-mono">{r.code}</span></div>
                  </div>
                  <div className="text-xs text-gray-400">Joined: {r.joined_at}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModuleLayout>
  );
};

export default StudentRooms;
