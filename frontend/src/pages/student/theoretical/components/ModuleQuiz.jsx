import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getModuleQuizPassed } from './moduleQuizUtils.js';
import useTimeAccumulator from '../../../../hooks/useTimeAccumulator.js';

// Component now accepts external questions via props (dynamic per-module set)
// Passing state is stored in localStorage under key pattern: signatureQuiz:<moduleSlug>:passed
// If a quiz was previously passed, component hydrates saved answers/score and locks into review mode.
// Namespacing enhancement: include user id when available to prevent cross-account leakage in a shared browser.
// Backward compatibility: if user-specific key missing, legacy key (without user suffix) is checked.

const QuestionBlock = ({ q, options, idx, answered, setAnswer, locked, review, correctIndex }) => (
  <div className="mb-4 p-3 rounded-lg border border-[var(--lms-border)] bg-[var(--lms-surface)]">
    <div className="font-medium mb-2">{idx+1}. {q}</div>
    <div className="mt-2 space-y-2">
      {options.map((opt, oi) => {
        const chosen = answered === oi;
        const isCorrect = review && oi === correctIndex;
        const isWrongChosen = review && chosen && oi !== correctIndex;
        return (
          <label key={oi} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${chosen ? 'border-[var(--lms-primary)] bg-[var(--lms-primary-muted)]/40' : 'border-[var(--lms-border)] hover:bg-[var(--lms-surface-alt)]'} ${isCorrect ? '!bg-emerald-600/15 !border-emerald-500/50' : ''} ${isWrongChosen ? '!bg-red-600/15 !border-red-500/50' : ''}`}>
            <input type="radio" name={`q-${idx}`} disabled={locked} checked={chosen} onChange={() => setAnswer(oi)} />
            <span className="text-sm">{opt}</span>
            {isCorrect && <span className="ml-auto text-xs font-semibold text-green-700">Correct</span>}
            {isWrongChosen && <span className="ml-auto text-xs font-semibold text-red-700">Incorrect</span>}
          </label>
        );
      })}
    </div>
  </div>
);

const ModuleQuiz = ({ moduleSlug, questions = [], onPass, studentId, quizKeySubIndex=null, markdownSource, onServerUpdate, nextLessonHref, nextLessonLabel='Next Lesson', track='signature', authToken=null }) => {
  // Correct namespacing: formerly we wrote global keys; now only per-track + per-user keys are authoritative.
  const prefix = track === 'anomaly' ? 'anomalyQuiz' : track === 'hybrid' ? 'hybridQuiz' : 'signatureQuiz';
  const nsBase = (suffix) => studentId ? `${suffix}:u${studentId}` : suffix;
  const storageBase = nsBase(`${prefix}:${moduleSlug}`);
  const [answers, setAnswers] = useState(Array(questions.length).fill(null));
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [firstPassSuccess, setFirstPassSuccess] = useState(false);
  const [lastAttemptTime, setLastAttemptTime] = useState(null);
  const [hydratedFromServer, setHydratedFromServer] = useState(false);
  const serverPassedRef = useRef(null);
  const quizStartRef = useRef(Date.now());

  // Start accumulating time for this quiz (moduleSlug represents parent module quiz grouping code
  // We send unit_type 'quiz' and unit_code moduleSlug for granularity)
  useTimeAccumulator({
    studentId,
    moduleSlug: (track === 'anomaly' ? 'anomaly-based-detection' : track === 'hybrid' ? 'hybrid-detection' : 'signature-based-detection'),
    unitType: 'quiz',
    unitCode: moduleSlug,
    authToken: authToken || (typeof window!== 'undefined' ? window.__authToken : null),
    debug: true,
    realtime: true
  });

  // One-time cleanup: when a real user is present, remove legacy global pass keys to prevent inheritance by new accounts.
  useEffect(()=>{
    if(!studentId) return; // only clean in authenticated context
    try {
      const CLEAN_KEY = 'quiz_pass_legacy_purged_v2';
      if(localStorage.getItem(CLEAN_KEY)==='true') return;
      const legacyGlobalKeys = [];
      const quizCodes = ['m1','m2','m3','m4','summary'];
      quizCodes.forEach(c=>{
        legacyGlobalKeys.push(`${moduleSlug}-module-quiz-passed`); // very old format
        legacyGlobalKeys.push(`signatureQuiz:${moduleSlug}:passed`); // old signature global
        legacyGlobalKeys.push(`anomalyQuiz:${moduleSlug}:passed`);
        legacyGlobalKeys.push(`hybridQuiz:${moduleSlug}:passed`);
      });
      legacyGlobalKeys.forEach(k=>{ try { if(localStorage.getItem(k)==='true') localStorage.removeItem(k); } catch {} });
      localStorage.setItem(CLEAN_KEY,'true');
    } catch {}
  }, [studentId, moduleSlug]);

  // Backward compatibility: earlier UI read `${moduleSlug}-module-quiz-passed` only, while new code also
  // stores a namespaced `signatureQuiz:${moduleSlug}:passed`. We will write both so sidebar/legacy panels update.
  const key = quizKeySubIndex != null ? `${moduleSlug}-module-quiz-passed-${quizKeySubIndex}` : `${moduleSlug}-module-quiz-passed`;
  // Derive canonical passed key for new system
  // Canonical user-specific pass key (new)
  // NOTE: We maintain BOTH orders for maximum compatibility while readers migrate:
  //  - canonical (preferred): <prefix>:<moduleSlug>:u<id>:passed
  //  - legacy (older build):  <prefix>:<moduleSlug>:passed:u<id>
  const passedStorageKey = nsBase(`${prefix}:${moduleSlug}:passed`); // legacy order (':passed:u<id>')
  const canonicalUserPassKey = studentId ? `${prefix}:${moduleSlug}:u${studentId}:passed` : null; // preferred
  // Legacy ordering (used briefly in earlier build) so we still write it for backward compatibility
  const legacyUserOrderedPassKey = studentId ? `${prefix}:${moduleSlug}:passed:u${studentId}` : null;
  const answersKey = `${storageBase}:answers`;
  const scoreKey = `${storageBase}:score`;
  const draftKey = `${storageBase}:answersDraft`;
  const attemptKey = `${storageBase}:attempts`;
  const firstPassKey = `${storageBase}:firstPassSuccess`;
  const lastAttemptKey = `${storageBase}:lastAttemptTime`;

  // Hydrate from server first (if studentId present), then local
  useEffect(()=>{
    let cancelled = false;
    (async ()=>{
      if (studentId && moduleSlug) {
        try {
          const res = await fetch(`/api/student/${studentId}/module/${moduleSlug}/quiz`);
          if (res.ok) {
            const data = await res.json();
            if (!cancelled && data && data.total) {
              serverPassedRef.current = !!data.passed;
              if (data.passed) {
                setAnswers(JSON.parse(localStorage.getItem(answersKey) || '[]'));
                setScore(data.score);
                setSubmitted(true);
                setReviewMode(true);
              }
              setHydratedFromServer(true);
            }
          }
        } catch {}
      }
      // Local fallback hydration
      try {
        // Prefer canonical user key first; fallback to legacy ordering and finally anonymous
        let passedRaw = (canonicalUserPassKey ? localStorage.getItem(canonicalUserPassKey) : null);
        if (passedRaw === null) {
          passedRaw = localStorage.getItem(passedStorageKey);
        }
        const passed = passedRaw === 'true';
        const storedAttempts = parseInt(localStorage.getItem(attemptKey) || '0', 10); setAttempts(isNaN(storedAttempts)?0:storedAttempts);
        setFirstPassSuccess(localStorage.getItem(firstPassKey) === 'true');
        const lat = localStorage.getItem(lastAttemptKey); if (lat) setLastAttemptTime(lat);
        if (passed) {
          const savedAnswers = JSON.parse(localStorage.getItem(answersKey) || '[]');
          const savedScore = parseInt(localStorage.getItem(scoreKey) || '0', 10);
          if (Array.isArray(savedAnswers) && savedAnswers.length === questions.length) {
            setAnswers(savedAnswers);
            setScore(savedScore);
            setSubmitted(true);
            setReviewMode(true);
          }
          // If server doesn't know about this pass yet, sync it now (one-shot)
          if (studentId && moduleSlug && serverPassedRef.current !== true) {
            try {
              const parentSlug = track === 'anomaly' ? 'anomaly-based-detection' : track === 'hybrid' ? 'hybrid-detection' : 'signature-based-detection';
              const headers = { 'Content-Type':'application/json', ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : (typeof window!== 'undefined' && window.__authToken ? { 'Authorization': `Bearer ${window.__authToken}` } : {})) };
              // Record quiz unit event
              fetch(`/api/student/${studentId}/module/${parentSlug}/unit`, { method:'POST', headers, body: JSON.stringify({ unit_type:'quiz', unit_code: moduleSlug, completed:true, duration_seconds: 0 }) }).catch(()=>{});
              // Upsert quiz scoreboard row
              fetch(`/api/student/${studentId}/module/${moduleSlug}/quiz`, { method:'POST', headers, body: JSON.stringify({ student_id: studentId, module_name: moduleSlug, passed: 1, score: savedScore || questions.length, total: questions.length }) }).catch(()=>{});
              try { window.dispatchEvent(new CustomEvent('moduleUnitUpdated', { detail: { moduleSlug: parentSlug, quizCode: moduleSlug } })); } catch {}
            } catch {}
          }
        } else if (studentId) {
          // Privacy hardening: if a legacy global pass key exists but the namespaced one doesn't,
          // we ignore (and optionally remove) the legacy key so a new user doesn't inherit it.
          const legacyKey = `signatureQuiz:${moduleSlug}:passed`;
          const legacyVal = localStorage.getItem(legacyKey);
          if (legacyVal === 'true' && !localStorage.getItem(passedStorageKey)) {
            try { localStorage.removeItem(legacyKey); } catch {}
          }
          // load draft if exists
          const draft = JSON.parse(localStorage.getItem(draftKey) || '[]');
          if (Array.isArray(draft) && draft.length === questions.length) {
            setAnswers(draft);
          }
        } else {
          // load draft if exists (legacy / anonymous)
          const draft = JSON.parse(localStorage.getItem(draftKey) || '[]');
          if (Array.isArray(draft) && draft.length === questions.length) {
            setAnswers(draft);
          }
        }
      } catch {}
    })();
    return ()=>{ cancelled = true; };
  }, [questions.length, studentId, moduleSlug, answersKey, scoreKey, passedStorageKey, draftKey, attemptKey, firstPassKey, lastAttemptKey]);
  const answeredCount = answers.filter(a=>a!==null).length;
  const pctAnswered = Math.round((answeredCount / questions.length) * 100);

  const setAnswer = (qi, val) => setAnswers(prev => { const c=[...prev]; c[qi]=val; try { localStorage.setItem(draftKey, JSON.stringify(c)); } catch {} return c; });

  const handleSubmit = () => {
    if (answers.some(a=>a===null)) return;
    const s = answers.reduce((acc,a,i)=> acc + (a === questions[i].ans ? 1 : 0), 0);
    setScore(s);
    setSubmitted(true);
  const passed = (s / questions.length) >= 0.8;
    try {
      // Write BOTH canonical and legacy user-specific keys so all readers update consistently.
      if (canonicalUserPassKey) {
        localStorage.setItem(canonicalUserPassKey, passed ? 'true' : 'false');
        try { window.dispatchEvent(new StorageEvent('storage', { key: canonicalUserPassKey, newValue: passed ? 'true' : 'false' })); } catch {}
      }
      // Legacy globals deprecated (remain for anonymous only until cleanup) + legacy reversed user order
      localStorage.setItem(passedStorageKey, passed ? 'true' : 'false');
      // Also write legacy ordering for transitional compatibility (will be ignored once migration stabilizes)
      if (legacyUserOrderedPassKey) {
        try { localStorage.setItem(legacyUserOrderedPassKey, passed ? 'true' : 'false'); } catch {}
      }
      // Proactively dispatch a synthetic storage event so same-tab listeners (Safari / Firefox edge cases) update
      try { window.dispatchEvent(new StorageEvent('storage', { key: passedStorageKey, newValue: passed ? 'true':'false' })); } catch {}
      localStorage.setItem(answersKey, JSON.stringify(answers));
      localStorage.setItem(scoreKey, String(s));
      const newAttempts = attempts + 1; setAttempts(newAttempts); localStorage.setItem(attemptKey, String(newAttempts));
      const nowIso = new Date().toISOString(); setLastAttemptTime(nowIso); localStorage.setItem(lastAttemptKey, nowIso);
      if (passed && attempts === 0) { localStorage.setItem(firstPassKey, 'true'); setFirstPassSuccess(true); }
      // Clear draft after submit
      localStorage.removeItem(draftKey);
    } catch {}
  const totalElapsed = Math.round((Date.now() - quizStartRef.current)/1000);
  if (passed) {
      // Enter review mode immediately after a passing submission so the user sees locked answers
      // and the UI offers an explicit Retake (Reset) instead of a misleading Try Again.
      setReviewMode(true);
      onPass && onPass();
      // Broadcast a custom event so sidebar / stats panels can refresh without full reload
      try {
        window.dispatchEvent(new CustomEvent('moduleQuizPassed', { detail: { moduleSlug, score: s, total: questions.length } }));
        window.dispatchEvent(new CustomEvent('moduleUnitUpdated', { detail: { unit_type: 'quiz', moduleSlug } }));
      } catch {}
      // Also normalize the aggregated dashboard key `module-<parentSlug>-module-quiz-passed`.
      // Parent slug for signature track is fixed; extend mapping here if additional top-level modules adopt this pattern.
      try {
  const parentSlug = track === 'anomaly' ? 'anomaly-based-detection' : track === 'hybrid' ? 'hybrid-detection' : 'signature-based-detection';
        const base = `module-${parentSlug}`;
        const aggKey = studentId ? `${base}-u${studentId}-module-quiz-passed` : `${base}-module-quiz-passed`;
        if (localStorage.getItem(aggKey) !== 'true') {
          localStorage.setItem(aggKey, 'true');
        }
        // Cleanup: remove any stale legacy pass keys from other tracks pointing at this moduleSlug to prevent UI confusion.
        try {
          const otherPrefixes = ['signatureQuiz','anomalyQuiz','hybridQuiz'].filter(p=>p!==(track==='anomaly'?'anomalyQuiz':track==='hybrid'?'hybridQuiz':'signatureQuiz'));
          otherPrefixes.forEach(p=>{
            const kUser = studentId ? `${p}:${moduleSlug}:u${studentId}:passed` : null;
            const kAnon = `${p}:${moduleSlug}:passed`;
            if (kUser && localStorage.getItem(kUser)==='true') localStorage.removeItem(kUser);
            if (localStorage.getItem(kAnon)==='true') localStorage.removeItem(kAnon);
          });
        } catch {}
      } catch {}
      // Notify backend unit tracker so quizzes_passed increments (ties into /modules/summary)
      if (studentId && moduleSlug) {
        try {
          const parentSlug = track === 'anomaly' ? 'anomaly-based-detection' : track === 'hybrid' ? 'hybrid-detection' : 'signature-based-detection';
          fetch(`/api/student/${studentId}/module/${parentSlug}/unit`, {
            method: 'POST',
            headers: { 'Content-Type':'application/json', ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : (typeof window!== 'undefined' && window.__authToken ? { 'Authorization': `Bearer ${window.__authToken}` } : {})) },
            body: JSON.stringify({ unit_type: 'quiz', unit_code: moduleSlug, completed: true, duration_seconds: totalElapsed })
          })
            .then(()=>{
              try { window.dispatchEvent(new CustomEvent('moduleUnitUpdated', { detail: { moduleSlug: parentSlug, quizCode: moduleSlug } })); } catch {}
            })
            .catch(()=>{});
        } catch {}
      }
    }
    if (studentId && moduleSlug) {
      (async () => {
        try {
          const res = await fetch(`/api/student/${studentId}/module/${moduleSlug}/quiz`, {
            method: 'POST', headers: { 'Content-Type':'application/json', ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : (typeof window!== 'undefined' && window.__authToken ? { 'Authorization': `Bearer ${window.__authToken}` } : {})) },
            body: JSON.stringify({ student_id: studentId, module_name: moduleSlug, passed: passed ? 1 : 0, score: s, total: questions.length })
          });
          if (res.ok) { onServerUpdate && onServerUpdate(); }
        } catch {}
      })();
    }
  };
  const retry = () => { if (reviewMode) return; setAnswers(Array(questions.length).fill(null)); setSubmitted(false); setScore(null); try { localStorage.setItem(draftKey, JSON.stringify(Array(questions.length).fill(null))); } catch {} };

  const resetAndRetake = () => {
    try {
      localStorage.removeItem(passedStorageKey);
      localStorage.removeItem(answersKey);
      localStorage.removeItem(scoreKey);
      localStorage.removeItem(draftKey);
    } catch {}
    setAnswers(Array(questions.length).fill(null));
    setScore(null);
    setSubmitted(false);
    setReviewMode(false);
  };

  return (
    <div className="rounded-xl border border-[var(--lms-border)] overflow-hidden bg-[var(--lms-surface)]">
      <div className="bg-gradient-to-r from-[var(--lms-primary-muted)] to-transparent px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white grid place-items-center">📝</div>
          <h2 className="text-lg font-semibold">Module Quiz</h2>
          <span className="ml-2 text-xs lms-text-faint">80% to pass</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-32 bg-[var(--lms-surface-alt)] rounded-full overflow-hidden" aria-hidden>
            <div className="h-full bg-[var(--lms-primary)] transition-all" style={{ width: `${pctAnswered}%` }} />
          </div>
          <span className="text-xs lms-text-muted tabular-nums">{pctAnswered}%</span>
        </div>
      </div>
      <div className="p-4">
        {markdownSource && (
          <div className="prose max-w-none mb-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdownSource}</ReactMarkdown>
          </div>
        )}
        {questions.map((q,i)=>(
          <QuestionBlock key={i} idx={i} q={q.q} options={q.options} correctIndex={q.ans} answered={answers[i]} setAnswer={(val)=>setAnswer(i,val)} locked={submitted} review={submitted} />
        ))}
        {!submitted ? (
          <div className="flex items-center justify-between mt-2">
            <div className="text-xs lms-text-faint">Answered {answeredCount}/{questions.length}</div>
            <button disabled={answers.some(a=>a===null)} onClick={handleSubmit} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md disabled:opacity-50">Submit Quiz</button>
          </div>
        ) : (
            <div className="mt-4 p-4 rounded-lg border border-[var(--lms-border)] bg-[var(--lms-surface-alt)]">
            <div className="font-semibold flex flex-wrap items-center gap-3">Your score: {score} / {questions.length} ({Math.round((score/questions.length)*100)}%)
              <span className="text-xs lms-text-faint">Attempts: {attempts}</span>
              {lastAttemptTime && <span className="text-xs lms-text-faint">Last: {new Date(lastAttemptTime).toLocaleString()}</span>}
              {firstPassSuccess && <span className="text-xs px-2 py-0.5 rounded bg-emerald-600/15 text-emerald-700 border border-emerald-500/40">First-Pass</span>}
            </div>
            {Math.round((score/questions.length)*100) >= 80 ? (
              <div className="lms-text-success mt-2 flex items-center gap-3">
                <span>🎉 Passed — great work!</span>
                {nextLessonHref && (
                  <Link to={nextLessonHref} className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs hover:bg-emerald-700 transition" aria-label={nextLessonLabel}>{nextLessonLabel} →</Link>
                )}
              </div>
            ) : (
              <div className="lms-text-danger mt-2">Not passed — review and retry.</div>
            )}
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={retry} disabled={reviewMode} className="px-3 py-1.5 border border-slate-300 rounded-md disabled:opacity-40">Try Again</button>
              {reviewMode && <button onClick={resetAndRetake} className="px-3 py-1.5 border border-indigo-300 text-indigo-700 rounded-md hover:bg-indigo-50">Retake (Reset)</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModuleQuiz;

export function ModuleQuizLegacy({ onPass, passed }) {
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const correct = 1;
  const answers = [
    'It blindly trusts all traffic',
    'It matches known patterns/signatures',
    'It executes every binary it sees',
    'It randomizes packet sizes'
  ];

  const submit = () => {
    setSubmitted(true);
    if (selected === correct && !passed) {
      onPass?.();
    }
  };

  return (
    <div className="border border-slate-300 bg-white rounded-lg p-6 shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Quick Module Quiz</h3>
      <p className="text-sm lms-text-muted mb-4">What best describes signature-based detection?</p>
      <ul className="space-y-2 mb-4">
        {answers.map((a, i) => (
          <li key={i}>
            <label className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${selected===i ? 'border-indigo-500 bg-indigo-50':'border-slate-200 hover:bg-slate-50'}`}>
              <input type="radio" name="quiz" value={i} checked={selected===i} onChange={()=>setSelected(i)} className="mt-1" />
              <span className="text-sm lms-text-muted">{a}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-4">
        <button onClick={submit} disabled={selected===null || submitted} className="px-4 py-2 rounded-md text-sm bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700">{passed ? 'Passed ✓' : submitted ? 'Submitted' : 'Submit'}</button>
        {submitted && (
          <span className={`text-sm ${selected===correct ? 'text-green-600':'text-red-600'}`}>
            {selected===correct ? 'Correct!' : 'Incorrect — try again next time.'}
          </span>
        )}
      </div>
    </div>
  );
}
