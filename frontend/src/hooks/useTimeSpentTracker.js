import { useEffect, useRef } from 'react';

/**
 * useTimeSpentTracker
 * Tracks time spent on a page and sends it to the backend on unmount and periodically.
 * @param {Object} options
 * @param {number} options.studentId
 * @param {string} options.studentName
 * @param {string} options.moduleName
 * @param {string} options.lessonName
 * @param {number} options.lessonsCompleted
 * @param {number} options.totalLessons
 * @param {number} options.engagementScore
 * @param {string} options.endpoint - Backend endpoint to POST progress
 */
export default function useTimeSpentTracker({
  studentId,
  studentName,
  moduleName,
  lessonName,
  lessonsCompleted = 0,
  totalLessons = 0,
  engagementScore = 0,
  endpoint = '/api/student/progress',
  authToken = null,
}) {
  const startTimeRef = useRef(Date.now());
  const totalTimeRef = useRef(0); // ms
  const lastVisibilityChange = useRef(Date.now());
  const isVisible = useRef(document.visibilityState === 'visible');
  const intervalRef = useRef(null);
  const lastSentSeconds = useRef(0); // Track last sent seconds

  // Helper to send progress (delta only)
  function sendProgress(deltaSeconds) {
    if (deltaSeconds <= 0) return; // Don't send if no new time
    if (!studentId) {
      // Do not POST anonymous progress to the server; avoids 422 validation errors.
      console.log('[useTimeSpentTracker] no studentId; skipping progress send');
      return;
    }
    if (!moduleName || String(moduleName).trim() === '') {
      console.log('[useTimeSpentTracker] empty moduleName; skipping progress send');
      return;
    }
    const payload = {
      student_id: studentId,
      student_name: studentName,
      module_name: moduleName,
      lessons_completed: lessonsCompleted,
      total_lessons: totalLessons,
      last_lesson: lessonName,
      time_spent_seconds: deltaSeconds,
      engagement_score: engagementScore,
    };
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}) },
      body: JSON.stringify(payload),
    });
    // Log for debugging
    console.log('[useTimeSpentTracker] Progress sent:', payload);
  }

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        // Pause timer
        if (isVisible.current) {
          totalTimeRef.current += Date.now() - lastVisibilityChange.current;
          isVisible.current = false;
        }
      } else {
        // Resume timer
        lastVisibilityChange.current = Date.now();
        isVisible.current = true;
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic update every 10 seconds
    intervalRef.current = setInterval(() => {
      if (isVisible.current) {
        const now = Date.now();
        const elapsed = totalTimeRef.current + (now - lastVisibilityChange.current);
        const seconds = Math.floor(elapsed / 1000);
        const delta = seconds - lastSentSeconds.current;
        sendProgress(delta);
        lastSentSeconds.current = seconds;
      }
    }, 10000);

    return () => {
      // On unmount, add any remaining visible time
      if (isVisible.current) {
        totalTimeRef.current += Date.now() - lastVisibilityChange.current;
      }
      const seconds = Math.floor(totalTimeRef.current / 1000);
      const delta = seconds - lastSentSeconds.current;
      sendProgress(delta);
      lastSentSeconds.current = seconds;
      clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  // eslint-disable-next-line
  }, [studentId, studentName, moduleName, lessonName, lessonsCompleted, totalLessons, engagementScore, endpoint]);
}
