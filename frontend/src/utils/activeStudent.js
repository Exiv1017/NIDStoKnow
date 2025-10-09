// Central helper to resolve the active student id across the app.
// Falls back gracefully if not authenticated.
export function getActiveStudentId({ user } = {}) {
  try {
    if (user?.id) return user.id;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('active-student-id');
      if (stored) return stored;
      if (window.__ACTIVE_STUDENT_ID__) return window.__ACTIVE_STUDENT_ID__;
    }
  } catch {}
  return null;
}
