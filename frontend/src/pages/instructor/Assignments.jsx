import { useEffect, useState, useContext, useMemo } from 'react';
import InstructorSidebar from '../../components/InstructorSidebar';
import AuthContext from '../../context/AuthContext';
import useModuleSummaries from '../../hooks/useModuleSummaries.js';

export default function Assignments() {
  const { user } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ q: '', status: 'all' });
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackTarget, setFeedbackTarget] = useState(null); // {id, studentId, studentName}
  const [toast, setToast] = useState('');

  const { summaries } = useModuleSummaries(user);

  const load = async () => {
    try {
      setLoading(true);
      const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
      const res = await fetch(`${API_BASE}/api/instructor/assignments?instructor_id=${user?.id || ''}`.replace(/([^:]?)\/\/+/g,'$1/'),
        { headers: user?.token ? { 'Authorization': `Bearer ${user.token}` } : {} }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Failed to load assignments');
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    try {
      const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
      const res = await fetch(`${API_BASE}/api/instructor/assignments/${id}`.replace(/([^:]?)\/\/+/g,'$1/') ,{
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(user?.token ? { 'Authorization': `Bearer ${user.token}` } : {}) },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Update failed');
      setItems(prev => prev.map(it => it.id === id ? { ...it, status } : it));
    } catch (e) { setError(String(e.message || e)); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this assignment?')) return;
    try {
      const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
      const res = await fetch(`${API_BASE}/api/instructor/assignments/${id}`.replace(/([^:]?)\/\/+/g,'$1/'), {
        method: 'DELETE',
        headers: user?.token ? { 'Authorization': `Bearer ${user.token}` } : {}
      });
      if (!res.ok) throw new Error('Delete failed');
      setItems(prev => prev.filter(it => it.id !== id));
    } catch (e) { setError(String(e.message || e)); }
  };

  const openFeedback = (assignment) => {
    setFeedbackTarget({ id: assignment.id, studentId: assignment.studentId, studentName: assignment.studentName || assignment.studentId, moduleName: assignment.moduleName });
    setFeedbackMsg('');
    setFeedbackOpen(true);
  };

  const submitFeedback = async () => {
    if (!feedbackTarget || !feedbackMsg.trim()) return;
    try {
      const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
      const res = await fetch(`${API_BASE}/api/instructor/feedback`.replace(/([^:]?)\/\/+/g,'$1/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.token ? { 'Authorization': `Bearer ${user.token}` } : {})
        },
        body: JSON.stringify({
          instructor_id: user?.id,
          student_id: feedbackTarget.studentId,
          assignment_id: feedbackTarget.id,
          message: feedbackMsg.trim()
        })
      });
      let data = null;
      try { data = await res.json(); } catch {}
      if (!res.ok) {
        const msg = (data && (data.detail || data.error)) || `Failed to send feedback (${res.status})`;
        throw new Error(msg);
      }
      setFeedbackOpen(false);
      setToast('Feedback sent');
      setTimeout(() => setToast(''), 2500);
    } catch (e) {
      setError(String(e.message || e));
    }
  };

  const filtered = useMemo(() => {
    const normalize = (val) => {
      if (val == null) return '';
      const s = String(val).trim().toLowerCase().replace(/[ _]+/g, '-');
      if (s === 'in-progress' || s === 'inprogress') return 'in-progress';
      if (s === 'complete') return 'completed';
      if (s === 'past-due' || s === 'past_due') return 'overdue';
      return s;
    };

    const getProgress = (it) => {
      if (!it) return 0;
      const candidates = [it.comprehensiveProgress, it.progressPercent, it.progress, it.percent, it.percentage, it.percentComplete];
      for (const c of candidates) {
        if (c == null) continue;
        const n = Number(String(c).replace('%','').trim());
        if (!Number.isNaN(n)) return n;
      }
      // fall back to summaries when available
      try {
        if (summaries) {
          if (it.moduleSlug && summaries[it.moduleSlug] && typeof summaries[it.moduleSlug].percent === 'number') return summaries[it.moduleSlug].percent;
          const vals = Object.values(summaries || {});
          const nameMatch = vals.find(s => (s.display_name === it.moduleName) || (s.module_name === it.moduleName));
          if (nameMatch && typeof nameMatch.percent === 'number') return nameMatch.percent;
        }
      } catch {}
      return 0;
    };

    const computeDerived = (it) => {
      const p = getProgress(it) || 0;
      if (p >= 100) return 'completed';
      if (p > 0) return 'in-progress';
      return 'assigned';
    };

    const toDate = (d) => {
      if (!d) return null;
      const s = String(d).replace(' ', 'T');
      const t = Date.parse(s);
      return isNaN(t) ? null : t;
    };

    const now = Date.now();

    const mapped = items.map(a => {
      const norm = normalize(a.status);
      const derived = computeDerived(a);
      const dueTs = toDate(a.dueDate);
      let display = derived;
      if (norm === 'overdue') display = 'overdue';
      else if (derived !== 'completed' && dueTs != null && dueTs < now) display = 'overdue';
      return { ...a, _derivedStatus: derived, _displayStatus: display };
    });

    const base = mapped.filter(it => {
      const matchesQ = !filters.q || (it.moduleName?.toLowerCase().includes(filters.q.toLowerCase()) || it.studentName?.toLowerCase().includes(filters.q.toLowerCase()));
      const matchesStatus = filters.status === 'all' || it._displayStatus === filters.status;
      return matchesQ && matchesStatus;
    });

    return base;
  }, [items, filters, summaries]);

  return (
    <div className="min-h-screen bg-white">
      <InstructorSidebar />
      <main className="ml-64 p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Assignments</h1>
          <div className="flex gap-2">
            <input className="border rounded px-3 py-2" placeholder="Search student/module" value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} />
              <select className="border rounded px-3 py-2" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
              <option value="all">All</option>
              <option value="assigned">Assigned</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
              <button onClick={load} className="px-3 py-2 border rounded hover:bg-gray-50">Refresh</button>
          </div>
        </div>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded">{error}</div>}
        {loading ? (
          <div>Loading…</div>
        ) : (
          <div className="bg-white border rounded shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Student</th>
                  <th className="text-left py-3 px-4">Module</th>
                  <th className="text-left py-3 px-4">Due</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Notes</th>
                  <th className="text-left py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} className="border-b">
                    <td className="py-3 px-4">{a.studentName || a.studentId}</td>
                    <td className="py-3 px-4">{a.moduleName}</td>
                    <td className="py-3 px-4">{a.dueDate ? String(a.dueDate).replace('T',' ').slice(0,16) : '-'}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          (a._displayStatus === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          a._displayStatus === 'in-progress' ? 'bg-amber-100 text-amber-700' :
                          a._displayStatus === 'overdue' ? 'bg-rose-100 text-rose-700' :
                          'bg-slate-100 text-slate-700')
                        }`}>{a._displayStatus || a.status}</span>
                        <select className="border rounded px-2 py-1" value={a.status} onChange={e => updateStatus(a.id, e.target.value)}>
                          <option value="assigned">Assigned</option>
                          <option value="in-progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="overdue">Overdue</option>
                        </select>
                      </div>
                    </td>
                    <td className="py-3 px-4">{a.notes || ''}</td>
                    <td className="py-3 px-4 space-x-2">
                      <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200" onClick={() => openFeedback(a)}>Feedback</button>
                      <button className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200" onClick={() => remove(a.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td className="py-6 text-center text-gray-400" colSpan={6}>No assignments found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
      {toast && (
        <div className="fixed bottom-4 right-4 bg-black text-white text-sm px-3 py-2 rounded shadow">{toast}</div>
      )}

      {feedbackOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-xl w-full max-w-md">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Feedback</h3>
              <p className="text-sm text-gray-500 mt-1">To {feedbackTarget?.studentName} — {feedbackTarget?.moduleName}</p>
            </div>
            <div className="p-4 space-y-3">
              <textarea
                className="w-full border rounded p-2 h-28"
                placeholder="Write feedback..."
                value={feedbackMsg}
                onChange={(e) => setFeedbackMsg(e.target.value)}
              />
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button className="px-3 py-1.5 border rounded" onClick={() => setFeedbackOpen(false)}>Cancel</button>
              <button className="px-3 py-1.5 bg-blue-600 text-white rounded disabled:opacity-50" disabled={!feedbackMsg.trim()} onClick={submitFeedback}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
