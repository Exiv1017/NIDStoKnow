import { useCallback, useEffect, useState } from 'react';
import { getLessonId, toSlug } from '../logic/ids.js';

export default function useServerModuleProgress({ user, moduleTitle, lessons }) {
  const moduleSlug = toSlug(moduleTitle || 'module');
  const [loading, setLoading] = useState(!!user);
  const [completedIds, setCompletedIds] = useState([]);
  const [quizPassed, setQuizPassed] = useState(false);
  const [error, setError] = useState(null);

  // Fetch initial state
  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    // Reset state whenever the user identity or module changes to avoid showing stale previous-user data.
    setCompletedIds([]);
    setQuizPassed(false);
    if (!user) { setLoading(false); return () => { ignore = true; controller.abort(); }; }
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/student/${user.id}/module/${moduleSlug}/lessons`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (!ignore) {
            let ids = Array.isArray(data.lesson_ids) ? data.lesson_ids : [];
            // Migration: server may have stored older slug-based IDs. If any map to a lesson with a canonical id, normalize.
            if (lessons && lessons.length) {
              const slugToCanonical = new Map();
              lessons.forEach((l,i)=>{
                if (l?.id) {
                  const canonical = String(l.id);
                  const titleSlug = l.title ? toSlug(l.title) : null;
                  if (titleSlug && titleSlug !== canonical) slugToCanonical.set(titleSlug, canonical);
                }
              });
              if (slugToCanonical.size) {
                let changed = false;
                ids = ids.map(id => {
                  if (slugToCanonical.has(id)) { changed = true; return slugToCanonical.get(id); }
                  return id;
                });
                if (changed) ids = Array.from(new Set(ids));
              }
            }
            setCompletedIds(ids);
          }
        }
        const qres = await fetch(`/api/student/${user.id}/module/${moduleSlug}/quiz`, { signal: controller.signal });
        if (qres.ok) {
          const qdata = await qres.json();
          if (!ignore) setQuizPassed(!!(qdata && (qdata.passed === true || qdata.passed === 1 || qdata.passed === '1')));
        }
      } catch (e) {
        if (!ignore && e.name !== 'AbortError') setError(e);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    run();
    return () => { ignore = true; controller.abort(); };
  }, [user?.id, moduleSlug]);

  const markLessonComplete = useCallback(async (lessonIndex) => {
    if (!user) return; // silent noop
    const lesson = lessons[lessonIndex];
    const id = getLessonId(lesson, lessonIndex);
    try {
      // optimistic
      setCompletedIds(prev => prev.includes(id) ? prev : [...prev, id]);
      await fetch(`/api/student/${user.id}/module/${moduleSlug}/lesson`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: user.id, module_name: moduleSlug, lesson_id: id, completed: true })
      });
    } catch (e) {
      // revert optimistic if needed (skip for simplicity)
    }
  }, [user, moduleSlug, lessons]);

  const markQuizPassed = useCallback(async () => {
    if (!user) return;
    try {
      setQuizPassed(true);
      await fetch(`/api/student/${user.id}/module/${moduleSlug}/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: user.id, module_name: moduleSlug, passed: true })
      });
    } catch (e) {}
  }, [user, moduleSlug]);

  return {
    loading,
    completedIds,
    quizPassed,
    error,
    markLessonComplete,
    markQuizPassed,
    moduleSlug,
  };
}
