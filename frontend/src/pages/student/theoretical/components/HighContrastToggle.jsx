import { useEffect, useState } from 'react';

export default function HighContrastToggle(){
  const [enabled,setEnabled]=useState(false);
  useEffect(()=>{
    try { const v = localStorage.getItem('ui:highContrast'); if(v==='true'){ setEnabled(true); document.documentElement.classList.add('high-contrast'); } } catch {}
  },[]);
  const toggle=()=>{
    setEnabled(e=>{ const next=!e; try { localStorage.setItem('ui:highContrast', String(next)); } catch {};
      if(next) document.documentElement.classList.add('high-contrast'); else document.documentElement.classList.remove('high-contrast');
      return next; });
  };
  return (
    <button onClick={toggle} className="text-xs px-3 py-1.5 rounded-md border border-[var(--lms-border)] hover:bg-[var(--lms-surface-alt)]" aria-pressed={enabled} aria-label="Toggle high contrast mode">
      {enabled ? 'Contrast On' : 'Contrast Off'}
    </button>
  );
}