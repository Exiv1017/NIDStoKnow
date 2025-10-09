import { useEffect, useState, useContext } from 'react';
import InstructorSidebar from '../../components/InstructorSidebar';
import AuthContext from '../../context/AuthContext';

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

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:8000/api/instructor/assignments?instructor_id=${user?.id || ''}`,
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
      const res = await fetch(`http://localhost:8000/api/instructor/assignments/${id}` ,{
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
      const res = await fetch(`http://localhost:8000/api/instructor/assignments/${id}`, {
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
      const res = await fetch('http://localhost:8000/api/instructor/feedback', {
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

  const filtered = items.filter(it => {
    const matchesQ = !filters.q || (it.moduleName?.toLowerCase().includes(filters.q.toLowerCase()) || it.studentName?.toLowerCase().includes(filters.q.toLowerCase()));
    const matchesStatus = filters.status === 'all' || it.status === filters.status;
    return matchesQ && matchesStatus;
  });

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
                      <select className="border rounded px-2 py-1" value={a.status} onChange={e => updateStatus(a.id, e.target.value)}>
                        <option value="assigned">Assigned</option>
                        <option value="in-progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="overdue">Overdue</option>
                      </select>
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
