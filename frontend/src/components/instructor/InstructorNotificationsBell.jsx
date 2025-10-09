import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import AuthContext from '../../context/AuthContext';

function useInstructorAuthHeaders(userFromContext) {
  return useMemo(() => {
    const tokenFromCtx = userFromContext?.token;
    if (tokenFromCtx) return { Authorization: `Bearer ${tokenFromCtx}` };
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw);
        const token = parsed?.token;
        return token ? { Authorization: `Bearer ${token}` } : null;
      }
    } catch {}
    return null;
  }, [userFromContext]);
}

const InstructorNotificationsBell = ({ refreshIntervalMs = 30000, appearance = 'light' }) => {
  const { user } = useContext(AuthContext);
  const headers = useInstructorAuthHeaders(user);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const intervalRef = useRef(null);
  const panelRef = useRef(null);

  const fetchCount = async (signal) => {
    if (!headers) return;
    try {
      const res = await fetch('/api/instructor/notifications/count', { headers, signal });
      if (!res.ok) return;
      const data = await res.json();
      setCount(data?.count ?? 0);
    } catch {}
  };

  const fetchList = async () => {
    if (!headers) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/instructor/notifications', { headers });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setItems(data);
      else setError(data?.error || 'Failed to load notifications');
    } catch {
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id) => {
    if (!headers) return;
    try {
      const res = await fetch(`/api/instructor/notifications/${id}/read`, { method: 'PATCH', headers });
      if (res.ok) {
        setItems((prev) => prev.filter((n) => n.id !== id));
        setCount((c) => Math.max(0, c - 1));
      }
    } catch {}
  };

  const markAllRead = async () => {
    if (!headers) return;
    try {
      const res = await fetch('/api/instructor/notifications/mark-all-read', { method: 'POST', headers });
      if (res.ok) {
        setItems([]);
        setCount(0);
      }
    } catch {}
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchCount(controller.signal);
    if (refreshIntervalMs > 0) intervalRef.current = setInterval(() => fetchCount(controller.signal), refreshIntervalMs);
    return () => {
      controller.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [headers, refreshIntervalMs]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!open) return;
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next && headers) await fetchList();
  };

  const bellDisabled = false;

  const formatTime = (t) => {
    if (!t) return '';
    const d = new Date(t);
    if (isNaN(d.getTime())) return String(t);
    return d.toLocaleString();
  };

  const iconColorClass = appearance === 'light' ? 'text-[#1E5780]' : 'text-white';
  const hoverBgClass = appearance === 'light' ? 'hover:bg-black/5' : 'hover:bg-white/10';

  return (
    <div className="relative" ref={panelRef}>
      <button
        disabled={bellDisabled}
        onClick={toggleOpen}
        className={`relative p-2 rounded-md ${hoverBgClass} transition ${bellDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={bellDisabled ? 'Log in to view notifications' : 'Notifications'}
        aria-label="Instructor notifications"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${iconColorClass}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-red-600 rounded-full min-w-[18px]">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-white text-gray-800 rounded-lg shadow-xl border border-gray-200 z-50">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold text-sm">Notifications</div>
            <div className="flex items-center gap-3">
              <button onClick={fetchList} className="text-xs text-blue-600 hover:underline">Refresh</button>
            </div>
          </div>
          <div className="max-h-80 overflow-auto">
            {loading && (
              <div className="p-4 text-sm text-gray-500">Loading…</div>
            )}
            {!!error && !loading && (
              <div className="p-4 text-sm text-red-600">{error}</div>
            )}
            {!loading && !error && items.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-400">
                <svg className="mx-auto h-12 w-12 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-sm">No notifications</p>
              </div>
            )}
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id} className="p-3 flex items-start gap-3">
                  <div className={`mt-1 h-2 w-2 rounded-full ${n.read ? 'bg-gray-300' : 'bg-blue-600'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-gray-900 break-words">{n.message}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {(n.type || n.notification_type || 'info')} • {formatTime(n.time)}
                    </div>
                  </div>
                  {!n.read && (
                    <button onClick={() => markRead(n.id)} className="text-xs text-blue-600 hover:underline ml-auto whitespace-nowrap">Mark read</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
          {items.length > 0 && (
            <div className="px-4 py-2 border-t flex justify-end">
              <button onClick={markAllRead} className="text-sm text-[#1E5780] hover:text-[#164666] font-semibold transition-colors">Mark all as read</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InstructorNotificationsBell;
