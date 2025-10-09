// Utility helpers for module quiz state (separated to keep React Fast Refresh clean)
// There have been TWO user-specific key orderings historically:
//  1) Legacy (initial user-namespace implementation):  <prefix>:<moduleSlug>:passed:u<id>
//  2) Canonical (desired final form)               :  <prefix>:<moduleSlug>:u<id>:passed
// Anonymous (no user id) has always been: <prefix>:<moduleSlug>:passed
// This helper now:
//  - Checks canonical first
//  - Falls back to legacy ordering
//  - Migrates legacy -> canonical if found (write canonical, optionally remove legacy)
//  - Still respects very old pre-prefix key  <moduleSlug>-module-quiz-passed (signature track only)
export function getModuleQuizPassed(moduleSlug, userId=null, track='signature') {
  try {
    const prefix = track === 'anomaly' ? 'anomalyQuiz' : track === 'hybrid' ? 'hybridQuiz' : 'signatureQuiz';
    // Anonymous / legacy global check
    if (!userId) {
      if (localStorage.getItem(`${prefix}:${moduleSlug}:passed`) === 'true') return true;
      if (track === 'signature' && localStorage.getItem(`${moduleSlug}-module-quiz-passed`) === 'true') return true; // very old key
      return false;
    }
    const canonical = `${prefix}:${moduleSlug}:u${userId}:passed`;
    if (localStorage.getItem(canonical) === 'true') return true;
    const legacy = `${prefix}:${moduleSlug}:passed:u${userId}`; // old ordering
    if (localStorage.getItem(legacy) === 'true') {
      // Migrate silently
      try {
        localStorage.setItem(canonical, 'true');
        // Keep legacy for a short time to avoid race conditions; we could remove later.
        // localStorage.removeItem(legacy);
        // Fire a storage event manually for same-tab listeners (some browsers don't for programmatic set)
        window.dispatchEvent(new StorageEvent('storage', { key: canonical, newValue: 'true' }));
      } catch {}
      return true;
    }
    // Fallback: signature very old key (pre prefix) for a specific module slug (rare)
    if (track === 'signature' && localStorage.getItem(`${moduleSlug}-module-quiz-passed`) === 'true') {
      try { localStorage.setItem(canonical, 'true'); } catch {}
      return true;
    }
    return false;
  } catch { return false; }
}
