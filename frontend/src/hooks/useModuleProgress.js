import { useEffect, useState, useCallback } from 'react';
import { toSlug, lessonIdsKey, loadCompletedLessonIds } from '../pages/student/theoretical/logic/ids';

/*
  useModuleProgress
  Canonical progress calculator for a module object with shape:
  {
    title, sections: [{ name, completed, locked }], theoryModules: [{ lessons: [{ title }] }]
  }
  Progress = percentage of completed atomic items:
    - Overview (1)
    - Each theory lesson (N)
    - Theory quiz (1) (detected via localStorage slug-module-quiz-passed*)
    - Theory summary (1) if not already a lesson named 'Summary'
    - Practical Exercise (1)
    - Assessment (1) (only counts if practical completed)
*/
export default function useModuleProgress(modules, userId=null) {
  const [progressMap, setProgressMap] = useState({});
  const slugify = useCallback((s='')=> toSlug(s), []);

  const compute = useCallback((moduleObj) => {
  if (!moduleObj) return 0;
    const slug = slugify(moduleObj.title || '');
    // Raw lessons present on the lightweight module object
    let rawTotalLessons = (moduleObj.theoryModules || []).reduce((t, tm) => t + ((tm.lessons || []).length), 0);
    const lessonTotalCacheKey = `module-${slug}-lesson-total`;
    try {
      if (rawTotalLessons > 0) {
        const cached = parseInt(localStorage.getItem(lessonTotalCacheKey) || '0', 10);
        if (!cached || cached !== rawTotalLessons) {
          localStorage.setItem(lessonTotalCacheKey, String(rawTotalLessons));
        }
      }
    } catch {}
    // Fallback to cached full lesson count if snapshot seems incomplete (0,1,2)
    if (rawTotalLessons <= 2) {
      try {
        const cached = parseInt(localStorage.getItem(lessonTotalCacheKey) || '0', 10);
        if (cached > rawTotalLessons) rawTotalLessons = cached;
      } catch {}
    }
    // Hardcoded fallback for known modules to avoid inflated early percentages before seeding occurs
    if (rawTotalLessons <= 2) {
      const expected = {
        'signature-based-detection': 11,
        'anomaly-based-detection': 13, // anomaly module has 13 lessons
        'hybrid-detection': 13 // hybrid mirrors anomaly lesson count pattern
      }[slug];
      if (expected && expected > rawTotalLessons) {
        rawTotalLessons = expected;
        try { localStorage.setItem(lessonTotalCacheKey, String(expected)); } catch {}
      }
    }
    // Clamp against cached if raw snapshot suddenly jumps beyond cached+expected (guards against malformed theoryModules duplication)
    try {
      const cached = parseInt(localStorage.getItem(lessonTotalCacheKey) || '0', 10);
      if (cached > 0 && rawTotalLessons > cached * 1.5) { // heuristic threshold
        rawTotalLessons = cached; // treat as anomaly
      }
    } catch {}
    const totalLessons = rawTotalLessons;

    // Completed lessons
    let lessonsCompleted = 0;
    try {
      const lessonIds = loadCompletedLessonIds(slug, userId);
      const filtered = Array.isArray(lessonIds) ? lessonIds.filter(id => !/overview$/i.test(id)) : [];
      lessonsCompleted = Math.min(filtered.length, totalLessons);
      if (!userId && lessonsCompleted === 0) {
        const legacyTitleKey = `${slug}-completed-lessons`;
        const legacy = JSON.parse(localStorage.getItem(legacyTitleKey) || '[]');
        lessonsCompleted = Array.isArray(legacy) ? Math.min(legacy.length, totalLessons) : 0;
      }
    } catch {}

    // Overview
    const prefixBase = `module-${slug}`;
    const prefix = userId ? `${prefixBase}-u${userId}` : prefixBase;
      const overviewCompleted = localStorage.getItem(`${prefix}-overview-completed`) === 'true';

      // --- Unified progress model: overview + lessons + quizzes + practical + assessment ---
      // Quiz count: try to get from cache, else fallback to known codes
      const quizTotalCacheKey = `module-${slug}-quiz-total`;
      let quizTotal = 0;
      try {
        const cachedQ = parseInt(localStorage.getItem(quizTotalCacheKey) || '0', 10);
        if (cachedQ > 0) quizTotal = cachedQ;
      } catch {}
      // Fallback: known codes for signature/anomaly/hybrid
      if (quizTotal === 0) {
        // Signature: 5, anomaly: 5 (mirrors signature structure), hybrid: 0 (placeholder)
        if (slug === 'signature-based-detection') quizTotal = 5;
        else if (slug === 'anomaly-based-detection') quizTotal = 5;
        else if (slug === 'hybrid-detection') quizTotal = 5;
      }

      // Count passed quizzes
        let quizzesPassed = 0;
        try {
          const quizCodes = ['m1','m2','m3','m4','summary'];
          const track = slug === 'anomaly-based-detection' ? 'anomaly' : slug === 'hybrid-detection' ? 'hybrid' : 'signature';
          quizCodes.forEach(code => {
            // New canonical key pattern (user-scoped)
            const canonicalUser = userId ? `${track}Quiz:${code}:u${userId}:passed` : null;
            // Legacy patterns we still honor for backward compatibility
            const legacyWithSlugUser = userId ? `${track}Quiz:${slug}:${code}:u${userId}:passed` : null; // old format inserted parent slug
            const legacyNoUser = `${track}Quiz:${code}:passed`;
            const legacyWithSlugNoUser = `${track}Quiz:${slug}:${code}:passed`;
            if ((canonicalUser && localStorage.getItem(canonicalUser)==='true') ||
                (legacyWithSlugUser && localStorage.getItem(legacyWithSlugUser)==='true') ||
                localStorage.getItem(legacyNoUser)==='true' ||
                localStorage.getItem(legacyWithSlugNoUser)==='true') {
              quizzesPassed += 1;
            }
          });
        } catch {}

      // Practical & assessment units
      const practicalCompleted = localStorage.getItem(`${prefix}-practical-completed`) === 'true';
      const assessmentCompleted = localStorage.getItem(`${prefix}-assessment-completed`) === 'true';
      const practicalUnit = practicalCompleted ? 1 : 0;
      const assessmentUnit = assessmentCompleted ? 1 : 0;

      // Final denominator: overview + lessons + quizzes + practical + assessment
      let denominator = 1 + totalLessons + quizTotal + 2;
      // Fallback: ensure denominator at least 1 + expected lessons + expected quizzes + 2
      try {
        const cached = parseInt(localStorage.getItem(`module-${slug}-lesson-total`) || '0', 10);
        if (cached > 0 && (1 + cached + quizTotal + 2) > denominator) {
          denominator = 1 + cached + quizTotal + 2;
        }
      } catch {}
      if (denominator <= 0) return 0;
    // Numerator: completed units
  // If theory section is marked complete but lessonsCompleted is significantly below totalLessons (e.g., due to premature marking),
  // do not award full lesson credit; just use actual lessonsCompleted.
  const numerator = (overviewCompleted ? 1 : 0) + lessonsCompleted + quizzesPassed + practicalUnit + assessmentUnit;
    return Math.min(100, Math.round((numerator / denominator) * 100));
  }, [slugify, userId]);

  // Recalc helper (defined early so later effects can safely depend on it)
  const recalc = useCallback(() => {
    if (!Array.isArray(modules)) return;
    setProgressMap(prev => {
      const next = { ...prev };
      modules.forEach(m => { next[m.title] = compute(m); });
      return next;
    });
  }, [modules, compute]);

  useEffect(() => {
    if (!Array.isArray(modules)) return;
    const map = {};
    modules.forEach(m => { map[m.title] = compute(m); });
    setProgressMap(map);
  }, [modules, compute]);

  // One-time migration: copy legacy (non user-namespaced) module progress keys to user-scoped keys
  useEffect(() => {
    if (!userId || !Array.isArray(modules) || modules.length === 0) return;
    const MIGRATION_FLAG = `progress_namespace_migration_v1_u${userId}`;
    try {
      if (localStorage.getItem(MIGRATION_FLAG) === 'true') return;
      modules.forEach(m => {
        if (!m?.title) return;
        const slug = slugify(m.title);
        const base = `module-${slug}`;
        const legacyPrefix = base;
        const nsPrefix = `${base}-u${userId}`;
        // Simple scalar keys to migrate
        const scalarSuffixes = [
          'overview-completed',
          'theory-unlocked',
          'theory-completed',
          'practical-completed',
          'assessment-completed',
          'lesson-total',
          'quiz-total'
        ];
        scalarSuffixes.forEach(sfx => {
          const legacyKey = `${legacyPrefix}-${sfx}`;
          const nsKey = `${nsPrefix}-${sfx}`;
            try {
              if (localStorage.getItem(legacyKey) !== null && localStorage.getItem(nsKey) === null) {
                localStorage.setItem(nsKey, localStorage.getItem(legacyKey));
              }
            } catch {}
        });
        // Lesson ids array
        const legacyLessonIds = `${legacyPrefix}-completed-lesson-ids`;
        const nsLessonIds = `${nsPrefix}-completed-lesson-ids`;
        try {
          if (localStorage.getItem(legacyLessonIds) && !localStorage.getItem(nsLessonIds)) {
            localStorage.setItem(nsLessonIds, localStorage.getItem(legacyLessonIds));
          }
        } catch {}
        // Quiz pass key migration (signature/anomaly/hybrid)
        try {
          const tracks = ['signature','anomaly','hybrid'];
          const quizCodes = ['m1','m2','m3','m4','summary'];
          tracks.forEach(track => {
            quizCodes.forEach(code => {
              const canonicalUser = `${track}Quiz:${code}:u${userId}:passed`;
              if (localStorage.getItem(canonicalUser) === 'true') return; // already migrated
              const legacyNoUser = `${track}Quiz:${code}:passed`;
              const legacyWithSlug = `${track}Quiz:${slug}:${code}:passed`;
              const legacyWithSlugUser = `${track}Quiz:${slug}:${code}:u${userId}:passed`;
              if (localStorage.getItem(legacyWithSlugUser) === 'true' || localStorage.getItem(legacyNoUser) === 'true' || localStorage.getItem(legacyWithSlug) === 'true') {
                try { localStorage.setItem(canonicalUser, 'true'); } catch {}
              }
            });
          });
        } catch {}
        // No deletion of legacy keys (non-destructive)
      });
      localStorage.setItem(MIGRATION_FLAG, 'true');
      // Recompute after migration
      const map = {};
      modules.forEach(m => { map[m.title] = compute(m); });
      setProgressMap(map);
      try { window.dispatchEvent(new Event('moduleProgressMigrated')); } catch {}
    } catch {}
  }, [modules, userId, compute, slugify]);

  // Visibility change recalc to sync when user switches tabs/windows
  useEffect(() => {
    const handle = () => { if (document.visibilityState === 'visible') recalc(); };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [recalc]);

  // Recompute on storage events (multi-tab sync)
  useEffect(() => {
    const handler = (e) => {
      if (!Array.isArray(modules)) return;
      // Only respond to keys we care about
      if (!e.key) return;
      if (!e.key.includes(`module-`)) return; // broad filter, then recompute
      const map = {};
      modules.forEach(m => { map[m.title] = compute(m); });
      setProgressMap(map);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [modules, compute]);

  return { progressMap, recalc, computeFor: compute };
}
