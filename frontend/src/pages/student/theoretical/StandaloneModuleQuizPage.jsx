import React, { useEffect, useState, useContext } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import AuthContext from '../../../context/AuthContext';
import '../../../styles/lms-theme.css';
import ModuleQuiz from './components/ModuleQuiz.jsx';
import { signatureModules, signatureModuleQuizzes } from '../../../content/signature/index.js';
import { anomalyModules, anomalyModuleQuizzes } from '../../../content/anomaly/index.js';
import { hybridModules, hybridModuleQuizzes } from '../../../content/hybrid/index.js';
import { getLessonId, toSlug } from '../theoretical/logic/ids.js';
// Theme toggle removed: light-only mode

// A focused standalone quiz page (Option B) that works with /student/theoretical/:moduleSlug/quiz?moduleQuiz=m1
// Falls back to theory route if prerequisites not met.

const StandaloneModuleQuizPage = () => {
  const { moduleSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext) || { user: null };
  const moduleCode = searchParams.get('moduleQuiz');
  const isAnomaly = moduleSlug === 'anomaly-based-detection';
  const isHybrid = moduleSlug === 'hybrid-detection';
  const modulesSet = isAnomaly ? anomalyModules : isHybrid ? hybridModules : signatureModules;
  const quizzesSet = isAnomaly ? anomalyModuleQuizzes : isHybrid ? hybridModuleQuizzes : signatureModuleQuizzes;
  const moduleMeta = modulesSet.find(m => (m.code === moduleCode));
  const quizQuestions = moduleCode ? (quizzesSet[moduleCode]?.questions || []) : [];
  const [toast, setToast] = useState(null);

  // Prerequisite check (relaxed). Removed deprecated /progress endpoint (was 404) – now purely local storage heuristic.
  useEffect(()=>{
    if (!moduleCode || !moduleMeta) return;
    const STRICT_GATING = false; // set true to enforce full lesson completion before quiz
    let localCompleted = [];
    try {
      const storageSlug = isAnomaly ? 'Anomaly-Based Detection' : isHybrid ? 'Hybrid Detection' : 'Signature-Based Detection';
      const base = `module-${toSlug(storageSlug)}`;
      const key = user?.id ? `${base}-u${user.id}-completed-lesson-ids` : `${base}-completed-lesson-ids`;
      localCompleted = JSON.parse(localStorage.getItem(key)||'[]');
    } catch {}
    const completedSet = new Set(localCompleted);
    const allCourseLessons = modulesSet.flatMap(m=>m.lessons);
    const targetLessons = moduleMeta.lessons || [];
    const allDone = targetLessons.length === 0 || targetLessons.every(l=>{
      const idx = allCourseLessons.findIndex(x=>x.id===l.id);
      const id = getLessonId({ id: l.id, title: l.title }, idx >=0 ? idx : 0);
      if (completedSet.has(id)) return true;
      const slugId = toSlug(l.title||'');
      return completedSet.has(slugId);
    });
    if (!allDone && STRICT_GATING) {
      setToast({ id: Date.now(), message: 'Please finish the lessons before attempting this quiz.' });
      navigate(`/student/theoretical/${moduleSlug}/theory`);
    } else if (!allDone && !STRICT_GATING) {
      setToast({ id: Date.now(), message: 'Tip: Completing lessons first improves your quiz score (gating relaxed).' });
    }
  }, [moduleCode, moduleMeta, moduleSlug, user?.id, isAnomaly, isHybrid, modulesSet, navigate]);

  // Determine next lesson path (composite course lives under same theory route; we use ?lesson=<index>)
  let nextLessonHref = null;
  let nextLessonLabel = 'Next Lesson';
  if (moduleMeta) {
    // Use the appropriate module set (signature or anomaly) in natural order (1..4 + summary)
    const orderedModules = [...modulesSet].sort((a,b)=>a.module-b.module);
    const allLessons = orderedModules.flatMap(m=>m.lessons.map(l=>({ ...l, module: m.module, code: m.code })));
    const currentLastLessonId = moduleMeta.lessons[moduleMeta.lessons.length-1]?.id;
    const totalLessonsBefore = allLessons.findIndex(l=>l.id===currentLastLessonId) + 1; // index of first lesson AFTER current module
    const summaryModule = orderedModules.find(m=>m.code==='summary');
    if (totalLessonsBefore > 0 && totalLessonsBefore < allLessons.length) {
      // Navigate to first lesson of next module (or summary if that's next)
      nextLessonHref = `/student/theoretical/${moduleSlug}/theory?lesson=${totalLessonsBefore}`;
      const target = allLessons[totalLessonsBefore];
      if (target) {
        nextLessonLabel = target.code === 'summary' ? 'Go to Summary' : `Next: ${target.title}`;
      }
    } else if (summaryModule && moduleMeta.code !== 'summary') {
      // At end of non-summary module but could not resolve next (fallback)
      const summaryFirstId = summaryModule.lessons[0]?.id;
      const summaryIndex = allLessons.findIndex(l=>l.id===summaryFirstId);
      if (summaryIndex >= 0) {
        nextLessonHref = `/student/theoretical/${moduleSlug}/theory?lesson=${summaryIndex}`;
        nextLessonLabel = 'Go to Summary';
      }
    } else if (moduleMeta.code === 'summary') {
      // Summary quiz passed: all modules done
      nextLessonHref = `/student/theoretical/${moduleSlug}/theory`;
      nextLessonLabel = 'All Modules Complete';
    }
  }

  return (
    <div className="min-h-screen lms-app-bg">
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-4 mb-8">
          <h1 className="lms-heading-xl">{moduleMeta ? `Module ${moduleMeta.module} Quiz` : 'Module Quiz'}</h1>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => navigate('/learning-modules')}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--lms-border)] bg-[var(--lms-surface-alt)] hover:bg-[var(--lms-surface)] lms-focus-ring"
            >
              ← Learning Modules
            </button>
            <button
              onClick={()=>{
                // Retrieve last viewed lesson index from TheoryModulePage persistence
                const storageBase = user?.id ? `theory:Signature-Based Detection:last:lesson:u${user.id}` : `theory:Signature-Based Detection:last:lesson`;
                let lessonIdx = null;
                try { const v = localStorage.getItem(storageBase); if(v!==null) { const n = parseInt(v,10); if(!isNaN(n)) lessonIdx = n; } } catch {}
                const lessonParam = lessonIdx !== null ? `?lesson=${lessonIdx}` : '';
                navigate(`/student/theoretical/${moduleSlug}/theory${lessonParam}`);
              }}
              className="text-xs px-3 py-1.5 rounded border border-[var(--lms-border)] hover:bg-[var(--lms-surface-alt)]"
            >Back to Lessons</button>
            {/* Dark mode toggle removed: light-only */}
          </div>
        </div>
  <ModuleQuiz moduleSlug={moduleCode} questions={quizQuestions} studentId={user?.id} track={isAnomaly ? 'anomaly' : isHybrid ? 'hybrid' : 'signature'} onPass={()=> setToast({ id: Date.now(), message: 'Quiz Passed!' })} nextLessonHref={nextLessonHref} nextLessonLabel={nextLessonLabel} authToken={user?.token || null} />
        {toast && (
          <div className="fixed bottom-4 right-4 z-50">
            <div className="bg-slate-900/90 text-white text-sm px-4 py-2 rounded shadow-lg flex items-center gap-3 animate-slide-in" role="status" aria-live="polite">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping-slow" />
              <span>{toast.message}</span>
              <button onClick={()=>setToast(null)} className="lms-text-subtle hover:lms-text-inverse ml-2" aria-label="Dismiss notification">×</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StandaloneModuleQuizPage;
