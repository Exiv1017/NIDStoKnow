import { useMemo } from 'react';

// Combines local and server progress objects produced by existing hooks.
// Expects shape: { completedIds: string[], markLessonComplete?: (idx)=>void, total?: number, completedCount?: number }
export default function useMergedProgress(localProgress, serverProgress) {
  return useMemo(() => {
    const localIds = localProgress?.completedIds || [];
    const serverIds = serverProgress?.completedIds || [];
  const completedSet = new Set([...localIds, ...serverIds]);
  const total = localProgress?.total ?? serverProgress?.total ?? 0;
  // Clamp size to total to prevent >100% if server returns extra IDs (e.g., legacy/summary duplication)
  const cappedCompletedCount = Math.min(completedSet.size, total || completedSet.size);
    const merged = {
      total,
      completedIds: Array.from(completedSet),
  completedCount: cappedCompletedCount,
      // Prefer server marking if available, else local
      markLessonComplete: (idx) => {
        localProgress?.markComplete?.(idx);
        serverProgress?.markLessonComplete?.(idx);
      }
    };
    return merged;
  }, [localProgress, serverProgress]);
}