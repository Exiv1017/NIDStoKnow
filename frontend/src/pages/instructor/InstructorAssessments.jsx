import { useEffect, useState, useContext, useMemo } from 'react';
import InstructorSidebar from '../../components/InstructorSidebar';
import AuthContext from '../../context/AuthContext';

/*
  Unified Instructor Assessments Page
  Combines previous Assignments.jsx (assignment management + feedback)
  and Submissions.jsx (student submissions list) into a single tabbed interface.
*/
export default function InstructorAssessments() {
  const { user } = useContext(AuthContext);
  // Assignments state
  const [assignments, setAssignments] = useState([]);
  const [assignLoading, setAssignLoading] = useState(true);
  const [assignError, setAssignError] = useState('');
  const [assignFilters, setAssignFilters] = useState({ q: '', status: 'all' });
  const [assignSearchRaw, setAssignSearchRaw] = useState(''); // debounced input
  const [assignSort, setAssignSort] = useState('due'); // due | student | module | status
  const [assignSortDir, setAssignSortDir] = useState('asc'); // asc | desc
  // Feedback modal
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackTarget, setFeedbackTarget] = useState(null);
  const [toast, setToast] = useState('');

  // Submissions state
  const [subs, setSubs] = useState([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [subsError, setSubsError] = useState(null);
  const [subsQuery, setSubsQuery] = useState('');
  const [subsSearchRaw, setSubsSearchRaw] = useState('');
  const [subsSort, setSubsSort] = useState('when'); // when | student | module | type
  const [subsSortDir, setSubsSortDir] = useState('desc');
  const [subsType, setSubsType] = useState('all');

  const [activeTab, setActiveTab] = useState('assignments'); // 'assignments' | 'submissions'

  // Fetch assignments
  const loadAssignments = async () => {
    try {
      setAssignLoading(true);
      const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
      const res = await fetch(`${API_BASE}/api/instructor/assignments?instructor_id=${user?.id || ''}`.replace(/([^:]?)\/\/+/g,'$1/'),
        { headers: user?.token ? { 'Authorization': `Bearer ${user.token}` } : {} }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Failed to load assignments');
      setAssignments(Array.isArray(data) ? data : []);
      setAssignError('');
    } catch (e) {
      setAssignError(String(e.message || e));
    } finally { setAssignLoading(false); }
  };

  // Fetch submissions
  const loadSubmissions = async () => {
    try {
      setSubsLoading(true);
      const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
      const res = await fetch(`${API_BASE}/api/instructor/submissions`.replace(/([^:]?)\/\/+/g,'$1/'));
      if (!res.ok) throw new Error('Failed to fetch submissions');
      const data = await res.json();
      setSubs(Array.isArray(data) ? data : []);
      setSubsError(null);
    } catch (e) { setSubsError(e.message); } finally { setSubsLoading(false); }
  };

  useEffect(() => { loadAssignments(); loadSubmissions(); }, []);

  // Debounce assignment search
  useEffect(() => {
    const t = setTimeout(() => setAssignFilters(f => ({ ...f, q: assignSearchRaw })), 300);
    return () => clearTimeout(t);
  }, [assignSearchRaw]);

  // Debounce submissions search
  useEffect(() => {
    const t = setTimeout(() => setSubsQuery(subsSearchRaw), 300);
    return () => clearTimeout(t);
  }, [subsSearchRaw]);

  // Assignment actions
  const updateStatus = async (id, status) => {
    try {
      const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
      const res = await fetch(`${API_BASE}/api/instructor/assignments/${id}`.replace(/([^:]?)\/\/+/g,'$1/'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(user?.token ? { 'Authorization': `Bearer ${user.token}` } : {}) },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Update failed');
      setAssignments(prev => prev.map(it => it.id === id ? { ...it, status } : it));
    } catch (e) { setAssignError(String(e.message || e)); }
  };

  const removeAssignment = async (id) => {
    if (!confirm('Delete this assignment?')) return;
    try {
      const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
      const res = await fetch(`${API_BASE}/api/instructor/assignments/${id}`.replace(/([^:]?)\/\/+/g,'$1/'), {
        method: 'DELETE',
        headers: user?.token ? { 'Authorization': `Bearer ${user.token}` } : {}
      });
      if (!res.ok) throw new Error('Delete failed');
      setAssignments(prev => prev.filter(it => it.id !== id));
    } catch (e) { setAssignError(String(e.message || e)); }
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
        headers: { 'Content-Type': 'application/json', ...(user?.token ? { 'Authorization': `Bearer ${user.token}` } : {}) },
        body: JSON.stringify({
          instructor_id: user?.id,
          student_id: feedbackTarget.studentId,
          assignment_id: feedbackTarget.id,
          message: feedbackMsg.trim()
        })
      });
      let data = null; try { data = await res.json(); } catch {}
      if (!res.ok) throw new Error((data && (data.detail || data.error)) || `Failed to send feedback (${res.status})`);
      setFeedbackOpen(false);
      setToast('Feedback sent');
      setTimeout(() => setToast(''), 2500);
    } catch (e) { setAssignError(String(e.message || e)); }
  };

  // Filters
  const filteredAssignments = useMemo(() => {
    const base = assignments.filter(it => {
      const matchesQ = !assignFilters.q || (it.moduleName?.toLowerCase().includes(assignFilters.q.toLowerCase()) || it.studentName?.toLowerCase().includes(assignFilters.q.toLowerCase()));
      const matchesStatus = assignFilters.status === 'all' || it.status === assignFilters.status;
      return matchesQ && matchesStatus;
    });
    const dir = assignSortDir === 'asc' ? 1 : -1;
    return [...base].sort((a,b) => {
      const av = assignSort === 'due' ? (a.dueDate || '') : assignSort === 'student' ? (a.studentName || a.studentId || '') : assignSort === 'module' ? (a.moduleName || '') : (a.status || '');
      const bv = assignSort === 'due' ? (b.dueDate || '') : assignSort === 'student' ? (b.studentName || b.studentId || '') : assignSort === 'module' ? (b.moduleName || '') : (b.status || '');
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [assignments, assignFilters, assignSort, assignSortDir]);

  const assignmentCounts = useMemo(() => {
    const counts = { total: assignments.length, assigned:0, 'in-progress':0, completed:0, overdue:0 };
    assignments.forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++; });
    return counts;
  }, [assignments]);

  const filteredSubs = useMemo(() => {
    const base = subs.filter(s => {
      const matchesQ = subsQuery.trim() === '' || `${s.studentName} ${s.moduleTitle} ${s.moduleSlug}`.toLowerCase().includes(subsQuery.toLowerCase());
      const matchesType = subsType === 'all' || s.submissionType === subsType;
      return matchesQ && matchesType;
    });
    const dir = subsSortDir === 'asc' ? 1 : -1;
    return [...base].sort((a,b) => {
      const av = subsSort === 'when' ? (a.createdAt || '') : subsSort === 'student' ? (a.studentName || '') : subsSort === 'module' ? (a.moduleTitle || '') : (a.submissionType || '');
      const bv = subsSort === 'when' ? (b.createdAt || '') : subsSort === 'student' ? (b.studentName || '') : subsSort === 'module' ? (b.moduleTitle || '') : (b.submissionType || '');
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [subs, subsQuery, subsType, subsSort, subsSortDir]);

  const toggleAssignSort = (field) => {
    setAssignSort(prev => prev === field ? prev : field);
    setAssignSortDir(prev => assignSort === field ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
  };

  const toggleSubsSort = (field) => {
    setSubsSort(prev => prev === field ? prev : field);
    setSubsSortDir(prev => subsSort === field ? (prev === 'asc' ? 'desc' : 'asc') : (field === 'when' ? 'desc' : 'asc'));
  };

  const Badge = ({ status }) => {
    const map = {
      'assigned': 'bg-slate-100 text-slate-700',
      'in-progress': 'bg-amber-100 text-amber-700',
      'completed': 'bg-emerald-100 text-emerald-700',
      'overdue': 'bg-rose-100 text-rose-700'
    };
    return <span className={`px-2 py-0.5 text-xs font-medium rounded ${map[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>;
  };

  const TypeBadge = ({ type }) => {
    const map = {
      practical: 'bg-indigo-100 text-indigo-700',
      assessment: 'bg-teal-100 text-teal-700',
      simulation: 'bg-purple-100 text-purple-700'
    };
    return <span className={`px-2 py-0.5 text-xs font-medium rounded capitalize ${map[type] || 'bg-gray-100 text-gray-600'}`}>{type}</span>;
  };

  const SkeletonRows = ({ cols, rows=5 }) => (
    <tbody>
      {Array.from({ length: rows }).map((_,i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: cols }).map((__,j) => (
            <td key={j} className="py-3 px-4"><div className="h-3 rounded bg-gray-200 w-full" /></td>
          ))}
        </tr>
      ))}
    </tbody>
  );

  return (
    <div className="min-h-screen bg-white">
      <InstructorSidebar />
      <main className="ml-64 p-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <h1 className="text-2xl font-bold">Instructor Assessments</h1>
          <div className="flex border rounded overflow-hidden">
            <button onClick={() => setActiveTab('assignments')} className={`px-4 py-2 text-sm font-medium ${activeTab==='assignments' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}`}>Assignments</button>
            <button onClick={() => setActiveTab('submissions')} className={`px-4 py-2 text-sm font-medium ${activeTab==='submissions' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}`}>Submissions</button>
          </div>
        </div>

        {activeTab === 'assignments' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 rounded-lg border bg-white">
                <div className="text-xs text-gray-500">Total</div>
                <div className="text-lg font-semibold">{assignmentCounts.total}</div>
              </div>
              <div className="p-3 rounded-lg border bg-white">
                <div className="text-xs text-gray-500">Assigned</div>
                <div className="text-lg font-semibold">{assignmentCounts.assigned}</div>
              </div>
              <div className="p-3 rounded-lg border bg-white">
                <div className="text-xs text-gray-500">In Progress</div>
                <div className="text-lg font-semibold">{assignmentCounts['in-progress']}</div>
              </div>
              <div className="p-3 rounded-lg border bg-white">
                <div className="text-xs text-gray-500">Completed</div>
                <div className="text-lg font-semibold text-emerald-600">{assignmentCounts.completed}</div>
              </div>
              <div className="p-3 rounded-lg border bg-white">
                <div className="text-xs text-gray-500">Overdue</div>
                <div className="text-lg font-semibold text-rose-600">{assignmentCounts.overdue}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <input className="border rounded px-3 py-2 w-64" placeholder="Search student/module" value={assignSearchRaw} onChange={e => setAssignSearchRaw(e.target.value)} />
              <select className="border rounded px-3 py-2" value={assignFilters.status} onChange={e => setAssignFilters({ ...assignFilters, status: e.target.value })}>
                <option value="all">All Statuses</option>
                <option value="assigned">Assigned</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
              </select>
              <div className="flex items-center gap-1 text-sm text-gray-500 ml-auto">
                <span>Sort:</span>
                {['due','student','module','status'].map(f => (
                  <button key={f} onClick={() => toggleAssignSort(f)} className={`px-2 py-1 rounded border text-xs ${assignSort===f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'}`}>{f.charAt(0).toUpperCase() + f.slice(1)}{assignSort===f ? (assignSortDir==='asc' ? ' ↑' : ' ↓') : ''}</button>
                ))}
              </div>
              <button onClick={loadAssignments} className="px-3 py-2 border rounded hover:bg-gray-50">Refresh</button>
            </div>
            {assignError && <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded">{assignError}</div>}
            <div className="bg-white border rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/60">
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Student</th>
                    <th className="text-left py-3 px-4">Module</th>
                    <th className="text-left py-3 px-4">Due</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Notes</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                {assignLoading ? <SkeletonRows cols={6} rows={6} /> : (
                  <tbody>
                    {filteredAssignments.map(a => (
                      <tr key={a.id} className="border-b last:border-b-0 hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-medium">{a.studentName || a.studentId}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">{a.moduleName}</td>
                        <td className="py-3 px-4 whitespace-nowrap text-xs text-gray-600">{a.dueDate ? String(a.dueDate).replace('T',' ').slice(0,16) : '-'}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Badge status={a.status} />
                            <select aria-label="Update status" className="border rounded px-2 py-1 text-xs" value={a.status} onChange={e => updateStatus(a.id, e.target.value)}>
                              <option value="assigned">Assigned</option>
                              <option value="in-progress">In Progress</option>
                              <option value="completed">Completed</option>
                              <option value="overdue">Overdue</option>
                            </select>
                          </div>
                        </td>
                        <td className="py-3 px-4 max-w-xs text-gray-600">{a.notes || ''}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex gap-2">
                            <button className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs" onClick={() => openFeedback(a)}>Feedback</button>
                            <button className="px-2.5 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs" onClick={() => removeAssignment(a.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(!assignLoading && filteredAssignments.length === 0) && (
                      <tr><td className="py-10 text-center text-gray-400 text-sm" colSpan={6}>No assignments match your filters.</td></tr>
                    )}
                  </tbody>
                )}
              </table>
            </div>
          </div>
        )}

        {activeTab === 'submissions' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <input value={subsSearchRaw} onChange={e=>setSubsSearchRaw(e.target.value)} placeholder="Search student/module" className="px-3 py-2 border rounded w-64" />
              <select value={subsType} onChange={e=>setSubsType(e.target.value)} className="px-3 py-2 border rounded">
                <option value="all">All Types</option>
                <option value="practical">Practical</option>
                <option value="assessment">Assessment</option>
                <option value="simulation">Simulation</option>
              </select>
              <div className="flex items-center gap-1 text-sm text-gray-500 ml-auto">
                <span>Sort:</span>
                {['when','student','module','type'].map(f => (
                  <button key={f} onClick={() => toggleSubsSort(f)} className={`px-2 py-1 rounded border text-xs ${subsSort===f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'}`}>{f.charAt(0).toUpperCase() + f.slice(1)}{subsSort===f ? (subsSortDir==='asc' ? ' ↑' : ' ↓') : ''}</button>
                ))}
              </div>
              <button onClick={loadSubmissions} className="px-3 py-2 border rounded hover:bg-gray-50">Refresh</button>
            </div>
            <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/60">
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">When</th>
                    <th className="text-left py-3 px-4">Student</th>
                    <th className="text-left py-3 px-4">Module</th>
                    <th className="text-left py-3 px-4">Type</th>
                    <th className="text-left py-3 px-4">Rules</th>
                    <th className="text-left py-3 px-4">Matches</th>
                    <th className="text-left py-3 px-4">Attacker Pts</th>
                    <th className="text-left py-3 px-4">Defender Pts</th>
                  </tr>
                </thead>
                {subsLoading ? <SkeletonRows cols={8} rows={6} /> : (
                  <tbody>
                    {filteredSubs.map(s => (
                      <tr key={s.id} className="border-b last:border-b-0 hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap text-xs text-gray-600">{new Date(s.createdAt).toLocaleString()}</td>
                        <td className="py-3 px-4 font-medium whitespace-nowrap">{s.studentName}</td>
                        <td className="py-3 px-4 whitespace-nowrap">{s.moduleTitle}</td>
                        <td className="py-3 px-4 whitespace-nowrap"><TypeBadge type={s.submissionType} /></td>
                        <td className="py-3 px-4">{s.ruleCount ?? '-'}</td>
                        <td className="py-3 px-4">{s.totalMatches ?? '-'}</td>
                        <td className="py-3 px-4 whitespace-nowrap">{s.attackerScore ?? '-'}</td>
                        <td className="py-3 px-4 whitespace-nowrap">{s.defenderScore ?? '-'}</td>
                      </tr>
                    ))}
                    {(!subsLoading && filteredSubs.length === 0) && (
                      <tr><td colSpan={8} className="py-10 text-center text-gray-400 text-sm">No submissions match your filters.</td></tr>
                    )}
                  </tbody>
                )}
              </table>
            </div>
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
              <textarea className="w-full border rounded p-2 h-28" placeholder="Write feedback..." value={feedbackMsg} onChange={(e) => setFeedbackMsg(e.target.value)} />
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
