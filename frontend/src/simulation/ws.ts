import { AnyOutboundMessage } from './messages';

export function buildWsUrl(path: string, token?: string) {
  const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const q = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${proto}://${host}:8000${path}${q}`;
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
