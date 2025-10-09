import React, { useState } from 'react';
import useModuleTimeSpent from '../../../../hooks/useModuleTimeSpent.js';
import useTimeAccumulator from '../../../../hooks/useTimeAccumulator.js';
import { Link } from 'react-router-dom';
import QuestionCarousel from '../../../../components/QuestionCarousel';
import { getActiveStudentId } from '../../../../utils/activeStudent';

const Card = ({ title, children }) => (
  <div className="border rounded-xl p-4 bg-white shadow-sm">
    <div className="font-semibold text-gray-900 mb-2">{title}</div>
    <div className="text-gray-700 space-y-2">{children}</div>
  </div>
);

const Checklist = ({ items }) => {
  const [checked, setChecked] = useState(Array(items.length).fill(false));
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={checked[i]} onChange={() => setChecked(prev => prev.map((v, idx) => idx === i ? !v : v))} />
          <span className="leading-relaxed">{it}</span>
        </li>
      ))}
    </ul>
  );
};

const HybridPractical = ({ modules, setModules }) => {
  const title = 'Hybrid Detection';
  const slug = 'hybrid-detection';
  const timeSpentSeconds = useModuleTimeSpent({ studentId: getActiveStudentId(), moduleSlug: slug, realtime: true });

  useTimeAccumulator({
    studentId: getActiveStudentId(),
    moduleSlug: slug,
    unitType: 'practical',
    unitCode: 'practical',
    debug: true
  });

  const onComplete = async () => {
    try { localStorage.setItem(`${slug}-practical-completed`, 'true'); } catch (e) {}
    if (setModules) {
      setModules(prev => prev.map(m => m.title===title ? { ...m, sections: m.sections.map(s => s.name==='Practical Exercise'?{...s,completed:true}:s) } : m));
    }
    try {
      const userId = getActiveStudentId();
      if (userId) {
        await fetch(`/api/student/${userId}/module/${slug}/unit`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unit_type: 'practical', completed: true })
        });
        window.dispatchEvent(new CustomEvent('moduleUnitUpdated', { detail: { module: slug, unit: 'practical' } }));
      }
    } catch {}
  };

  const questions = [
    { id: 1, type: 'single', prompt: 'Why combine signature with threshold?', choices:['Speed','Less noise, better precision','Aesthetic'], correct: 1 },
    { id: 2, type: 'boolean', prompt: 'Hybrid can reduce false positives.', correct: true },
    { id: 3, type: 'blank', promptWithBlank: 'Set a signature AND a ____ on frequency.', correctText: 'threshold' },
    { id: 4, type: 'dropdown', prompt: 'Action when both conditions met?', options:['ignore','alert','sleep'], correct:'alert' },
    { id: 5, type: 'order', prompt: 'Order hybrid pipeline.', items:['baseline','alert','signature','score'], correctOrder:['signature','baseline','score','alert'] },
  ];

  return (
    <div className="p-8 bg-[#F5F8FC] min-h-screen">
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{title} — Practical Exercise</h1>
          <p className="text-gray-600 mt-1">Blend signature and anomaly signals to reduce false positives.</p>
          <p className="text-xs text-gray-500 mt-1">Time Spent: {(()=>{ const s=timeSpentSeconds||0; const m=Math.floor(s/60); const r=s%60; return `${m}m ${r}s`; })()}</p>
        </div>
        <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded-full">Estimated: 10–20 mins</span>
      </div>
      <div className="bg-white rounded-2xl shadow p-6 space-y-4">
        <div className="rounded-xl border p-4 bg-gradient-to-br from-sky-50 to-emerald-50">
          <h2 className="text-lg font-semibold text-gray-900">Practical Exercise</h2>
          <p className="text-gray-700 mt-2">Hands‑on warm‑up to combine signals. This practice boosts your confidence before formal testing.</p>
          <p className="text-gray-700 mt-2">You’ll blend a precise signature with a frequency threshold for better precision.</p>
        </div>
        <div className="text-gray-700">Complete 5 quick hybrid checks. Finishing marks Practical as done.</div>
        <QuestionCarousel
          questions={questions}
          onComplete={onComplete}
          passThreshold={0}
          intro={{
            title: 'Practical Check',
            lead: 'Short interactive warm‑up before the hybrid assessment.',
            details: '5 items for practice only. Feel free to retry.',
          }}
        />
        <div className="flex items-center gap-3 pt-2">
          <Link to="/learning-modules" className="text-blue-600 hover:underline">Back to Modules</Link>
        </div>
      </div>
    </div>
  );
};

export default HybridPractical;
