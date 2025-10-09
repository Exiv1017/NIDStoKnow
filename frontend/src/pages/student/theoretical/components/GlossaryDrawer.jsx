import React, { useEffect, useState } from 'react';
import { glossaryDefinitions, extractGlossaryTerms } from '../logic/glossary.js';

export default function GlossaryDrawer({ content }) {
  const [open, setOpen] = useState(false);
  const [activeTerm, setActiveTerm] = useState(null);
  const [termsInLesson, setTermsInLesson] = useState([]);

  useEffect(()=>{
    setTermsInLesson(extractGlossaryTerms(content));
  }, [content]);

  useEffect(()=>{
    const handler = (e) => {
      const target = e.target.closest?.('.glossary-term');
      if (target) {
        const term = target.getAttribute('data-term');
        setActiveTerm(term);
        setOpen(true);
      }
    };
    document.addEventListener('click', handler);
    return ()=> document.removeEventListener('click', handler);
  }, []);

  return (
    <>
      <button onClick={()=>setOpen(o=>!o)} className="lms-secondary lms-focus-ring text-[11px]" aria-expanded={open}>Glossary ({termsInLesson.length})</button>
      {open && (
  <div className="fixed inset-y-0 right-0 w-80 bg-[var(--lms-surface)] border-l border-[var(--lms-border)] shadow-xl z-50 flex flex-col">
          <div className="p-4 flex items-center justify-between border-b border-[var(--lms-border)]">
            <h3 className="text-sm font-semibold">Glossary</h3>
            <button onClick={()=>setOpen(false)} className="text-xs lms-text-muted hover:lms-text-accent">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
            {termsInLesson.length === 0 && <div className="text-xs lms-text-faint">No glossary terms detected.</div>}
            {termsInLesson.map(t=>{
              const def = glossaryDefinitions[t] || 'Definition not available yet.';
              return (
                <div key={t} className={`p-3 rounded-md border ${activeTerm===t?'border-[var(--lms-primary)] bg-[var(--lms-primary-muted)]/40':'border-[var(--lms-border)] bg-[var(--lms-surface-alt)]/60'}`}> 
                  <div className="font-semibold mb-1 capitalize">{t}</div>
                  <div className="text-xs leading-relaxed lms-text-soft">{def}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
