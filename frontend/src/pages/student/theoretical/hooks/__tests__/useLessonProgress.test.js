import { renderHook, act } from '@testing-library/react';
import useLessonProgress from '../useLessonProgress.js';

describe('useLessonProgress', () => {
  const lessons = [
    { title: 'A' },
    { title: 'B' }
  ];
  const moduleTitle = 'Test Module';

  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with zero completed', () => {
    const { result } = renderHook(() => useLessonProgress({ moduleTitle, lessons }));
    expect(result.current.completedCount).toBe(0);
    expect(result.current.total).toBe(2);
  });

  it('marks lesson complete and persists', () => {
    const { result, rerender } = renderHook(() => useLessonProgress({ moduleTitle, lessons }));
    act(() => result.current.markComplete(0));
    expect(result.current.completedCount).toBe(1);

    // rerender to simulate remount
    rerender();
    expect(result.current.completedCount).toBe(1);
  });
});
