import React, { useEffect, useState, useCallback } from 'react';

function storageKey(moduleTitle, lessonTitle) {
  return `notes:${moduleTitle}:${lessonTitle}`;
}

export default function LessonNotesPanel({ moduleTitle, lessonTitle, onExit }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [savedAt, setSavedAt] = useState(null);

  // Load existing notes for lesson
  useEffect(() => {
    if (!lessonTitle) return;
    try {
      const raw = localStorage.getItem(storageKey(moduleTitle, lessonTitle));
      if (raw) {
        const parsed = JSON.parse(raw);
        setValue(parsed.value || '');
        setSavedAt(parsed.savedAt || null);
      } else {
        setValue('');
        setSavedAt(null);
      }
    } catch {}
  }, [moduleTitle, lessonTitle]);

  const save = useCallback((next) => {
    const ts = Date.now();
    const record = { value: next, savedAt: ts };
    try { localStorage.setItem(storageKey(moduleTitle, lessonTitle), JSON.stringify(record)); } catch {}
    setSavedAt(ts);
  }, [moduleTitle, lessonTitle]);

  // Debounced autosave status message fade
  const [justSaved, setJustSaved] = useState(false);
  useEffect(()=>{
    if(!savedAt) return;
    setJustSaved(true);
    const t=setTimeout(()=>setJustSaved(false), 3000);
    return ()=>clearTimeout(t);
  },[savedAt]);

  const exportNotes = () => {
    const blob = new Blob([value], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lessonTitle || 'lesson'}-notes.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`fixed right-4 bottom-4 z-40 ${open ? 'w-80' : 'w-auto'} flex flex-col items-end gap-2`}>
      {!open && (
        <div className="flex items-center gap-2">
          <button onClick={() => setOpen(true)} className="lms-primary lms-focus-ring text-xs flex items-center gap-2 shadow-md" aria-label="Open notes">
            📝 Notes
          </button>
          <button onClick={onExit} className="text-xs px-3 py-1.5 rounded-md border border-[var(--lms-border)] bg-[var(--lms-surface)] hover:bg-[var(--lms-surface-alt)] lms-focus-ring shadow-sm" aria-label="Exit to modules">
            Exit
          </button>
        </div>
      )}
      {open && (
        <div className="lms-surface p-4 rounded-lg shadow-lg flex flex-col h-96 w-80">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold">Notes</h4>
            <div className="flex items-center gap-2">
              {savedAt && <span className="text-[10px] lms-text-faint">Saved {new Date(savedAt).toLocaleTimeString()}</span>}
              <button onClick={() => setOpen(false)} className="text-xs lms-text-muted hover:lms-text-accent" aria-label="Close notes">✕</button>
            </div>
          </div>
          <textarea
            className="flex-1 text-xs rounded-md border border-[var(--lms-border)] bg-white/70 dark:bg-[var(--lms-surface-alt)] p-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={value}
            placeholder="Write your notes..."
            onChange={(e) => { setValue(e.target.value); save(e.target.value); }}
          />
          <div className="mt-2 flex justify-between items-center">
            <div className="text-[10px] lms-text-faint min-h-[1em]">
              {savedAt && (justSaved ? 'Saved just now' : `Saved ${new Date(savedAt).toLocaleTimeString()}`)}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportNotes} className="text-[11px] px-2 py-1 rounded-md border border-[var(--lms-border)] hover:bg-[var(--lms-surface-alt)]" aria-label="Export notes">Export</button>
              <button onClick={onExit} className="text-[11px] px-2 py-1 rounded-md border border-[var(--lms-border)] hover:bg-[var(--lms-surface-alt)]" aria-label="Exit to modules">Exit</button>
              <button onClick={() => { save(value); }} className="lms-secondary text-[11px]" aria-label="Save notes">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
