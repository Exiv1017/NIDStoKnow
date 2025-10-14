import { useState, useEffect, useContext, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
// Interactive lesson blocks
import { PointsTrackerBlock, HighlightBox, QuoteBlock, ImageOverlayBlock, IconList, FlipCardDeck, ExpandableCardGroup, Carousel, TimelineFancy, HotspotImage, DragOrderBlock, MatchingPairs, FillBlank, ReflectionBlock, PollBlock, DoDontBlock, NextStepsBlock, ScenarioBlock, PersonaCard, CertificateBlock } from '../../components/LessonBlocks.jsx';
import React, { useRef } from 'react';
import AuthContext from '../../context/AuthContext';
import useModuleProgress from '../../hooks/useModuleProgress';
import { toSlug, loadCompletedLessonIds } from './theoretical/logic/ids';
import ModuleCard from '../../components/ModuleCard';
import useModuleSummaries from '../../hooks/useModuleSummaries.js';
import { lessonIdsKey } from './theoretical/logic/ids';

// Build API base from window override or Vite env; default to same-origin
const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
const apiUrl = (p) => `${API_BASE}${p}`.replace(/([^:]?)\/\/+/g,'$1/');

const LearningModules = ({ modules, setModules }) => {
  const { user } = useContext(AuthContext);
  const { moduleName, lessonName } = useParams();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [moduleProgress, setModuleProgress] = useState({});
  const [forceUpdate, setForceUpdate] = useState(0);
  const [loadingModules, setLoadingModules] = useState(false); // placeholder if async later
  const [fetchError, setFetchError] = useState('');
  const [assignments, setAssignments] = useState([]);
  // Assigned-only filter removed in favor of a manual refresh button (server now authoritative for gating & assignments visible inline).
  const [assignedOnly, setAssignedOnly] = useState(false); // kept to avoid refactors elsewhere; always false.
  const [lastSync, setLastSync] = useState(null); // ISO timestamp of last modules summary fetch
  const { summaries, refresh: refreshSummaries, error: summariesError } = useModuleSummaries(user);
  const getSummary = (title='') => summaries[toSlug(title)] || null;
  // Auto-refresh summaries periodically (the hook already loads once on mount)
  useEffect(()=>{ const id = setInterval(()=>{ if(user?.id) refreshSummaries(); }, 30000); return ()=> clearInterval(id); }, [user?.id, refreshSummaries]);

  const formatNotificationTime = (timeString) => {
    try {
      const date = new Date(timeString);
      const now = new Date();
      const diffMs = now - date;
      const mins = Math.floor(diffMs / 60000);
      const hours = Math.floor(mins / 60);
      const days = Math.floor(hours / 24);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
      if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
      if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
      return date.toLocaleDateString();
    } catch {
      return timeString || '';
    }
  };
  // Load notifications for this student
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/student/notifications`),
          { headers: user?.token ? { 'Authorization': `Bearer ${user.token}` } : {} }
        );
        if (res.ok) {
          const data = await res.json();
          setNotifications(Array.isArray(data) ? data : []);
        }
        try {
          const c = await fetch(apiUrl('/api/student/notifications/count'), { headers: user?.token ? { 'Authorization': `Bearer ${user.token}` } : {} });
          if (c.ok) {
            const cj = await c.json();
            setUnreadCount(typeof cj?.count === 'number' ? cj.count : 0);
          }
        } catch {}
      } catch (e) {
        // no-op
      }
    })();
  }, [user?.id, user?.token]);


  const isModuleAssigned = (moduleTitle = '') => {
    try {
      const t = (moduleTitle || '').toLowerCase();
      return Array.isArray(assignments) && assignments.some(a => String(a.moduleName || '').toLowerCase() === t);
    } catch { return false; }
  };

  // Load assignments once for this student
  useEffect(() => {
    if (!user?.id) return;
    const cached = localStorage.getItem('student_assignments_cache');
    if (cached) {
      try { setAssignments(JSON.parse(cached)); } catch {}
    }
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/student/assignments?student_id=${user.id}`), {
          headers: user?.token ? { 'Authorization': `Bearer ${user.token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          setAssignments(Array.isArray(data) ? data : []);
          localStorage.setItem('student_assignments_cache', JSON.stringify(Array.isArray(data) ? data : []));
        }
      } catch {}
    })();
  }, [user?.id]);

  useEffect(() => {
    try { localStorage.setItem('assigned-only', assignedOnly ? 'true' : 'false'); } catch {}
  }, [assignedOnly]);

  // When summaries change (server fetch completed), update lastSync.
  useEffect(()=>{
    if (summaries && Object.keys(summaries).length>0) {
      setLastSync(new Date());
    }
  }, [summaries]);

  // Listen for unit updates (quiz/practical/assessment) to trigger immediate refresh
  useEffect(()=>{
    const handler = () => { refreshSummaries(); };
    window.addEventListener('moduleUnitUpdated', handler);
    // Backward compat events dispatched by legacy practical component
    window.addEventListener('practicalCompleted', handler);
    return ()=>{
      window.removeEventListener('moduleUnitUpdated', handler);
      window.removeEventListener('practicalCompleted', handler);
    };
  }, [refreshSummaries]);

  const manualRefresh = async () => {
    await refreshSummaries();
    setLastSync(new Date());
  };
  
  // Helper: compute progress (revised model)
  // Denominator: Overview (1) + Theory lessons (N). Quizzes are shown separately and do not dilute lesson completion.
  // Practical & Assessment still excluded from percentage (tracked independently).
  const computePerItemProgress = (moduleObj) => {
    if(!moduleObj) return 0;
    const summary = getSummary(moduleObj.title);
    if(summary){
      const expectedLessons = summary.total_lessons || 0;
      const expectedQuizzes = summary.total_quizzes || 0;
      const quizUnits = summary.quizzes_passed ? expectedQuizzes : 0; // boolean semantics
      const numerator = (summary.overview_completed?1:0) + summary.lessons_completed + quizUnits + (summary.practical_completed?1:0) + (summary.assessment_completed?1:0);
      const denom = 1 + expectedLessons + expectedQuizzes + 2;
      if(denom<=0) return 0;
      let pct = Math.round((numerator/denom)*100);
      if(pct===100 && !summary.assessment_completed) pct = 95;
      return pct;
    }
    return 0; // fallback disabled (server authoritative)
  };

  // Previous destructive migration removed: it incorrectly reset practical/assessment flags on refresh
  // leading to loss of completion state before lesson IDs finished loading. We now simply ensure
  // assessment is unset if practical not done (non-destructive) and avoid clearing user completions.
  useEffect(() => {
    const SAFE_MIGRATION_KEY = 'lm_non_destructive_alignment_v2';
    if (localStorage.getItem(SAFE_MIGRATION_KEY) === 'true') return;
    if (!Array.isArray(modules) || modules.length === 0) return;
    try {
      modules.forEach(module => {
        if (!module?.title) return;
        const slug = toSlug(module.title);
        const base = `module-${slug}`;
        const prefixes = user?.id ? [`${base}-u${user.id}`, base] : [base];
        prefixes.forEach(pref => {
          const practicalKey = `${pref}-practical-completed`;
            const assessmentKey = `${pref}-assessment-completed`;
          const practicalDone = localStorage.getItem(practicalKey) === 'true';
          if (!practicalDone) {
            // Do NOT forcibly clear existing assessment flag if already true; just ensure consistency going forward
            // (optional: could unset assessment if practical incomplete, but we avoid destructive changes now)
          }
        });
      });
      localStorage.setItem(SAFE_MIGRATION_KEY, 'true');
    } catch (e) {}
  }, [modules, user?.id]);

  // One-time legacy cleanup: remove old non-namespaced completed-lesson-ids keys when a user id is present.
  useEffect(()=>{
    if(!user?.id) return; // keep for anonymous mode
    try {
      const CLEAN_KEY = 'lm_legacy_completed_ids_purged_v1';
      if(localStorage.getItem(CLEAN_KEY)==='true') return;
      (modules||[]).forEach(m=>{
        if(!m?.title) return;
        const slug = toSlug(m.title);
        const legacyKey = `module-${slug}-completed-lesson-ids`; // pre-namespace format
        const namespacedKey = `module-${slug}-u${user.id}-completed-lesson-ids`;
        if(localStorage.getItem(legacyKey) && localStorage.getItem(namespacedKey)){
          // Safe to remove legacy key (duplicate / outdated titles)
          try { localStorage.removeItem(legacyKey); } catch {}
        }
      });
      localStorage.setItem(CLEAN_KEY,'true');
    } catch { /* ignore */ }
  }, [modules, user?.id]);

  // Sync practical & assessment section objects with persisted keys so styling is immediately green after refresh
  useEffect(() => {
    if (!Array.isArray(modules) || modules.length === 0) return;
    let anyChanged = false;
    setModules(prev => {
      const current = prev || [];
      const updated = current.map(m => {
        if (!m?.title) return m;
        const slug = toSlug(m.title);
        const base = `module-${slug}`;
        const prefix = user?.id ? `${base}-u${user.id}` : base;
        const practicalDone = localStorage.getItem(`${prefix}-practical-completed`) === 'true';
        const assessmentDone = localStorage.getItem(`${prefix}-assessment-completed`) === 'true';
        if (!practicalDone && !assessmentDone) return m; // nothing to sync
        let changed = false;
        const next = { ...m };
        next.sections = (next.sections || []).map(s => {
          if (s.name === 'Practical Exercise' && practicalDone && !s.completed) { changed = true; return { ...s, completed: true, locked: false }; }
          if (s.name === 'Assessment' && assessmentDone && !s.completed) { changed = true; return { ...s, completed: true, locked: false }; }
          return s;
        });
        if (changed) { anyChanged = true; return next; }
        return m;
      });
      return anyChanged ? updated : current; // prevent pointless state update loops
    });
  }, [modules, user?.id, setModules]);

  const getDifficultyBadge = (difficulty) => {
    const styles = {
      Beginner: 'bg-green-100 text-green-800',
      Intermediate: 'bg-yellow-100 text-yellow-800',
      Advanced: 'bg-red-100 text-red-800'
    };
    return styles[difficulty] || 'bg-gray-100 text-gray-800';
  };

  // Helpers used by rendering logic
  const slugify = (s = '') => s.toLowerCase().replace(/\s+/g, '-');

  // Route fix: theory pages require explicit /theory segment per App.jsx route definition
  const getTheoryUrl = (moduleTitle = '') => `/student/theoretical/${slugify(moduleTitle)}/theory`;

  const getSectionButtonStyle = (section, module) => {
    try {
      const slug = slugify(module.title);
      const base = `module-${slug}`;
      const prefix = user?.id ? `${base}-u${user.id}` : base;
  const summary = getSummary(module.title);
  const overviewCompleted = summary ? !!summary.overview_completed : false;
  const theoryUnlocked = summary ? !!summary.overview_completed : false;
      // Derive completion from storage if model hasn't bubbled state yet
      let derivedCompleted = section.completed;
      if(summary){
        if(section.name === 'Overview' && summary.overview_completed) derivedCompleted = true;
        if(section.name === 'Practical Exercise' && summary.practical_completed) derivedCompleted = true;
        if(section.name === 'Assessment' && summary.assessment_completed) derivedCompleted = true;
      }
      // Local storage derivation removed; rely solely on server flags & existing section.completed state.

      let isAccessible;
      // If assigned-only is enabled, only allow modules that are assigned
      if (assignedOnly && !isModuleAssigned(module.title)) {
        return 'bg-gray-200 text-gray-400 cursor-not-allowed';
      }
      if (section.name === 'Theory' && overviewCompleted && theoryUnlocked) {
        isAccessible = true;
      } else if (section.locked === false) {
        isAccessible = true;
      } else if (section.name === 'Overview') {
        isAccessible = true; // overview always accessible
      } else {
        isAccessible = !section.locked; // rely purely on locked flag from summaries normalization
      }

      // If Theory and all lessons completed, mark as completed (green)
      if (section.name === 'Theory' && summary) {
        const allLessonsDone = (summary.total_lessons || 0) > 0 && (summary.lessons_completed || 0) >= (summary.total_lessons || 0);
        if (allLessonsDone) return 'bg-green-100 text-green-800 hover:bg-green-200';
      }

      // Locked (not accessible)
      if (!isAccessible) return 'bg-gray-200 text-gray-400 cursor-not-allowed';
      // Completed stays green
  if (derivedCompleted || (summary && section.name==='Practical Exercise' && summary.practical_completed) || (summary && section.name==='Assessment' && summary.assessment_completed)) return 'bg-green-100 text-green-800 hover:bg-green-200';

      // Available (accessible but not completed): use blue tint with darker blue text,
      // matching the green pill opacity but in blue.
      if (section.name === 'Overview') {
        // Keep Overview primary look when available
        return 'bg-[#206EA6] hover:bg-[#185785] text-white cursor-pointer';
      }
      return 'bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-200';
    } catch {
      return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSectionComplete = (moduleId, sectionName, subName) => {
    try {
      if (typeof setModules === 'function') {
        setModules(prev => (prev || []).map(m => {
          if (m.id !== moduleId) return m;
          const next = { ...m };
          next.sections = (next.sections || []).map(s => {
            if (s.name !== sectionName) return s;
            const updated = { ...s };
            if (subName && Array.isArray(updated.subModules)) {
              updated.subModules = updated.subModules.map(sm => sm.name === subName ? { ...sm, completed: true } : sm);
              // If all subModules completed, mark section completed too
              if (updated.subModules.every(sm => sm.completed)) updated.completed = true;
            } else {
              updated.completed = true;
            }
            return updated;
          });
          return next;
        }));
      }
      if (['Overview','Theory','Practical Exercise','Assessment'].includes(sectionName)) {
        refreshSummaries();
      }
    } catch {}
  };

  const markLessonCompleted = (moduleTitle = '', lessonTitle = '') => {
    try {
      const slug = slugify(moduleTitle);
      // Title-based legacy completion list only for anonymous users (no user.id) for backward compatibility.
      if (!user?.id) {
        const legacyKey = `${slug}-completed-lessons`;
        const list = JSON.parse(localStorage.getItem(legacyKey) || '[]');
        if (!list.includes(lessonTitle)) {
          list.push(lessonTitle);
          localStorage.setItem(legacyKey, JSON.stringify(list));
        }
      }
      // For namespaced users, incremental marking of lesson IDs is handled in theoretical pages via updated hooks.
    } catch {}
  };

  // Prefer the three core top-level modules when they are present (Signature, Anomaly, Hybrid).
  // This prevents expanded per-theory submodules (Module 1/2/3...) from showing up on the Learning Modules page.
  const coreModuleTitles = ['Signature-Based Detection', 'Anomaly-Based Detection', 'Hybrid Detection'];
  const visibleModules = (Array.isArray(modules) && modules.some(m => coreModuleTitles.includes(m.title)))
    ? modules.filter(m => coreModuleTitles.includes(m.title))
    : modules;

  // If the modules array looks like a per-theory breakdown (titles like "Module 1: ..."),
  // normalize to the three core top-level modules so Learning Modules doesn't show Module 1/2/3.
  const normalizedModules = useMemo(() => {
    let base = visibleModules;
    const looksLikePerTheory = Array.isArray(visibleModules) && visibleModules.length > 0 && visibleModules.some(m => /^Module\s*\d+/i.test(m.title || ''));
    // If base already contains the three top-level modules, still overlay server summary flags
    if (!looksLikePerTheory) {
      return (Array.isArray(base) ? base : []).map(orig => {
        const title = orig?.title || '';
        const summary = getSummary(title);
        let sections = Array.isArray(orig?.sections) ? [...orig.sections] : [
          { name: 'Overview', completed: false, locked: false },
          { name: 'Theory', completed: false, locked: true },
          { name: 'Practical Exercise', completed: false, locked: true },
          { name: 'Assessment', completed: false, locked: true }
        ];
        if (summary) {
          const mark = (n, pred) => {
            const idx = sections.findIndex(s => s.name === n);
            if (idx >= 0) sections[idx] = { ...sections[idx], completed: !!pred || sections[idx].completed, locked: false };
          };
          if (summary.overview_completed) mark('Overview', true);
          if (summary.overview_completed || summary.lessons_completed > 0) {
            const tidx = sections.findIndex(s => s.name === 'Theory');
            if (tidx >= 0) sections[tidx] = { ...sections[tidx], locked: false };
          }
          // If all lessons are completed, mark Theory as completed (green)
          if ((summary.total_lessons||0) > 0 && (summary.lessons_completed||0) >= (summary.total_lessons||0)) {
            const tidx = sections.findIndex(s => s.name === 'Theory');
            if (tidx >= 0) sections[tidx] = { ...sections[tidx], completed: true };
          }
          if (summary.practical_completed) mark('Practical Exercise', true);
          if (summary.assessment_completed) mark('Assessment', true);
        }
        const progress = summary ? summary.percent : (orig?.progress || 0);
        return { ...orig, sections, progress };
      });
    }
    return coreModuleTitles.map(title => {
      const match = Array.isArray(modules) && modules.find(m => (m.title || '').toLowerCase().includes(title.split('-')[0].trim().toLowerCase().split(' ')[0]));
      const summary = getSummary(title);
      const sections = (match && match.sections) ? [...match.sections] : [
        // Start Overview as not completed for new accounts; unlocked by default
        { name: 'Overview', completed: false, locked: false },
        { name: 'Theory', completed: false, locked: true },
        { name: 'Practical Exercise', completed: false, locked: true },
        { name: 'Assessment', completed: false, locked: true }
      ];
      if(summary){
        const mark = (n,pred)=>{
          const idx = sections.findIndex(s=>s.name===n); if(idx>=0){ sections[idx] = { ...sections[idx], completed: pred? true: sections[idx].completed, locked: false }; }
        };
        if(summary.overview_completed) mark('Overview', true);
        if(summary.overview_completed || summary.lessons_completed>0){
          const tidx = sections.findIndex(s=>s.name==='Theory'); if(tidx>=0) sections[tidx] = { ...sections[tidx], locked: false }; }
        // If all lessons are complete, mark Theory completed for green state
        if ((summary.total_lessons||0) > 0 && (summary.lessons_completed||0) >= (summary.total_lessons||0)) {
          const tidx = sections.findIndex(s=>s.name==='Theory'); if (tidx>=0) sections[tidx] = { ...sections[tidx], completed: true };
        }
        if(summary.practical_completed){ mark('Practical Exercise', true); }
        if(summary.assessment_completed){ mark('Assessment', true); }
      }
      return {
        title,
        description: (match && (match.description || match.overview)) || (title === 'Signature-Based Detection' ? 'Understand signature-based detection methods and limitations.' : ''),
        progress: summary ? summary.percent : (match && match.progress) || 0,
        sections,
        theoryModules: (match && match.theoryModules) || []
      };
    });
  }, [modules, visibleModules.length, summaries]);

  // progress map (canonical)
  // Namespaced per-user progress (no legacy leakage when user id present)
  const { progressMap, recalc } = useModuleProgress(normalizedModules, user?.id || null);

  // (Legacy auto-mark Theory removed; server summaries now drive unlock / completion.)

  // (Legacy overview completion propagation removed; summaries provide authoritative flag.)

  const filteredModules = normalizedModules.filter(module => {
    const matchesSearch = module.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         module.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || 
                         (filter === 'completed' && progressMap[module.title] === 100) ||
                         (filter === 'in-progress' && progressMap[module.title] < 100 && progressMap[module.title] > 0) ||
                         (filter === 'not-started' && (progressMap[module.title] || 0) === 0);
    return matchesSearch && matchesFilter;
  });

  // Find the selected module and lesson if params exist
  let selectedModule = null;
  let selectedLesson = null;
  if (moduleName && lessonName) {
    selectedModule = modules.find(m => m.title.replace(/\s+/g, '-').toLowerCase() === moduleName);
    if (selectedModule) {
      // Search all theoryModules for the lesson
      for (const theory of selectedModule.theoryModules || []) {
        selectedLesson = (theory.lessons || []).find(l => l.title.replace(/\s+/g, '-').toLowerCase() === lessonName);
        if (selectedLesson) break;
      }
    }
  }

  // --- Enhanced Interactive Components (from HybridDetection_new.jsx) ---
const WatchBlock = ({ url }) => (
  <div className="my-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-500 rounded-lg shadow-sm glass-effect">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-2xl">🎬</span>
      <span className="font-semibold text-blue-800">Watch & Learn</span>
    </div>
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-700 underline hover:text-blue-900 transition-colors duration-200 font-medium"
    >
      Click here to watch a short video introduction
    </a>
  </div>
);

const TryItBlock = ({ children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-4">
      <button
        className="flex items-center gap-2 font-semibold text-yellow-800 bg-gradient-to-r from-yellow-100 to-yellow-200 px-4 py-2 rounded-lg hover:from-yellow-200 hover:to-yellow-300 transition-all duration-200 shadow-sm glass-effect"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-xl">💡</span>
        Try it {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="mt-3 p-4 bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-yellow-500 rounded-lg shadow-sm glass-effect animate-fadeIn">
          <div className="text-gray-800 leading-relaxed">{children}</div>
        </div>
      )}
    </div>
  );
};

const QuizBlock = ({ question }) => {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    // Simple quiz logic (can be extended per lesson)
    setFeedback('✅ Answer submitted!');
  };

  return (
    <div className="my-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-lg shadow-sm glass-effect">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🧠</span>
        <span className="font-semibold text-green-800">Knowledge Check</span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="text-gray-800 font-medium">{question}</div>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={submitted}
          placeholder="Type your answer (A, B, C, or D)..."
        />
        <button
          type="submit"
          className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={submitted || !answer.trim()}
        >
          Submit Answer
        </button>
        {feedback && (
          <div className="text-green-700 font-medium mt-2 p-2 bg-white rounded border border-green-200">
            {feedback}
          </div>
        )}
      </form>
    </div>
  );
};

const DiagramBlock = ({ children }) => (
  <div className="my-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500 rounded-lg shadow-sm glass-effect">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-2xl">📊</span>
      <span className="font-semibold text-indigo-800">Process Diagram</span>
    </div>
    <pre className="font-mono text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-white p-3 rounded border border-indigo-200">
      {children}
    </pre>
  </div>
);

const ExampleBlock = ({ children }) => (
  <div className="my-4 p-4 bg-gradient-to-r from-gray-50 to-slate-50 border-l-4 border-gray-500 rounded-lg shadow-sm glass-effect">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-2xl">💼</span>
      <span className="font-semibold text-gray-800">Real-World Example</span>
    </div>
    <div className="text-gray-800 leading-relaxed">{children}</div>
  </div>
);

const InteractiveBlock = ({ children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-4">
      <button
        className="flex items-center gap-2 font-semibold text-purple-800 bg-gradient-to-r from-purple-100 to-purple-200 px-4 py-2 rounded-lg hover:from-purple-200 hover:to-purple-300 transition-all duration-200 shadow-sm glass-effect"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-xl">⚡</span>
        Interactive {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="mt-3 p-4 bg-gradient-to-r from-purple-50 to-violet-50 border-l-4 border-purple-500 rounded-lg shadow-sm glass-effect animate-fadeIn">
          <div className="text-gray-800 leading-relaxed">{children}</div>
        </div>
      )}
    </div>
  );
};

const KeyPointsBlock = ({ points }) => (
  <div className="my-4 p-4 bg-gradient-to-r from-cyan-50 to-teal-50 border-l-4 border-cyan-500 rounded-lg shadow-sm glass-effect">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-2xl">🔑</span>
      <span className="font-semibold text-cyan-800">Key Points</span>
    </div>
    <ul className="space-y-2">
      {points.map((point, i) => (
        <li key={i} className="flex items-start gap-2 text-gray-800">
          <span className="text-cyan-600 mt-1">•</span>
          <span className="leading-relaxed">{point}</span>
        </li>
      ))}
    </ul>
  </div>
);

const BestPracticesBlock = ({ practices }) => (
  <div className="my-4 p-4 bg-gradient-to-r from-emerald-50 to-green-50 border-l-4 border-emerald-500 rounded-lg shadow-sm glass-effect">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-2xl">✅</span>
      <span className="font-semibold text-emerald-800">Best Practices</span>
    </div>
    <ul className="space-y-2">
      {practices.map((practice, i) => (
        <li key={i} className="flex items-start gap-2 text-gray-800">
          <span className="text-emerald-600 mt-1">•</span>
          <span className="leading-relaxed">{practice}</span>
        </li>
      ))}
    </ul>
  </div>
);

// New: Objectives (learning outcomes)
const ObjectivesBlock = ({ objectives }) => (
  <div className="my-4 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border-l-4 border-indigo-500 rounded-lg shadow-sm glass-effect">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-2xl">🎯</span>
      <span className="font-semibold text-indigo-800">Learning Objectives</span>
    </div>
    <ul className="space-y-2">
      {objectives.map((o, i) => (
        <li key={i} className="flex items-start gap-2 text-gray-800">
          <span className="mt-1">●</span>
          <span className="leading-relaxed">{o}</span>
        </li>
      ))}
    </ul>
  </div>
);

// New: Checklist with local persistence per page
const ChecklistBlock = ({ items }) => {
  const key = typeof window !== 'undefined' ? `lms:checklist:${window.location.pathname}` : 'lms:checklist';
  const [checked, setChecked] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
  });
  const toggle = (label) => {
    setChecked(prev => {
      const next = { ...prev, [label]: !prev[label] };
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  return (
    <div className="my-4 p-4 bg-gradient-to-r from-slate-50 to-gray-50 border-l-4 border-slate-400 rounded-lg shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🧩</span>
        <span className="font-semibold text-slate-800">Checklist</span>
      </div>
      <ul className="space-y-2">
        {items.map((label, i) => (
          <li key={i} className="flex items-center gap-3 text-gray-800">
            <input type="checkbox" checked={!!checked[label]} onChange={() => toggle(label)} className="w-4 h-4 accent-blue-600" />
            <span className={checked[label] ? 'line-through text-gray-500' : ''}>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

// New: Enhanced Tabs block with subtle animation & icons
const TabsBlock = ({ items = [] }) => {
  const [active, setActive] = React.useState(0);
  if (!items.length) return null;
  const iconFor = (label='') => {
    const l = label.toLowerCase();
    if (l.includes('overview')) return '🧭';
    if (l.includes('placement')) return '🛰️';
    if (l.includes('capab')) return '⚙️';
    if (l.includes('limit')) return '🚧';
    return '📌';
  };
  return (
    <div className="my-8 bg-gradient-to-b from-white to-blue-50/40 rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
      <div className="flex flex-wrap relative">
        {items.map((it, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`relative px-5 py-3 text-sm font-medium flex items-center gap-2 transition-all duration-300 focus:outline-none ${i === active ? 'text-blue-800' : 'text-gray-500 hover:text-blue-700'}`}
          >
            <span>{iconFor(it.label)}</span>
            {it.label}
            {i === active && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
            )}
          </button>
        ))}
      </div>
      <div className="p-6 text-gray-800 leading-relaxed animate-[fadeIn_.35s_ease]">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {items[active]?.content || ''}
        </ReactMarkdown>
      </div>
    </div>
  );
};

// New: Interactive Stepper (click to focus step)
const StepperBlock = ({ steps = [] }) => {
  const [current, setCurrent] = React.useState(0);
  if (!steps.length) return null;
  return (
    <div className="my-10">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-blue-700 font-semibold tracking-wide">Pipeline Walkthrough</span>
        <div className="flex-1 h-1 rounded bg-gradient-to-r from-blue-200 via-indigo-200 to-purple-200" />
      </div>
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        {steps.map((s, i) => {
          const active = i === current;
            return (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`group relative text-left p-4 rounded-xl border transition-all duration-300 focus:outline-none shadow-sm ${active ? 'border-blue-500 bg-white ring-2 ring-blue-200' : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow'} `}
            >
              <div className="flex items-start gap-3">
                <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shadow ${active ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white' : 'bg-gray-100 text-gray-600 group-hover:bg-blue-600 group-hover:text-white'}`}>{i+1}</span>
                <div>
                  <div className={`font-semibold mb-0.5 ${active ? 'text-blue-800' : 'text-gray-700 group-hover:text-blue-700'}`}>{s.title}</div>
                  <div className="text-xs text-gray-500 line-clamp-3 md:line-clamp-4">{s.detail.replace(/<[^>]+>/g,'').slice(0,140)}{s.detail.length>140?'…':''}</div>
                </div>
              </div>
              {active && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-10 h-1 rounded bg-gradient-to-r from-blue-500 to-purple-500" />}
            </button>
          );
        })}
      </div>
      <div className="rounded-xl border border-blue-100 bg-white p-6 shadow-inner">
        <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2"><span className="w-6 h-6 flex items-center justify-center text-xs rounded-full bg-blue-600 text-white font-bold">{current+1}</span>{steps[current].title}</h4>
        <div className="prose prose-sm max-w-none text-gray-700">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{steps[current].detail}</ReactMarkdown>
        </div>
        <div className="flex justify-between mt-4 text-sm">
          <button disabled={current===0} onClick={()=>setCurrent(c=>Math.max(0,c-1))} className={`px-3 py-1.5 rounded-md border ${current===0? 'opacity-30 cursor-not-allowed' : 'border-blue-300 text-blue-700 hover:bg-blue-50'}`}>Prev</button>
          <button disabled={current===steps.length-1} onClick={()=>setCurrent(c=>Math.min(steps.length-1,c+1))} className={`px-3 py-1.5 rounded-md border ${current===steps.length-1? 'opacity-30 cursor-not-allowed' : 'border-blue-300 text-blue-700 hover:bg-blue-50'}`}>Next</button>
        </div>
      </div>
    </div>
  );
};

// Activity quiz block (MCQ + TF)
const ActivityQuiz = ({ data }) => {
  const { type, questions=[] } = data || {};
  const [answers, setAnswers] = React.useState({});
  const [submitted, setSubmitted] = React.useState(false);
  const allAnswered = questions.every((_,i)=> answers[i] !== undefined);
  const score = submitted ? questions.reduce((acc,q,i)=>{
    if (type==='mcq' && answers[i] === q.ans) return acc+1;
    if (type==='tf' && !!answers[i] === !!q.ans) return acc+1;
    return acc;
  },0) : 0;
  return (
    <div className="my-8 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 p-6 shadow relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.15),transparent_60%)]" />
      <div className="relative">
        <h3 className="font-semibold text-indigo-800 mb-4 flex items-center gap-2">{type==='tf' ? 'True / False Check' : 'Quick Knowledge Check'} <span className="text-xs font-normal text-indigo-500">({questions.length} questions)</span></h3>
        <div className="space-y-5">
          {questions.map((q,i)=> (
            <div key={i} className="bg-white/70 backdrop-blur-sm rounded-lg border border-indigo-100 p-4 shadow-sm">
              <div className="font-medium text-gray-800 mb-3">{i+1}. {q.q}</div>
              {type==='mcq' && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {q.options.map((opt, oi)=>{
                    const selected = answers[i] === oi;
                    const correct = submitted && oi === q.ans;
                    const wrong = submitted && selected && oi !== q.ans;
                    return (
                      <button key={oi} disabled={submitted} onClick={()=> setAnswers(a=>({...a,[i]:oi}))}
                        className={`text-left px-3 py-2 rounded-md border text-sm transition shadow-sm ${selected? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-300'} ${correct? '!border-green-500 bg-green-50' : ''} ${wrong? '!border-red-500 bg-red-50' : ''}`}>{opt}</button>
                    );
                  })}
                </div>
              )}
              {type==='tf' && (
                <div className="flex gap-3">
                  {[true,false].map(val=>{
                    const selected = answers[i] === val;
                    const correct = submitted && val === q.ans;
                    const wrong = submitted && selected && val !== q.ans;
                    return (
                      <button key={String(val)} disabled={submitted} onClick={()=> setAnswers(a=>({...a,[i]:val}))} className={`px-4 py-2 rounded-md text-sm border shadow-sm transition ${selected? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-300'} ${correct? '!border-green-500 bg-green-50' : ''} ${wrong? '!border-red-500 bg-red-50' : ''}`}>{val? 'True':'False'}</button>
                    );
                  })}
                </div>
              )}
              {submitted && (
                <div className={`mt-3 text-xs font-medium ${ (type==='mcq'? answers[i]===q.ans : answers[i]===q.ans)? 'text-green-700':'text-red-600'}`}>Answer: {type==='mcq'? q.options[q.ans] : (q.ans? 'True':'False')}</div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-center gap-4 flex-wrap">
          {!submitted && <button onClick={()=> setSubmitted(true)} disabled={!allAnswered} className={`px-5 py-2 rounded-md text-sm font-semibold shadow transition ${allAnswered? 'bg-indigo-600 text-white hover:bg-indigo-700':'bg-gray-300 text-gray-600 cursor-not-allowed'}`}>Submit</button>}
          {submitted && (
            <>
              <div className="text-sm font-semibold text-indigo-700">Score: {score} / {questions.length} ({Math.round((score/questions.length)*100)}%)</div>
              <button onClick={()=> {setSubmitted(false); setAnswers({});}} className="px-4 py-2 rounded-md border text-sm bg-white hover:bg-indigo-50 border-indigo-300 text-indigo-700">Retry</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// New: Callout block (Tip/Note/Warning)
const CalloutBlock = ({ kind = 'note', children }) => {
  const styles = {
    tip: {
      icon: '💡',
      wrap: 'from-emerald-50 to-green-50 border-emerald-500 text-emerald-800',
    },
    note: {
      icon: '📝',
      wrap: 'from-blue-50 to-cyan-50 border-blue-500 text-blue-800',
    },
    warning: {
      icon: '⚠️',
      wrap: 'from-amber-50 to-yellow-50 border-amber-500 text-amber-800',
    },
  };
  const style = styles[kind] || styles.note;
  return (
    <div className={`my-4 p-4 bg-gradient-to-r border-l-4 rounded-lg shadow-sm glass-effect ${style.wrap}`}>
      <div className="flex items-start gap-2">
        <span className="text-2xl leading-none">{style.icon}</span>
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  );
};

// New: Image with caption/source
const ImageCaptionBlock = ({ src, alt, caption, source }) => (
  <figure className="my-6">
    <img src={src} alt={alt || caption || 'image'} className="rounded-lg shadow" />
    {(caption || source) && (
      <figcaption className="mt-2 text-xs text-gray-500">
        {caption}
        {source ? (
          <>
            {caption ? ' — ' : ''}
            <a href={source} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">Source</a>
          </>
        ) : null}
      </figcaption>
    )}
  </figure>
);

// New: Button row
const ButtonRow = ({ items = [] }) => (
  <div className="flex flex-wrap gap-2 my-3">
    {items.map((it, i) => (
      <a key={i} href={it.href} target="_blank" rel="noreferrer" className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm">
        {it.label}
      </a>
    ))}
  </div>
);

// New: Timeline (Module schedule)
const TimelineBlock = ({ events = [] }) => (
  <div className="my-6">
    <div className="space-y-4">
      {events.map((ev, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="w-2 h-2 mt-2 rounded-full bg-purple-600"></div>
          <div>
            <div className="font-semibold text-purple-800">{ev.when} — {ev.title}</div>
            {ev.detail && <div className="text-gray-700"><ReactMarkdown remarkPlugins={[remarkGfm]}>{ev.detail}</ReactMarkdown></div>}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// New: Glossary
const GlossaryBlock = ({ terms = [] }) => (
  <div className="my-6 p-4 bg-gradient-to-r from-fuchsia-50 to-pink-50 border-l-4 border-fuchsia-500 rounded-lg shadow-sm glass-effect">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-2xl">📚</span>
      <span className="font-semibold text-fuchsia-800">Glossary</span>
    </div>
    <dl className="grid md:grid-cols-2 gap-4">
      {terms.map((t, i) => (
        <div key={i}>
          <dt className="font-semibold text-fuchsia-900">{t.term}</dt>
          <dd className="text-gray-800"><ReactMarkdown remarkPlugins={[remarkGfm]}>{t.definition}</ReactMarkdown></dd>
        </div>
      ))}
    </dl>
  </div>
);

// New: Resource list (references/links)
const ResourceListBlock = ({ items = [] }) => (
  <div className="my-6 p-4 bg-white rounded-lg border shadow-sm">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-2xl">🔗</span>
      <span className="font-semibold text-gray-900">Resources</span>
    </div>
    <ul className="list-disc ml-6 text-blue-800">
      {items.map((it, i) => (
        <li key={i}><a className="hover:underline" href={it.href} target="_blank" rel="noreferrer">{it.label}</a></li>
      ))}
    </ul>
  </div>
);

// New: Video embed (YouTube/Vimeo)
function normalizeVideoUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const qp = (name) => u.searchParams.get(name);
    const withoutParams = (base, paramsObj) => {
      const nu = new URL(base);
      Object.entries(paramsObj || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') nu.searchParams.set(k, String(v));
      });
      return nu.toString();
    };
    if (host.includes('youtube.com') || host.includes('youtu.be') || host.includes('youtube-nocookie.com')) {
      let id = '';
      if (host.includes('youtu.be')) {
        id = (u.pathname || '/').split('/')[1] || '';
      } else if (u.pathname.startsWith('/watch')) {
        id = qp('v') || '';
      } else if (u.pathname.startsWith('/embed/')) {
        id = (u.pathname.split('/')[2] || '').split('?')[0];
      }
      id = id.replace(/[^a-zA-Z0-9_-]/g, '');
      if (!id) return url;
      let start = qp('start');
      const t = qp('t');
      if (!start && t) {
        const m = String(t).match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?|(\d+)/);
        if (m) {
          const hrs = parseInt(m[1] || '0', 10) || 0;
          const mins = parseInt(m[2] || '0', 10) || 0;
          const secs = parseInt(m[3] || m[4] || '0', 10) || 0;
          start = String(hrs * 3600 + mins * 60 + secs);
        }
      }
      const base = `https://www.youtube-nocookie.com/embed/${id}`;
      const params = { rel: '0', modestbranding: '1', playsinline: '1' };
      if (start) params.start = start;
      return withoutParams(base, params);
    }
    if (host.includes('vimeo.com')) {
      const parts = (u.pathname || '').split('/').filter(Boolean);
      const id = parts.find(p => /^(\d+)$/.test(p));
      if (id) return `https://player.vimeo.com/video/${id}`;
      if (host.includes('player.vimeo.com')) return url;
    }
    return url;
  } catch { return url; }
}

const VideoEmbedBlock = ({ url }) => (
  <div className="my-6">
    <div className="aspect-video w-full rounded-xl overflow-hidden shadow">
      <iframe
        src={normalizeVideoUrl(url)}
        title="Lesson video"
        className="w-full h-full"
        frameBorder="0"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      ></iframe>
    </div>
  </div>
);

// New: Generic card wrapper (used by <card> ... </card>)
const SimpleCard = ({ children }) => (
  <div className="my-4 p-5 rounded-xl border bg-white shadow-sm ring-1 ring-gray-100">
    <div className="prose prose-sm max-w-none text-gray-800">
      {children}
    </div>
  </div>
);

// --- Enhanced lesson content parser (from HybridDetection_new.jsx) ---
function renderLessonContent(content) {
  if (!content) return null;
  const text = Array.isArray(content) ? content.join('\n\n') : String(content);
  return (
    <div className="prose max-w-none text-gray-800 leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
    

  // Render selected lesson if found
  if (selectedModule && selectedLesson) {
    // Scroll progress state
    const [scrollProg, setScrollProg] = React.useState(0);
    const contentRef = React.useRef(null);
    React.useEffect(()=>{
      const handler = () => {
        const el = contentRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const total = el.scrollHeight - window.innerHeight;
        const sc = window.scrollY - (el.offsetTop || 0);
        const pct = Math.min(100, Math.max(0, (sc/total)*100));
        setScrollProg(isNaN(pct)?0:pct);
      };
      window.addEventListener('scroll', handler, { passive: true });
      handler();
      return () => window.removeEventListener('scroll', handler);
    },[]);
    // Mark lesson as completed when viewed (with a slight delay to ensure it's actually read)
    useEffect(() => {
      const timer = setTimeout(() => {
        markLessonCompleted(selectedModule.title, selectedLesson.title);
      }, 2000); // Mark as completed after 2 seconds of viewing
      
      return () => clearTimeout(timer);
    }, [selectedModule.title, selectedLesson.title]);
    
    // Find lesson index and total lessons for progress
    let lessonIdx = 0;
    let totalLessons = 1;
    if (selectedModule.theoryModules) {
      for (const theory of selectedModule.theoryModules) {
        const idx = (theory.lessons || []).findIndex(l => l.title.replace(/\s+/g, '-').toLowerCase() === lessonName);
        if (idx !== -1) {
          lessonIdx = idx;
          totalLessons = theory.lessons.length;
          break;
        }
      }
    }
    // Dummy reading progress (can be replaced with real progress)
    const readingProgress = Math.round(((lessonIdx + 1) / totalLessons) * 100);
    return (
      <div className="p-0 md:p-8 bg-[#F5F8FC] min-h-screen relative">
        {/* Global reading progress bar */}
        <div className="fixed top-0 left-0 right-0 h-1 bg-gray-200 z-40">
          <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-200" style={{ width: `${scrollProg}%` }} />
        </div>
        {/* Lesson Header Card */}
        <div className="bg-white rounded-none md:rounded-2xl shadow md:shadow-lg p-6 md:mb-6 flex flex-col md:flex-row md:items-center md:justify-between border-b md:border">
          <div>
            <div className="text-sm text-blue-700 font-semibold mb-1">Lesson {lessonIdx + 1} of {totalLessons}</div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{selectedLesson.title}</h2>
            <div className="flex items-center gap-4 mb-2">
              <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded-full">Est. reading time {selectedLesson.estimatedTime || '1 min'}</span>
              <span className="text-xs font-medium text-green-800 bg-green-100 px-2 py-1 rounded-full flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> Reading...
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xs text-gray-500 mb-1">Reading Progress</div>
              <div className="w-48 bg-gray-200 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${readingProgress}%` }}></div>
              </div>
              <div className="text-xs text-blue-700 mt-1">{readingProgress}%</div>
            </div>
          </div>
          {/* Lesson Progress Indicator */}
          <div className="flex flex-col items-end mt-4 md:mt-0">
            <div className="flex items-center gap-2 bg-white rounded-full shadow px-4 py-2 border border-blue-100">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l3 3" /></svg>
              <div>
                <div className="text-xs text-gray-500">Lesson Progress</div>
                <div className="text-sm font-semibold text-blue-700">{readingProgress}% <span className="text-xs text-gray-500 ml-1">{lessonIdx + 1} of {totalLessons}</span></div>
              </div>
            </div>
          </div>
        </div>
        {/* Lesson Content with right rail for quick nav (desktop) */}
        <div ref={contentRef} className="md:grid md:grid-cols-[1fr_260px] gap-8">
          <div className="px-6 md:px-0 pb-16 md:pb-8">
            {renderLessonContent(selectedLesson.content)}
          </div>
          <aside className="hidden md:block sticky top-20 self-start space-y-6 pr-6">
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-600 inline-block" /> Quick Nav</h4>
              <ul className="space-y-2 text-sm">
                {(selectedLesson.content.match(/^##\s.+$/gm) || []).slice(0,8).map((h,i)=>{
                  const title = h.replace(/^##\s*/, '').trim();
                  const id = title.toLowerCase().replace(/[^a-z0-9]+/g,'-');
                  return <li key={i}><a href={`#${id}`} className="text-gray-600 hover:text-blue-700 hover:underline">{title}</a></li>;
                })}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl text-white p-4 shadow relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_70%_30%,white,transparent_60%)]" />
              <div className="relative">
                <div className="text-xs uppercase tracking-wide font-semibold mb-2 opacity-90">Progress</div>
                <div className="text-3xl font-bold mb-1">{Math.round(scrollProg)}%</div>
                <div className="text-xs text-indigo-100 mb-4">Scroll completion</div>
                <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all" style={{ width: `${scrollProg}%` }} />
                </div>
              </div>
            </div>
          </aside>
        </div>
        <Link to="/learning-modules" className="mt-8 inline-block text-blue-600 hover:underline font-medium">Back to Modules</Link>
      </div>
    );
  }

  return (
  <div className="flex bg-[#f3f6f8]"> {/* Removed h-screen */}
  {/* Sidebar provided by ModuleLayout */}
      
      <main className="flex-1 bg-[#FFFFFF]"> {/* Removed overflow-hidden */}
        <div className="h-full overflow-y-auto"> {/* Keep this for scrolling */}
          <div className="p-4">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-semibold">Learning Modules</h1>
                {/* Refresh button removed. Progress and unlocks update automatically. */}
              </div>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search modules..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#206EA6] focus:border-transparent"
                  />
                  <svg
                    className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#206EA6] focus:border-transparent"
                >
                  <option value="all">All Modules</option>
                  <option value="completed">Completed</option>
                  <option value="in-progress">In Progress</option>
                  <option value="not-started">Not Started</option>
                </select>
                <div className="flex items-center gap-4 text-sm">
                  <button
                    type="button"
                    onClick={manualRefresh}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20A8 8 0 0 1 4.46 7.12L4 10m16-6-4 .35M15 4a8 8 0 0 1 4.54 12.88L20 14" />
                    </svg>
                    <span>Refresh</span>
                  </button>
                  <div className="flex flex-col leading-tight text-xs text-gray-500">
                    <span className="font-medium text-gray-600">Assigned: {Array.isArray(assignments) ? assignments.length : 0}</span>
                    <span className="italic">{lastSync ? `Synced ${Math.max(1, Math.round((new Date()-lastSync)/1000))}s ago` : 'Syncing...'}</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                  className="relative p-2 text-gray-600 hover:text-gray-800 focus:outline-none"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </button>
                
                {isNotificationOpen && (
                  <div className="absolute right-8 top-16 w-80 bg-white rounded-lg shadow-lg py-2 z-10">
                    <div className="px-4 py-2 border-b flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Notifications</h3>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const res = await fetch(apiUrl(`/api/student/notifications`),
                              { headers: user?.token ? { 'Authorization': `Bearer ${user.token}` } : {} }
                            );
                            if (res.ok) {
                              const data = await res.json();
                              setNotifications(Array.isArray(data) ? data : []);
                            }
                            try {
                              const c = await fetch(apiUrl('/api/student/notifications/count'), { headers: user?.token ? { 'Authorization': `Bearer ${user.token}` } : {} });
                              if (c.ok) {
                                const cj = await c.json();
                                setUnreadCount(typeof cj?.count === 'number' ? cj.count : 0);
                              }
                            } catch {}
                          } catch {}
                        }}
                        className="text-[#1E5780] hover:text-[#164666] transition-colors"
                        aria-label="Refresh notifications"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-gray-400">
                          <svg className="mx-auto h-12 w-12 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                          <p className="text-sm">No notifications</p>
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-start gap-2 border-l-4"
                          >
                            <div className="flex-1">
                              <p className="text-sm text-gray-800">{notification.message}</p>
                              <p className="text-xs text-gray-500 mt-1">{formatNotificationTime(notification.time)}</p>
                            </div>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  const r = await fetch(apiUrl(`/api/student/notifications/${notification.id}/read`), {
                                    method: 'PATCH',
                                    headers: user?.token ? { 'Authorization': `Bearer ${user.token}` } : {}
                                  });
                                  if (r.ok) {
                                    setNotifications(prev => prev.filter(n => n.id !== notification.id));
                                    try {
                                      const c = await fetch(apiUrl('/api/student/notifications/count'), { headers: user?.token ? { 'Authorization': `Bearer ${user.token}` } : {} });
                                      if (c.ok) {
                                        const cj = await c.json();
                                        setUnreadCount(typeof cj?.count === 'number' ? cj.count : 0);
                                      }
                                    } catch {}
                                  }
                                } catch {}
                              }}
                              className="text-gray-400 hover:text-green-600 transition-colors mr-2"
                              title="Mark as read"
                              aria-label="Mark notification as read"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="px-4 py-2 border-t">
                      <button
                        onClick={async () => {
                          try {
                            const r = await fetch(apiUrl('/api/student/notifications/mark_all_read'), {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                ...(user?.token ? { 'Authorization': `Bearer ${user.token}` } : {})
                              }
                            });
                            if (r.ok) {
                              setNotifications([]);
                              try {
                                const c = await fetch(apiUrl('/api/student/notifications/count'), { headers: user?.token ? { 'Authorization': `Bearer ${user.token}` } : {} });
                                if (c.ok) {
                                  const cj = await c.json();
                                  setUnreadCount(typeof cj?.count === 'number' ? cj.count : 0);
                                }
                              } catch {}
                            }
                          } catch (e) {
                            // no-op
                          }
                        }}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Mark all as read
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-6">
              {loadingModules && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_,i)=>(
                    <div key={i} className="p-6 rounded-lg border bg-white animate-pulse">
                      <div className="h-5 bg-gray-200 rounded w-40 mb-3" />
                      <div className="h-3 bg-gray-200 rounded w-full mb-2" />
                      <div className="h-3 bg-gray-200 rounded w-5/6 mb-6" />
                      <div className="h-2.5 bg-gray-200 rounded w-32" />
                    </div>
                  ))}
                </div>
              )}
              {!loadingModules && filteredModules.length === 0 && !fetchError && (
                <div className="p-10 text-center border rounded-lg bg-white">
                  <p className="text-gray-500 mb-2">No modules match your filters.</p>
                  <button onClick={()=> { setSearchQuery(''); setFilter('all'); }} className="text-blue-600 hover:underline text-sm">Reset filters</button>
                </div>
              )}
              {fetchError && (
                <div className="p-4 border border-red-200 bg-red-50 text-red-700 rounded">{fetchError}</div>
              )}
              {!loadingModules && filteredModules.map(module => {
                const slug = toSlug(module.title || '');
                const serverSummary = summaries[slug];
                return (
                  <ModuleCard
                    key={module.id || module.title}
                    module={module}
                    progress={progressMap[module.title] || 0}
                    isAssigned={isModuleAssigned(module.title)}
                    assignedOnly={assignedOnly}
                    onCompleteSection={handleSectionComplete}
                    getTheoryUrl={getTheoryUrl}
                    userId={user?.id || null}
                    serverSummary={serverSummary}
                    onOverviewPersist={() => {
                      if(!user?.id) return;
                      fetch(`/api/student/${user.id}/module/${slug}/unit`, {
                        method:'POST',
                        headers:{
                          'Content-Type':'application/json',
                          ...(user?.token ? { 'Authorization': `Bearer ${user.token}` } : {})
                        },
                        body: JSON.stringify({ unit_type:'overview', completed:true })
                      }).finally(()=> refreshSummaries());
                    }}
                    onServerRefresh={() => refreshSummaries()}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LearningModules;