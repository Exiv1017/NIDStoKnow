import React, { useEffect, useState, useMemo } from 'react';
// Redesigned panel: show actionable items (quiz checklist, next action, tips)
import { useModuleLearning } from '../context/ModuleLearningContext.jsx';
import { signatureModuleQuizzes } from '../../../../content/signature/index.js';
import { anomalyModuleQuizzes } from '../../../../content/anomaly/index.js';
import { hybridModuleQuizzes } from '../../../../content/hybrid/index.js';
import { getModuleQuizPassed } from './moduleQuizUtils.js';
import AuthContext from '../../../../context/AuthContext';
import { useContext } from 'react';

function toSlug(str='') { return str.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }

export default function StatsPanel({ estimatedTotalMinutes }) {
  const ctx = useModuleLearning();
  if(!ctx) return null;
  const { currentLessonIdx=0, lessons=[], setCurrentLessonIdx=()=>{}, currentModule } = ctx;
  const { user } = useContext(AuthContext) || { user: null };
  const completedIds = ctx.completedIds || ctx.mergedCompletedIds || [];
  const totalLessons = lessons.length;
  const completedLessons = completedIds.length;
  const remainingLessons = totalLessons - completedLessons;
  const estMinutesPerLesson = 7;
  const remainingMinutes = Math.max(0, remainingLessons * estMinutesPerLesson);

  const [quizVersion, setQuizVersion] = useState(0);

  useEffect(()=>{
    const bump = ()=> setQuizVersion(v=>v+1);
    window.addEventListener('moduleQuizPassed', bump);
    window.addEventListener('storage', bump);
    return ()=>{
      window.removeEventListener('moduleQuizPassed', bump);
      window.removeEventListener('storage', bump);
    };
  }, []);

  const activeSet = useMemo(()=> {
    const slug = toSlug(currentModule?.slug || currentModule?.title || '');
    if (slug === 'anomaly-based-detection') return anomalyModuleQuizzes;
    if (slug === 'hybrid-detection') return hybridModuleQuizzes;
    return signatureModuleQuizzes;
  }, [currentModule]);
  const quizMeta = useMemo(()=>{
    const slug = toSlug(currentModule?.slug || currentModule?.title || '');
  const contextKey = slug === 'anomaly-based-detection' ? 'anomaly' : slug === 'hybrid-detection' ? 'hybrid' : 'signature';
    const codesAll = Object.keys(activeSet);
    return codesAll.map(code=>{
      const total = activeSet[code].questions.length;
      const passed = total>0 ? getModuleQuizPassed(code, user?.id || null, contextKey) : false;
      return {
        code,
        total,
        comingSoon: total === 0,
        passed
      };
    });
  }, [activeSet, completedLessons, user?.id, quizVersion, currentModule]);

  const nextQuizLocked = quizMeta.find(q=>!q.passed);
  const nextQuizLabel = nextQuizLocked ? (nextQuizLocked.code==='summary' ? 'Summary Quiz' : nextQuizLocked.code.toUpperCase()+' Quiz') : 'All Quizzes Passed';

  const nextLessonIndex = currentLessonIdx < lessons.length -1 ? currentLessonIdx + 1 : null;
  const nextAction = nextLessonIndex !== null ? `Review Lesson ${currentLessonIdx+1} or continue to Lesson ${nextLessonIndex+1}` : (nextQuizLocked ? 'Take remaining quizzes' : 'All content completed');

  return (
    <div className="lms-surface px-5 py-6 flex flex-col gap-6 sticky top-10">
      <section>
        <h4 className="lms-heading-md mb-3">Checklist</h4>
        <ul className="space-y-1 text-sm">
          {quizMeta.map(q=>{
            const labelBase = q.code==='summary'? 'Summary Quiz' : q.code.toUpperCase()+ ' Quiz';
            const label = q.comingSoon ? `${labelBase} (Coming Soon)` : labelBase;
            return (
              <li key={q.code} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${(q.passed && !q.comingSoon)? 'bg-emerald-500': q.comingSoon ? 'bg-slate-200':'bg-slate-300'}`} />
                <span className={(q.passed && !q.comingSoon)? 'line-through text-slate-500':'lms-text-muted'}>{label}</span>
                {q.passed && !q.comingSoon && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600/15 text-emerald-700 border border-emerald-500/30">Passed</span>}
              </li>
            );
          })}
        </ul>
        <div className="mt-3 text-[11px] lms-text-faint">80% required to pass each quiz.</div>
      </section>
      <section>
        <h4 className="text-xs uppercase tracking-wide lms-text-faint mb-2">Next Action</h4>
        <div className="text-sm lms-text-accent">{nextAction}</div>
      </section>
      <section>
        <h4 className="text-xs uppercase tracking-wide lms-text-faint mb-2">Remaining Lessons</h4>
        <div className="text-sm font-medium">{remainingLessons} left • ≈ {remainingMinutes} mins</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {nextLessonIndex !== null && (
            <button onClick={()=> setCurrentLessonIdx(nextLessonIndex)} className="px-3 py-1.5 text-xs rounded-md border border-[var(--lms-border)] hover:bg-[var(--lms-surface-alt)]">Go to Lesson {nextLessonIndex+1}</button>
          )}
          {nextQuizLocked && (()=> {
            const slug = toSlug(currentModule?.slug || currentModule?.title || '');
            let base;
            if (slug === 'anomaly-based-detection') base = 'anomaly-based-detection';
            else if (slug === 'hybrid-detection') base = 'hybrid-detection';
            else base = 'signature-based-detection';
            return (
              <a href={`/student/theoretical/${base}/quiz?moduleQuiz=${nextQuizLocked.code}`} className="px-3 py-1.5 text-xs rounded-md bg-[var(--lms-primary)] text-white hover:bg-indigo-700">{nextQuizLabel}</a>
            );
          })()}
        </div>
      </section>
      <section>
        <h4 className="text-xs uppercase tracking-wide lms-text-faint mb-2">Tip</h4>
        <div className="text-xs lms-text-muted leading-relaxed">Mark a lesson complete after you extract 1 actionable or differentiating point. This habit speeds summary retention and prepares you for quizzes.</div>
      </section>
    </div>
  );
}
