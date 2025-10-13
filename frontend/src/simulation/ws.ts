import { AnyOutboundMessage } from './messages';

export function buildWsUrl(path: string, token?: string) {
  const isBrowser = typeof window !== 'undefined';
  const proto = isBrowser && window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = isBrowser ? window.location.host : 'localhost'; // includes port if any
  const q = token ? `?token=${encodeURIComponent(token)}` : '';
  // If path already starts with /api use as-is, else prefer same-origin root path
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${proto}://${host}${clean}${q}`;
}

export function safeSend(ws: WebSocket | null | undefined, msg: AnyOutboundMessage): boolean {
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  } catch {
    return false;
  }
}
