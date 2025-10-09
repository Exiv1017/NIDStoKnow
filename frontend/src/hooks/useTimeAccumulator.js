import { useEffect, useRef } from 'react';

/**
 * useTimeAccumulator
 * Periodically batches time the student spends on a unit (lesson/overview/quiz/practical/assessment)
 * and sends it to the backend /time_event endpoint. Also flushes when unmounting or visibility changes.
 *
 * @param {Object} opts
 * @param {number} opts.studentId
 * @param {string} opts.moduleSlug canonical module slug e.g. signature-based-detection
 * @param {string} opts.unitType lesson|overview|quiz|practical|assessment
 * @param {string} [opts.unitCode] identifier (lesson id, quiz code, etc)
 * @param {number} [opts.intervalSeconds=15] local accumulation tick
 * @param {number} [opts.flushSeconds=60] flush cadence to server
 * @param {string} [opts.baseUrl='http://localhost:8000'] API base
 * @param {string} [opts.authToken] optional bearer token
 * @param {boolean} [opts.debug=false] when true logs increments & flushes to console
 * @param {boolean} [opts.realtime=false] emit per-second tick events for UI between flushes
 */
export default function useTimeAccumulator({ studentId, moduleSlug, unitType, unitCode=null, intervalSeconds=15, flushSeconds=60, baseUrl='http://localhost:8000', authToken, debug=false, realtime=false }) {
  const accRef = useRef(0);
  const lastSentRef = useRef(Date.now());
  const realtimeRef = useRef(0);

  useEffect(()=>{
    if(!studentId || !moduleSlug || !unitType) return; // nothing to do

    let active = true;
    const tickMs = intervalSeconds * 1000;
    const flushMs = flushSeconds * 1000;

    const incr = () => { 
      if(document.visibilityState === 'visible') { 
        accRef.current += intervalSeconds; 
        if(debug) console.log(`[timeacc] +${intervalSeconds}s (${unitType}${unitCode?':'+unitCode:''}) pending=${accRef.current}s module=${moduleSlug}`);
      }
    };
    const tickTimer = setInterval(incr, tickMs);
    let realtimeTimer = null;
    if(realtime){
      realtimeTimer = setInterval(()=>{
        if(document.visibilityState !== 'visible') return;
        realtimeRef.current += 1;
        try { window.dispatchEvent(new CustomEvent('moduleTimeRealtimeTick', { detail:{ moduleSlug, elapsedSinceMount: realtimeRef.current } })); } catch {}
      }, 1000);
    }

    async function flush(force=false){
      if(!active) return;
      const now = Date.now();
      const elapsedSince = now - lastSentRef.current;
      if(!force && elapsedSince < flushMs) return;
      const delta = accRef.current;
      if(delta <= 0) return;
      accRef.current = 0;
      lastSentRef.current = now;
      try {
        if(debug) console.log(`[timeacc] FLUSH sending ${delta}s (${unitType}${unitCode?':'+unitCode:''}) -> ${baseUrl}/api/student/${studentId}/module/${moduleSlug}/time_event`);
        const res = await fetch(`${baseUrl}/api/student/${studentId}/module/${moduleSlug}/time_event`, {
          method:'POST',
            headers:{ 'Content-Type':'application/json', ...(authToken? { 'Authorization':`Bearer ${authToken}` } : {}) },
          body: JSON.stringify({ unit_type: unitType, unit_code: unitCode, delta_seconds: delta })
        });
        if(res.ok){
          let data=null; try { data=await res.json(); } catch {}
            if(debug) console.log(`[timeacc] FLUSH ok +${delta}s (module=${moduleSlug}) total=${data?.total_time_spent}`);
            if(data && typeof data.total_time_spent==='number'){
              try{ window.dispatchEvent(new CustomEvent('moduleTimeUpdated', { detail:{ moduleSlug, totalSeconds: data.total_time_spent } })); }catch{}
            }
            if(realtime){ realtimeRef.current = 0; }
        } else if(debug){
          console.warn('[timeacc] FLUSH non-200 status', res.status);
        }
      } catch (e) {
        // Best-effort; re-accumulate on failure
        if(debug) console.warn(`[timeacc] FLUSH failed, re-queue ${delta}s`, e);
        accRef.current += delta;
      }
    }

    const flushTimer = setInterval(()=>flush(), 5000); // check every 5s if flush interval elapsed

  const handleVisibility = () => { if(document.visibilityState === 'hidden') { if(debug) console.log('[timeacc] visibility hidden -> force flush'); flush(true); } };
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', ()=>flush(true));

    return ()=>{
      active = false;
  if(debug) console.log('[timeacc] unmount -> force flush');
  flush(true);
      clearInterval(tickTimer);
      clearInterval(flushTimer);
      window.removeEventListener('visibilitychange', handleVisibility);
      if(realtimeTimer) clearInterval(realtimeTimer);
    };
  }, [studentId, moduleSlug, unitType, unitCode, intervalSeconds, flushSeconds, baseUrl, authToken, realtime]);
}
