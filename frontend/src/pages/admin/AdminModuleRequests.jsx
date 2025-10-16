import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const STATUS_ORDER = ['pending','approved','rejected'];

const badge = (status) => {
  const base = 'px-3 py-1 rounded-full text-sm font-semibold';
  switch(status){
    case 'approved': return <span className={`${base} bg-green-100 text-green-800`}>Approved</span>;
    case 'pending': return <span className={`${base} bg-yellow-100 text-yellow-800`}>Pending</span>;
    case 'rejected': return <span className={`${base} bg-red-100 text-red-800`}>Rejected</span>;
    default: return <span className={`${base} bg-gray-100 text-gray-800`}>{status}</span>;
  }
};

export default function AdminModuleRequests(){
  const navigate = useNavigate();
  const [requests,setRequests] = useState([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [activeStatus,setActiveStatus] = useState('pending');
  const [selected,setSelected] = useState(null);
  const [comment,setComment] = useState('');
  const [actionLoading,setActionLoading] = useState(false);
  const [toast,setToast] = useState({show:false,message:'',type:'success'});
  const [contentLoading,setContentLoading] = useState(false);
  const [contentError,setContentError] = useState('');
  const [content,setContent] = useState(null); // parsed structure { meta, overview, theory, practical, assessment }
  const handleLogout = () => {
    try {
      localStorage.removeItem('admin');
      localStorage.removeItem('admin_user');
      localStorage.removeItem('admin_token');
      localStorage.removeItem('token_admin');
    } catch {}
    navigate('/admin-login');
  };

  const showToast=(message,type='success')=>{ setToast({show:true,message,type}); setTimeout(()=>setToast({show:false,message:'',type:'success'}),3000); };

  const fetchRequests = async () => {
    // Avoid parallel duplicate fetches
    if (loading) return;
    setLoading(true); setError('');
    try {
  const res = await fetch(`/api/admin/module-requests`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) {
        const sorted = [...data].sort((a,b)=>{
          const so = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
          if(so!==0) return so;
          return new Date(b.created_at) - new Date(a.created_at);
        });
        setRequests(sorted);
        // Only refresh selected if it still exists in new list
        if (selected) {
          const found = sorted.find(r=>r.id===selected.id);
          if (!found) setSelected(null); else setSelected(prev => ({...prev, ...found}));
        }
      } else {
        setError(data.detail || `Failed to load requests (status ${res.status})`);
      }
    } catch (e) {
      setError('Network error loading requests');
    } finally {
      setLoading(false);
    }
  };

  const authHeaders = () => {
    // Admin token is stored in auth context logic? Fallback to localStorage search.
    let token = null;
    try {
      const adminUserRaw = localStorage.getItem('admin_user');
      if(adminUserRaw){ const au = JSON.parse(adminUserRaw); token = au.token || localStorage.getItem('admin_token'); }
    } catch(e){}
    if(!token){
      // Also look for any stored token manually (older login code might not store separately)
      token = localStorage.getItem('token_admin');
    }
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  // Initial load only (and on manual refresh triggers)
  useEffect(()=>{ fetchRequests(); // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const openDetail = (req)=>{ setSelected(req); setComment(req.admin_comment||''); fetchContent(req.id); };
  const closeDetail = ()=>{ setSelected(null); setComment(''); };

  const fetchContent = useCallback(async (id)=>{
    setContent(null); setContentError(''); setContentLoading(true);
    try {
      const res = await fetch(`/api/admin/module-requests/${id}/content`, { headers: authHeaders() });
      const data = await res.json();
      if(!res.ok){ setContentError(data.detail || 'Failed to load content'); }
      else setContent(data.content || null);
    } catch(e){ setContentError('Network error loading content'); }
    finally { setContentLoading(false); }
  },[]);

  const performStatus = async(newStatus)=>{
    if(!selected) return; setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/module-requests/${selected.id}`,{
        method:'PATCH',
        headers:{ 'Content-Type':'application/json', ...authHeaders() },
        body: JSON.stringify({ status:newStatus, admin_comment: comment.trim()||null })
      });
      const data = await res.json();
      if(res.ok){
        showToast(`Request ${newStatus}`);
        setSelected(data);
        // Refresh list quietly
  fetchRequests();
      } else {
        showToast(data.detail || 'Failed to update', 'error');
      }
    } catch(e){ showToast('Network error','error'); }
    finally { setActionLoading(false); }
  };

  const tabs = [ 'pending','approved','rejected','all' ];
  const counts = {
    pending: requests.filter(r=>r.status==='pending').length,
    approved: requests.filter(r=>r.status==='approved').length,
    rejected: requests.filter(r=>r.status==='rejected').length,
    all: requests.length
  };

  return (
    <div className="min-h-screen bg-[#E3E3E3] flex">
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
              <Link to="/admin/lobbies" className="flex items-center p-3 rounded-lg hover:bg-white/10 font-medium">
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5V4H2v16h5m10 0v-4H7v4m10 0H7" />
                </svg>
                Active Lobbies
              </Link>
            </li>
            <li>
              <Link to="/admin/module-requests" className="flex items-center p-3 rounded-lg bg-white/10 font-medium text-white">
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0120 9.414V19a2 2 0 01-2 2z" />
                </svg>
                Module Requests
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
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 p-3 rounded-lg hover:bg-white/10 transition-all duration-200 text-left text-red-300 font-semibold"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm">Logout</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-black mb-1">Module Requests</h1>
              <p className="text-gray-600">Review, approve or reject instructor module requests</p>
            </div>
          </div>
          <div className="flex gap-2 mb-4 flex-wrap">
            {tabs.map(t=>{
              const active = t===activeStatus;
              return (
                <button key={t} onClick={()=>setActiveStatus(t)} className={`px-4 py-2 rounded-lg font-medium transition-colors ${active? 'bg-[#1E5780] text-white':'bg-white text-gray-700 hover:bg-gray-100'}`}>{t.charAt(0).toUpperCase()+t.slice(1)}{t!=='all' && (
                  <span className="ml-2 text-xs bg-black/10 px-2 py-0.5 rounded-full">{counts[t]}</span>
                )}{t==='all' && (
                  <span className="ml-2 text-xs bg-black/10 px-2 py-0.5 rounded-full">{counts.all}</span>
                )}</button>
              );
            })}
          </div>
          {loading && <div className="p-6 bg-white rounded shadow">Loading...</div>}
          {error && <div className="p-4 bg-red-100 text-red-700 rounded mb-4">{error}</div>}
          {!loading && !error && (
            <div className="overflow-x-auto bg-white rounded shadow">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Module Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Instructor ID</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.filter(r=> activeStatus==='all' || r.status===activeStatus).map(r=> (
                    <tr key={r.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={()=>openDetail(r)}>
                      <td className="py-2 px-4 font-mono text-xs">{r.id}</td>
                      <td className="py-2 px-4">{r.module_name}</td>
                      <td className="py-2 px-4">{r.category}</td>
                      <td className="py-2 px-4">{r.instructor_id}</td>
                      <td className="py-2 px-4">{badge(r.status)}</td>
                      <td className="py-2 px-4 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="py-2 px-4">
                        {r.status==='pending' && (
                          <div className="flex gap-2">
                            <button onClick={(e)=>{e.stopPropagation(); openDetail(r);}} className="text-blue-600 hover:underline text-xs">Review</button>
                          </div>
                        )}
                        {r.status!=='pending' && <span className="text-gray-400 text-xs">—</span>}
                      </td>
                    </tr>
                  ))}
                  {requests.filter(r=> activeStatus==='all' || r.status===activeStatus).length===0 && (
                    <tr><td colSpan={7} className="py-6 text-center text-gray-500">No requests</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      {selected && (
        <div className="fixed inset-0 bg-black/30 flex items-start justify-end z-50">
          <div className="w-full max-w-3xl h-full bg-white shadow-xl flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Request #{selected.id} • {selected.module_name}</h2>
              <button onClick={closeDetail} className="text-gray-500 hover:text-black">✕</button>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="grid grid-cols-1 lg:grid-cols-3 flex-1 overflow-hidden">
                {/* Left meta & actions */}
                <div className="border-r p-4 space-y-4 overflow-y-auto text-sm bg-gray-50/40">
                  <div>
                    <label className="block text-xs text-gray-500">Status</label>
                    <div className="mt-1">{badge(selected.status)}</div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Category</label>
                    <div className="font-mono text-[11px] bg-gray-100 inline-block px-2 py-0.5 rounded mt-1">{selected.category}</div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Instructor ID</label>
                    <div className="mt-1">{selected.instructor_id}</div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Details</label>
                    <div className="p-2 bg-white rounded border min-h-[60px] whitespace-pre-wrap text-xs">{selected.details || <span className="italic text-gray-400">No details provided</span>}</div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Admin Comment</label>
                    <textarea value={comment} onChange={e=>setComment(e.target.value)} className="w-full border rounded p-2 text-xs h-32 resize-none focus:outline-none focus:ring-1 focus:ring-[#1E5780]" placeholder="Optional comment for instructor" maxLength={2000} />
                    <div className="text-right text-[10px] text-gray-400">{comment.length}/2000</div>
                  </div>
                  {selected.decided_at && (
                    <div className="text-[11px] text-gray-500">Decided: {new Date(selected.decided_at).toLocaleString()}</div>
                  )}
                  <div className="pt-2 space-y-2">
                    {selected.status==='pending' && <>
                      <button disabled={actionLoading} onClick={()=>performStatus('approved')} className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 text-sm disabled:opacity-50">Approve</button>
                      <button disabled={actionLoading} onClick={()=>performStatus('rejected')} className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 text-sm disabled:opacity-50">Reject</button>
                    </>}
                    {selected.status!=='pending' && <button disabled={actionLoading} onClick={()=>performStatus('pending')} className="w-full bg-yellow-500 text-white py-2 rounded hover:bg-yellow-600 text-sm disabled:opacity-50">Revert to Pending</button>}
                    <button onClick={()=>fetchContent(selected.id)} disabled={contentLoading} className="w-full bg-gray-200 text-gray-700 py-2 rounded text-sm hover:bg-gray-300 disabled:opacity-50">{contentLoading? 'Refreshing Content…':'Reload Content'}</button>
                  </div>
                </div>
                {/* Right content preview */}
                <div className="lg:col-span-2 flex flex-col overflow-hidden">
                  <div className="p-4 border-b flex items-center justify-between bg-white">
                    <h3 className="font-semibold text-sm">Module Content</h3>
                    {content && <span className="text-[11px] text-gray-500">{content.meta?.difficulty || '—'} • {content.meta?.estimatedTime || '—'} • {content.meta?.visibility || '—'}</span>}
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-6 text-sm">
                    {contentLoading && <div className="text-gray-500 text-xs">Loading content…</div>}
                    {contentError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs">{contentError}</div>}
                    {!contentLoading && !contentError && !content && <div className="text-gray-500 text-xs">No structured content provided with this request.</div>}
                    {content && (
                      <>
                        {/* Overview */}
                        <section>
                          <h4 className="text-sm font-semibold mb-1">Overview</h4>
                          <div className="text-xs whitespace-pre-wrap bg-gray-50 border rounded p-3">{content.overview?.content || '—'}</div>
                        </section>
                        {/* Theory */}
                        <section>
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">Theory Modules <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded">{(content.theory||[]).length}</span></h4>
                          {(content.theory||[]).length===0 && <div className="text-xs text-gray-500">No theory modules.</div>}
                          <div className="space-y-3">
                            {(content.theory||[]).map((m,i)=>{
                              const completeLessons = (m.lessons||[]).filter(l=>l.title && l.content).length;
                              return (
                                <div key={i} className="border rounded-lg">
                                  <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
                                    <div className="font-medium text-xs">Module {m.moduleNumber || i+1}</div>
                                    <div className="text-[10px] text-gray-500">{completeLessons}/{(m.lessons||[]).length} lessons complete</div>
                                  </div>
                                  <div className="p-3 space-y-2">
                                    {(m.lessons||[]).map((l,li)=>(
                                      <div key={li} className="bg-white border rounded p-2">
                                        <div className="font-medium text-xs mb-1">Lesson {li+1}: {l.title || <span className="italic text-gray-400">Untitled</span>}</div>
                                        {l.content && <div className="text-[11px] text-gray-600 whitespace-pre-wrap line-clamp-6">{l.content}</div>}
                                      </div>
                                    ))}
                                    {m.assessment && (m.assessment.title || m.assessment.content) && (
                                      <div className="mt-2 border-t pt-2">
                                        <div className="text-[11px] font-semibold mb-1">Module Assessment</div>
                                        <div className="text-[11px] whitespace-pre-wrap bg-gray-50 p-2 rounded border">{m.assessment.content || '—'}</div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                        {/* Practical */}
                        <section>
                          <h4 className="text-sm font-semibold mb-1">Practical Exercise</h4>
                          <div className="text-xs whitespace-pre-wrap bg-gray-50 border rounded p-3">{content.practical?.content || '—'}</div>
                        </section>
                        {/* Assessment */}
                        <section>
                          <h4 className="text-sm font-semibold mb-1">Final Assessment</h4>
                          <div className="text-xs whitespace-pre-wrap bg-gray-50 border rounded p-3">{content.assessment?.content || '—'}</div>
                        </section>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 p-3 rounded shadow text-white text-sm ${toast.type==='error'?'bg-red-600':'bg-green-600'}`}>{toast.message}</div>
      )}
    </div>
  );
}
