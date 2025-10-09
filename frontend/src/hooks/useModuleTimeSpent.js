import { useEffect, useState, useRef } from 'react';

// useModuleTimeSpent
// Listens for moduleTimeUpdated events (emitted by useTimeAccumulator flushes) and can optionally
// do an initial fetch from the summary endpoint to seed the value.
export default function useModuleTimeSpent({ studentId, moduleSlug, initialSeconds=null, pollMs=0, realtime=false }) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const lastServerSecondsRef = useRef(initialSeconds || 0);

  useEffect(()=>{
    if(!studentId || !moduleSlug) return;
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await fetch(`/api/student/${studentId}/modules/summary`);
        if(!res.ok) return;
        const data = await res.json();
        let found = null;
        if(Array.isArray(data?.modules)){
          found = data.modules.find(m=> m.module_name === moduleSlug);
        }
        if(!found && data && data[moduleSlug]) found = data[moduleSlug];
        if(found && typeof found.time_spent === 'number' && !cancelled){
          setSeconds(found.time_spent);
        }
      } catch {/* ignore */}
    };
    if(initialSeconds == null) fetchOnce();
    const handler = (e)=>{
      if(e.detail?.moduleSlug === moduleSlug && typeof e.detail.totalSeconds === 'number'){
        lastServerSecondsRef.current = e.detail.totalSeconds;
        setSeconds(e.detail.totalSeconds);
      }
    };
    window.addEventListener('moduleTimeUpdated', handler);
    const realtimeHandler = (e)=>{
      if(!realtime) return;
      if(e.detail?.moduleSlug === moduleSlug){
        setSeconds(lastServerSecondsRef.current + (e.detail.elapsedSinceMount || 0));
      }
    };
    if(realtime){ window.addEventListener('moduleTimeRealtimeTick', realtimeHandler); }
    let pollTimer = null;
    if(pollMs>0){ pollTimer = setInterval(fetchOnce, pollMs); }
    return ()=>{ cancelled = true; window.removeEventListener('moduleTimeUpdated', handler); if(realtime) window.removeEventListener('moduleTimeRealtimeTick', realtimeHandler); if(pollTimer) clearInterval(pollTimer); };
  }, [studentId, moduleSlug, pollMs, initialSeconds, realtime]);

  return seconds;
}
