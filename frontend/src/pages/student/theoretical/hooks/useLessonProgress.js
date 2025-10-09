import { useCallback, useState, useEffect, useRef } from 'react';
import { getLessonId, loadCompletedLessonIds, saveCompletedLessonIds, toSlug } from '../logic/ids.js';

// Local-only progress (will be merged with server once server hook is added)
export default function useLessonProgress({ moduleTitle, lessons, userId=null }) {
  const moduleSlug = toSlug(moduleTitle || 'module');
  // Track whether we performed an initial anonymous (no userId) load so we can purge it when userId arrives.
  const [initialUserId, setInitialUserId] = useState(userId);
  const [completedIds, setCompletedIds] = useState(() => {
    // If userId is null we still load legacy for anonymous usage; if a userId will appear shortly, we'll reset below.
    return loadCompletedLessonIds(moduleSlug, userId);
  });
  // Track if we've already attempted a slug->canonical migration for the current module+user to avoid loops.
  const migratedRef = useRef(false);

  useEffect(() => {
    // If userId transitioned from null -> value, reinitialize with the namespaced set (ignoring legacy) to avoid leakage.
    if (initialUserId == null && userId) {
      setCompletedIds(loadCompletedLessonIds(moduleSlug, userId));
      setInitialUserId(userId);
      migratedRef.current = false; // allow migration to run with new user scope
      return; // skip the normal path this cycle
    }
    // Normal reload when module or userId changes (excluding the transition handled above)
    setCompletedIds(loadCompletedLessonIds(moduleSlug, userId));
    migratedRef.current = false; // reset migration flag when module/user switches
  }, [moduleSlug, userId, initialUserId]);

  // Migration: earlier versions stored lesson completion by slug (derived from title or index). We now
  // prefer canonical lesson.id if present (e.g., sig-1). On first availability of lessons array, map any
  // stored slug values that correspond to a lesson whose canonical id differs; replace with canonical.
  useEffect(() => {
    if (migratedRef.current) return;
    if (!lessons || lessons.length === 0) return;
    if (!completedIds || completedIds.length === 0) { migratedRef.current = true; return; }
    const slugToCanonical = new Map();
    lessons.forEach((l, i) => {
      const canonical = getLessonId(l, i); // already returns id if present else slug fallback
      // If lesson has explicit id and a distinct title-based slug, capture mapping
      if (l?.id) {
        const titleSlug = l.title ? toSlug(l.title) : null;
        if (titleSlug && titleSlug !== canonical) slugToCanonical.set(titleSlug, canonical);
      }
    });
    if (slugToCanonical.size === 0) { migratedRef.current = true; return; }
    let changed = false;
    const normalized = completedIds.map(id => {
      if (slugToCanonical.has(id)) { changed = true; return slugToCanonical.get(id); }
      return id;
    });
    if (changed) {
      const unique = Array.from(new Set(normalized));
      setCompletedIds(unique);
      saveCompletedLessonIds(moduleSlug, unique, userId);
    }
    migratedRef.current = true;
  }, [lessons, completedIds, moduleSlug, userId]);

  const markComplete = useCallback((lessonIndex) => {
    const id = getLessonId(lessons[lessonIndex], lessonIndex);
    setCompletedIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveCompletedLessonIds(moduleSlug, next, userId);
      return next;
    });
  }, [lessons, moduleSlug, userId]);

  const isComplete = useCallback((lessonIndex) => {
    const id = getLessonId(lessons[lessonIndex], lessonIndex);
    return completedIds.includes(id);
  }, [completedIds, lessons]);

  return {
    moduleSlug,
    completedIds,
    markComplete,
    isComplete,
    completedCount: completedIds.length,
    total: lessons.length,
  };
}
