import { useState, useEffect, useContext } from 'react';
import InstructorSidebar from '../../components/InstructorSidebar';
import AuthContext from '../../context/AuthContext';
// Build API base helper
const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
const apiUrl = (p) => `${API_BASE}${p}`.replace(/([^:]?)\/\/+/g,'$1/');

// Canonical slug -> display title mapping
const CANONICAL_TITLES = {
  'signature-based-detection': 'Signature-Based Detection',
  'anomaly-based-detection': 'Anomaly-Based Detection',
  'hybrid-detection': 'Hybrid Detection'
};

const ORDER = ['signature-based-detection', 'anomaly-based-detection', 'hybrid-detection'];

function slugify(name = '') {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

const ManageModules = () => {
  const { user } = useContext(AuthContext);
  const [modules, setModules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedModule, setSelectedModule] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', status: 'Active' });
  const [deleteId, setDeleteId] = useState(null);
  // Assign modal state
  const [assignOpen, setAssignOpen] = useState(false);
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');
  const [assignForm, setAssignForm] = useState({ instructorId: 0, studentIds: [], dueDate: '', notes: '' });
  // Request modal state
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestCategory, setRequestCategory] = useState('');
  const [requestDetails, setRequestDetails] = useState('');
  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState('');
  // Instructor module requests (tracking status & admin comments)
  const [myRequests, setMyRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState('');
  const [showRequestsPanel, setShowRequestsPanel] = useState(false);
  // Maps for request state per module (lower-case name key)
  // Allow multiple requests: do not block new requests per module
  const pendingRequestsByModule = {}; // legacy placeholder (unused now)
  // (Removed latestRequestByModule badge display per user request)

  const requestCategories = ['Edit Module', 'Delete Module', 'Change Status', 'Other'];

  const handleSendRequest = async () => {
    setRequestError(''); setRequestSuccess('');
    if (!selectedModule) { setRequestError('No module selected'); return; }
    if (!requestCategory) { setRequestError('Select a category'); return; }
    if (!requestDetails.trim()) { setRequestError('Enter details'); return; }
    try {
      const payload = {
        instructor_id: user?.id || 0,
        module_name: selectedModule.title,
        category: requestCategory,
        details: requestDetails
      };
      const res = await fetch(apiUrl('/api/instructor/module-request'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(user?.token ? { 'Authorization': `Bearer ${user.token}` } : {}) },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to send request');
      }
      setRequestSuccess('Request sent to admin.');
      setRequestOpen(false);
      setRequestCategory('');
      setRequestDetails('');
      // Refresh my requests list after successful creation
      fetchMyRequests();
    } catch (e) {
      setRequestError(String(e.message || e));
    }
  };

  const fetchMyRequests = async () => {
    if (!user?.token) return;
    setRequestsLoading(true); setRequestsError('');
    try {
      const res = await fetch(apiUrl('/api/instructor/module-requests'), {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to load requests');
      }
      const data = await res.json();
      setMyRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      setRequestsError(String(e.message || e));
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(()=>{ fetchMyRequests(); }, [user?.token]);

  // Fetch modules data from backend
  useEffect(() => {
    fetchModules();
  }, []);

  const fetchModules = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(apiUrl('/api/instructor/modules'), {
        headers: user?.token ? { 'Authorization': `Bearer ${user.token}` } : {}
      });

      // Initialize merged map with core modules (ensures they always show)
      const merged = {};
      ORDER.forEach(slug => {
        merged[slug] = {
          slug,
          name: CANONICAL_TITLES[slug],
          students: 0,
          completion: 0
        };
      });

      if (response.ok) {
        const backendModules = await response.json();
        (backendModules || []).forEach(m => {
          // Accept either m.name or m.title
            const raw = m.name || m.title || '';
            const slug = slugify(raw);
            if (!slug) return;
            if (!merged[slug]) {
              // Non-core module, keep its original display or title-case
              const display = CANONICAL_TITLES[slug] || raw.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              merged[slug] = {
                slug,
                name: display,
                students: m.students || 0,
                completion: m.completion || 0
              };
            } else {
              // Core module: prefer non-zero backend numbers
              if (typeof m.students === 'number') merged[slug].students = m.students;
              if (typeof m.completion === 'number') merged[slug].completion = m.completion;
            }
        });
      } else {
        console.error('Failed to fetch modules:', response.status);
        setError('Failed to load modules from server, showing default modules');
      }

      // Build ordered array: core order first, then any additional modules alphabetically
      const additional = Object.values(merged)
        .filter(m => !ORDER.includes(m.slug))
        .sort((a, b) => a.name.localeCompare(b.name));

      const orderedCore = ORDER.filter(slug => merged[slug]).map(slug => merged[slug]);
      const modulesToShow = [...orderedCore, ...additional];

      const formattedModules = modulesToShow.map((module, index) => ({
        id: index + 1,
        title: module.name,
        description: getModuleDescription(module.name),
        status: 'Active',
        students: module.students || 0,
        lastUpdated: '2024-01-15'
      }));

      setModules(formattedModules);
    } catch (error) {
      console.error('Error fetching modules:', error);
      setError('Failed to load modules from server, showing default modules');
      setModules(getDefaultModules());
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      setStudentsLoading(true);
      const res = await fetch(apiUrl('/api/instructor/students'), {
        headers: user?.token ? { 'Authorization': `Bearer ${user.token}` } : {}
      });
      if (!res.ok) throw new Error('Failed to fetch students');
      const data = await res.json();
      setStudents(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error fetching students:', e);
      setAssignError('Failed to load students');
    } finally {
      setStudentsLoading(false);
    }
  };

  // Helper function to get module descriptions
  const getModuleDescription = (moduleName) => {
    const descriptions = {
      'Signature-Based Detection': 'Learn about signature-based intrusion detection systems',
      'Anomaly-Based Detection': 'Understanding anomaly-based detection methods',
      'Hybrid Detection': 'Exploring hybrid detection techniques'
    };
    return descriptions[moduleName] || 'NIDS learning module';
  };

  // Fallback modules if API fails
  const getDefaultModules = () => [
    {
      id: 1,
  title: 'Signature-Based Detection',
  description: 'Learn about signature-based intrusion detection systems',
      status: 'Active',
      students: 0,
      lastUpdated: '2024-01-15',
    },
    {
      id: 2,
  title: 'Anomaly-Based Detection',
  description: 'Understanding anomaly-based detection methods',
      status: 'Active',
      students: 0,
      lastUpdated: '2024-01-20',
    },
    {
      id: 3,
  title: 'Hybrid Detection',
  description: 'Exploring hybrid detection techniques',
      status: 'Active',
      students: 0,
      lastUpdated: '2024-01-25',
    },
  ];

  const openCreateModal = () => {
    setModalMode('create');
    setForm({ title: '', description: '', status: 'Active' });
    setSelectedModule(null);
    setIsModalOpen(true);
  };

  const openEditModal = (module) => {
    setModalMode('edit');
    setForm({ title: module.title, description: module.description, status: module.status });
    setSelectedModule(module);
    setIsModalOpen(true);
  };

  const openAssignModal = (module) => {
    setSelectedModule(module);
    setAssignError('');
    setAssignSuccess('');
    setAssignForm({ instructorId: user?.id || 0, studentIds: [], dueDate: '', notes: '' });
    setAssignOpen(true);
    fetchStudents();
  };

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (modalMode === 'create') {
      const newModule = {
        id: Date.now(),
        title: form.title,
        description: form.description,
        status: form.status,
        students: 0,
        lastUpdated: new Date().toISOString().split('T')[0],
      };
      setModules([newModule, ...modules]);
    } else if (modalMode === 'edit' && selectedModule) {
      setModules(
        modules.map((m) =>
          m.id === selectedModule.id
            ? { ...m, ...form, lastUpdated: new Date().toISOString().split('T')[0] }
            : m
        )
      );
    }
    setIsModalOpen(false);
    // Refresh modules data to get updated student counts
    await fetchModules();
  };

  const openDeleteModal = (id) => {
    setDeleteId(id);
    setIsDeleteOpen(true);
  };

  const handleDelete = () => {
    setModules(modules.filter((m) => m.id !== deleteId));
    setIsDeleteOpen(false);
  };

  return (
    <div className="min-h-screen bg-white">
      <InstructorSidebar />
      <main className="ml-64 overflow-y-auto">
        <div className="p-4 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <h1 className="text-3xl font-bold">Manage Modules</h1>
            <div className="flex gap-2">
              <button
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${showRequestsPanel ? 'bg-[#1E5780] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                onClick={()=> setShowRequestsPanel(s => !s)}
              >
                {showRequestsPanel ? 'Hide Requests' : 'My Requests'}
              </button>
            </div>
          </div>
          {/* Quick stats */}
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="text-xs font-medium text-gray-500 tracking-wide">Total Modules</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{modules.length}</div>
            </div>
            <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="text-xs font-medium text-gray-500 tracking-wide">Pending Requests</div>
              <div className="text-2xl font-bold text-amber-600 mt-1">{myRequests.filter(r=>r.status==='pending').length}</div>
            </div>
            <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="text-xs font-medium text-gray-500 tracking-wide">Approved Requests</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">{myRequests.filter(r=>r.status==='approved').length}</div>
            </div>
          </div>

          {showRequestsPanel && (
            <div className="mb-8 bg-white rounded-2xl shadow-md border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">My Module Requests</h2>
                <button
                  onClick={fetchMyRequests}
                  className="text-sm px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 font-medium"
                  disabled={requestsLoading}
                >
                  {requestsLoading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
              {requestsError && <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">{requestsError}</div>}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">ID</th>
                      <th className="text-left py-2 px-3">Module</th>
                      <th className="text-left py-2 px-3">Category</th>
                      <th className="text-left py-2 px-3">Status</th>
                      <th className="text-left py-2 px-3">Admin Comment</th>
                      <th className="text-left py-2 px-3">Created</th>
                      <th className="text-left py-2 px-3">Decision Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requestsLoading ? (
                      <tr><td colSpan={7} className="py-6 text-center text-gray-500">Loading...</td></tr>
                    ) : myRequests.length === 0 ? (
                      <tr><td colSpan={7} className="py-6 text-center text-gray-400">No requests submitted yet.</td></tr>
                    ) : myRequests.map(r => {
                      const statusBadge = (
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${r.status==='pending' ? 'bg-yellow-100 text-yellow-700' : r.status==='approved' ? 'bg-green-100 text-green-700' : r.status==='rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
                      );
                      return (
                        <tr key={r.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-3 font-mono text-xs">{r.id}</td>
                          <td className="py-2 px-3 font-medium">{r.module_name}</td>
                          <td className="py-2 px-3 text-xs uppercase tracking-wide text-gray-600">{r.category}</td>
                          <td className="py-2 px-3">{statusBadge}</td>
                          <td className="py-2 px-3 text-gray-700 max-w-xs whitespace-pre-wrap">{r.admin_comment || <span className="text-gray-400 italic">—</span>}</td>
                          <td className="py-2 px-3 text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</td>
                          <td className="py-2 px-3 text-xs text-gray-500">{r.decided_at ? new Date(r.decided_at).toLocaleString() : <span className="text-gray-400">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-md border border-gray-100">
            <div className="p-6 overflow-x-auto">
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700">⚠️ {error}</p>
                </div>
              )}
              
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E5780]"></div>
                  <p className="mt-2 text-gray-600">Loading modules...</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Module Name</th>
                      <th className="text-left py-3 px-4">Description</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Students</th>
                      <th className="text-left py-3 px-4">Last Updated</th>
                      <th className="text-left py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map((module) => (
                      <tr key={module.id} className="border-b hover:bg-gray-50">
                        <td className="py-4 px-4 font-semibold text-gray-900">{module.title}</td>
                        <td className="py-4 px-4 text-gray-700">{module.description}</td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${module.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                            {module.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center font-semibold text-[#1E5780]">{module.students}</td>
                        <td className="py-4 px-4">{module.lastUpdated}</td>
                        <td className="py-4 px-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                            <button
                              className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 font-semibold transition-colors"
                              onClick={() => openAssignModal(module)}
                            >
                              Assign
                            </button>
                            <button
                              className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 font-semibold transition-colors"
                              onClick={() => { setSelectedModule(module); setRequestOpen(true); }}
                            >
                              Request
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {modules.length === 0 && !isLoading && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-400">No modules found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {isModalOpen && (
            <div className="fixed inset-0 z-30 flex items-center justify-center bg-black bg-opacity-30">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 animate-fade-in border border-gray-100">
                <h2 className="text-xl font-bold mb-6">{modalMode === 'create' ? 'Create Module' : 'Edit Module'}</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Module Name</label>
                    <input
                      type="text"
                      name="title"
                      value={form.title}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780]"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Description</label>
                    <textarea
                      name="description"
                      value={form.description}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780]"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Status</label>
                    <select
                      name="status"
                      value={form.status}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780]"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-8">
                  <button
                    className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 font-semibold"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-[#1E5780] text-white hover:bg-[#164666] font-semibold"
                    onClick={handleSave}
                    disabled={!form.title.trim() || !form.description.trim()}
                  >
                    {modalMode === 'create' ? 'Create' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {isDeleteOpen && (
            <div className="fixed inset-0 z-30 flex items-center justify-center bg-black bg-opacity-30">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 animate-fade-in border border-gray-100">
                <h2 className="text-lg font-bold mb-4">Delete Module</h2>
                <p className="mb-6 text-gray-700">Are you sure you want to delete this module? This action cannot be undone.</p>
                <div className="flex justify-end gap-3">
                  <button
                    className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 font-semibold"
                    onClick={() => setIsDeleteOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-semibold"
                    onClick={handleDelete}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {requestOpen && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 animate-fade-in border border-gray-100">
                <h2 className="text-xl font-bold mb-6">Request to Admin: {selectedModule?.title}</h2>
                {requestError && <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700">{requestError}</div>}
                {requestSuccess && <div className="mb-4 p-3 rounded bg-green-50 border border-green-200 text-green-700">{requestSuccess}</div>}
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Category</label>
                    <select
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      value={requestCategory}
                      onChange={e => setRequestCategory(e.target.value)}
                    >
                      <option value="">Select category</option>
                      {requestCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Details</label>
                    <textarea
                      rows={4}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      placeholder="Describe your request"
                      value={requestDetails}
                      onChange={e => setRequestDetails(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-8">
                  <button
                    className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 font-semibold"
                    onClick={() => { setRequestOpen(false); setRequestCategory(''); setRequestDetails(''); setRequestError(''); setRequestSuccess(''); }}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 font-semibold disabled:opacity-50"
                    onClick={handleSendRequest}
                    disabled={!requestCategory || !requestDetails.trim()}
                  >
                    Send Request
                  </button>
                </div>
              </div>
            </div>
          )}

          {assignOpen && (
            <div className="fixed inset-0 z-30 flex items-center justify-center bg-black bg-opacity-30">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 animate-fade-in border border-gray-100">
                <h2 className="text-xl font-bold mb-6">Assign Module{selectedModule ? `: ${selectedModule.title}` : ''}</h2>
                {assignError && <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700">{assignError}</div>}
                {assignSuccess && <div className="mb-4 p-3 rounded bg-green-50 border border-green-200 text-green-700">{assignSuccess}</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Students</label>
                    <div className="max-h-56 overflow-y-auto border rounded-lg">
                      {studentsLoading ? (
                        <div className="p-4 text-gray-500">Loading students…</div>
                      ) : students.length === 0 ? (
                        <div className="p-4 text-gray-400">No students</div>
                      ) : (
                        <ul className="divide-y">
                          {students.map(s => {
                            const checked = assignForm.studentIds.includes(s.id);
                            return (
                              <li key={s.id} className="flex items-center gap-3 p-3 hover:bg-gray-50">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const next = new Set(assignForm.studentIds);
                                    if (e.target.checked) next.add(s.id); else next.delete(s.id);
                                    setAssignForm(prev => ({ ...prev, studentIds: Array.from(next) }));
                                  }}
                                />
                                <div>
                                  <div className="font-medium">{s.name}</div>
                                  <div className="text-xs text-gray-500">{s.email}</div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-700 font-semibold mb-1">Due Date (optional)</label>
                      <input
                        type="datetime-local"
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780]"
                        value={assignForm.dueDate}
                        onChange={(e) => setAssignForm(prev => ({ ...prev, dueDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-semibold mb-1">Notes (optional)</label>
                      <textarea
                        rows={5}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780]"
                        placeholder="Any special instructions"
                        value={assignForm.notes}
                        onChange={(e) => setAssignForm(prev => ({ ...prev, notes: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-8">
                  <button
                    className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 font-semibold"
                    onClick={() => setAssignOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-[#1E5780] text-white hover:bg-[#164666] font-semibold disabled:opacity-50"
                    onClick={async () => {
                      try {
                        setAssignError(''); setAssignSuccess('');
                        if (!selectedModule) { setAssignError('No module selected'); return; }
                        if (assignForm.studentIds.length === 0) { setAssignError('Select at least one student'); return; }
                        const payload = {
                          instructor_id: assignForm.instructorId || 0,
                          student_ids: assignForm.studentIds,
                          module_name: selectedModule.title,
                          module_slug: selectedModule.title.toLowerCase().replace(/\s+/g, '-'),
                          due_date: assignForm.dueDate || null,
                          notes: assignForm.notes || null,
                        };
                        const res = await fetch(apiUrl('/api/instructor/assignments'), {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', ...(user?.token ? { 'Authorization': `Bearer ${user.token}` } : {}) },
                          body: JSON.stringify(payload)
                        });
                        if (!res.ok) {
                          const text = await res.text();
                          throw new Error(text || 'Failed to create assignments');
                        }
                        const data = await res.json();
                        setAssignSuccess(`Assigned to ${data.created || assignForm.studentIds.length} student(s).`);
                        // Reset selection but keep modal open for visibility
                        setAssignForm(prev => ({ ...prev, studentIds: [] }));
                      } catch (e) {
                        setAssignError(String(e.message || e));
                      }
                    }}
                    disabled={studentsLoading}
                  >
                    Assign Module
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      {/* Request Modal moved outside delete conditional */}
      {requestOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 animate-fade-in border border-gray-100">
            <h2 className="text-xl font-bold mb-6">Request to Admin: {selectedModule?.title}</h2>
            {requestError && <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700">{requestError}</div>}
            {requestSuccess && <div className="mb-4 p-3 rounded bg-green-50 border border-green-200 text-green-700">{requestSuccess}</div>}
            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Category</label>
                <select
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  value={requestCategory}
                  onChange={e => setRequestCategory(e.target.value)}
                >
                  <option value="">Select category</option>
                  {requestCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Details</label>
                <textarea
                  rows={4}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Describe your request"
                  value={requestDetails}
                  onChange={e => setRequestDetails(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 font-semibold"
                onClick={() => { setRequestOpen(false); setRequestCategory(''); setRequestDetails(''); setRequestError(''); setRequestSuccess(''); }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 font-semibold disabled:opacity-50"
                onClick={handleSendRequest}
                disabled={!requestCategory || !requestDetails.trim()}
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageModules;
