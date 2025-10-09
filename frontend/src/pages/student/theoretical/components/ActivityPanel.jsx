import React from 'react';

export default function ActivityPanel({ onComplete, completed }) {
  return (
    <div className="rounded-lg border border-[var(--lms-border)] bg-[var(--lms-surface)] p-4 shadow-sm">
      <h4 className="font-semibold mb-2">Activity</h4>
      <p className="text-sm lms-text-muted mb-4">(Placeholder) Interactive tasks will appear here.</p>
      <button
        onClick={onComplete}
        disabled={completed}
  className={`px-4 py-2 rounded-md text-sm border ${completed ? 'bg-emerald-600/10 border-emerald-500/40 text-emerald-500 cursor-default' : 'bg-[var(--lms-primary)] border-[var(--lms-primary)] text-white hover:bg-[var(--lms-primary-accent)]'}`}
      >{completed ? 'Lesson Completed ✓' : 'Mark Lesson Complete'}</button>
    </div>
  );
}
