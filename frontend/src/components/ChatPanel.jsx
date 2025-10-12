import React from 'react';

const ChatPanel = ({
  title = 'Communication',
  messages = [],
  input = '',
  onInputChange,
  onSend,
  disabled = false,
}) => {
  return (
    <div className="bg-[#111827] rounded-xl border border-slate-800 p-4">
      <h3 className="text-lg font-semibold mb-4 text-sky-400">{title}</h3>
      <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
        {messages.length === 0 ? (
          <div className="text-gray-400 text-sm">No messages yet.</div>
        ) : (
          messages
            .slice(-20)
            .reverse()
            .map((m) => {
              const ts = m?.timestamp && typeof m.timestamp.toLocaleTimeString === 'function' ? m.timestamp : new Date(m?.timestamp);
              return (
                <div key={m.id} className="p-2 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="text-xs text-gray-300">
                    <span className="text-sky-300 font-semibold">{m.sender}</span>
                  </div>
                  <div className="text-gray-100 text-sm">{m.message}</div>
                  <div className="text-[10px] text-gray-500">{ts?.toLocaleTimeString?.() || ''}</div>
                </div>
              );
            })
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={onInputChange}
          onKeyDown={(e) => e.key === 'Enter' && onSend?.()}
          placeholder="Type a message..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-gray-100"
          disabled={disabled}
        />
        <button onClick={onSend} className="bg-sky-600 hover:bg-sky-500 text-white px-3 py-2 rounded" disabled={disabled}>
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;
