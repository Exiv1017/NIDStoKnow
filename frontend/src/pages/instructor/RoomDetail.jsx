import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import InstructorSidebar from '../../components/InstructorSidebar';

const RoomDetail = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const headers = user?.token ? { Authorization: `Bearer ${user.token}` } : {};
        const res = await fetch('/api/instructor/rooms', { headers });
        if (!res.ok) throw new Error('fetch failed');
        const arr = await res.json();
        const found = arr.find(r => r.code === code);
        setRoom(found || null);
      } catch (err) {
        console.error('fetchRoom', err);
      }
    };
    fetchRoom();
  }, [code]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      alert('Copy failed');
    }
  };

  const openLobby = async () => {
    setLoading(true);
    try {
      const headers = {};
      if (user?.token) headers.Authorization = `Bearer ${user.token}`;
      const res = await fetch(`/api/create_lobby/${code}`, { method: 'POST', headers });
      if (!res.ok) throw new Error('create lobby failed');
      // Navigate to InstructorLobby and pass lobbyCode
      navigate('/instructor/lobby', { state: { lobbyCode: code } });
    } catch (err) {
      console.error('openLobby', err);
      alert('Failed to open lobby');
    } finally { setLoading(false); }
  };

  const closeLobby = async () => {
    if (!confirm('Close this lobby? This will remove participants from the lobby.')) return;
    try {
      const headers = {};
      if (user?.token) headers.Authorization = `Bearer ${user.token}`;
      const res = await fetch(`/api/close_lobby/${code}`, { method: 'POST', headers });
      if (!res.ok) throw new Error('close failed');
      alert('Lobby closed');
      navigate('/instructor/rooms');
    } catch (err) {
      console.error('closeLobby', err);
      alert('Failed to close lobby');
    }
  };

  if (!room) {
    return (
      <div className="min-h-screen bg-white">
        <InstructorSidebar />
        <div className="ml-64 p-8">Loading room...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <InstructorSidebar />
      <div className="ml-64 p-8 max-w-4xl">
        <h1 className="text-2xl font-bold mb-2">Room: {room.name}</h1>
        <div className="text-sm text-gray-600 mb-4">Created at: {room.created_at}</div>
        <div className="bg-white border rounded p-4 mb-4 shadow-sm">
          <div className="mb-2 text-sm text-gray-600">Join Code</div>
          <div className="flex items-center justify-between">
            <div className="font-mono text-2xl font-semibold">{room.code}</div>
            <div className="flex gap-2">
              <button onClick={copyCode} className="px-3 py-1 bg-gray-100 rounded">{copied ? 'Copied' : 'Copy'}</button>
              <button onClick={openLobby} className="px-3 py-1 bg-[#0E6BA8] text-white rounded" disabled={loading}>{loading ? 'Opening...' : 'Open Lobby'}</button>
              <button onClick={closeLobby} className="px-3 py-1 bg-red-50 text-red-700 rounded">Close Lobby</button>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded p-4">
          <h3 className="font-semibold mb-2">Actions</h3>
          <div className="space-y-2">
            <button onClick={() => navigate('/instructor/simulation', { state: { lobbyCode: code } })} className="px-4 py-2 bg-green-50 text-green-700 rounded">Open Simulation Control</button>
            <button onClick={() => navigate('/instructor/rooms')} className="px-4 py-2 bg-gray-50 rounded">Back to Rooms</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomDetail;
