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

const AnomalyPractical = ({ modules, setModules }) => {
  const title = 'Anomaly-Based Detection';
  const slug = 'anomaly-based-detection';
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
    // Attempt server update (student id inferred later if global auth context pattern used elsewhere)
    try {
      const userId = getActiveStudentId();
      if (userId) {
        await fetch(`/api/student/${userId}/module/${slug}/unit`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unit_type: 'practical', completed: true })
        });
        // Fire event so dashboards / hooks can refresh summaries
        window.dispatchEvent(new CustomEvent('moduleUnitUpdated', { detail: { module: slug, unit: 'practical' } }));
      }
    } catch {}
  };

  const questions = [
    { id: 1, type: 'single', prompt: 'What defines an anomaly?', choices:['Known bad pattern','Deviation from baseline','User complaint'], correct: 1 },
    { id: 2, type: 'number', prompt: 'If baseline is 50±10, value that should alert?', correct: 70 },
    { id: 3, type: 'boolean', prompt: 'Seasonality must be considered.', correct: true },
    { id: 4, type: 'dropdown', prompt: 'Best starting aggregation window?', options:['1s','1m','24h'], correct:'1m' },
    { id: 5, type: 'blank', promptWithBlank: 'Use a ____ to bound acceptable variance.', correctText: 'threshold' },
  ];

  return (
    <div className="p-8 bg-[#F5F8FC] min-h-screen">
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{title} — Practical Exercise</h1>
          <p className="text-gray-600 mt-1">Define a baseline and flag meaningful outliers.</p>
          <p className="text-xs text-gray-500 mt-1">Time Spent: {(()=>{ const s=timeSpentSeconds||0; const m=Math.floor(s/60); const r=s%60; return `${m}m ${r}s`; })()}</p>
        </div>
        <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded-full">Estimated: 10–20 mins</span>
      </div>
      <div className="bg-white rounded-2xl shadow p-6 space-y-4">
        <div className="rounded-xl border p-4 bg-gradient-to-br from-sky-50 to-emerald-50">
          <h2 className="text-lg font-semibold text-gray-900">Practical Exercise</h2>
          <p className="text-gray-700 mt-2">Practice what you learned with short, hands‑on checks. This is for skill‑building and confidence before a formal test.</p>
          <p className="text-gray-700 mt-2">Here, you’ll apply anomaly concepts to baselines, thresholds, and deviations.</p>
        </div>
        <div className="text-gray-700">Answer 5 quick practical checks. Finishing marks Practical as done.</div>
        <QuestionCarousel
          questions={questions}
          onComplete={onComplete}
          passThreshold={0}
          intro={{
            title: 'Practical Check',
            lead: 'Warm‑up before the assessment. Short and interactive.',
            details: '5 items, for practice only. You can retry anytime.',
          }}
        />
        <div className="flex items-center gap-3 pt-2">
          <Link to="/learning-modules" className="text-blue-600 hover:underline">Back to Modules</Link>
        </div>
      </div>
    </div>
  );
};

export default AnomalyPractical;
