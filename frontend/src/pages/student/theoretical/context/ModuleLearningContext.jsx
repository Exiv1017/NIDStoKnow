import React, { createContext, useContext, useMemo, useCallback } from 'react';

const ModuleLearningContext = createContext(null);
export const useModuleLearning = () => useContext(ModuleLearningContext);

export function ModuleLearningProvider({ children, lessons, currentLessonIdx, setCurrentLessonIdx, serverProgress, currentModule=null, getLessonIdFn }) {
  const safeIsComplete = (i) => (serverProgress && typeof serverProgress.isComplete === 'function') ? serverProgress.isComplete(i) : false;
  const allLessonsComplete = lessons.length > 0 && lessons.every((_, i) => safeIsComplete(i));

  const markLessonComplete = useCallback((idx) => {
    if (serverProgress && typeof serverProgress.markComplete === 'function') {
      serverProgress.markComplete(idx);
    }
  }, [serverProgress]);

  const nextLesson = useCallback(() => { if (currentLessonIdx < lessons.length - 1) setCurrentLessonIdx(i=>i+1); }, [currentLessonIdx, lessons.length, setCurrentLessonIdx]);
  const prevLesson = useCallback(() => { if (currentLessonIdx > 0) setCurrentLessonIdx(i=>i-1); }, [currentLessonIdx, setCurrentLessonIdx]);

  const value = useMemo(() => ({
    lessons,
    currentLessonIdx,
    setCurrentLessonIdx,
    completedIds: (serverProgress && Array.isArray(serverProgress.completedIds)) ? serverProgress.completedIds : [],
    markLessonComplete,
    allLessonsComplete,
    nextLesson,
    prevLesson,
    currentModule,
    getLessonId: getLessonIdFn,
  }), [lessons, currentLessonIdx, serverProgress, markLessonComplete, allLessonsComplete, nextLesson, prevLesson, currentModule, getLessonIdFn]);

  return <ModuleLearningContext.Provider value={value}>{children}</ModuleLearningContext.Provider>;
}
