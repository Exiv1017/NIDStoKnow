import { useEffect, useState, useCallback, useRef } from 'react';
import { toSlug } from '../pages/student/theoretical/logic/ids';

// Enhanced hook: normalizes, merges duplicate variants. Overview completion now trusts backend flags only.
export default function useModuleSummaries(user){
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState(null);
  const [summaries,setSummaries] = useState({});
  const lastFetchedRef = useRef(null);

  // Allow overriding API base (docker / prod) while still supporting Vite dev proxy.
  const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
  const buildUrl = (id) => `${API_BASE}/api/student/${id}/modules/summary`.replace(/([^:]?)\/\/+/g,'$1/');

  // Do NOT auto-complete Overview for new accounts. A student must click Overview to mark it done.
  const ALWAYS_COMPLETE_OVERVIEW = false;

  const normalizeRows = (arr) => {
    const map = {};
    if(!Array.isArray(arr)) return map;
    arr.forEach(r=>{
      if(!r) return;
      const slug = toSlug(r.module_name || r.slug || r.display_name || '');
      if(!slug) return;
      const normalized = {
        slug,
        display_name: r.display_name || r.module_name || slug,
        module_name: r.module_name || slug,
        percent: typeof r.percent === 'number' ? r.percent : 0,
        lessons_completed: r.lessons_completed ?? r.raw_lessons_completed ?? 0,
        total_lessons: r.total_lessons ?? 0,
        quizzes_passed: r.quizzes_passed ?? 0,
        total_quizzes: r.total_quizzes ?? 0,
        // Trust backend: overview is complete only when server says so
        overview_completed: !!r.overview_completed,
        practical_completed: !!r.practical_completed,
        assessment_completed: !!r.assessment_completed,
        can_start_practical: !!r.can_start_practical,
        can_start_assessment: !!r.can_start_assessment,
        time_spent_seconds: r.time_spent_seconds ?? 0,
        engagement_score: r.engagement_score ?? 0,
        units_completed: r.units_completed ?? null,
        units_total: r.units_total ?? null
      };
      const existing = map[slug];
      if(!existing){ map[slug] = normalized; } else {
        ['percent','lessons_completed','total_lessons','quizzes_passed','total_quizzes','time_spent_seconds','engagement_score','units_completed','units_total'].forEach(f=>{
          if(typeof normalized[f]==='number') existing[f] = Math.max(existing[f]||0, normalized[f]);
        });
        ['overview_completed','practical_completed','assessment_completed','can_start_practical','can_start_assessment'].forEach(f=>{ if(normalized[f]) existing[f] = true; });
      }
    });
    return map;
  };

  const load = useCallback(async ({retry=1}={})=>{
    if(!user?.id){ setSummaries({}); return; }
    setLoading(true); setError(null);
    const url = buildUrl(user.id);
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(), 8000); // 8s timeout
    try {
      if(process.env.NODE_ENV !== 'production') {
        // Lightweight dedupe: avoid hammering if same url requested quickly
        if(lastFetchedRef.current === url) {
          // proceed anyway but note in console
          // eslint-disable-next-line no-console
          console.debug('[useModuleSummaries] Re-fetching same URL:', url);
        }
      }
      lastFetchedRef.current = url;
      const res = await fetch(url, { signal: controller.signal, headers: { 'Accept':'application/json' }});
      let bodyText = '';
      if(!res.ok){
        try { bodyText = await res.text(); } catch(_){}
        const err = new Error(`Failed to load module summaries (status ${res.status})`);
        err.status = res.status; // attach status
        err.body = bodyText.slice(0,400);
        throw err;
      }
      let data;
      try {
        data = await res.json();
      } catch(jsonErr){
        const err = new Error('Invalid JSON in module summaries response');
        err.cause = jsonErr;
        throw err;
      }
      setSummaries(normalizeRows(data));
    } catch(e){
      if(e.name === 'AbortError'){
        const abortErr = new Error('Module summaries request timed out');
        setError(abortErr);
        if(retry>0){
            // Retry once automatically after short delay
            setTimeout(()=>load({retry: retry-1}), 500);
        }
      } else {
        setError(e);
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [user?.id, API_BASE]);

  useEffect(()=>{ load(); }, [load]);

  // Removed old auto-sync that force-completed overview on the server.

  const getForTitle = (title='') => summaries[toSlug(title)] || null;
  return { loading, error, summaries, refresh: load, getForTitle, apiBase: API_BASE };
}
