import { useEffect, useState } from 'react';
import InstructorSidebar from '../../components/InstructorSidebar';

export default function Submissions() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');

  useEffect(() => {
    fetchSubs();
  }, []);

  // Lifted fetch so Refresh button can call it
  async function fetchSubs() {
    setLoading(true);
    try {
      const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
      const res = await fetch(`${API_BASE}/api/instructor/submissions`.replace(/([^:]?)\/\/+/g,'$1/'));
      if (!res.ok) throw new Error('Failed to fetch submissions');
      const data = await res.json();
      setSubs(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = subs.filter(s => {
    const matchesQ = q.trim() === '' || `${s.studentName} ${s.moduleTitle} ${s.moduleSlug}`.toLowerCase().includes(q.toLowerCase());
    const matchesType = type === 'all' || s.submissionType === type;
    return matchesQ && matchesType;
  });

  // Deduplicate by id to ensure each event only has one row
  const uniqueById = (arr) => {
    const seen = new Map();
    for (const it of arr) {
      if (!seen.has(it.id)) seen.set(it.id, it);
    }
    return Array.from(seen.values());
  };

  const practicalSubs = uniqueById(filtered.filter(s => s.submissionType === 'practical'));
  const simSubs = uniqueById(filtered.filter(s => s.submissionType === 'simulation'));
  // For attacker/defender we will show the same simulation submissions but different columns
  const attackerSubs = simSubs;
  const defenderSubs = simSubs;

  return (
    <div className="min-h-screen bg-white">
      <InstructorSidebar />
      <main className="ml-64 overflow-y-auto">
        <div className="p-4 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h1 className="text-3xl font-bold">Submissions</h1>
            <div className="flex gap-2 w-full sm:w-auto items-center">
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by student or module" className="px-3 py-2 border rounded w-full sm:w-72" />
              <select value={type} onChange={e=>setType(e.target.value)} className="px-3 py-2 border rounded">
                <option value="all">All types</option>
                <option value="practical">Practical</option>
                <option value="assessment">Assessment</option>
                <option value="simulation">Simulation</option>
              </select>
              <button onClick={() => fetchSubs()} className="px-3 py-2 bg-white border rounded ml-2 hover:bg-gray-50">Refresh</button>
            </div>
          </div>
          <div className="space-y-6">
            {loading ? (
              <div className="py-10 text-center text-gray-500">Loading…</div>
            ) : error ? (
              <div className="py-10 text-center text-red-600">{error}</div>
            ) : (
              <>
                {/* Practical - full width table */}
                <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-x-auto">
                  <div className="p-4">
                    <h2 className="text-lg font-semibold mb-3">Practical Submissions</h2>
                    {practicalSubs.length === 0 ? (
                      <div className="py-6 text-center text-gray-400">No practical submissions.</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4">When</th>
                            <th className="text-left py-3 px-4">Student</th>
                            <th className="text-left py-3 px-4">Module</th>
                            <th className="text-left py-3 px-4">Rules</th>
                            <th className="text-left py-3 px-4">Matches</th>
                            <th className="text-left py-3 px-4">Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {practicalSubs.map(s => (
                            <tr key={s.id} className="border-b hover:bg-gray-50">
                              <td className="py-3 px-4 text-xs text-gray-600">{new Date(s.createdAt).toLocaleString()}</td>
                              <td className="py-3 px-4 font-medium">{s.studentName}</td>
                              <td className="py-3 px-4">{s.moduleTitle}</td>
                              <td className="py-3 px-4">{s.ruleCount ?? '-'}</td>
                              <td className="py-3 px-4">{s.totalMatches ?? '-'}</td>
                              <td className="py-3 px-4">{s.attackerScore ?? s.defenderScore ?? '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Simulation: split into Attacker and Defender half-width tables */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-x-auto">
                    <div className="p-4">
                      <h3 className="text-lg font-semibold mb-3">Attacker Submissions</h3>
                      {attackerSubs.length === 0 ? (
                        <div className="py-6 text-center text-gray-400">No attacker submissions.</div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-3 px-4">When</th>
                              <th className="text-left py-3 px-4">Student</th>
                              <th className="text-left py-3 px-4">Attacker Pts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {attackerSubs.map(s => (
                              <tr key={s.id} className="border-b hover:bg-gray-50">
                                <td className="py-3 px-4 text-xs text-gray-600">{new Date(s.createdAt).toLocaleString()}</td>
                                <td className="py-3 px-4 font-medium">{s.studentName}</td>
                                <td className="py-3 px-4 whitespace-nowrap">{s.attackerScore ?? '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-x-auto">
                    <div className="p-4">
                      <h3 className="text-lg font-semibold mb-3">Defender Submissions</h3>
                      {defenderSubs.length === 0 ? (
                        <div className="py-6 text-center text-gray-400">No defender submissions.</div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-3 px-4">When</th>
                              <th className="text-left py-3 px-4">Student</th>
                              <th className="text-left py-3 px-4">Defender Pts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {defenderSubs.map(s => (
                              <tr key={s.id} className="border-b hover:bg-gray-50">
                                <td className="py-3 px-4 text-xs text-gray-600">{new Date(s.createdAt).toLocaleString()}</td>
                                <td className="py-3 px-4 font-medium">{s.studentName}</td>
                                <td className="py-3 px-4 whitespace-nowrap">{s.defenderScore ?? '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
