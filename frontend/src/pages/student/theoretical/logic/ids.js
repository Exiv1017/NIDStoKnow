// Utility functions for consistent lesson/module identification
export const toSlug = (s = '') => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

export const getLessonId = (lesson, index) => {
  if (!lesson) return `lesson-${index}`;
  if (lesson.id) return String(lesson.id);
  if (lesson.title) return toSlug(lesson.title);
  return `lesson-${index}`;
};

// Storage key helpers. We now namespace by user id (if available) to prevent
// progress from leaking across different logged-in accounts that share the
// same browser profile. Backward compatibility: if a user-specific key is not
// found we still read legacy global key once (but we do NOT migrate / write
// back into the old key to avoid cross-user contamination).
export const moduleStoragePrefix = (moduleSlug, userId=null) => `module-${moduleSlug}${userId?`-u${userId}`:''}`;
export const legacyModuleStoragePrefix = (moduleSlug) => `module-${moduleSlug}`; // pre-namespace
export const lessonIdsKey = (moduleSlug, userId=null) => `${moduleStoragePrefix(moduleSlug, userId)}-completed-lesson-ids`;
export const legacyLessonIdsKey = (moduleSlug) => `${legacyModuleStoragePrefix(moduleSlug)}-completed-lesson-ids`;

export const loadCompletedLessonIds = (moduleSlug, userId=null) => {
  try {
    if (userId) {
      // DO NOT fallback to legacy when a user id is supplied. This ensures a brand-new account
      // starts at zero progress even if a previous (different) user used the same browser.
      const namespaced = localStorage.getItem(lessonIdsKey(moduleSlug, userId));
      return namespaced ? JSON.parse(namespaced) : [];
    }
    // Anonymous / legacy mode: read old key.
    const legacy = localStorage.getItem(lessonIdsKey(moduleSlug, null)) || localStorage.getItem(legacyLessonIdsKey(moduleSlug));
    return legacy ? JSON.parse(legacy) : [];
  } catch { return []; }
};

export const saveCompletedLessonIds = (moduleSlug, ids, userId=null) => {
  try { localStorage.setItem(lessonIdsKey(moduleSlug, userId), JSON.stringify(Array.from(new Set(ids)))); } catch {}
};

export const lessonIdFrom = (lesson, index) => getLessonId(lesson, index);
