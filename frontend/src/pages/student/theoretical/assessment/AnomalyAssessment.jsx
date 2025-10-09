import React from 'react';
import { Link } from 'react-router-dom';
import QuestionCarousel from '../../../../components/QuestionCarousel';
import { getActiveStudentId } from '../../../../utils/activeStudent';

const AnomalyAssessment = ({ modules, setModules }) => {
  const title = 'Anomaly-Based Detection';
  const slug = 'anomaly-based-detection';

  const onPass = async () => {
    try {
      const userId = getActiveStudentId();
      if (userId) {
        await fetch(`/api/student/${userId}/module/${slug}/unit`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unit_type: 'quiz', unit_code: 'summary', completed: true })
        });
        window.dispatchEvent(new CustomEvent('moduleUnitUpdated', { detail: { module: slug, unit: 'quiz', code: 'summary' } }));
      }
    } catch {}
  };
  const onComplete = async (score) => {
    if (score.ratio < 0.8) return;
    if (setModules) setModules(prev => prev.map(m => m.title === title ? { ...m, sections: m.sections.map(s => s.name === 'Assessment' ? { ...s, completed: true } : s) } : m));
    try {
      const userId = getActiveStudentId();
      if (userId) {
        await fetch(`/api/student/${userId}/module/${slug}/unit`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unit_type: 'assessment', completed: true })
        });
        window.dispatchEvent(new CustomEvent('moduleUnitUpdated', { detail: { module: slug, unit: 'assessment' } }));
      }
    } catch {}
  };

  const questions = [
    { id: 1, type: 'single', prompt: 'What defines an anomaly?', choices: ['Unknown pattern','Known pattern','Random noise','Baseline average'], correct: 0 },
    { id: 2, type: 'boolean', prompt: 'Anomalies are always attacks.', correct: false },
    { id: 3, type: 'text', prompt: 'Name one ML approach for anomaly scoring from theory.', correctText: 'isolation forest' },
    { id: 4, type: 'multi', prompt: 'Select ways to reduce FP.', choices: ['Tune thresholds','Add context features','Ignore alerts'], correct: [0,1] },
    { id: 5, type: 'blank', promptWithBlank: 'Always establish a ____ before flagging outliers.', correctText: 'baseline' },
    { id: 6, type: 'order', prompt: 'Order the steps.', items: ['Define features','Collect normal data','Train model'], correctOrder: ['Collect normal data','Define features','Train model'] },
    { id: 7, type: 'match', prompt: 'Match concept.', pairs: [{left:'Z-score', right:'Standard deviations'},{left:'IF score', right:'Path length'}] },
    { id: 8, type: 'arrange', prompt: 'Arrange a simple pipeline.', tokens: ['collect','baseline','score','alert'], correctOrder: ['collect','baseline','score','alert'] },
    { id: 9, type: 'dropdown', prompt: 'Choose metric.', options: ['requests/min','screen size','theme'], correct: 'requests/min' },
    { id: 10, type: 'slider', prompt: 'Select a reasonable z-score threshold.', min: 0, max: 10, correctRange: [2, 4] },
    { id: 11, type: 'matrix', prompt: 'Mark suspicious combos.', rows: ['night','day'], cols: ['sudden spike','normal'], correctCells: [['night','sudden spike']] },
    { id: 12, type: 'toggle', prompt: 'Toggle helpful signals.', items: [{label:'IP reputation', correct:true},{label:'Font size', correct:false}] },
    { id: 13, type: 'classify', prompt: 'Classify: 50x the baseline suddenly.', labels:['Benign','Malicious'], correct: 'Malicious' },
    { id: 14, type: 'number', prompt: 'What percentile often flags outliers? (e.g., 95)', correct: 95 },
    { id: 15, type: 'single', prompt: 'Best after spike?', choices:['Ignore','Investigate context','Reboot server','Disable logging'], correct: 1 },
  ];

  return (
    <div className="p-8 bg-[#F5F8FC] min-h-screen">
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{title} — Practical Assessment</h1>
          <p className="text-gray-600 mt-1">15 interactive questions. Score at least 80% to pass.</p>
        </div>
        <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded-full">Estimated: 10–15 mins</span>
      </div>
      <div className="bg-white rounded-2xl shadow p-6 space-y-4">
        <QuestionCarousel
          questions={questions}
          onPass={onPass}
          onComplete={onComplete}
          passThreshold={0.8}
          intro={{
            title: 'Quiz',
            lead: 'Let’s check your knowledge about the concepts you just learned.',
            details: 'This is a 15‑question quiz. You must get 80% to pass. You can review and retake as many times as needed.',
          }}
        />
        <div className="flex items-center gap-3 pt-2">
          <Link to="/learning-modules" className="text-blue-600 hover:underline">Back to Modules</Link>
        </div>
      </div>
    </div>
  );
};

export default AnomalyAssessment;
