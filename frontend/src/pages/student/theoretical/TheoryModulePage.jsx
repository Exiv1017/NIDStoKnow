// Minimal temporary TheoryModulePage (clean baseline)
import { useState, useEffect, useRef, useContext, Suspense, lazy } from 'react';
import '../../../styles/lms-theme.css';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import AuthContext from '../../../context/AuthContext';
const LessonContent = lazy(()=>import('./components/LessonContent.jsx'));
import SidebarNav from './components/SidebarNav.jsx';
import ActivityPanel from './components/ActivityPanel.jsx';
// Option B only: standalone quiz route; remove inline ModuleQuiz usage.
// Global ModuleQuiz import removed; per-module quizzes will be integrated inline later.
import useServerModuleProgress from './hooks/useServerModuleProgress.js';
import { getLessonId } from './logic/ids.js';
import { ModuleLearningProvider } from './context/ModuleLearningContext.jsx';
import useServerLessonProgress from '../../../hooks/useServerLessonProgress.js';

// Sample markdown imports (adjust if paths differ)
import { signatureLessons, signatureModules, signatureModuleQuizzes } from '../../../content/signature/index.js';
import { anomalyModules, anomalyModuleQuizzes } from '../../../content/anomaly/index.js';
import { hybridModules, hybridModuleQuizzes } from '../../../content/hybrid/index.js';
import { getModuleQuizPassed } from './components/moduleQuizUtils.js';
import useModuleSummaries from '../../../hooks/useModuleSummaries.js';
import StatsPanel from './components/StatsPanel.jsx';
// Theme toggle removed (light-only)
import LessonNotesPanel from './components/LessonNotesPanel.jsx';
// Legacy merged progress removed – now purely server-authoritative
import LessonSkeleton from './components/LessonSkeleton.jsx';
import useTimeAccumulator from '../../../hooks/useTimeAccumulator.js';
import useModuleTimeSpent from '../../../hooks/useModuleTimeSpent.js';

const toSlug = (s='') => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

// Factory to build composite module from a modules definition (signature | anomaly | hybrid)
const buildCompositeModule = (track) => {
  let cfg; let meta;
  if (track === 'anomaly') {
    cfg = anomalyModules;
    meta = {
      title: 'Anomaly-Based Detection',
      description: 'Behavioral foundations, detection techniques, modeling, operations & review.',
      slug: 'anomaly-based-detection'
    };
  } else if (track === 'hybrid') {
    cfg = hybridModules;
    meta = {
      title: 'Hybrid Detection',
      description: 'Fusion of signature + anomaly: correlation, enrichment, adaptive modeling, operations & integration.',
      slug: 'hybrid-detection'
    };
  } else {
    cfg = signatureModules;
    meta = {
      title: 'Signature-Based Detection',
      description: 'Foundations, workflow, capture, application & evolution, plus summary.',
      slug: 'signature-based-detection'
    };
  }
  return [{
    title: meta.title,
    description: meta.description,
    slug: meta.slug,
    lessons: cfg.flatMap(m => m.lessons.map(l => ({
      id: l.id,
      title: l.title,
      duration: l.minutes,
      tags: l.tags,
      moduleNumber: m.module,
      moduleTitle: m.title === 'Summary & Review' ? 'Summary' : `Module ${m.module}: ${m.title}`,
      moduleCode: m.code,
      slug: l.slug,
      content: undefined,
      _importer: l.import
    })))
  }];
};

let seedModules = buildCompositeModule('signature');

const TheoryModulePage = () => {
  const { moduleSlug } = useParams();
  const navigate = useNavigate();
  const goToModuleQuiz = (moduleCode) => {
    if(!currentModule) return;
    // Smooth scroll to top then client-side navigate (avoid full reload losing auth state)
    try { window.scrollTo({top:0,behavior:'smooth'}); } catch {}
    setTimeout(()=>{ navigate(`/student/theoretical/${toSlug(currentModule.title)}/quiz?moduleQuiz=${moduleCode}`); }, 200);
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useContext(AuthContext) || { user: null };
  // Pull summarized server progress (quizzes_passed, etc.) so UI reflects backend, not just localStorage.
  const { summaries: moduleSummaries, refresh: refreshSummaries } = useModuleSummaries(user);
  useEffect(()=>{
    const h = ()=> refreshSummaries();
    window.addEventListener('moduleUnitUpdated', h);
    return ()=> window.removeEventListener('moduleUnitUpdated', h);
  }, [refreshSummaries]);

  const [currentModule, setCurrentModule] = useState(seedModules[0]);
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0); // will be replaced by hook below once lessons known
  const [toast, setToast] = useState(null);
  const [quizPassTick, setQuizPassTick] = useState(0); // increments when a quiz is passed to trigger re-render
  // Option B: no inline quiz rendering; quiz handled by dedicated route.
  const lessonRef = useRef(null);

  // Determine current track slug & normalized module slug for time tracking
  const currentTrack = (()=>{
    const slugged = toSlug(moduleSlug||'');
    if(slugged==='anomaly-based-detection') return 'anomaly';
    if(slugged==='hybrid-detection') return 'hybrid';
    return 'signature';
  })();
  const parentModuleSlug = currentTrack==='anomaly' ? 'anomaly-based-detection' : currentTrack==='hybrid' ? 'hybrid-detection' : 'signature-based-detection';
  const currentModuleTimeSpent = useModuleTimeSpent({ studentId: user?.id, moduleSlug: parentModuleSlug, initialSeconds: moduleSummaries[parentModuleSlug]?.time_spent, realtime: true });

  // Time accumulation for the Overview (lesson index -1) once at mount if first lesson index is 0 and user hasn't started lessons yet.
  const isOverviewPhase = currentLessonIdx === 0 && (currentModule?.lessons?.length||0) > 0 && localStorage.getItem(`overview-done:${parentModuleSlug}:u${user?.id||'anon'}`)!=='true';
  useTimeAccumulator({
    studentId: user?.id,
    moduleSlug: parentModuleSlug,
    unitType: isOverviewPhase ? 'overview' : 'lesson',
    unitCode: isOverviewPhase ? 'overview' : (currentModule?.lessons?.[currentLessonIdx]?.id || null),
    authToken: user?.token || null,
    debug: true,
    realtime: true
  });

  useEffect(() => {
    if (!moduleSlug) return;
    const slugged = toSlug(moduleSlug);
    const track = slugged === 'anomaly-based-detection' ? 'anomaly' : slugged === 'hybrid-detection' ? 'hybrid' : 'signature';
    seedModules = buildCompositeModule(track);
    const found = seedModules.find(m => toSlug(m.slug || m.title) === slugged);
    if (found) setCurrentModule(found);
  }, [moduleSlug]);

  // Seed cached totals (lessons + quizzes) for dashboard denominator accuracy.
  useEffect(()=>{
    if(!currentModule) return;
    try {
  const slug = toSlug(currentModule.slug || currentModule.title || '');
      const lessonTotal = (currentModule.lessons || []).length;
      if(lessonTotal>0){
        const key = `module-${slug}-lesson-total`;
        const existing = parseInt(localStorage.getItem(key)||'0',10);
        if(existing !== lessonTotal) localStorage.setItem(key, String(lessonTotal));
      }
      // Quiz total: derive from track quizzes definitions (signature has 5, anomaly currently 0/coming soon)
  const isAnomaly = slug==='anomaly-based-detection';
  const isHybrid = slug==='hybrid-detection';
  const quizSet = isAnomaly ? anomalyModuleQuizzes : isHybrid ? hybridModuleQuizzes : signatureModuleQuizzes;
  const quizCodes = ['m1','m2','m3','m4','summary'];
  // Each code appears once in quizCodes; summary already included so do NOT add it again.
  let quizTotal = quizCodes.filter(c => quizSet[c] && Array.isArray(quizSet[c].questions) && quizSet[c].questions.length>0).length;
  // Safety: if signature but dynamic evaluation mis-counted (e.g., lazy load), enforce expected 5
  if((!isAnomaly && !isHybrid) && quizTotal < 5) quizTotal = 5;
  if(isHybrid && quizTotal < 5) quizTotal = 5;
      const quizKey = `module-${slug}-quiz-total`;
      const existingQuiz = parseInt(localStorage.getItem(quizKey)||'0',10);
      if(quizTotal>0 && existingQuiz !== quizTotal) localStorage.setItem(quizKey, String(quizTotal));
    } catch { /* ignore */ }
  }, [currentModule]);

  useEffect(() => {
    // On mount or module change, read ?lesson= OR user-specific last lesson key.
    const lp = searchParams.get('lesson');
    const base = `theory:${currentModule.title}:last:lesson`;
    const userKey = user?.id ? `${base}:u${user.id}` : base;
    // Legacy key (without user namespace) for graceful fallback one time.
    let storedLesson = localStorage.getItem(userKey);
    if (storedLesson == null && user?.id) {
      // Fallback to legacy only if namespaced missing; do NOT overwrite until after we parse.
      storedLesson = localStorage.getItem(base);
    }
    // Remove legacy view key (deprecated)
    try { localStorage.removeItem(`theory:${currentModule.title}:last:view`); } catch {}
    if (lp !== null) {
      const idx = parseInt(lp, 10);
      if (!isNaN(idx) && idx >= 0 && idx < (currentModule.lessons?.length || 0)) {
        setCurrentLessonIdx(idx);
      }
    } else if (storedLesson) {
      const idx = parseInt(storedLesson, 10);
      if (!isNaN(idx) && idx >= 0 && idx < (currentModule.lessons?.length || 0)) {
        setCurrentLessonIdx(idx);
        const p = new URLSearchParams(searchParams);
        p.set('lesson', String(idx));
        setSearchParams(p, { replace: true });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleSlug, user?.id]);

  // When lesson changes, push to URL (shallow). This is now the single authoritative
  // URL <-> state sync (removed useSyncedLessonIndex to prevent infinite update loop).
  useEffect(() => {
    const current = searchParams.get('lesson');
    if (String(currentLessonIdx) !== current) {
      const next = new URLSearchParams(searchParams);
      next.set('lesson', String(currentLessonIdx));
      setSearchParams(next, { replace: true });
    }
    // Persist namespaced key (and remove legacy if present once we have user id).
    try {
      const base = `theory:${currentModule.title}:last:lesson`;
      const userKey = user?.id ? `${base}:u${user.id}` : base;
      localStorage.setItem(userKey, String(currentLessonIdx));
      if (user?.id) {
        // Avoid stale cross-user read later.
        localStorage.removeItem(base);
      }
    } catch {}
  }, [currentLessonIdx, searchParams, setSearchParams, user?.id, currentModule.title]);

  // Remove legacy view persistence (Option A retired)

  useEffect(() => {
    try { lessonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
  }, [currentLessonIdx]);

  // Lazy load lesson raw markdown content once (simple sequential approach)
  useEffect(()=>{
    if(!currentModule?.lessons) return;
    currentModule.lessons.forEach((lesson, idx)=>{
      if(lesson.content || !lesson._importer) return;
      lesson._importer().then(mod=>{
        lesson.content = mod.default || mod; // mutate in place (module state object)
        // Force a re-render after first batch load for current lesson
        if(idx === currentLessonIdx){ setCurrentLessonIdx(i=>i); }
      }).catch(()=>{ lesson.content = 'Content failed to load.'; });
    });
  }, [currentModule, currentLessonIdx]);

  const lessons = currentModule.lessons || [];
  // Server authoritative hooks
  const lessonServerProgress = useServerLessonProgress({ moduleTitle: currentModule.title, lessons, user });
  const moduleServerProgress = useServerModuleProgress({ user, moduleTitle: currentModule.title, lessons });
  // Removed secondary URL sync hook (useSyncedLessonIndex) to avoid double-setting state loops.
  // Removed global quiz view state
  const currentLesson = lessons[currentLessonIdx] || null;
  const completedSet = new Set(lessonServerProgress.completedIds);
  // Helper: determine if all lessons in a given module code are complete (accept canonical id or slug for backward compat)
  const isModuleFullyComplete = (moduleCode) => {
    if (!moduleCode) return false;
    if (moduleCode === 'summary') {
      // Summary quiz unlocks only after ALL lessons complete
      return lessons.length>0 && lessons.every((l,i)=>{
        const id = getLessonId(l,i);
        if (completedSet.has(id)) return true;
        // fallback slug check
        const slugId = toSlug(l.title||'');
        return completedSet.has(slugId);
      });
    }
    // Map module code to its numeric moduleNumber via signatureModules
  const activeModules = toSlug(currentModule.slug||currentModule.title)==='anomaly-based-detection' ? anomalyModules : signatureModules;
  const modMeta = activeModules.find(m=>m.code===moduleCode);
    if (!modMeta) return false;
    const targetNumber = modMeta.module;
    return lessons.filter(l=>l.moduleNumber===targetNumber).every((l,i)=>{
      // Need the absolute index for getLessonId; obtain by search once.
      const absoluteIndex = lessons.indexOf(l);
      const id = getLessonId(l, absoluteIndex);
      if (completedSet.has(id)) return true;
      const slugId = toSlug(l.title||'');
      return completedSet.has(slugId);
    });
  };
  const allLessonsComplete = isModuleFullyComplete('summary'); // reuse for overall (all)

  // Loading state sourced from lesson server progress (module progress has independent loading for quiz flag)
  const isLoading = lessonServerProgress.loading;

  // Normalized current module slug & track (used widely below)
  const currentModuleSlug = toSlug(currentModule?.slug || currentModule?.title || '');
  // currentTrack already declared earlier based on route param; reuse it here to avoid redeclaration.

  // Listen for quiz pass events to refresh quiz-derived UI (badges, counts) since localStorage changes don't re-render automatically.
  useEffect(()=>{
    const handler = (e) => {
      // Optional: could inspect e.detail.moduleSlug
      setQuizPassTick(t=>t+1);
    };
    window.addEventListener('moduleQuizPassed', handler);
    return ()=> window.removeEventListener('moduleQuizPassed', handler);
  }, []);

  // Keyboard shortcuts: ←/→ navigate lessons
  useEffect(() => {
    const handler = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight') { nextLesson(); }
      else if (e.key === 'ArrowLeft') { prevLesson(); }
      // Removed quiz toggle shortcuts
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [searchParams, setSearchParams, allLessonsComplete, currentLessonIdx]);

  // Enhanced shortcut set (Home, End, Alt+Q, Ctrl+Shift+N); '?' to show help toast
  useEffect(()=>{
    const adv = (e)=>{
      if(e.target && ['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
      // Home / End
      if(e.key==='Home'){ setCurrentLessonIdx(0); }
      if(e.key==='End'){ setCurrentLessonIdx(Math.max(0, lessons.length-1)); }
      // Alt+Q opens quiz for current lesson's module when unlocked
      if(e.altKey && e.key.toLowerCase()==='q'){
        const modNum = currentLesson?.moduleNumber; if(modNum){
          const moduleConfig = signatureModules.find(m=>m.module===modNum); if(moduleConfig){
            const moduleCode = moduleConfig.code;
            const moduleLessons = lessons.filter(l=>l.moduleNumber===modNum);
            const allCompleteForModule = moduleLessons.every(l=>{ const id=getLessonId(l, lessons.indexOf(l)); return lessonServerProgress.completedIds.includes(id); });
            if(allCompleteForModule){ navigate(`/student/theoretical/${toSlug(currentModule.title)}/quiz?moduleQuiz=${moduleCode}`); }
          }
        }
      }
      // Ctrl+Shift+N toggle notes button (simulate click on notes open button if closed)
      if(e.ctrlKey && e.shiftKey && e.key.toLowerCase()==='n'){
        const btn = document.querySelector('button[aria-label="Open notes"]');
        if(btn) { btn.click(); }
      }
      // '?' show quick help
      if(e.key==='?' || (e.shiftKey && e.key==='/')){
        setToast({ id: Date.now(), message: 'Shortcuts: ←/→ prev/next • Home/End first/last • Alt+Q quiz • Ctrl+Shift+N notes • ? help' });
      }
    };
    window.addEventListener('keydown', adv);
    return ()=>window.removeEventListener('keydown', adv);
  }, [lessons.length, currentLesson?.moduleNumber, lessonServerProgress.completedIds, currentModule.title]);

  const nextLesson = () => { if (currentLessonIdx < lessons.length - 1) setCurrentLessonIdx(i => i + 1); };
  const prevLesson = () => { if (currentLessonIdx > 0) setCurrentLessonIdx(i => i - 1); };

  const calcReadingTime = (raw='') => {
    const words = raw.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 180)); // approx 180 wpm
  };

  return (
  <div className="min-h-screen lms-app-bg">
      <style>{`.animate-slide-in{animation:slide-in .35s cubic-bezier(.4,0,.2,1);}@keyframes slide-in{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}.animate-ping-slow{animation:ping 1.6s cubic-bezier(0,0,.2,1) infinite}`}</style>
      <ModuleLearningProvider
        lessons={lessons}
        currentLessonIdx={currentLessonIdx}
        setCurrentLessonIdx={setCurrentLessonIdx}
        serverProgress={lessonServerProgress}
        currentModule={currentModule}
        getLessonIdFn={getLessonId}
      >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-12 gap-8">
        {/* Sidebar */}
        <aside className="col-span-12 lg:col-span-3 hidden lg:block">
          <SidebarNav track={currentTrack} onOpenModuleQuiz={({moduleCode,moduleNumber})=>{ navigate(`/student/theoretical/${toSlug(currentModule.title)}/quiz?moduleQuiz=${moduleCode}`); }} />
        </aside>
  {/* Main Content */}
  <section className="col-span-12 lg:col-span-9 xl:col-span-6">
          {/* HERO HEADER */}
          <div className="lms-surface mb-8 px-7 py-7 relative overflow-hidden" role="group" aria-labelledby="module-title">
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
              <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-indigo-100/60 blur-3xl" />
              <div className="absolute -bottom-16 -left-10 w-64 h-64 rounded-full bg-violet-100/50 blur-2xl" />
            </div>
            <div className="relative flex flex-col md:flex-row md:items-start gap-8">
              <div className="flex-1 min-w-0">
                {/* Removed standalone back button; relocated near Notes panel per request */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="lms-badge">Module</span>
                  <span className="lms-badge-neutral">Difficulty: <strong className="font-semibold">Intermediate</strong></span>
                  <span className="lms-badge-neutral">Lessons: {lessons.length}</span>
                  {/* Per-module quiz pass badges (m1-m4 + summary) */}
                  {['m1','m2','m3','m4','summary'].filter(code=> (currentTrack==='anomaly'? anomalyModuleQuizzes : currentTrack==='hybrid'? hybridModuleQuizzes : signatureModuleQuizzes)[code]).map(code=>{
                    const passed = getModuleQuizPassed(code, user?.id || null, currentTrack);
                    if (!passed) return null;
                    return <span key={code} className="lms-badge-success">{code==='summary' ? 'Summary Quiz' : code.toUpperCase()} ✓</span>;
                  })}
                </div>
                <h1 id="module-title" className="lms-heading-xl mb-3 tracking-tight">{currentModule.title}</h1>
                <p className="text-sm lms-text-soft max-w-2xl leading-relaxed">{currentModule.description}</p>
                <div className="mt-6 flex flex-wrap items-center gap-8">
                  {(() => {
                    // Unified progress ring using server-authoritative quiz count when higher.
                    const isAnomaly = currentTrack==='anomaly';
                    const isHybrid = currentTrack==='hybrid';
                    const quizCodes = ['m1','m2','m3','m4','summary'];
                    const localQuizPassedCount = quizCodes.filter(c=>getModuleQuizPassed(c, user?.id || null, currentTrack)).length;
                    const summarySlug = currentTrack==='anomaly' ? 'anomaly-based-detection' : currentTrack==='hybrid' ? 'hybrid-detection' : 'signature-based-detection';
                    const serverQuizPassedCount = moduleSummaries[summarySlug]?.quizzes_passed || 0;
                    const quizzesPassed = Math.max(localQuizPassedCount, serverQuizPassedCount);
                    const lessonsPlanned = (isAnomaly || isHybrid) ? 13 : 11;
                    const lessonUnits = Math.min(lessonServerProgress.completedIds.length, lessonsPlanned);
                    // Overview completion reflects server state; starts at 0 for new accounts
                    const overviewUnit = moduleSummaries[summarySlug]?.overview_completed ? 1 : 0;
                    const practicalDone = false; // future: derive from server
                    const assessmentDone = false; // future: derive from server
                    const ringTotal = 1 + lessonsPlanned + quizCodes.length + 1 + 1; // overview + lessons + quizzes + practical + assessment
                    const ringCompleted = Math.min(ringTotal, overviewUnit + lessonUnits + quizzesPassed + (practicalDone?1:0) + (assessmentDone?1:0));
                    const pct = ringTotal ? ringCompleted / ringTotal : 0;
                    const percentDisplay = Math.round(pct*100);
                    return (
                      <div className="flex items-center gap-4">
                        <div className="lms-progress-ring" aria-label="Overall progress" role="progressbar" aria-valuemin={0} aria-valuemax={ringTotal} aria-valuenow={ringCompleted} aria-valuetext={`${ringCompleted} of ${ringTotal} units (overview, lessons, quizzes, practical, assessment)`}>
                          <svg width="46" height="46">
                            <circle cx="23" cy="23" r={20} stroke="#e0e7ff" strokeWidth="4" fill="none" />
                            <circle cx="23" cy="23" r={20} stroke="var(--lms-primary)" strokeWidth="4" fill="none" strokeDasharray={`${(2*Math.PI*20)}`} strokeDashoffset={`${(1-pct)*(2*Math.PI*20)}`} strokeLinecap="round" style={{transition:'stroke-dashoffset .6s ease'}} />
                          </svg>
                          <div className="lms-progress-ring__label">{percentDisplay}%</div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs uppercase tracking-wide lms-text-faint">Progress ({ringTotal}-unit)</span>
                          <span className="text-sm font-semibold lms-text-accent">{ringCompleted}/{ringTotal}</span>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-wide lms-text-faint">Estimated Time</span>
                      <span className="text-sm font-medium">~{Math.max(15, lessons.length*7)} mins</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-wide lms-text-faint">Time Spent <span style={{color:'#22c55e',fontWeight:600,marginLeft:4}}>[live]</span></span>
                      <span className="text-sm font-medium">
                        {(()=>{
                          const s=currentModuleTimeSpent||0;
                          const m=Math.floor(s/60); const r=s%60;
                          if(window && window.__DEBUG_LIVE_TIME!==s){
                            window.__DEBUG_LIVE_TIME=s;
                            // eslint-disable-next-line no-console
                            console.log('[realtime-ui] Time Spent now', s, 'seconds');
                          }
                          return `${m}m ${r}s`;
                        })()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-wide lms-text-faint">Status</span>
                      <span className="text-sm font-medium">{allLessonsComplete ? (moduleServerProgress.quizPassed ? 'Completed' : 'Ready for Quiz') : 'In Progress'}</span>
                    </div>
                  </div>
                  {(() => { // Lessons progress bar (visual, separate from ring) placed left of quizzes
                    const totalLessons = lessons.length;
                    const done = lessonServerProgress.completedIds.length;
                    const pct = totalLessons ? Math.round((done/totalLessons)*100) : 0;
                    return (
                      <div className="flex items-center gap-3" aria-label="Lessons progress" role="group">
                        <div className="flex flex-col">
                          <span className="text-xs uppercase tracking-wide lms-text-faint">Lessons</span>
                          <span className="text-sm font-semibold lms-text-accent">{done}/{totalLessons} done</span>
                        </div>
                        <div className="w-28 h-2 bg-[var(--lms-surface-alt)] rounded overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={totalLessons} aria-valuenow={done} aria-valuetext={`${done} of ${totalLessons} lessons completed`}>
                          <div className="h-full bg-[var(--lms-primary)] transition-all" style={{width:`${pct}%`}} />
                        </div>
                      </div>
                    );
                  })()}
                  {(() => { // Module quiz progress summary (m1-m4 + summary)
                    const activeQuizSet = currentTrack==='anomaly' ? anomalyModuleQuizzes : currentTrack==='hybrid' ? hybridModuleQuizzes : signatureModuleQuizzes;
                    const quizCodes = Object.keys(activeQuizSet).filter(k=>activeQuizSet[k].questions.length>0);
                    const localPassed = quizCodes.filter(c=>getModuleQuizPassed(c, user?.id || null, currentTrack)).length;
                    // Server authoritative count (signature/anomaly/hybrid all aggregated under composite slug)
                    const summarySlug = currentTrack==='anomaly' ? 'anomaly-based-detection' : currentTrack==='hybrid' ? 'hybrid-detection' : 'signature-based-detection';
                    const serverRow = moduleSummaries[summarySlug];
                    const serverPassed = serverRow?.quizzes_passed ?? 0;
                    const passed = Math.max(localPassed, serverPassed);
                    const pct = quizCodes.length? Math.round((passed/quizCodes.length)*100):0;
                    return (
                      <div className="flex items-center gap-3" aria-label="Module quiz progress" role="group">
                        <div className="flex flex-col">
                          <span className="text-xs uppercase tracking-wide lms-text-faint">Module Quizzes</span>
                          <span className="text-sm font-semibold lms-text-accent">{passed}/{quizCodes.length} passed</span>
                        </div>
                        <div className="w-28 h-2 bg-[var(--lms-surface-alt)] rounded overflow-hidden" aria-label="Quizzes passed" role="progressbar" aria-valuemin={0} aria-valuemax={quizCodes.length} aria-valuenow={passed} aria-valuetext={`${passed} of ${quizCodes.length} quizzes passed`}>
                          <div className="h-full bg-[var(--lms-primary)] transition-all" style={{width:`${pct}%`}} />
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-6">
                  {(() => {
                    const quizCodes = ['m1','m2','m3','m4','summary'];
                    const lessonTotal = lessons.length;
                    const localPassed = quizCodes.filter(c=>getModuleQuizPassed(c, user?.id || null, currentTrack)).length;
                    const summarySlug = currentTrack==='anomaly' ? 'anomaly-based-detection' : currentTrack==='hybrid' ? 'hybrid-detection' : 'signature-based-detection';
                    const serverPassed = moduleSummaries[summarySlug]?.quizzes_passed ?? 0;
                    const quizzesPassed = Math.max(localPassed, serverPassed);
                    return (
                      <div className="flex flex-wrap items-center gap-5 text-xs font-medium lms-text-soft" aria-label="Progress breakdown (lessons & quizzes)">
                        <span className="flex items-center gap-1"><span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--lms-surface-alt)] border border-[var(--lms-border)]">Lessons</span> <span className="text-[var(--lms-primary)] font-semibold">{lessonServerProgress.completedIds.length}/{lessonTotal}</span></span>
                        <span className="flex items-center gap-1"><span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--lms-surface-alt)] border border-[var(--lms-border)]">Quizzes</span> <span className="text-[var(--lms-primary)] font-semibold">{quizzesPassed}/{quizCodes.length}</span></span>
                      </div>
                    );
                  })()}
                </div>
                <div className="mt-4 flex gap-3 flex-wrap items-center">
                  {!allLessonsComplete && (
                    <button className="lms-primary lms-focus-ring" onClick={()=>{ /* resume current lesson scroll */ lessonRef.current?.scrollIntoView({behavior:'smooth'}); }}>Resume Lesson {currentLessonIdx+1}</button>
                  )}
                  {/* Dark mode toggle removed */}
                </div>
                <div className="mt-4">
                  {isLoading && <p className="text-[10px] uppercase tracking-wide lms-text-accent animate-pulse mt-2">Syncing...</p>}
                </div>
              </div>
            </div>
          </div>
          {isLoading && (<div className="max-w-3xl mx-auto mb-8"><LessonSkeleton /></div>)}
          {!isLoading && currentLesson ? (
            <article ref={lessonRef} className="max-w-3xl mx-auto" aria-labelledby="lesson-title">
              <header className="mb-6">
                <h2 id="lesson-title" className="lms-heading-lg tracking-tight mb-2">{currentLesson.title}</h2>
                <div className="lesson-meta flex flex-wrap items-center gap-3 text-xs lms-text-faint bg-white/60 border border-[var(--lms-border)] rounded-md px-3 py-2">
                  <span className="flex items-center gap-1"><span aria-hidden="true">⏱</span>{currentLesson.duration || calcReadingTime(currentLesson.content)} mins</span>
                  <span className="flex items-center gap-1"><span aria-hidden="true">🗓</span>Updated {new Date().toLocaleDateString()}</span>
                  {Array.isArray(currentLesson.tags) && currentLesson.tags.map(t=> <span key={t} className="lms-pill">{t}</span>)}
                  <button
                    onClick={()=>{ const id=getLessonId(currentLesson,currentLessonIdx); if(!lessonServerProgress.completedIds.includes(id)){ lessonServerProgress.markComplete(currentLessonIdx); setToast({id:Date.now(), message:`Marked "${currentLesson.title}" complete`}); } }}
                    className="ml-auto text-[11px] font-medium px-2.5 py-1 rounded-md border border-[var(--lms-border)] hover:bg-[var(--lms-primary-muted)] hover:text-[var(--lms-primary)] transition"
                  >
                    {(()=>{const id=getLessonId(currentLesson,currentLessonIdx); return lessonServerProgress.completedIds.includes(id) ? 'Completed' : 'Mark Complete';})()}
                  </button>
                </div>
              </header>
              <div className="lesson-content space-y-8 mb-12">
                {(()=>{ // Quiz readiness banner for current lesson's module
                  if(!currentLesson) return null;
                  const moduleNumber = currentLesson.moduleNumber;
                  const moduleConfig = (currentTrack==='anomaly'? anomalyModules : currentTrack==='hybrid'? hybridModules : signatureModules).find(m=>m.module===moduleNumber);
                  if(!moduleConfig) return null;
                  const moduleCode = moduleConfig.code;
                  const moduleLessons = lessons.filter(l=>l.moduleNumber===moduleNumber);
                  const allCompleteForModule = moduleLessons.every(l=>{ const id=getLessonId(l, lessons.indexOf(l)); return lessonServerProgress.completedIds.includes(id); });
                  const quizPassed = getModuleQuizPassed(moduleCode, user?.id || null, currentTrack);
                  if(!allCompleteForModule || quizPassed) return null;
                  return (
                    <div className="lms-quiz-unlock-banner animate-slide-in" role="status" aria-live="polite">
                      <div className="lms-quiz-unlock-header">
                        <span className="lms-quiz-unlock-icon" aria-hidden="true">✅</span>
                        <span className="lms-quiz-unlock-text">Module {moduleNumber} lessons complete — Quiz unlocked!</span>
                      </div>
                      <div className="lms-quiz-unlock-actions">
                        <button onClick={()=> goToModuleQuiz(moduleCode)} className="lms-quiz-unlock-btn">Take Quiz →</button>
                        <button onClick={()=>{ sessionStorage.setItem(`hideQuizBanner:${moduleCode}`,'1'); }} className="lms-quiz-unlock-dismiss">Dismiss</button>
                      </div>
                    </div>
                  );
                })()}
                <Suspense fallback={<div className="space-y-3" aria-hidden="true">{Array.from({length:8}).map((_,i)=><div key={i} className="h-4 bg-slate-200 rounded animate-pulse" />)}</div>}>
                  <LessonContent content={currentLesson.content} />
                </Suspense>
                <ActivityPanel
                  onComplete={() => { 
                    lessonServerProgress.markComplete(currentLessonIdx); 
                    setToast({ id: Date.now(), message: `Marked "${currentLesson.title}" complete` });
                  }}
                  completed={(() => { const id = getLessonId(currentLesson, currentLessonIdx); return lessonServerProgress.completedIds.includes(id); })()}
                />
                <div>
                  <LessonNotesPanel moduleTitle={currentModule.title} lessonTitle={currentLesson.title} onExit={()=>navigate('/learning-modules')} />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 pt-4 border-t">
                <button onClick={prevLesson} disabled={currentLessonIdx === 0} className="px-4 py-2 rounded-md text-sm bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40" aria-label="Previous lesson">Previous</button>
                <div className="text-xs lms-text-muted" aria-live="polite">Lesson {currentLessonIdx + 1} of {lessons.length}</div>
                <button onClick={nextLesson} disabled={currentLessonIdx >= lessons.length - 1} className="px-4 py-2 rounded-md text-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40" aria-label="Next lesson">{currentLessonIdx >= lessons.length - 1 ? 'End' : 'Next'}</button>
              </div>
              {currentLessonIdx === lessons.length -1 && (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  {(()=>{ // Offer direct quiz CTA for relevant internal module
                    const currentModuleNumber = currentLesson.moduleNumber;
                    const moduleConfig = (currentTrack==='anomaly'? anomalyModules : currentTrack==='hybrid'? hybridModules : signatureModules).find(m=>m.module===currentModuleNumber);
                    if(!moduleConfig) return null;
                    const moduleCode = moduleConfig.code;
                    const allCompleteForModule = lessons.filter(l=>l.moduleNumber===currentModuleNumber).every(l=>{ const id=getLessonId(l, lessons.indexOf(l)); return lessonServerProgress.completedIds.includes(id); });
                    if(!allCompleteForModule) return null;
                    return (
                      <button onClick={()=> goToModuleQuiz(moduleCode)} className="lms-primary-outline text-sm">Go to Module {currentModuleNumber} Quiz →</button>
                    );
                  })()}
                </div>
              )}
              {/* (Quiz moved to exclusive view) */}
              {toast && (
                <div className="fixed bottom-4 right-4 z-50">
                  <div className="bg-slate-900/90 text-white text-sm px-4 py-2 rounded shadow-lg flex items-center gap-3 animate-slide-in" role="status" aria-live="polite">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping-slow" />
                    <span>{toast.message}</span>
                    <button onClick={()=>setToast(null)} className="lms-text-subtle hover:lms-text-inverse ml-2" aria-label="Dismiss notification">×</button>
                  </div>
                </div>
              )}
            </article>
          ) : (
            <div className="text-center lms-text-muted py-12">No lesson selected.</div>
          )}
        </section>
        {/* Stats Side Panel */}
        <aside className="col-span-12 xl:col-span-3 hidden xl:block">
          <StatsPanel estimatedTotalMinutes={Math.max(15, lessons.length*7)} />
        </aside>
      </div>
      </ModuleLearningProvider>
    </div>
  );
};

export default TheoryModulePage;
