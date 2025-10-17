import React, { useContext, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthContext from '../../../../context/AuthContext';
import { getActiveStudentId } from '../../../../utils/activeStudent';
import QuestionCarousel from '../../../../components/QuestionCarousel';

const SignatureAssessment = ({ modules, setModules }) => {
  const title = 'Signature-Based Detection';
  const slug = 'signature-based-detection';
  const navigate = useNavigate();
  const { user } = useContext(AuthContext) || {};

  const onPass = () => {
    try {
      localStorage.setItem(`${slug}-module-quiz-passed`, 'true');
      const base = `module-${slug}`;
      if (user?.id) {
        localStorage.setItem(`${base}-u${user.id}-module-quiz-passed`, 'true');
      } else {
        localStorage.setItem(`${base}-module-quiz-passed`, 'true');
      }
    } catch (e) {}
    // Server quiz unit event (use unit_code 'summary' to align with other quiz completions)
    try {
      const userId = user?.id || getActiveStudentId();
      if (userId) {
        const headers = { 'Content-Type': 'application/json' };
        if (user?.token) headers['Authorization'] = `Bearer ${user.token}`;
        fetch(`/api/student/${userId}/module/${slug}/unit`, {
          method: 'POST', headers,
          body: JSON.stringify({ unit_type: 'quiz', unit_code: 'summary', completed: true })
        }).then(()=>{
          try { window.dispatchEvent(new CustomEvent('moduleUnitUpdated', { detail: { module: slug, unit: 'quiz', code: 'summary' } })); } catch {}
        }).catch(()=>{});
      }
    } catch {}
  };

  const onComplete = (score) => {
    const passed = score.ratio >= 0.8;
    if (!passed) return;
    if (setModules) {
      setModules(prev => prev.map(m => m.title === title ? { ...m, sections: m.sections.map(s => s.name === 'Assessment' ? { ...s, completed: true } : s) } : m));
    }
    // Server assessment unit only
    const userId = user?.id || getActiveStudentId();
    if (userId) {
      const headers = { 'Content-Type': 'application/json' };
      if (user?.token) headers['Authorization'] = `Bearer ${user.token}`;
      fetch(`/api/student/${userId}/module/${slug}/unit`, {
        method: 'POST', headers,
        body: JSON.stringify({ unit_type: 'assessment', completed: true })
      }).then(()=>{
        try { window.dispatchEvent(new CustomEvent('moduleUnitUpdated', { detail: { module: slug, unit: 'assessment' } })); } catch {}
      }).catch(()=>{});
    }
  };

  // 15 mixed-type practical/assessment questions (answers derived from theory content)
  const questions = [
    { id: 1, type: 'single', prompt: 'Which best describes a signature in NIDS?', choices: ['Statistical baseline','Heuristic guess','Known pattern of malicious activity','Random sampling'], correct: 2 },
    { id: 2, type: 'boolean', prompt: 'Signatures are effective for zero-day attacks.', correct: false },
    { id: 3, type: 'text', prompt: 'Name one popular signature engine mentioned in theory (e.g., Snort).', correctText: 'snort' },
    { id: 4, type: 'multi', prompt: 'Select all limitations of signature-based detection.', choices: ['Noisy alerts','Cannot catch unknown threats','Requires updates','High compute cost always'], correct: [1,2] },
    { id: 5, type: 'blank', promptWithBlank: 'Rules must be ____ regularly to remain effective.', correctText: 'updated' },
    { id: 6, type: 'order', prompt: 'Order the steps to author a signature rule.', items: ['Test rule on logs','Define pattern','Deploy rule'], correctOrder: ['Define pattern','Test rule on logs','Deploy rule'] },
    { id: 7, type: 'match', prompt: 'Match field to example.', pairs: [{left:'URI', right:'/wp-login.php'}, {left:'User-Agent', right:'curl/7.68.0'}] },
    { id: 8, type: 'arrange', prompt: 'Arrange tokens to form a sample Snort content match.', tokens: ['alert','tcp','any','->','any','(content:"/etc/passwd";)'], correctOrder: ['alert','tcp','any','->','any','(content:"/etc/passwd";)'] },
    { id: 9, type: 'dropdown', prompt: 'Choose the rule action.', options: ['drop','alert','pass'], correct: 'alert' },
    { id: 10, type: 'slider', prompt: 'Select a threshold that indicates likely brute force (requests/min).', min: 0, max: 200, correctRange: [60, 120] },
    { id: 11, type: 'matrix', prompt: 'Mark combinations that are high-risk.', rows: ['/admin','/setup'], cols: ['curl UA','SQLi payload'], correctCells: [['/admin','SQLi payload']] },
    { id: 12, type: 'toggle', prompt: 'Toggle valid rule components.', items: [{label:'content', correct:true},{label:'nonsense', correct:false},{label:'pcre', correct:true}] },
    { id: 13, type: 'classify', prompt: 'Classify: GET /wp-login.php?user=admin&pass=12345 with known leaked password list.', labels: ['Benign','Malicious'], correct: 'Malicious' },
    { id: 14, type: 'number', prompt: 'How many bytes does the payload length must be at least (min_length)?', correct: 1 },
    { id: 15, type: 'single', prompt: 'Best next step after writing a new rule?', choices: ['Deploy to prod immediately','Test on sample logs','Disable all other rules','Ignore false positives'], correct: 1 },
  ];

  // Track last saved answers in-memory (optional extension later)
  const answersRef = useRef({});

  const baseKey = `module-${slug}` + (user?.id ? `-u${user.id}` : '');

  const handleQuestionChecked = ({ id, correct, answer }) => {
    answersRef.current[id] = { answer, correct };
    try {
      // Persist incremental progress: store list of answered question IDs and correctness map
      const progressKey = `${baseKey}-assessment-progress`;
      const existing = JSON.parse(localStorage.getItem(progressKey) || '{}');
      existing[id] = { answer, correct };
      localStorage.setItem(progressKey, JSON.stringify(existing));
    } catch (e) {}
  };

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
            // Auto-complete when last question is submitted
          autoFinishOnLast={true}
          onQuestionChecked={handleQuestionChecked}
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

export default SignatureAssessment;
