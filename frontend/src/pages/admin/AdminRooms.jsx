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
  const [deleting, setDeleting] = useState({}); // room_id => true while deleting
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
    if(!window.confirm(`Delete room "${room.name}" (code ${room.code})?\n\nThis will:\n• Remove all student memberships\n• Close any active simulation sessions\n• Cannot be undone`)) return;
    
    setDeleting(prev => ({ ...prev, [room.id]: true }));
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
    } finally {
      setDeleting(prev => ({ ...prev, [room.id]: false }));
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

  const refreshRooms = () => {
    const abort = new AbortController();
    fetchRooms(abort.signal);
  };

  const clearError = () => setError('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex">
      {/* Sidebar */}
      <aside className="w-64 h-screen bg-gradient-to-b from-[#0C2A40] to-[#206EA6] text-white flex flex-col fixed top-0 left-0 z-40 shadow-2xl">
        <div className="p-6 flex items-center justify-start pr-4">
          <Link to="/admin-dashboard" className="ml-2 hover:opacity-80 transition-opacity">
            <img src="/NIDStoKnowLogo.svg" alt="NIDSToKnow Logo" className="h-10 w-auto" />
          </Link>
        </div>
        <nav className="flex-1 px-4">
          <ul className="space-y-2">
            <li>
              <Link to="/admin-dashboard" className="flex items-center p-3 rounded-lg hover:bg-white/10 font-medium transition-all duration-200">
                <img src="/dashboardicon.svg" alt="" className="w-6 h-6 mr-3" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/admin/users" className="flex items-center p-3 rounded-lg hover:bg-white/10 font-medium transition-all duration-200">
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                User Management
              </Link>
            </li>
            <li>
              <Link to="/admin/module-requests" className="flex items-center p-3 rounded-lg hover:bg-white/10 font-medium transition-all duration-200">
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0120 9.414V19a2 2 0 01-2 2z" />
                </svg>
                Module Requests
              </Link>
            </li>
            <li>
              <Link to="/admin/rooms" className="flex items-center p-3 rounded-lg bg-white/20 font-medium text-white border border-white/20">
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V7a2 2 0 00-2-2h-2V3H8v2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0H4" />
                </svg>
                Rooms
              </Link>
            </li>
            <li>
              <Link to="/admin/lobbies" className="flex items-center p-3 rounded-lg hover:bg-white/10 font-medium transition-all duration-200">
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5V4H2v16h5m10 0v-4H7v4m10 0H7" />
                </svg>
                Active Lobbies
              </Link>
            </li>
            <li>
              <Link to="/admin/settings" className="flex items-center p-3 rounded-lg hover:bg-white/10 font-medium transition-all duration-200">
                <img src="/settings.svg" alt="" className="w-6 h-6 mr-3" />
                Settings
              </Link>
            </li>
          </ul>
        </nav>
        <div className="p-4 mt-auto border-t border-white/20">
          <button onClick={handleLogout} className="w-full flex items-center gap-2 p-3 rounded-lg hover:bg-red-600/20 transition-all duration-200 text-left text-red-300 hover:text-red-200 font-medium">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Simulation Rooms</h1>
                <p className="text-gray-600 text-lg">Manage instructor-created rooms and student memberships</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input 
                    value={search} 
                    onChange={e=>setSearch(e.target.value)} 
                    placeholder="Search rooms, instructors..." 
                    className="pl-10 pr-4 py-3 w-80 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" 
                  />
                </div>
                <button 
                  onClick={refreshRooms} 
                  disabled={loading}
                  className="px-4 py-3 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2"
                >
                  <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {loading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-blue-100">
                    <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V7a2 2 0 00-2-2h-2V3H8v2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0H4" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
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
                    <p className="text-2xl font-bold text-gray-900">{filtered.reduce((sum, r) => sum + r.member_count, 0)}</p>
                    <p className="text-gray-600 text-sm">Total Students</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-purple-100">
                    <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-gray-900">{new Set(filtered.map(r => r.instructor_id)).size}</p>
                    <p className="text-gray-600 text-sm">Active Instructors</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-amber-100">
                    <svg className="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-gray-900">{filtered.filter(r => r.member_count > 0).length}</p>
                    <p className="text-gray-600 text-sm">Active Rooms</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex">
                  <svg className="h-5 w-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-700 font-medium">{error}</p>
                </div>
                <button onClick={clearError} className="text-red-400 hover:text-red-600">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-600">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="text-lg font-medium">Loading rooms...</span>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-16">
              <svg className="mx-auto h-24 w-24 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V7a2 2 0 00-2-2h-2V3H8v2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0H4" />
              </svg>
              <h3 className="text-2xl font-medium text-gray-900 mb-2">No rooms found</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                {search ? 'No rooms match your search criteria. Try adjusting your search terms.' : 'No simulation rooms have been created yet. Instructors can create rooms from their dashboard.'}
              </p>
              {search && (
                <button 
                  onClick={() => setSearch('')} 
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Clear search
                </button>
              )}
            </div>
          )}
          {/* Rooms Grid */}
          {!loading && filtered.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map(r => (
                <div key={r.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 overflow-hidden">
                  {/* Room Header */}
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">{r.name || 'Unnamed Room'}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {r.code}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {r.member_count} member{r.member_count === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => deleteRoom(r)} 
                        disabled={deleting[r.id]}
                        className="ml-3 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 disabled:opacity-50"
                        title="Delete room"
                      >
                        {deleting[r.id] ? (
                          <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>

                    {/* Room Details */}
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center">
                        <svg className="h-4 w-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="font-medium">
                          {r.instructor_name ? (
                            <span title={r.instructor_email}>{r.instructor_name}</span>
                          ) : (
                            <span className="text-gray-400">Unknown Instructor #{r.instructor_id}</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <svg className="h-4 w-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Created {r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Unknown'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Members Section */}
                  <div className="p-6">
                    <button 
                      onClick={() => toggleMembers(r)} 
                      className="w-full flex items-center justify-between text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors duration-200"
                    >
                      <span className="flex items-center">
                        <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        {Array.isArray(expanded[r.id]) ? 'Hide Members' : (expanded[r.id] ? 'Loading...' : 'View Members')}
                      </span>
                      <svg className={`h-4 w-4 transition-transform duration-200 ${Array.isArray(expanded[r.id]) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Expanded Members List */}
                    {Array.isArray(expanded[r.id]) && (
                      <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                        {expanded[r.id].length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">No members yet</p>
                        ) : (
                          <div className="space-y-3">
                            {expanded[r.id].map(m => (
                              <div key={m.student_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center space-x-3">
                                  <div className="flex-shrink-0">
                                    <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                                      <span className="text-sm font-medium text-blue-600">
                                        {(m.name || `Student ${m.student_id}`).charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                      {m.name || `Student #${m.student_id}`}
                                    </p>
                                    {m.email && (
                                      <p className="text-xs text-gray-500 truncate">{m.email}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '—'}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
