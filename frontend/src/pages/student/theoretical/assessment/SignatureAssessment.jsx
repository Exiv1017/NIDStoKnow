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
    <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-screen">
      <div className="max-w-4xl mx-auto p-6">
        {/* Enhanced header */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-6 border border-blue-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{title} — Assessment</h1>
              <p className="text-gray-600 text-lg mt-2">Test your knowledge with 15 interactive questions</p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-purple-700 bg-purple-100 px-4 py-2 rounded-xl border border-purple-200">
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
                Estimated: 10–15 mins
              </span>
            </div>
          </div>
          
          {/* Progress indicator */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                <span className="font-medium text-gray-700">Pass Requirement: 80% (12/15 questions)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                <span className="font-medium text-gray-700">Unlimited Attempts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced content container */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-blue-100 overflow-hidden">
          <div className="p-6">
            <QuestionCarousel
              questions={questions}
              onPass={onPass}
              // Auto-complete when last question is submitted
              autoFinishOnLast={true}
              onQuestionChecked={handleQuestionChecked}
              onComplete={onComplete}
              passThreshold={0.8}
              intro={{
                title: 'Knowledge Assessment',
                lead: 'Test your understanding of signature-based detection concepts.',
                details: 'This is a comprehensive 15-question assessment covering practical and theoretical aspects. You must score 80% to pass. You can review and retake as many times as needed.',
              }}
            />
            
            {/* Enhanced navigation */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <Link 
                  to="/learning-modules" 
                  className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                >
                  <span>←</span>
                  Back to Modules
                </Link>
                
                <div className="text-sm text-gray-500">
                  Assessment • Signature-Based Detection
                </div>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
};

export default SignatureAssessment;
