import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [confirmAction, setConfirmAction] = useState({ show: false, action: '', userId: null, userName: '' });
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [editUser, setEditUser] = useState(null); // {id, name, email}
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [resetUser, setResetUser] = useState(null); // {id, name}
  const [resetPassword, setResetPassword] = useState('');
  const navigate = useNavigate();

  // Add a prop or callback to notify parent (dashboard) to refresh stats
  // We'll use a custom event for simplicity
  const notifyStatsUpdate = () => {
    const event = new CustomEvent('studentsChanged');
    window.dispatchEvent(event);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = authHeaders();
      const res = await fetch('/api/admin/users', { headers });
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
      } else {
        setError(data.error || 'Failed to fetch users');
      }
    } catch (err) {
      setError('Error fetching users');
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

  const handleApprove = async (userId, userName) => {
    setConfirmAction({ show: false, action: '', userId: null, userName: '' });
    try {
      const res = await fetch(`/api/admin/approve/${userId}`, { method: 'POST', headers: authHeaders() });
      if (res.ok) {
        await fetchUsers(); // Refresh user list from server
        showToast(`${userName} has been approved successfully`);
      } else {
        const data = await res.json();
        showToast(data.detail || 'Failed to approve user', 'error');
      }
    } catch (err) {
      showToast('Error approving user', 'error');
    }
  };

  const handleReject = async (userId, userName) => {
    setConfirmAction({ show: false, action: '', userId: null, userName: '' });
    try {
      const res = await fetch(`/api/admin/reject/${userId}`, { method: 'POST', headers: authHeaders() });
      if (res.ok) {
        await fetchUsers(); // Refresh user list from server
        showToast(`${userName} has been rejected`);
      } else {
        const data = await res.json();
        showToast(data.detail || 'Failed to reject user', 'error');
      }
    } catch (err) {
      showToast('Error rejecting user', 'error');
    }
  };

  const handleDelete = async (userId, userName) => {
    setConfirmAction({ show: false, action: '', userId: null, userName: '' });
    try {
      const res = await fetch(`/api/admin/delete/${userId}`, { method: 'DELETE', headers: authHeaders() });
      if (res.ok) {
        await fetchUsers(); // Refresh user list from server
        showToast(`${userName} has been deleted`);
        notifyStatsUpdate(); // Notify dashboard to refresh stats
      } else {
        const data = await res.json();
        showToast(data.detail || 'Failed to delete user', 'error');
      }
    } catch (err) {
      showToast('Error deleting user', 'error');
    }
  };

  const authHeaders = () => {
    let token = null;
    try { const raw = localStorage.getItem('admin_user'); if(raw){ const parsed = JSON.parse(raw); token = parsed.token; } } catch {}
    if(!token) token = localStorage.getItem('admin_token');
    if(!token) token = localStorage.getItem('token_admin');
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  };

  const openEdit = (u) => { setEditUser(u); setEditForm({ name: u.name, email: u.email }); };
  const cancelEdit = () => { setEditUser(null); setEditForm({ name: '', email: '' }); };
  const submitEdit = async () => {
    if(!editUser) return;
    try {
      const res = await fetch(`/api/admin/users/${editUser.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(editForm) });
      const data = await res.json().catch(()=>({}));
      if(res.ok){
        showToast('User updated');
        // apply change locally
        setUsers(prev => prev.map(u=> u.id===editUser.id ? { ...u, name: editForm.name, email: editForm.email } : u));
        cancelEdit();
      } else {
        showToast(data.detail || 'Update failed', 'error');
      }
    } catch { showToast('Network error', 'error'); }
  };

  const openReset = (u) => { setResetUser(u); setResetPassword(''); };
  const cancelReset = () => { setResetUser(null); setResetPassword(''); };
  const submitReset = async () => {
    if(!resetUser || !resetPassword) return;
    try {
      const res = await fetch(`/api/admin/users/${resetUser.id}/reset-password`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ new_password: resetPassword }) });
      const data = await res.json().catch(()=>({}));
      if(res.ok){ showToast('Password reset'); cancelReset(); }
      else { showToast(data.detail || 'Reset failed', 'error'); }
    } catch { showToast('Network error', 'error'); }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_token');
    localStorage.removeItem('token_admin');
    navigate('/admin-login');
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

  // Sorting logic
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (columnName) => {
    if (sortConfig.key !== columnName) return null;
    if (sortConfig.direction === 'asc') {
      return <span className="ml-1">▲</span>;
    }
    return <span className="ml-1">▼</span>;
  };

  const sortedUsers = [...users]
    .filter(u => {
      const q = query.trim().toLowerCase();
      if(!q) return true;
      return (u.name||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q) || (u.userType||'').toLowerCase().includes(q) || (u.status||'').toLowerCase().includes(q);
    })
    .sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  // Filtering logic
  const filteredUsers = sortedUsers.filter(user => {
    if (filter === 'all') return true;
    if (filter === 'students') return user.userType === 'student';
    if (filter === 'instructors') return user.userType === 'instructor';
    if (filter === 'pending') return user.status === 'pending';
    if (filter === 'approved') return user.status === 'approved';
    if (filter === 'rejected') return user.status === 'rejected';
    return true;
  });

  return (
    <div className="min-h-screen bg-[#E3E3E3] flex">
      {/* Sidebar */}
      <aside className="w-64 h-screen bg-gradient-to-b from-[#0C2A40] to-[#206EA6] text-white flex flex-col fixed top-0 left-0 z-50">
        <div className="p-6 flex items-center justify-start pr-4">
          <Link to="/admin-dashboard" className="ml-2">
            <img src="/NIDStoKnowLogo.svg" alt="NIDSToKnow Logo" className="h-10 w-auto" />
          </Link>
        </div>
        <nav className="flex-1 px-4">
          <ul className="space-y-3">
            <li>
              <Link
                to="/admin-dashboard"
                className="flex items-center p-3 rounded-lg hover:bg-white/10 font-medium"
              >
                <img src="/dashboardicon.svg" alt="" className="w-6 h-6 mr-3" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                to="/admin/users"
                className="flex items-center p-3 rounded-lg bg-white/10 font-medium text-white"
              >
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                User Management
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
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-black mb-1">User Management</h1>
            <p className="text-gray-600 text-base">View, filter and manage all users</p>
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
                {confirmAction.action === 'approve' && `Are you sure you want to approve ${confirmAction.userName}?`}
                {confirmAction.action === 'reject' && `Are you sure you want to reject ${confirmAction.userName}?`}
                {confirmAction.action === 'delete' && `Are you sure you want to delete ${confirmAction.userName}?`}
                {confirmAction.action === 'logout' && `Are you sure you want to log out?`}
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={cancelAction}
                  className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                {confirmAction.action === 'approve' && (
                  <button
                    onClick={() => handleApprove(confirmAction.userId, confirmAction.userName)}
                    className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                  >
                    Approve
                  </button>
                )}
                {confirmAction.action === 'reject' && (
                  <button
                    onClick={() => handleReject(confirmAction.userId, confirmAction.userName)}
                    className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors"
                  >
                    Reject
                  </button>
                )}
                {confirmAction.action === 'delete' && (
                  <button
                    onClick={() => handleDelete(confirmAction.userId, confirmAction.userName)}
                    className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                  >
                    Delete
                  </button>
                )}
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

        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <h2 className="text-2xl font-semibold text-[#1E5780] mb-4 sm:mb-0">User List</h2>
            
            {/* Filter Controls */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, email, role, status" className="pl-8 pr-3 py-1.5 text-sm rounded-md border border-gray-300" />
                <svg className="w-4 h-4 absolute left-2 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z" /></svg>
              </div>
              <button 
                onClick={() => setFilter('all')}
                className={`px-3 py-1 text-sm rounded-md ${filter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}
              >
                All
              </button>
              <button 
                onClick={() => setFilter('students')}
                className={`px-3 py-1 text-sm rounded-md ${filter === 'students' ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-800'}`}
              >
                Students
              </button>
              <button 
                onClick={() => setFilter('instructors')}
                className={`px-3 py-1 text-sm rounded-md ${filter === 'instructors' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}
              >
                Instructors
              </button>
              <button 
                onClick={() => setFilter('pending')}
                className={`px-3 py-1 text-sm rounded-md ${filter === 'pending' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-800'}`}
              >
                Pending
              </button>
              {/* Bulk actions for instructors pending */}
              <button
                onClick={async()=>{
                  const pend = filteredUsers.filter(u=>u.userType==='instructor' && u.status==='pending');
                  for(const u of pend){
                    try{ await fetch(`/api/admin/approve/${u.id}`, { method:'POST', headers: authHeaders() }); } catch {}
                  }
                  await fetchUsers();
                  showToast('Approved all pending instructors in current filter');
                }}
                className="ml-2 px-3 py-1 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                title="Approve all pending instructors in current view"
              >
                Bulk Approve
              </button>
              <button
                onClick={async()=>{
                  const pend = filteredUsers.filter(u=>u.userType==='instructor' && u.status==='pending');
                  for(const u of pend){
                    try{ await fetch(`/api/admin/reject/${u.id}`, { method:'POST', headers: authHeaders() }); } catch {}
                  }
                  await fetchUsers();
                  showToast('Rejected all pending instructors in current filter');
                }}
                className="px-3 py-1 text-sm rounded-md bg-red-600 text-white hover:bg-red-700"
                title="Reject all pending instructors in current view"
              >
                Bulk Reject
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1E5780]"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 p-4 rounded-md text-red-800 mb-4">
              <div className="flex">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>{error}</span>
              </div>
              <button 
                onClick={fetchUsers}
                className="mt-3 text-[#1E5780] hover:text-[#0C2A40] font-semibold"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse table-auto text-sm">
                <thead>
                  <tr className="bg-gray-100 border-b text-gray-700">
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">
                      <button 
                        onClick={() => requestSort('name')}
                        className="flex items-center font-semibold focus:outline-none"
                      >
                        Name {getSortIndicator('name')}
                      </button>
                    </th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">
                      <button 
                        onClick={() => requestSort('email')}
                        className="flex items-center font-semibold focus:outline-none"
                      >
                        Email {getSortIndicator('email')}
                      </button>
                    </th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">
                      <button 
                        onClick={() => requestSort('userType')}
                        className="flex items-center font-semibold focus:outline-none"
                      >
                        Role {getSortIndicator('userType')}
                      </button>
                    </th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">
                      <button 
                        onClick={() => requestSort('status')}
                        className="flex items-center font-semibold focus:outline-none"
                      >
                        Status {getSortIndicator('status')}
                      </button>
                    </th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map(user => (
                      <tr key={user.id} className="border-t hover:bg-gray-50 align-middle">
                        <td className="py-2 px-4 max-w-[240px] whitespace-nowrap overflow-hidden text-ellipsis align-middle">{user.name}</td>
                        <td className="py-2 px-4 max-w-[320px] whitespace-nowrap overflow-hidden text-ellipsis align-middle">{user.email}</td>
                        <td className="py-2 px-4 whitespace-nowrap align-middle">
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            user.userType === 'instructor' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {user.userType}
                          </span>
                        </td>
                        <td className="py-2 px-4 whitespace-nowrap align-middle">
                          {getStatusBadge(user.status)}
                        </td>
                        <td className="py-2 px-4 align-middle">
                          <div className="flex items-center gap-2 flex-wrap">
                          {user.userType === 'instructor' && user.status === 'pending' && (
                            <>
                              <button 
                                onClick={() => showConfirmation('approve', user.id, user.name)}
                                className="w-28 justify-center px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors shadow text-sm inline-flex"
                              >
                                Approve
                              </button>
                              <button 
                                onClick={() => showConfirmation('reject', user.id, user.name)}
                                className="w-28 justify-center px-3 py-1 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors shadow text-sm inline-flex"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button 
                            onClick={() => showConfirmation('delete', user.id, user.name)}
                            className="w-28 justify-center px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors shadow text-sm inline-flex"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => openEdit(user)}
                            className="w-28 justify-center px-3 py-1 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 transition-colors shadow text-sm inline-flex"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => openReset(user)}
                            className="w-28 justify-center px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors shadow text-sm inline-flex"
                          >
                            Reset Password
                          </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-gray-500">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>            )}
          </div>
        </div>

      {/* Edit Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Edit User</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Name</label>
                <input value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Email</label>
                <input value={editForm.email} onChange={e=>setEditForm(f=>({...f,email:e.target.value}))} className="w-full px-3 py-2 border rounded" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={cancelEdit} className="px-3 py-1 rounded bg-gray-200">Cancel</button>
              <button onClick={submitEdit} className="px-3 py-1 rounded bg-[#1E5780] text-white">Save</button>
            </div>
          </div>
        </div>
      )}
      {/* Reset Password Modal */}
      {resetUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Reset Password</h3>
            <p className="text-sm text-gray-600 mb-3">User: <strong>{resetUser.name}</strong> (#{resetUser.id})</p>
            <div>
              <label className="block text-sm text-gray-700 mb-1">New Password</label>
              <input type="password" value={resetPassword} onChange={e=>setResetPassword(e.target.value)} className="w-full px-3 py-2 border rounded" placeholder="Enter new password" />
              <p className="text-[12px] text-gray-500 mt-1">Minimum 6 characters.</p>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={cancelReset} className="px-3 py-1 rounded bg-gray-200">Cancel</button>
              <button onClick={submitReset} className="px-3 py-1 rounded bg-indigo-600 text-white">Reset</button>
            </div>
          </div>
        </div>
      )}

      </main>
    </div>
  );
};

export default UserManagement;