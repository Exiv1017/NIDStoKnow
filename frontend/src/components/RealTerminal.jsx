import React, { useEffect, useRef, useContext } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import AuthContext from '../context/AuthContext';

const getWsUrl = (simulationType = 'terminal', token) => {
  const loc = window.location;
  const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  // Use same host and port as frontend (production: Caddy proxies to backend)
  const hostport = loc.host; // includes port if present
  // Route to appropriate WebSocket endpoint based on simulation type
  let endpoint;
  switch (simulationType) {
    case 'signature':
      endpoint = '/api/ws/terminal/signature';
      break;
    case 'anomaly':
      endpoint = '/api/ws/terminal/anomaly';
      break;
    case 'hybrid':
      endpoint = '/api/ws/terminal/hybrid';
      break;
    default:
      endpoint = '/api/ws/terminal';
  }
  const qs = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${protocol}//${hostport}${endpoint}${qs}`;
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
    wsRef.current = new WebSocket(getWsUrl(simulationType, token));
    wsRef.current.onopen = () => {
      const connectionMessage = simulationType === 'terminal' 
        ? 'Connected to simulation shell...'
        : `Connected to ${simulationType} simulation honeypot...`;
      xtermRef.current.writeln(connectionMessage);
    };
    wsRef.current.onmessage = (event) => {
      // Normalize newlines to CRLF for xterm.js so line breaks render correctly
      const data = String(event.data).replace(/\r\n|\r|\n/g, '\r\n');
      xtermRef.current.write(data);
    };
    wsRef.current.onclose = () => {
      xtermRef.current.writeln('\r\n[Disconnected from shell]');
    };
    wsRef.current.onerror = () => {
      xtermRef.current.writeln('\r\n[Connection error]');
    };

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
