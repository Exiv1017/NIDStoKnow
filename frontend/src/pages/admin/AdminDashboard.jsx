import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminNotificationsBell from '../../components/admin/AdminNotificationsBell';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalInstructors: 0,
    totalStudents: 0,
    pendingApprovals: 0,
    recentSignups: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [confirmAction, setConfirmAction] = useState({ show: false, action: '', userId: null, userName: '' });
  const navigate = useNavigate();

  const authHeaders = () => {
    let token = null;
    try { const raw = localStorage.getItem('admin_user'); if(raw){ const parsed = JSON.parse(raw); token = parsed.token; } } catch {}
    if(!token) token = localStorage.getItem('token_admin');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const [health,setHealth] = useState({ api:'unknown', db:'unknown' });
  const [requestsSummary,setRequestsSummary] = useState({ pending:0, approved:0, rejected:0, rich:0 });
  const [recentRequests,setRecentRequests] = useState([]); // last 3 pending

  useEffect(() => {
    fetchDashboardData();
    fetchHealth();
    fetchModuleRequests();
    // periodic light refresh every 60s for requests + health
    const int = setInterval(()=>{ fetchHealth(); fetchModuleRequests(); }, 60000);
    return ()=> clearInterval(int);
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch users to calculate stats
  const res = await fetch('/api/admin/users', { headers: authHeaders() });
      const data = await res.json();
      
      if (res.ok) {
        const users = data.users;
        const instructors = users.filter(u => u.userType === 'instructor');
        const students = users.filter(u => u.userType === 'student');
        const pendingApprovals = instructors.filter(u => u.status === 'pending');
        
        // Sort by newest first (assuming id is auto-incremented)
        const recentSignups = [...users].sort((a, b) => b.id - a.id).slice(0, 5);
        
        setStats({
          totalUsers: users.length,
          totalInstructors: instructors.length,
          totalStudents: students.length,
          pendingApprovals: pendingApprovals.length,
          recentSignups
        });
      } else {
        setError(data.error || 'Failed to fetch dashboard data');
      }
    } catch (err) {
      setError('Error fetching dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  const showConfirmation = (action, userId, userName) => {
    setConfirmAction({ show: true, action, userId, userName });
  };

  const cancelAction = () => {
    setConfirmAction({ show: false, action: '', userId: null, userName: '' });
  };

  const handleLogout = () => {
    localStorage.removeItem('admin');
    localStorage.removeItem('admin_user');
    navigate('/admin-login');
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/admin/health', { headers: authHeaders() });
      if(!res.ok) return;
      const data = await res.json();
      setHealth({ api:data.api, db:data.db });
    } catch {}
  };

  const fetchModuleRequests = async () => {
    try {
      const res = await fetch('/api/admin/module-requests', { headers: authHeaders() });
      if(!res.ok) return;
      const data = await res.json();
      if(Array.isArray(data)){
        const pending = data.filter(r=>r.status==='pending');
        const approved = data.filter(r=>r.status==='approved');
        const rejected = data.filter(r=>r.status==='rejected');
        // crude heuristic rich = details length > 40 or category indicates change + maybe existing content awareness (content presence not selected here)
        const rich = pending.filter(r=> (r.details||'').length > 80).length;
        setRequestsSummary({ pending: pending.length, approved: approved.length, rejected: rejected.length, rich });
        setRecentRequests(pending.sort((a,b)=> new Date(b.created_at)-new Date(a.created_at)).slice(0,3));
      }
    } catch {}
  };

  // Get status badge color
  const getStatusBadge = (status) => {
    switch(status) {
      case 'approved':
        return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">Approved</span>;
      case 'pending':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold">Pending</span>;
      case 'rejected':
        return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">Rejected</span>;
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-semibold">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#E3E3E3] flex">
      {/* Sidebar */}
      <aside className="w-64 h-screen bg-gradient-to-b from-[#0C2A40] to-[#206EA6] text-white flex flex-col fixed top-0 left-0 z-50">
        <div className="p-6 flex items-center justify-start">
          <Link to="/admin-dashboard" className="ml-2">
            <img src="/NIDStoKnowLogo.svg" alt="NIDSToKnow Logo" className="h-10 w-auto" />
          </Link>
        </div>
        <nav className="flex-1 px-4">
          <ul className="space-y-3">
            <li>
              <Link
                to="/admin-dashboard"
                className="flex items-center p-3 rounded-lg bg-white/10 font-medium text-white"
              >
                <img src="/dashboardicon.svg" alt="" className="w-6 h-6 mr-3" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                to="/admin/users"
                className="flex items-center p-3 rounded-lg hover:bg-white/10 font-medium"
              >
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                User Management
              </Link>
            </li>
            <li>
              <Link
                to="/admin/lobbies"
                className="flex items-center p-3 rounded-lg hover:bg-white/10 font-medium"
              >
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5V4H2v16h5m10 0v-4H7v4m10 0H7" />
                </svg>
                Active Lobbies
              </Link>
            </li>
            <li>
              <Link
                to="/admin/module-requests"
                className="flex items-center p-3 rounded-lg hover:bg-white/10 font-medium"
              >
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0120 9.414V19a2 2 0 01-2 2z" />
                </svg>
                Module Requests
              </Link>
            </li>
            <li>
              <Link
                to="/admin/settings"
                className="flex items-center p-3 rounded-lg hover:bg-white/10 font-medium"
              >
                <img src="/settings.svg" alt="" className="w-6 h-6 mr-3" />
                Settings
              </Link>
            </li>
          </ul>
        </nav>
        <div className="p-4 mt-auto border-t border-white/10">
          <button
            onClick={() => showConfirmation('logout', null, '')}
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
  {/* Main Content */}
  <main className="flex-1 ml-64 p-8">
        <div className="max-w-4xl w-full mx-auto">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div className="text-left">
              <h1 className="text-3xl font-bold text-black mb-1">Admin Dashboard</h1>
              <p className="text-gray-600 text-base">System overview and key metrics</p>
            </div>
            {/* Prominent notifications bell in header */}
            <div className="shrink-0">
              <AdminNotificationsBell refreshIntervalMs={15000} appearance="light" />
            </div>
          </div>

          {/* Toast Notification */}
          {toast.show && (
            <div className={`fixed top-4 right-4 z-50 p-4 rounded-md shadow-md ${
              toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
            } text-white max-w-md animate-fade-in`}>
              <div className="flex items-center">
                {toast.type === 'error' ? (
                  <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                ) : (
                  <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                )}
                <span>{toast.message}</span>
              </div>
            </div>
          )}

          {/* Confirmation Modal */}
          {confirmAction.show && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md mx-auto shadow-xl">
                <h3 className="text-xl font-semibold mb-4">Confirm Action</h3>
                <p className="mb-6">
                  {confirmAction.action === 'logout' && `Are you sure you want to log out?`}
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={cancelAction}
                    className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  {confirmAction.action === 'logout' && (
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                    >
                      Logout
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mr-4"></div>
              <span className="text-gray-600 text-lg">Loading dashboard...</span>
            </div>
          ) : error ? (
            <div className="flex justify-center">
              <div className="bg-red-50 p-4 rounded-md text-red-800 mb-4 max-w-md">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span>{error}</span>
                </div>
                <button 
                  onClick={fetchDashboardData}
                  className="mt-3 text-[#1E5780] hover:text-[#0C2A40] font-semibold"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                {/* User Stats */}
                <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow border border-gray-100 flex flex-col">
                  <h3 className="text-lg font-medium text-gray-600 mb-1">Total Users</h3>
                  <p className="text-4xl font-extrabold text-[#1E5780] mt-2">{stats.totalUsers}</p>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Students:</span>
                      <span className="text-sm font-semibold">{stats.totalStudents}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Instructors:</span>
                      <span className="text-sm font-semibold">{stats.totalInstructors}</span>
                    </div>
                  </div>
                </div>

                {/* Pending Instructor Approvals */}
                <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow border border-gray-100 flex flex-col">
                  <h3 className="text-lg font-medium text-gray-600 mb-1">Pending Approvals</h3>
                  <p className="text-4xl font-extrabold text-[#1E5780] mt-2">{stats.pendingApprovals}</p>
                  <div className="mt-4">
                    <Link to="/admin/users" className="text-sm text-blue-600 hover:underline">View pending instructors</Link>
                  </div>
                </div>
                {/* Module Requests Summary */}
                <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow border border-gray-100 flex flex-col">
                  <h3 className="text-lg font-medium text-gray-600 mb-1">Module Requests</h3>
                  <p className="text-4xl font-extrabold text-[#1E5780] mt-2">{requestsSummary.pending}</p>
                  <div className="mt-4 space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-gray-500">Approved:</span><span className="font-semibold text-emerald-600">{requestsSummary.approved}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Rejected:</span><span className="font-semibold text-red-600">{requestsSummary.rejected}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Rich Pending:</span><span className="font-semibold text-indigo-600">{requestsSummary.rich}</span></div>
                  </div>
                  <div className="mt-4">
                    <Link to="/admin/module-requests" className="text-sm text-blue-600 hover:underline">Review now</Link>
                  </div>
                </div>
                {/* Dynamic System Health */}
                <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow border border-gray-100 flex flex-col">
                  <h3 className="text-lg font-medium text-gray-600 mb-1">System Health</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">API</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${health.api==='ok'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{health.api==='ok'?'Online':'Error'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Database</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${health.db==='ok'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{health.db==='ok'?'Connected':'Error'}</span>
                    </div>
                  </div>
                  <button onClick={()=>fetchHealth()} className="mt-4 text-xs text-blue-600 hover:underline">Refresh</button>
                </div>
              </div>

              {/* Recent Signups */}
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 mb-10">
                <h2 className="text-2xl font-semibold text-[#1E5780] mb-4">Recent Signups</h2>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100 border-b">
                        <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Name</th>
                        <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Email</th>
                        <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Role</th>
                        <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentSignups.length > 0 ? (
                        stats.recentSignups.map(user => (
                          <tr key={user.id} className="border-t hover:bg-gray-50">
                            <td className="py-3 px-4">{user.name}</td>
                            <td className="py-3 px-4">{user.email}</td>
                            <td className="py-3 px-4">
                              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                user.userType === 'instructor' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                              }`}>
                                {user.userType}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {getStatusBadge(user.status)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="py-8 text-center text-gray-500">
                            No recent signups
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Recent Pending Module Requests */}
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 mb-10">
                <h2 className="text-2xl font-semibold text-[#1E5780] mb-4">Recent Module Requests</h2>
                {recentRequests.length===0 && <div className="text-sm text-gray-500">No pending requests.</div>}
                {recentRequests.length>0 && (
                  <ul className="divide-y">
                    {recentRequests.map(r=> (
                      <li key={r.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{r.module_name}</div>
                          <div className="text-[11px] text-gray-500">Instructor #{r.instructor_id} • {new Date(r.created_at).toLocaleString()}</div>
                          <div className="text-[11px] text-gray-500 line-clamp-2 max-w-md">{r.details || 'No details'}</div>
                        </div>
                        <Link to="/admin/module-requests" className="text-xs px-3 py-1 rounded bg-[#1E5780] text-white hover:bg-[#164666] font-semibold self-start sm:self-auto">Review</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;