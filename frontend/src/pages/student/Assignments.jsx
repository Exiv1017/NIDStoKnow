import { useEffect, useMemo, useState, useContext } from 'react';
import Sidebar from '../../components/Sidebar';
import AuthContext from '../../context/AuthContext';

export default function StudentAssignments() {
  const { user } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState([]);
  const [loadingFb, setLoadingFb] = useState(false);

  // UI helpers
  const formatDue = (val) => {
    if (!val) return '-';
    try {
      // Accept "YYYY-MM-DD HH:MM:SS" or ISO strings
      const s = String(val).replace(' ', 'T');
      const d = new Date(s);
      if (isNaN(d.getTime())) return String(val).replace('T', ' ').slice(0, 16);
      return new Intl.DateTimeFormat(undefined, {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      }).format(d);
    } catch {
      return String(val).replace('T', ' ').slice(0, 16);
    }
  };

  const StatusBadge = ({ value }) => {
    const normStatus = (val) => {
      if (val == null) return '';
      const s = String(val).trim().toLowerCase();
      // Replace spaces/underscores with hyphen and collapse repeats
      const hy = s.replace(/[ _]+/g, '-');
      // Map common variants
      if (hy === 'in-progress' || hy === 'inprogress') return 'in-progress';
      if (hy === 'assigned') return 'assigned';
      if (hy === 'completed' || hy === 'complete') return 'completed';
      if (hy === 'overdue' || hy === 'past-due' || hy === 'past_due') return 'overdue';
      return hy;
    };
    const v = normStatus(value);
    const styles = {
      assigned: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
      'in-progress': 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
      completed: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
      overdue: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
    };
    const cls = styles[v] || 'bg-gray-50 text-gray-700 ring-1 ring-gray-200';
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
        {value || '—'}
      </span>
    );
  };

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const headers = user?.token ? { 'Authorization': `Bearer ${user.token}` } : {};
  const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
  let res = await fetch(`${API_BASE}/api/student/assignments?student_id=${user.id}`.replace(/([^:]?)\/\/+/g,'$1/'), { headers });
      let data = null;
      try { data = await res.json(); } catch {}
      if (res.status === 404) {
  res = await fetch(`${API_BASE}/api/student/assignments/list?student_id=${user.id}`.replace(/([^:]?)\/\/+/g,'$1/'), { headers });
        try { data = await res.json(); } catch {}
      }
      if (res.status === 404) {
  res = await fetch(`${API_BASE}/api/student/${user.id}/assignments`.replace(/([^:]?)\/\/+/g,'$1/'), { headers });
        try { data = await res.json(); } catch {}
      }
      if (!res.ok) {
        const message = (data && (data.detail || data.error)) || `${res.status} ${res.statusText}`;
        throw new Error(message);
      }
      const arr = Array.isArray(data) ? data : [];
      // Minimal debug: log distinct statuses received
      try {
        const distinct = Array.from(new Set(arr.map(a => String(a.status || '').toLowerCase())));
        console.debug('[StudentAssignments] fetched', arr.length, 'items; statuses=', distinct);
      } catch {}
      setItems(arr);
      setError('');
    } catch (e) {
      setError(String(e.message || e));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!user?.id) return; // wait until we have a logged-in student
    fetchAssignments();
  }, [user?.id]);

  const loadFeedback = async () => {
    if (!user?.id) return;
    try {
      setLoadingFb(true);
      const headers = user?.token ? { 'Authorization': `Bearer ${user.token}` } : {};
  const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
  const res = await fetch(`${API_BASE}/api/student/feedback?student_id=${user.id}`.replace(/([^:]?)\/\/+/g,'$1/'), { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Failed to load feedback');
      setFeedback(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('feedback load error', e);
      setFeedback([]);
    } finally {
      setLoadingFb(false);
    }
  };

  const filtered = useMemo(() => {
    const base = Array.isArray(items) ? items : [];
    const normalize = (val) => {
      if (val == null) return '';
      const s = String(val).trim().toLowerCase().replace(/[ _]+/g, '-');
      if (s === 'in-progress' || s === 'inprogress') return 'in-progress';
      if (s === 'complete') return 'completed';
      if (s === 'past-due' || s === 'past_due') return 'overdue';
      return s;
    };

    // derive progress number from multiple possible fields
    const getProgress = (it) => {
      if (!it) return 0;
      const candidates = [
        it.comprehensiveProgress,
        it.progressPercent,
        it.progress,
        it.percent,
        it.percentage,
        it.percentComplete,
      ];
      for (const c of candidates) {
        if (c == null) continue;
        const n = Number(String(c).replace('%', '').trim());
        if (!Number.isNaN(n)) return n;
      }
      return 0;
    };

    const computeDerived = (it) => {
      const p = getProgress(it) || 0;
      if (p >= 100) return 'completed';
      if (p > 0) return 'in-progress';
      return 'assigned';
    };

    const now = Date.now();
    const toDate = (d) => {
      if (!d) return null;
      const s = String(d).replace(' ', 'T');
      const t = Date.parse(s);
      return isNaN(t) ? null : t;
    };

    // Map items to include derived statuses and a final display status (backend overdue wins)
    const mapped = base.map(a => {
      const norm = normalize(a.status);
      const derived = computeDerived(a);
      const dueTs = toDate(a.dueDate);
      let display = derived;
      if (norm === 'overdue') display = 'overdue';
      else if (derived !== 'completed' && dueTs != null && dueTs < now) display = 'overdue';
      return { ...a, _derivedStatus: derived, _displayStatus: display };
    });

    const byStatus = statusFilter === 'all' ? mapped : mapped.filter(a => a._displayStatus === statusFilter);

    // Sort by due date ascending (nulls last)
    return [...byStatus].sort((a, b) => {
      const da = toDate(a.dueDate); const db = toDate(b.dueDate);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
  }, [items, statusFilter]);

  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <main className="pl-3 pr-6 py-6 sm:pl-4">
        <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold">My Assignments</h1>
            <p className="text-sm text-gray-500 mt-1">Track what’s assigned to you and upcoming due dates.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md shadow-sm" role="group">
              {[{k:'all',l:'All'},{k:'assigned',l:'Assigned'},{k:'in-progress',l:'In-progress'},{k:'completed',l:'Completed'},{k:'overdue',l:'Overdue'}].map(({k,l}) => (
                <button
                  key={k}
                  onClick={() => setStatusFilter(k)}
                  className={`px-3 py-1.5 text-sm border first:rounded-l-md last:rounded-r-md ${statusFilter===k? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'}`}
                  title={k === 'all' ? 'Show all' : `Filter ${l}`}
                >{l.replace('-', ' ')}</button>
              ))}
            </div>
            <button onClick={fetchAssignments} className="ml-1 px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50">Refresh</button>
            <button onClick={() => { setShowFeedback(v=>!v); if (!showFeedback) loadFeedback(); }} className="ml-1 px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50">{showFeedback ? 'Hide' : 'View'} Feedback</button>
          </div>
        </div>
        {error && error.toLowerCase().includes('not found') ? (
          <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded">No assignments endpoint found. Please refresh after backend restarts.</div>
        ) : error ? (
          <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded">{error}</div>
        ) : null}
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_,i) => (
              <div key={i} className="h-16 bg-gray-100 animate-pulse rounded" />
            ))}
          </div>
        ) : (
          <>
            {showFeedback && (
              <div className="mb-6 bg-white border rounded shadow-sm">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <div className="font-semibold">Instructor Feedback</div>
                  <button className="text-sm text-blue-600" onClick={loadFeedback}>Refresh</button>
                </div>
                <div className="p-4">
                  {loadingFb ? (
                    <div className="text-sm text-gray-500">Loading feedback…</div>
                  ) : feedback.length === 0 ? (
                    <div className="text-sm text-gray-500">No feedback yet.</div>
                  ) : (
                    <ul className="space-y-3">
                      {feedback.map(f => (
                        <li key={f.id} className="border rounded p-3">
                          <div className="text-sm text-gray-500">{new Date(f.createdAt || Date.now()).toLocaleString()}</div>
                          <div className="mt-1 text-gray-800">{f.message}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
            {/* Table for md+ screens */}
            <div className="hidden md:block bg-white border rounded shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4">Module</th>
                    <th className="text-left py-3 px-4">Due</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => (
                    <tr key={a.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{a.moduleName}</td>
                      <td className="py-3 px-4">{formatDue(a.dueDate)}</td>
                      <td className="py-3 px-4"><StatusBadge value={a._displayStatus || a.status} /></td>
                      <td className="py-3 px-4 text-gray-600">{a.notes || ''}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td className="py-10 text-center text-gray-400" colSpan={4}>No assignments match this filter.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Cards for small screens */}
            <div className="md:hidden space-y-3">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-gray-500 border rounded">No assignments match this filter.</div>
              ) : (
                filtered.map(a => (
                  <div key={a.id} className="border rounded p-4 bg-white shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm text-gray-500">Module</div>
                        <div className="font-medium">{a.moduleName}</div>
                      </div>
                      <StatusBadge value={a._displayStatus || a.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-gray-500">Due</div>
                        <div>{formatDue(a.dueDate)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Notes</div>
                        <div className="text-gray-700">{a.notes || '—'}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
