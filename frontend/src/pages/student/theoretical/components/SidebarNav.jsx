import React, { useMemo, useState, useEffect } from 'react';
import { useModuleLearning } from '../context/ModuleLearningContext.jsx';
import { signatureModuleQuizzes } from '../../../../content/signature/index.js';
import { anomalyModuleQuizzes } from '../../../../content/anomaly/index.js';
import { hybridModuleQuizzes } from '../../../../content/hybrid/index.js';
import { getModuleQuizPassed } from './moduleQuizUtils.js';
import AuthContext from '../../../../context/AuthContext';
import { useContext } from 'react';
import useModuleSummaries from '../../../../hooks/useModuleSummaries.js';

// Expect each lesson optionally to have moduleNumber & moduleTitle injected by parent.
export default function SidebarNav({ onOpenModuleQuiz, track='signature' }) {
  const ctx = useModuleLearning();
  if(!ctx) return null;
  const { lessons = [], currentLessonIdx=0, setCurrentLessonIdx=()=>{}, completedIds = [], getLessonId: ctxGetLessonId } = ctx;
  const { user } = useContext(AuthContext) || { user: null };
  const [quizPassVersion, setQuizPassVersion] = useState(0);
  // Server summaries (provides authoritative quizzes_passed count per parent slug)
  const { summaries, refresh: refreshSummaries } = useModuleSummaries(user);

  const serverQuizPassMaps = useMemo(()=>{
    const order = ['m1','m2','m3','m4','summary'];
    const build = (parentSlug)=>{
      const map = {};
      try {
        const count = summaries[parentSlug]?.quizzes_passed || 0;
        for(let i=0;i<count && i<order.length;i++) map[order[i]] = true;
      } catch {}
      return map;
    };
    return {
      'signature-based-detection': build('signature-based-detection'),
      'anomaly-based-detection': build('anomaly-based-detection'),
      'hybrid-detection': build('hybrid-detection')
    };
  }, [summaries]);

  useEffect(()=>{
    const bump = ()=> setQuizPassVersion(v=>v+1);
    const handleUnitUpdated = ()=>{ refreshSummaries(); bump(); };
    window.addEventListener('moduleQuizPassed', bump);
    window.addEventListener('storage', bump);
    window.addEventListener('moduleUnitUpdated', handleUnitUpdated);
    return ()=>{
      window.removeEventListener('moduleQuizPassed', bump);
      window.removeEventListener('storage', bump);
      window.removeEventListener('moduleUnitUpdated', handleUnitUpdated);
    };
  }, [refreshSummaries]);

  // Derive grouped structure: { moduleKey, moduleTitle, startIndex, lessons: [...] }
  const groups = useMemo(() => {
    const buckets = [];
    lessons.forEach((l, absoluteIndex) => {
      const mNum = l.moduleNumber || 1;
      const mTitle = l.moduleTitle || `Module ${mNum}`;
      let bucket = buckets.find(b => b.moduleNumber === mNum);
      if (!bucket) {
        bucket = { moduleNumber: mNum, moduleTitle: mTitle, lessons: [], startIndex: absoluteIndex };
        buckets.push(bucket);
      }
      bucket.lessons.push({ ...l, absoluteIndex });
    });
    return buckets;
  }, [lessons, quizPassVersion]);

  const handleSelectLesson = (idx) => setCurrentLessonIdx(idx);

  return (
    <nav aria-label="Course navigation" className="sticky top-10 lms-surface p-5 h-[calc(100vh-5rem)] overflow-y-auto">
      <h3 className="lms-heading-md mb-4">Modules</h3>
      <div className="space-y-6">
        {groups.map(g => {
          const isSummary = /summary/i.test(g.moduleTitle);
          const moduleCode = isSummary ? 'summary' : (g.moduleTitle?.toLowerCase().includes('module') ? `m${g.moduleNumber}` : '');
          const quizSet = track === 'anomaly' ? anomalyModuleQuizzes : track === 'hybrid' ? hybridModuleQuizzes : signatureModuleQuizzes;
          const quizExists = moduleCode && quizSet[moduleCode] && quizSet[moduleCode].questions.length>0;
          const allModuleLessonsComplete = g.lessons.every(l=>{
            const id = ctxGetLessonId ? ctxGetLessonId(l, l.absoluteIndex) : (l.id || `${l.title}-${l.absoluteIndex}`);
            return completedIds.includes(id);
          });
          const parentSlug = track === 'anomaly' ? 'anomaly-based-detection' : track === 'hybrid' ? 'hybrid-detection' : 'signature-based-detection';
          const localQuizPassed = moduleCode ? getModuleQuizPassed(moduleCode, user?.id || null, track) : false;
          const serverQuizPassed = !!(moduleCode && serverQuizPassMaps[parentSlug]?.[moduleCode]);
          const quizPassed = localQuizPassed || serverQuizPassed;
          return (
          <div key={g.moduleNumber}>
            <h4 className="text-xs font-semibold tracking-wide uppercase lms-text-faint mb-2">{g.moduleTitle}</h4>
            <ul className="space-y-1">
              {g.lessons.map(({ absoluteIndex, title, id: explicitId }) => {
                const active = absoluteIndex === currentLessonIdx;
                const realId = ctxGetLessonId ? ctxGetLessonId(lessons[absoluteIndex], absoluteIndex) : (explicitId || `${title}-${absoluteIndex}`);
                const complete = completedIds.includes(realId);
                return (
                  <li key={absoluteIndex}>
                    <button
                      onClick={() => handleSelectLesson(absoluteIndex)}
                      className={`group w-full flex items-center justify-between text-left px-3 py-2 rounded-md text-[13px] font-medium border transition-colors lms-focus-ring relative overflow-hidden ${active ? 'bg-[var(--lms-primary)] text-white border-[var(--lms-primary)]' : 'bg-[var(--lms-surface-alt)] hover:bg-[var(--lms-surface)] border border-[var(--lms-border)] lms-text-muted'} ${complete && !active ? 'after:absolute after:inset-y-0 after:left-0 after:w-1 after:bg-emerald-400 after:rounded-r' : ''}`}
                      aria-current={active ? 'true' : 'false'}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-mono w-5 text-right opacity-60">{g.moduleNumber}.{absoluteIndex - g.startIndex + 1}</span>
                        <span className="truncate flex-1">{title}</span>
                      </span>
                      <span className="text-xs tabular-nums flex items-center gap-1">
                        {complete && <span className="flex items-center gap-1 text-emerald-600" aria-label="Completed"><span>✓</span><span className="hidden xl:inline bg-emerald-600/15 border border-emerald-500/30 text-emerald-700 px-1.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wide">Done</span></span>}
                        {active && !complete && <span className="lms-text-accent opacity-70" aria-hidden="true">●</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
              {quizExists && (
                <li className="pt-2 mt-2 border-t border-[var(--lms-border)]">
                  <button
                    disabled={!allModuleLessonsComplete || quizPassed}
                    onClick={()=>{ onOpenModuleQuiz && onOpenModuleQuiz({ moduleCode, moduleNumber: g.moduleNumber }); setQuizPassVersion(v=>v+1); }}
                    className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-md text-[12px] font-medium border transition-colors lms-focus-ring ${quizPassed ? 'bg-emerald-600/15 border-emerald-500/50 text-emerald-700' : allModuleLessonsComplete ? 'bg-[var(--lms-primary-muted)]/30 hover:bg-[var(--lms-primary-muted)]/50 border-[var(--lms-primary-muted)] text-[var(--lms-primary)]' : 'bg-[var(--lms-surface-alt)] border-[var(--lms-border)] text-slate-400 cursor-not-allowed'}`}
                    aria-label={quizPassed ? 'Quiz passed' : allModuleLessonsComplete ? 'Start module quiz' : 'Complete all lessons to unlock quiz'}
                  >
                    <span className="flex items-center gap-2">
                      <span>{quizPassed ? '✓ Module Quiz Passed' : 'Start Module Quiz'}</span>
                    </span>
                    <span className="text-[10px] font-mono">{quizPassed ? '100%' : allModuleLessonsComplete ? 'Ready' : 'Locked'}</span>
                  </button>
                </li>
              )}
            </ul>
          </div>
        );})}
      </div>
    </nav>
  );
}
