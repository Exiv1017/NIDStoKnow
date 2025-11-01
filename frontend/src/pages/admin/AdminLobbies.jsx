import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function useAdminAuthHeaders(){
  let token = null;
  try { const raw = localStorage.getItem('admin_user'); if(raw){ const parsed = JSON.parse(raw); token = parsed.token; } } catch {}
  if(!token) token = localStorage.getItem('admin_token');
  if(!token) token = localStorage.getItem('token_admin');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export default function AdminLobbies(){
  const [lobbies,setLobbies] = useState([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [search,setSearch] = useState('');
  const [autoRefresh,setAutoRefresh] = useState(true);
  const [refreshMs,setRefreshMs] = useState(10000);
  const navigate = useNavigate();

  const headers = useAdminAuthHeaders();

  const filtered = useMemo(()=>{
    const term = search.trim().toLowerCase();
    if(!term) return lobbies;
    return lobbies.filter(l =>
      (l.code||'').toLowerCase().includes(term) ||
      (l.difficulty||'').toLowerCase().includes(term) ||
      (l.participants||[]).some(p => (p.name||'').toLowerCase().includes(term))
    );
  },[lobbies,search]);

  useEffect(()=>{
    let timer;
    const fetchLobbies = async(signal) => {
      setError('');
      try{
        const res = await fetch('/api/admin/lobbies', { headers, signal });
        const data = await res.json();
        if(!res.ok){ setError(data.detail || `Failed to load lobbies (${res.status})`); return; }
        setLobbies(Array.isArray(data.lobbies)? data.lobbies: []);
      } catch(e){ if(e.name !== 'AbortError') setError('Network error'); }
    };
    const abort = new AbortController();
    fetchLobbies(abort.signal);
    if(autoRefresh){
      timer = setInterval(()=> fetchLobbies(abort.signal), refreshMs);
    }
    return ()=>{ abort.abort(); if(timer) clearInterval(timer); };
  },[autoRefresh,refreshMs]);

  const handleLogout = () => {
    try {
      localStorage.removeItem('admin');
      localStorage.removeItem('admin_user');
      localStorage.removeItem('admin_token');
      localStorage.removeItem('token_admin');
    } catch {}
    navigate('/admin-login');
  };

  const closeLobby = async (code) => {
    try{
      const res = await fetch(`/api/admin/lobbies/${code}/close`, { method: 'POST', headers });
      if(res.ok){
        // Remove from list locally to be snappy
        setLobbies(prev => prev.filter(l=>l.code!==code));
      } else {
        const data = await res.json().catch(()=>({}));
        setError(data.detail || 'Failed to close lobby');
      }
    } catch { setError('Network error closing lobby'); }
  };

  const removeParticipant = async (code, name) => {
    try{
      const res = await fetch(`/api/admin/lobbies/${encodeURIComponent(code)}/participants/${encodeURIComponent(name)}/remove`, { method: 'POST', headers });
      if(res.ok){
        // Update locally
        setLobbies(prev => prev.map(l => l.code===code ? { ...l, participants: (l.participants||[]).filter(p=>p.name!==name) } : l));
      } else {
        const data = await res.json().catch(()=>({}));
        setError(data.detail || 'Failed to remove participant');
      }
    } catch { setError('Network error removing participant'); }
  };

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
              <Link to="/admin/rooms" className="flex items-center p-3 rounded-lg hover:bg-white/10 font-medium transition-all duration-200">
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V7a2 2 0 00-2-2h-2V3H8v2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0H4" />
                </svg>
                Rooms
              </Link>
            </li>
            <li>
              <Link to="/admin/lobbies" className="flex items-center p-3 rounded-lg bg-white/20 font-medium text-white border border-white/20">
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
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Active Lobbies</h1>
                <p className="text-gray-600 text-lg">Monitor live simulation lobbies and participant activity</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input 
                    value={search} 
                    onChange={e=>setSearch(e.target.value)} 
                    placeholder="Search lobbies, participants..." 
                    className="pl-10 pr-4 py-3 w-80 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" 
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={()=>setAutoRefresh(!autoRefresh)}
                    className={`px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2 ${
                      autoRefresh 
                        ? 'bg-green-600 text-white hover:bg-green-700' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <svg className={`h-4 w-4 ${autoRefresh ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {autoRefresh ? 'Auto Refresh' : 'Manual Mode'}
                  </button>
                </div>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-blue-100">
                    <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5V4H2v16h5m10 0v-4H7v4m10 0H7" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
                    <p className="text-gray-600 text-sm">Active Lobbies</p>
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
                    <p className="text-2xl font-bold text-gray-900">{filtered.reduce((sum, l) => sum + (l.participants?.length || 0), 0)}</p>
                    <p className="text-gray-600 text-sm">Total Participants</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-purple-100">
                    <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-gray-900">{new Set(filtered.map(l => l.difficulty)).size}</p>
                    <p className="text-gray-600 text-sm">Difficulty Levels</p>
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
                    <p className="text-2xl font-bold text-gray-900">{autoRefresh ? Math.round(refreshMs/1000) : '—'}</p>
                    <p className="text-gray-600 text-sm">Refresh Rate (s)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Auto Refresh Settings */}
          {autoRefresh && (
            <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">Refresh Interval:</span>
                  <select 
                    value={refreshMs} 
                    onChange={e=>setRefreshMs(Number(e.target.value))}
                    className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={5000}>5 seconds</option>
                    <option value={10000}>10 seconds</option>
                    <option value={30000}>30 seconds</option>
                    <option value={60000}>1 minute</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  Live updates enabled
                </div>
              </div>
            </div>
          )}

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
                <button onClick={()=>setError('')} className="text-red-400 hover:text-red-600">
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
                <span className="text-lg font-medium">Loading lobbies...</span>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-16">
              <svg className="mx-auto h-24 w-24 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5V4H2v16h5m10 0v-4H7v4m10 0H7" />
              </svg>
              <h3 className="text-2xl font-medium text-gray-900 mb-2">No active lobbies</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                {search ? 'No lobbies match your search criteria. Try adjusting your search terms.' : 'No simulation lobbies are currently active. Lobbies will appear here when instructors create new sessions.'}
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
          {/* Lobbies Grid */}
          {!loading && filtered.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filtered.map(l => (
                <div key={l.code} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 overflow-hidden">
                  {/* Lobby Header */}
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Lobby {l.code}</h3>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {l.difficulty || 'Beginner'}
                          </span>
                          {(() => {
                            const state = l.status || l.state || (l.running ? 'running' : 'ended');
                            const isRunning = String(state).toLowerCase() === 'running' || String(state).toLowerCase() === 'active';
                            return (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                isRunning 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {isRunning ? 'Running' : 'Ended'}
                              </span>
                            );
                          })()}
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {(l.participants?.length || 0)} participant{(l.participants?.length || 0) === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => closeLobby(l.code)} 
                        className="ml-3 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                        title="Close lobby"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6m0 0l-6-6m6 6l-6 6" />
                        </svg>
                      </button>
                    </div>

                    {/* Lobby Details */}
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center">
                        <svg className="h-4 w-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="font-medium">
                          {l.created_by_user?.name ? (
                            <span title={l.created_by_user?.email}>{l.created_by_user.name}</span>
                          ) : (
                            <span className="text-gray-400">Unknown Instructor #{l.created_by}</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <svg className="h-4 w-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Created {l.created_at ? new Date(l.created_at).toLocaleDateString() : 'Unknown'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Participants Section */}
                  <div className="p-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Participants</h4>
                    {(l.participants || []).length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No participants yet</p>
                    ) : (
                      <div className="space-y-3">
                        {(l.participants || []).map((p, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                                  p.role === 'Instructor' ? 'bg-purple-100' : 'bg-blue-100'
                                }`}>
                                  <span className={`text-sm font-medium ${
                                    p.role === 'Instructor' ? 'text-purple-600' : 'text-blue-600'
                                  }`}>
                                    {(p.name || 'P').charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    p.role === 'Instructor' 
                                      ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                                      : 'bg-gray-100 text-gray-700 border border-gray-200'
                                  }`}>
                                    {p.role}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className={`text-xs ${
                                    p.ready ? 'text-green-600 font-medium' : 'text-gray-500'
                                  }`}>
                                    {p.ready ? '✓ Ready' : 'Not ready'}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {p.joined_at ? new Date(p.joined_at).toLocaleDateString() : '—'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {p.role !== 'Instructor' && (
                              <button 
                                onClick={() => removeParticipant(l.code, p.name)} 
                                className="ml-3 px-2 py-1 text-xs font-medium rounded bg-amber-600 text-white hover:bg-amber-700 transition-colors duration-200"
                                title="Remove participant"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ))}
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
