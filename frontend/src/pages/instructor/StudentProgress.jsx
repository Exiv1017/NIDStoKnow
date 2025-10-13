import React, { useState, useEffect, useMemo } from 'react';
import InstructorSidebar from '../../components/InstructorSidebar';

const StudentProgress = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchRaw, setSearchRaw] = useState('');
  const [search, setSearch] = useState(''); // debounced
  const [sortField, setSortField] = useState('name'); // name | progress | lastActive | lastSubmission
  const [sortDir, setSortDir] = useState('asc');
  const [quickFilter, setQuickFilter] = useState('all'); // all | at-risk | inactive | completed
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch students data from backend
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
  const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
  const response = await fetch(`${API_BASE}/api/instructor/students-summary`.replace(/([^:]?)\/\/+/g,'$1/'));
        if (!response.ok) {
          throw new Error('Failed to fetch student data');
        }
        const data = await response.json();
        setStudents(data);
        setError(null);
      } catch (err) {
        setError(err.message);
        console.error('Error fetching students:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchRaw.trim()), 300);
    return () => clearTimeout(t);
  }, [searchRaw]);

  const processedStudents = useMemo(() => {
    const now = Date.now();
    const fourteenDays = 14 * 24 * 3600 * 1000;
    const sevenDays = 7 * 24 * 3600 * 1000;
    const base = students.filter(s => {
      const matches = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
      if (!matches) return false;
      // Quick filters
      if (quickFilter === 'at-risk' && !(Number(s.progress) < 30)) return false;
      if (quickFilter === 'inactive') {
        const last = Date.parse(s.lastActive || '') || 0;
        if (!(last && (now - last) > fourteenDays)) return false;
      }
      if (quickFilter === 'completed' && Number(s.progress) !== 100) return false;
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...base].sort((a,b) => {
      let av, bv;
      if (sortField === 'progress') { av = Number(a.progress)||0; bv = Number(b.progress)||0; }
      else if (sortField === 'lastActive') { av = Date.parse(a.lastActive || '') || 0; bv = Date.parse(b.lastActive || '') || 0; }
      else if (sortField === 'lastSubmission') { av = Date.parse(a.lastSubmission || '') || 0; bv = Date.parse(b.lastSubmission || '') || 0; }
      else { av = (a.name || '').toLowerCase(); bv = (b.name || '').toLowerCase(); }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [students, search, sortField, sortDir, quickFilter]);

  const stats = useMemo(() => {
    if (!students.length) return { total:0, avg:0, completed:0, active7:0 };
    const now = Date.now();
    const sevenDays = 7 * 24 * 3600 * 1000;
    let sum=0, completed=0, active7=0;
    students.forEach(s => {
      const p = Number(s.progress)||0; sum+=p; if (p===100) completed++; const last = Date.parse(s.lastActive || '') || 0; if (last && (now-last) <= sevenDays) active7++; });
    return { total: students.length, avg: Math.round(sum/students.length), completed, active7 };
  }, [students]);

  const toggleSort = (field) => {
    setSortField(prev => prev === field ? prev : field);
    setSortDir(prev => (sortField === field ? (prev === 'asc' ? 'desc' : 'asc') : (field === 'name' ? 'asc' : 'desc')));
  };

  const sortIndicator = (field) => sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : '';

  const openModal = (student) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-white">
      <InstructorSidebar />
      <main className="ml-64 overflow-y-auto">
        <div className="p-4 sm:p-8">
          <div className="flex flex-col gap-6 mb-10">
            <div className="flex flex-col xl:flex-row xl:items-center gap-6 justify-between">
              <h1 className="text-3xl font-bold tracking-tight">Student Progress</h1>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full xl:w-auto">
                <input
                  type="text"
                  placeholder="Search name or email..."
                  value={searchRaw}
                  onChange={e => setSearchRaw(e.target.value)}
                  className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780] w-full sm:w-72"
                />
                <div className="flex gap-1 bg-white border rounded-lg p-1 overflow-hidden">
                  {['all','at-risk','inactive','completed'].map(f => (
                    <button key={f} onClick={()=>setQuickFilter(f)} className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${quickFilter===f? 'bg-[#1E5780] text-white shadow': 'text-gray-600 hover:bg-gray-100'}`}>{f.replace('-',' ')}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="p-4 rounded-xl border bg-white shadow-sm">
                <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Total Students</div>
                <div className="mt-2 text-2xl font-bold text-gray-800">{stats.total}</div>
              </div>
              <div className="p-4 rounded-xl border bg-white shadow-sm">
                <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Avg Progress</div>
                <div className="mt-2 text-2xl font-bold text-[#1E5780]">{stats.avg}%</div>
              </div>
              <div className="p-4 rounded-xl border bg-white shadow-sm">
                <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Completed</div>
                <div className="mt-2 text-2xl font-bold text-emerald-600">{stats.completed}</div>
              </div>
              <div className="p-4 rounded-xl border bg-white shadow-sm">
                <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Active (7d)</div>
                <div className="mt-2 text-2xl font-bold text-indigo-600">{stats.active7}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-md border border-gray-100">
            <div className="p-6 overflow-x-auto">
              {loading ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Student Name</th>
                      <th className="text-left py-3 px-4">Email</th>
                      <th className="text-left py-3 px-4">Overall Progress</th>
                      <th className="text-left py-3 px-4">Completed Modules</th>
                      <th className="text-left py-3 px-4">Last Active</th>
                      <th className="text-left py-3 px-4">Last Submission</th>
                      <th className="text-left py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 6 }).map((_,i) => (
                      <tr key={i} className="border-b animate-pulse">
                        {Array.from({ length: 7 }).map((__,j)=>(
                          <td key={j} className="py-4 px-4"><div className="h-3 rounded bg-gray-200 w-full" /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-red-600 mb-4">Error loading student data: {error}</p>
                  <button 
                    onClick={() => window.location.reload()} 
                    className="px-4 py-2 bg-[#1E5780] text-white rounded-lg hover:bg-[#164666]"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 cursor-pointer select-none" onClick={()=>toggleSort('name')}>Student {sortIndicator('name')}</th>
                      <th className="text-left py-3 px-4">Email</th>
                      <th className="text-left py-3 px-4 cursor-pointer select-none" onClick={()=>toggleSort('progress')}>Overall Progress {sortIndicator('progress')}</th>
                      <th className="text-left py-3 px-4">Completed Modules</th>
                      <th className="text-left py-3 px-4 cursor-pointer select-none" onClick={()=>toggleSort('lastActive')}>Last Active {sortIndicator('lastActive')}</th>
                      <th className="text-left py-3 px-4 cursor-pointer select-none" onClick={()=>toggleSort('lastSubmission')}>Last Submission {sortIndicator('lastSubmission')}</th>
                      <th className="text-left py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedStudents.map((student) => (
                      <tr key={student.id} className="border-b hover:bg-gray-50">
                        <td className="py-4 px-4 font-semibold text-gray-900">{student.name}</td>
                        <td className="py-4 px-4 text-gray-700">{student.email}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center">
                            <div className="w-32 bg-gray-200 rounded-full h-2.5 mr-2 overflow-hidden">
                              <div
                                className={`h-2.5 rounded-full transition-all ${student.progress===100? 'bg-emerald-500': student.progress>=70? 'bg-blue-600': student.progress>=30? 'bg-amber-500':'bg-rose-500'}`}
                                style={{ width: `${Math.min(100, Math.max(0, student.progress))}%` }}
                              />
                            </div>
                            <span className="font-semibold text-gray-800 tabular-nums">{student.progress}%</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="font-semibold text-[#1E5780]">
                            {student.completedModules} of {student.totalModules}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-gray-700">{student.lastActive}</td>
                        <td className="py-4 px-4 text-gray-700">{student.lastSubmission ? new Date(student.lastSubmission).toLocaleDateString() : '—'}</td>
                        <td className="py-4 px-4">
                          <div className="flex space-x-2">
                            <button
                              className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-semibold transition-colors"
                              onClick={() => openModal(student)}
                            >
                              View Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {processedStudents.length === 0 && !loading && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-400">No students found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {isModalOpen && selectedStudent && (
            <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 animate-fade-in border border-gray-100 relative">
                <button onClick={()=>setIsModalOpen(false)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600" aria-label="Close">✕</button>
                <h2 className="text-2xl font-bold mb-1 tracking-tight">{selectedStudent.name}</h2>
                <p className="text-sm text-gray-500 mb-6">Student Overview</p>
                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                  <div className="p-3 rounded-lg border bg-white">
                    <div className="text-xs text-gray-500">Progress</div>
                    <div className="mt-1 font-semibold text-[#1E5780]">{selectedStudent.progress}%</div>
                  </div>
                  <div className="p-3 rounded-lg border bg-white">
                    <div className="text-xs text-gray-500">Modules</div>
                    <div className="mt-1 font-semibold text-indigo-600">{selectedStudent.completedModules}/{selectedStudent.totalModules}</div>
                  </div>
                  <div className="p-3 rounded-lg border bg-white">
                    <div className="text-xs text-gray-500">Last Active</div>
                    <div className="mt-1 font-semibold text-gray-800">{selectedStudent.lastActive}</div>
                  </div>
                  <div className="p-3 rounded-lg border bg-white">
                    <div className="text-xs text-gray-500">Last Submission</div>
                    <div className="mt-1 font-semibold text-gray-800">{selectedStudent.lastSubmission ? new Date(selectedStudent.lastSubmission).toLocaleDateString() : '—'}</div>
                  </div>
                </div>
                <div className="mb-6">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Notes</div>
                  <div className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-4 border min-h-[60px]">{selectedStudent.details || 'No notes.'}</div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default StudentProgress; 