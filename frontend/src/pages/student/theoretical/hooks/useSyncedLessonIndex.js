import { useEffect, useState } from 'react';

// Manages lesson index syncing with URL search params and localStorage persistence.
// Params: { searchParams, setSearchParams, moduleTitle, lessonsLength }
export default function useSyncedLessonIndex({ searchParams, setSearchParams, moduleTitle, lessonsLength }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    // Read from URL else localStorage
    const lp = searchParams.get('lesson');
    const storedKey = `theory:${moduleTitle}:last:lesson`;
    const stored = typeof window !== 'undefined' ? localStorage.getItem(storedKey) : null;
    if (lp !== null) {
      const n = parseInt(lp, 10);
      if (!isNaN(n) && n >= 0 && n < lessonsLength) setIndex(n);
    } else if (stored) {
      const n = parseInt(stored, 10);
      if (!isNaN(n) && n >= 0 && n < lessonsLength) {
        setIndex(n);
        const next = new URLSearchParams(searchParams);
        next.set('lesson', String(n));
        setSearchParams(next, { replace: true });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleTitle, lessonsLength]);

  useEffect(() => {
    const current = searchParams.get('lesson');
    if (String(index) !== current) {
      const next = new URLSearchParams(searchParams);
      next.set('lesson', String(index));
      setSearchParams(next, { replace: true });
    }
    try { localStorage.setItem(`theory:${moduleTitle}:last:lesson`, String(index)); } catch {}
  }, [index, searchParams, setSearchParams, moduleTitle]);

  return [index, setIndex];
}