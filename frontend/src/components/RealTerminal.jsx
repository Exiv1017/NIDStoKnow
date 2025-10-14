import React, { useEffect, useRef, useContext } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import AuthContext from '../context/AuthContext';

// Build WS URL. REST endpoints use /api/*, but websocket endpoints are mounted at /ws/* (no /api prefix)
// so previous /api/ws/... paths failed. This corrects the prefix and adds a small reconnect/backoff strategy.
const getWsUrl = (simulationType = 'terminal', token) => {
  const { protocol: pageProto, host } = window.location;
  const wsProto = pageProto === 'https:' ? 'wss:' : 'ws:';
  let endpoint;
  switch (simulationType) {
    case 'signature': endpoint = '/ws/terminal/signature'; break;
    case 'anomaly': endpoint = '/ws/terminal/anomaly'; break;
    case 'hybrid': endpoint = '/ws/terminal/hybrid'; break;
    default: endpoint = '/ws/terminal';
  }
  const qs = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${wsProto}//${host}${endpoint}${qs}`;
};

const RealTerminal = ({ onCommand, simulationType = 'terminal' }) => {
  const auth = useContext(AuthContext);
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    xtermRef.current = new Terminal({
      fontSize: 16,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
      cursorBlink: true,
      rows: 18,
      cols: 80,
    });
    fitAddonRef.current = new FitAddon();
    xtermRef.current.loadAddon(fitAddonRef.current);
    xtermRef.current.open(terminalRef.current);
    fitAddonRef.current.fit();

    const token = auth?.user?.token || (() => {
      try {
        const u = localStorage.getItem('user');
        return u ? (JSON.parse(u).token) : null;
      } catch { return null; }
    })();
    const connect = (attempt = 0) => {
      const url = getWsUrl(simulationType, token);
      wsRef.current = new WebSocket(url);
      wsRef.current.onopen = () => {
        const msg = simulationType === 'terminal'
          ? 'Connected to simulation shell...'
          : `Connected to ${simulationType} simulation honeypot...`;
        xtermRef.current.writeln(msg);
        attempt = 0; // reset
      };
      wsRef.current.onmessage = (event) => {
        const data = String(event.data).replace(/\r\n|\r|\n/g, '\r\n');
        xtermRef.current.write(data);
      };
      wsRef.current.onclose = () => {
        xtermRef.current.writeln('\r\n[Disconnected from shell]');
        // Auto-reconnect with capped backoff (up to ~10s)
        if (attempt < 6) {
          const delay = Math.min(10000, 500 * Math.pow(2, attempt));
            xtermRef.current.writeln(`[Reconnecting in ${Math.round(delay/1000)}s]`);
          setTimeout(() => connect(attempt + 1), delay);
        } else {
          xtermRef.current.writeln('[Reconnect attempts exhausted]');
        }
      };
      wsRef.current.onerror = (e) => {
        xtermRef.current.writeln(`\r\n[Connection error] ${e?.message || ''}`);
      };
    };
    connect();

    let commandBuffer = '';
    xtermRef.current.onData((data) => {
      if (data === '\r') { // Enter key
        const command = commandBuffer.trim();
        if (command && typeof onCommand === 'function') {
          onCommand(command);
        }
        commandBuffer = '';
      } else if (data === '\u007F') { // Backspace
        commandBuffer = commandBuffer.slice(0, -1);
      } else {
        commandBuffer += data;
      }
      if (wsRef.current && wsRef.current.readyState === 1) {
        wsRef.current.send(data);
      }
    });

    window.addEventListener('resize', () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
      }
    });

    return () => {
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (fitAddonRef.current) {
        fitAddonRef.current = null;
      }
      window.removeEventListener('resize', () => fitAddonRef.current?.fit());
    };
  }, [simulationType]); // Include simulationType in dependencies

  return (
    <div ref={terminalRef} style={{ width: '100%', height: '350px', background: '#1e1e1e', borderRadius: '8px' }} />
  );
};

export default RealTerminal;
