import { useState, useEffect, useCallback } from 'react';
import { toSlug, getLessonId } from '../pages/student/theoretical/logic/ids';

/* Server-authoritative lesson progress hook
   Inputs: moduleTitle (string), lessons (array), student/user object with id
   Returns: { completedIds, markComplete, isComplete, refresh, loading, error }
*/
export default function useServerLessonProgress({ moduleTitle, lessons, user }) {
  const moduleSlug = toSlug(moduleTitle || '');
  const studentId = user?.id;
  const [completedIds, setCompletedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCompleted = useCallback(async () => {
    if (!studentId || !moduleSlug) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/student/${studentId}/module/${moduleSlug}/lessons/completed`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.lesson_ids)) setCompletedIds(data.lesson_ids);
    } catch (e) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [studentId, moduleSlug]);

  useEffect(() => { fetchCompleted(); }, [fetchCompleted]);

  const markComplete = useCallback(async (lessonIndex) => {
    if (!studentId) return;
    const id = getLessonId(lessons[lessonIndex], lessonIndex);
    try {
      const res = await fetch(`/api/student/${studentId}/module/${moduleSlug}/lesson/${encodeURIComponent(id)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true })
      });
      if (res.ok) {
        setCompletedIds(prev => prev.includes(id) ? prev : [...prev, id]);
        // Broadcast event so other components (summary refresher) can react
        try { window.dispatchEvent(new CustomEvent('lessonCompleted', { detail: { moduleSlug, lessonId: id } })); } catch {}
      }
    } catch (e) { /* swallow */ }
  }, [studentId, moduleSlug, lessons]);

  const isComplete = useCallback((lessonIndex) => {
    const id = getLessonId(lessons[lessonIndex], lessonIndex);
    return completedIds.includes(id);
  }, [completedIds, lessons]);

  return { moduleSlug, completedIds, markComplete, isComplete, refresh: fetchCompleted, loading, error };
}
