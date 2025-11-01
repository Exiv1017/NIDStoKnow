import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function useAdminAuthHeaders(){
  let token = null;
  try { const raw = localStorage.getItem('admin_user'); if(raw){ const parsed = JSON.parse(raw); token = parsed.token; } } catch {}
  if(!token) token = localStorage.getItem('admin_token');
  if(!token) token = localStorage.getItem('token_admin');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export default function AdminRooms(){
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({}); // room_id => members array or true while loading
  const headers = useAdminAuthHeaders();
  const navigate = useNavigate();

  const filtered = useMemo(()=>{
    const term = search.trim().toLowerCase();
    if(!term) return rooms;
    return rooms.filter(r =>
      (r.code||'').toLowerCase().includes(term) ||
      (r.name||'').toLowerCase().includes(term) ||
      (r.instructor_name||'').toLowerCase().includes(term) ||
      (r.instructor_email||'').toLowerCase().includes(term)
    );
  },[rooms,search]);

  const fetchRooms = async (signal) => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/rooms', { headers, signal });
      const data = await res.json().catch(()=>({}));
      if(!res.ok){ setError(data.detail || `Failed to load rooms (${res.status})`); return; }
      setRooms(Array.isArray(data.rooms) ? data.rooms : []);
    } catch(e) {
      if(e.name !== 'AbortError') setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{
    const abort = new AbortController();
    fetchRooms(abort.signal);
    return ()=> abort.abort();
  },[]);

  const toggleMembers = async (room) => {
    const curr = expanded[room.id];
    if(Array.isArray(curr)){
      setExpanded(prev => ({ ...prev, [room.id]: undefined }));
      return;
    }
    // load members
    setExpanded(prev => ({ ...prev, [room.id]: true })); // true = loading
    try{
      const res = await fetch(`/api/admin/rooms/${room.id}/members`, { headers });
      const data = await res.json().catch(()=>[]);
      if(res.ok){
        setExpanded(prev => ({ ...prev, [room.id]: Array.isArray(data) ? data : [] }));
      } else {
        setExpanded(prev => ({ ...prev, [room.id]: undefined }));
        setError(data.detail || 'Failed to load members');
      }
    } catch{
      setExpanded(prev => ({ ...prev, [room.id]: undefined }));
      setError('Network error loading members');
    }
  };

  const deleteRoom = async (room) => {
    if(!window.confirm(`Delete room "${room.name}" (code ${room.code})? This will remove all memberships and close live sessions.`)) return;
    try{
      const res = await fetch(`/api/admin/rooms/${room.id}`, { method: 'DELETE', headers });
      const data = await res.json().catch(()=>({}));
      if(res.ok){
        setRooms(prev => prev.filter(r => r.id !== room.id));
        setExpanded(prev => { const cp = { ...prev }; delete cp[room.id]; return cp; });
      } else {
        setError(data.detail || 'Failed to delete room');
      }
    } catch {
      setError('Network error deleting room');
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('admin');
      localStorage.removeItem('admin_user');
      localStorage.removeItem('admin_token');
      localStorage.removeItem('token_admin');
    } catch {}
    navigate('/admin-login');
  };

  return (
    <div className="min-h-screen bg-[#E3E3E3] flex">
      {/* Sidebar */}
      <aside className="w-64 h-screen bg-gradient-to-b from-[#0C2A40] to-[#206EA6] text-white flex flex-col fixed top-0 left-0 z-40">
        <div className="p-6 flex items-center justify-start pr-4">
          <Link to="/admin-dashboard" className="ml-2">
            <img src="/NIDStoKnowLogo.svg" alt="NIDSToKnow Logo" className="h-10 w-auto" />
          </Link>
        </div>
        <nav className="flex-1 px-4">
          <ul className="space-y-3">
            <li>
              <Link to="/admin-dashboard" className="flex items-center p-3 rounded-lg hover:bg-white/10 font-medium">
                <img src="/dashboardicon.svg" alt="" className="w-6 h-6 mr-3" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/admin/users" className="flex items-center p-3 rounded-lg hover:bg-white/10 font-medium">
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                User Management
              </Link>
            </li>
            <li>
              <Link to="/admin/module-requests" className="flex items-center p-3 rounded-lg hover:bg-white/10 font-medium">
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0120 9.414V19a2 2 0 01-2 2z" />
                </svg>
                Module Requests
              </Link>
            </li>
            <li>
              <Link to="/admin/rooms" className="flex items-center p-3 rounded-lg bg-white/10 font-medium text-white">
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V7a2 2 0 00-2-2h-2V3H8v2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0H4" />
                </svg>
                Rooms
              </Link>
            </li>
            <li>
              <Link to="/admin/lobbies" className="flex items-center p-3 rounded-lg hover:bg-white/10 font-medium">
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5V4H2v16h5m10 0v-4H7v4m10 0H7" />
                </svg>
                Active Lobbies
              </Link>
            </li>
            <li>
              <Link to="/admin/settings" className="flex items-center p-3 rounded-lg hover:bg-white/10 font-medium">
                <img src="/settings.svg" alt="" className="w-6 h-6 mr-3" />
                Settings
              </Link>
            </li>
          </ul>
        </nav>
        <div className="p-4 mt-auto border-t border-white/10">
          <button onClick={handleLogout} className="w-full flex items-center gap-2 p-3 rounded-lg hover:bg-white/10 transition-all duration-200 text-left text-red-300 font-semibold">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-black mb-1">Rooms</h1>
              <p className="text-gray-600">Instructor-created rooms with member counts</p>
            </div>
            <div className="flex items-center gap-3">
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search code, name, instructor" className="px-3 py-2 rounded-md border border-gray-300 text-sm" />
              <button onClick={()=>setSearch(s=>s)} className="px-3 py-2 text-sm rounded-md bg-[#1E5780] text-white">Refresh</button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 p-3 rounded-md text-red-700 text-sm mb-4">{error}</div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-gray-600 mb-4"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div> Loading...</div>
          )}

          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500">No rooms</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filtered.map(r => (
                <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold text-lg text-[#1E5780]">{r.name || 'Room'} <span className="text-gray-500">({r.code})</span></div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">{r.member_count} member{r.member_count===1?'':'s'}</span>
                      <button onClick={()=>deleteRoom(r)} className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700">Delete</button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mb-3">
                    <div>Created: {r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</div>
                    <div>Instructor: {r.instructor_name ? (<span title={r.instructor_email}>{r.instructor_name} (#{r.instructor_id})</span>) : (r.instructor_id ? `#${r.instructor_id}` : 'Unknown')}</div>
                  </div>
                  <div>
                    <button onClick={()=>toggleMembers(r)} className="text-sm text-[#1E5780] hover:underline">
                      {Array.isArray(expanded[r.id]) ? 'Hide members' : (expanded[r.id] ? 'Loading members...' : 'View members')}
                    </button>
                  </div>
                  {Array.isArray(expanded[r.id]) && (
                    <div className="mt-3 border-t pt-3">
                      {expanded[r.id].length === 0 ? (
                        <div className="text-sm text-gray-500">No members</div>
                      ) : (
                        <ul className="space-y-2">
                          {expanded[r.id].map(m => (
                            <li key={m.student_id} className="flex items-center justify-between text-sm">
                              <div>
                                <div className="font-medium">{m.name || `Student #${m.student_id}`}</div>
                                <div className="text-gray-500 text-xs">{m.email || ''}</div>
                              </div>
                              <div className="text-gray-500 text-xs">Joined {m.joined_at ? new Date(m.joined_at).toLocaleString() : '-'}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
