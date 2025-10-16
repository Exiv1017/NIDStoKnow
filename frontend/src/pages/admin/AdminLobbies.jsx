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
              <Link to="/admin/lobbies" className="flex items-center p-3 rounded-lg bg-white/10 font-medium text-white">
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
              <h1 className="text-3xl font-bold text-black mb-1">Active Lobbies</h1>
              <p className="text-gray-600">Real-time view of lobby sessions and participants</p>
            </div>
            <div className="flex items-center gap-3">
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search code, name, difficulty" className="px-3 py-2 rounded-md border border-gray-300 text-sm" />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={autoRefresh} onChange={e=>setAutoRefresh(e.target.checked)} /> Auto-refresh
              </label>
              <select value={refreshMs} onChange={e=>setRefreshMs(Number(e.target.value))} className="px-2 py-2 rounded-md border border-gray-300 text-sm">
                <option value={5000}>5s</option>
                <option value={10000}>10s</option>
                <option value={30000}>30s</option>
                <option value={60000}>60s</option>
              </select>
              <button onClick={()=>setAutoRefresh(false)||setSearch(s=>s)} className="px-3 py-2 text-sm rounded-md bg-[#1E5780] text-white">Refresh Now</button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 p-3 rounded-md text-red-700 text-sm mb-4">{error}</div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-gray-600 mb-4"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div> Loading...</div>
          )}

          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500">No active lobbies</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filtered.map(l => (
                <div key={l.code} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold text-lg text-[#1E5780]">Code: {l.code}</div>
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{l.difficulty || 'Beginner'}</span>
                  </div>
                  <div className="text-xs text-gray-500 mb-3">Created: {l.created_at ? new Date(l.created_at).toLocaleString() : '-'}</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-600 border-b">
                          <th className="py-2 pr-2">Name</th>
                          <th className="py-2 pr-2">Role</th>
                          <th className="py-2 pr-2">Ready</th>
                          <th className="py-2">Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(l.participants||[]).length === 0 && (
                          <tr><td colSpan="4" className="py-3 text-gray-400">No participants</td></tr>
                        )}
                        {(l.participants||[]).map((p,idx)=> (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="py-2 pr-2">{p.name}</td>
                            <td className="py-2 pr-2"><span className={`px-2 py-0.5 rounded text-xs border ${p.role==='Instructor'?'bg-purple-50 text-purple-700 border-purple-200':'bg-gray-50 text-gray-700 border-gray-200'}`}>{p.role}</span></td>
                            <td className="py-2 pr-2">{p.ready ? <span className="text-green-600 font-medium">Ready</span> : <span className="text-gray-500">Not ready</span>}</td>
                            <td className="py-2">{p.joined_at ? new Date(p.joined_at).toLocaleString() : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
