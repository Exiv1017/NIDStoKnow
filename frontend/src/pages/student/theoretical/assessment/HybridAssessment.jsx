import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../../../../context/AuthContext';
import { getActiveStudentId } from '../../../../utils/activeStudent';
import QuestionCarousel from '../../../../components/QuestionCarousel';

const HybridAssessment = ({ modules, setModules }) => {
  const title = 'Hybrid Detection';
  const slug = 'hybrid-detection';

  const { user } = useContext(AuthContext) || {};
  const onPass = () => {
    try {
      const userId = user?.id || getActiveStudentId();
      if (userId) {
        fetch(`/api/student/${userId}/module/${slug}/unit`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unit_type: 'quiz', unit_code: 'summary', completed: true })
        }).then(()=>{
          try { window.dispatchEvent(new CustomEvent('moduleUnitUpdated', { detail: { module: slug, unit: 'quiz', code: 'summary' } })); } catch {}
        }).catch(()=>{});
      }
    } catch {}
  };
  const onComplete = (score) => {
    if (score.ratio < 0.8) return;
    if (setModules) setModules(prev => prev.map(m => m.title === title ? { ...m, sections: m.sections.map(s => s.name === 'Assessment' ? { ...s, completed: true } : s) } : m));
    try {
      const userId = user?.id || getActiveStudentId();
      if (userId) {
        fetch(`/api/student/${userId}/module/${slug}/unit`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unit_type: 'assessment', completed: true })
        }).then(()=>{
          try { window.dispatchEvent(new CustomEvent('moduleUnitUpdated', { detail: { module: slug, unit: 'assessment' } })); } catch {}
        }).catch(()=>{});
      }
    } catch {}
  };

  const questions = [
    { id: 1, type: 'single', prompt: 'Why use hybrid detection?', choices:['Performance','Precision & coverage','Cheaper','None'], correct: 1 },
    { id: 2, type: 'boolean', prompt: 'Hybrid can reduce false positives.', correct: true },
    { id: 3, type: 'text', prompt: 'Name one benefit mentioned in theory.', correctText: 'precision' },
    { id: 4, type: 'multi', prompt: 'Select components.', choices:['Signature','Anomaly','Captcha'], correct:[0,1] },
    { id: 5, type: 'blank', promptWithBlank: 'Set a signature AND a ____ to limit noise.', correctText: 'threshold' },
    { id: 6, type: 'order', prompt: 'Order a hybrid pipeline.', items:['baseline','alert','signature','score'], correctOrder:['signature','baseline','score','alert'] },
    { id: 7, type: 'match', prompt: 'Match part to goal.', pairs:[{left:'Signature',right:'Known pattern'},{left:'Threshold',right:'Volume gate'}] },
    { id: 8, type: 'arrange', prompt: 'Arrange tokens.', tokens:['if','sig','&&','count>','X'], correctOrder:['if','sig','&&','count>','X'] },
    { id: 9, type: 'dropdown', prompt: 'Choose output action.', options:['alert','ignore','sleep'], correct:'alert' },
    { id: 10, type: 'slider', prompt: 'Set reasonable frequency threshold.', min:0, max:200, correctRange:[30,100] },
    { id: 11, type: 'matrix', prompt: 'Mark risky combos.', rows:['/admin','/setup'], cols:['known exploit','baseline ok'], correctCells:[['/admin','known exploit']] },
    { id: 12, type: 'toggle', prompt: 'Toggle valid hybrid signals.', items:[{label:'known IOC',correct:true},{label:'theme',correct:false}] },
    { id: 13, type: 'classify', prompt: 'Classify: known exploit at extreme rate.', labels:['Benign','Malicious'], correct:'Malicious' },
    { id: 14, type: 'number', prompt: 'How many components in hybrid here?', correct: 2 },
    { id: 15, type: 'single', prompt: 'Best after building hybrid?', choices:['Deploy blind','A/B test and tune','Disable logs','Set threshold=0'], correct: 1 },
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

export default HybridAssessment;
