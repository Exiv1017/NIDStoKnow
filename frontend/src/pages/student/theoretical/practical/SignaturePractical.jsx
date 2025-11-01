import React, { useEffect, useMemo, useState, useContext } from 'react';
import useTimeAccumulator from '../../../../hooks/useTimeAccumulator.js';
import useModuleTimeSpent from '../../../../hooks/useModuleTimeSpent.js';
import { Link } from 'react-router-dom';
import { getActiveStudentId } from '../../../../utils/activeStudent';
import AuthContext from '../../../../context/AuthContext';

const SignaturePractical = ({ modules, setModules }) => {
  const title = 'Signature-Based Detection';
  const slug = 'signature-based-detection';
  const { user } = useContext(AuthContext) || {};
  const timeSpentSeconds = useModuleTimeSpent({ studentId: user?.id, moduleSlug: slug, realtime: true });

  const [ack, setAck] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;
  const pct = Math.round(((currentStep - 1) / (totalSteps - 1)) * 100);
  const [showChecker, setShowChecker] = useState(false);
  const [rulesText, setRulesText] = useState('');
  const [logChoice, setLogChoice] = useState('/samples/web-access.log');
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState(null);
  const [resultsByFile, setResultsByFile] = useState({}); // key: filepath -> { file, rules }
  const [hasRunCheck, setHasRunCheck] = useState(false);
  const [totalMatches, setTotalMatches] = useState(0);
  const [parsedCount, setParsedCount] = useState(0);
  const [parsedPreview, setParsedPreview] = useState([]); // small sample of parsed fields
  const [rawPreview, setRawPreview] = useState([]);
  const [studentName, setStudentName] = useState('');
  const [reportNotes, setReportNotes] = useState('');
  const [attachment, setAttachment] = useState(null); // { name, type, size, base64 }
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState(null);
  // Guided (no-JSON) builder
  const [useGuided, setUseGuided] = useState(true);
  const [builderRules, setBuilderRules] = useState([]);
  const [brField, setBrField] = useState('path');
  const [brType, setBrType] = useState('contains'); // contains | exact | regex
  const [brPattern, setBrPattern] = useState('');
  const [brMethod, setBrMethod] = useState(''); // '', GET, POST
  const [brThreshold, setBrThreshold] = useState(''); // number string
  const [toast, setToast] = useState(null); // { id, message }

  // Debug time tracking for practical exercise
  useTimeAccumulator({
    studentId: user?.id,
    moduleSlug: slug,
    unitType: 'practical',
    unitCode: 'practical',
    authToken: user?.token || null,
    debug: true,
    realtime: true
  });
  const markCompleted = () => {
    try { window.dispatchEvent(new CustomEvent('practicalCompleted', { detail: { module: slug, userId: user?.id || null } })); } catch {}
    const userId = user?.id || getActiveStudentId();
    if (userId) {
      fetch(`/api/student/${userId}/module/${slug}/unit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(user?.token ? { 'Authorization': `Bearer ${user.token}` } : {}) },
        body: JSON.stringify({ unit_type: 'practical', completed: true })
      }).then(()=>{
        try { window.dispatchEvent(new CustomEvent('moduleUnitUpdated', { detail: { module: slug, unit: 'practical' } })); } catch {}
      }).catch(()=>{});
    }
    if (setModules) {
      setModules(prev => prev.map(m => m.title===title ? { ...m, sections: m.sections.map(s => s.name==='Practical Exercise'?{...s,completed:true, locked:false}:s) } : m));
    }
    setToast({ id: Date.now(), message: 'Practical marked as completed!' });
    setTimeout(()=> setToast(null), 3500);
  };

  // Starters to align with common patterns covered in theory
  const getStarters = (which = 'http3') => ({
    http3: [
      { name: 'WP Login brute force', field: 'path', type: 'contains', match: '/wp-login.php', method: 'POST', threshold: { by: 'ip', count: 3 } },
      { name: 'SQLi probe', field: 'query', type: 'regex', match: '\\bOR\\b\\s*1=1' },
      { name: 'Scanner UA (sqlmap)', field: 'ua', type: 'contains', match: 'sqlmap' },
    ],
    lfi_rfi: [
      { name: 'Path traversal', field: 'path', type: 'contains', match: '../' },
      { name: 'Read passwd file', field: 'path', type: 'contains', match: '/etc/passwd' },
      { name: 'Remote file include', field: 'query', type: 'contains', match: 'include=http://' },
    ],
    ssh_dropper: [
      { name: 'SSH dropper via pipe', field: 'cmd', type: 'regex', match: '(curl|wget)\\b.*\\|\\s*(bash|sh)' },
    ],
  })[which] || [];

  // Helper to bulk-append guided starter rules
  const addStarterRules = (which = 'http3') => {
    const toAdd = getStarters(which);
    setBuilderRules(prev => {
      const base = prev.length;
      return [
        ...prev,
        ...toAdd.map((r, i) => ({ id: `G-${base + i + 1}`, ...r }))
      ];
    });
    setUseGuided(true);
  };

  // Beginner quick-start: preload a small set targeted to chosen log
  const preloadStarters = (which = 'http3') => {
    const toAdd = getStarters(which);
    // Replace current builder rules with a fresh set for clarity
    setBuilderRules(toAdd.map((r, i) => ({ id: `G-${i + 1}`, ...r })));
    setUseGuided(true);
    if (which === 'ssh_dropper') setLogChoice('/samples/ssh-commands.log');
    if (which === 'http3' || which === 'lfi_rfi') setLogChoice('/samples/web-access.log');
    setToast({ id: Date.now(), message: 'Starters loaded. Click "Run check" below.' });
    setTimeout(()=> setToast(null), 3000);
  };

  // Restore last results so totals persist across steps/refresh
  useEffect(() => {
    try {
      // Restore all checks map first (preferred)
      const all = sessionStorage.getItem('signature-practical-all-checks');
      if (all) {
        const parsedAll = JSON.parse(all);
        if (parsedAll && typeof parsedAll === 'object') {
          setResultsByFile(parsedAll);
          // We intentionally do not set `results` or `hasRunCheck` here so Step 5
          // doesn't auto-show previous rules until the student runs a check.
        }
      }
      // Fallback to last single check if map not present
      const saved = sessionStorage.getItem('signature-practical-last-check');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.rules)) {
          // Record into map for totals on Step 6, but don't populate Step 5 UI automatically
          if (!all) setResultsByFile({ [parsed.file || '']: parsed });
        }
      }
    } catch {}
  }, []);

  // Lazy-load the rules scaffold the first time the checker opens
  useEffect(() => {
    const load = async () => {
      if (!showChecker || rulesText) return;
      try {
        const res = await fetch('/samples/rules.scaffold.json');
        if (res.ok) {
          const txt = await res.text();
          setRulesText(txt);
        }
      } catch (e) {}
    };
    load();
  }, [showChecker, rulesText]);

  const addGuidedRule = () => {
    if (!brPattern.trim()) return;
    const rule = {
      id: `G-${builderRules.length + 1}`,
      name: `${brField} ${brType}`,
      field: brField,
      type: brType === 'regex' ? 'regex' : (brType === 'exact' ? 'exact' : 'contains'),
      match: brPattern.trim(),
    };
    if (brMethod) rule.method = brMethod;
    if (brThreshold) rule.threshold = { by: 'ip', count: Number(brThreshold) || 0 };
    setBuilderRules(prev => [...prev, rule]);
    setBrPattern('');
  };

  const removeGuidedRule = (idx) => setBuilderRules(prev => prev.filter((_, i) => i !== idx));

  const loadScaffoldIntoText = async () => {
    try {
      const res = await fetch('/samples/rules.scaffold.json');
      if (res.ok) setRulesText(await res.text());
    } catch (e) {}
  };

  const parseWebAccess = (line) => {
    // Example: 203.0.113.77 - - [09/Sep/2025:10:04:12 +0000] "POST /wp-login.php HTTP/1.1" 200 256 "-" "Mozilla/5.0"
    const m = line.match(/^(\S+)\s+.*?\[(.*?)\]\s+"(\w+)\s+([^\"]+)\s+HTTP\/[^\"]+"\s+\d+\s+\d+\s+"[^"]*"\s+"([^"]*)"/);
    if (!m) return null;
    const ip = m[1];
    const rawDate = m[2];
    const method = m[3];
    const pathQuery = m[4];
    const ua = m[5] || '';
    let [path, query = ''] = pathQuery.split('?');
    // Best-effort percent-decoding to help regex/string matches (e.g., SQLi with %20)
    try {
      const decPath = decodeURIComponent(path);
      if (decPath) path = decPath;
    } catch {}
    try {
      // Replace + with space before decode to mirror typical www-form encoding
      const decQuery = decodeURIComponent(query.replace(/\+/g, ' '));
      if (decQuery) query = decQuery;
    } catch {}
    // Convert Apache time to Date if needed (best-effort)
    let ts = null;
    try {
      // 09/Sep/2025:10:04:12 +0000 -> 09 Sep 2025 10:04:12 +0000
      ts = new Date(rawDate.replace(':', ' ').replace('/', ' ').replace('/', ' '));
    } catch (e) { ts = null; }
    return { ip, method, path, query, ua, cmd: '', ts, raw: line };
  };

  const parseSshCommands = (line) => {
    // Example: 2025-09-09T10:06:05Z 198.51.100.40 user=root cmd="wget http://... | sh"
    const m = line.match(/^(\S+)\s+(\S+)\s+.*?cmd="([^"]*)"/);
    if (!m) return null;
    const ts = new Date(m[1]);
    const ip = m[2];
    const cmd = m[3] || '';
    return { ip, method: '', path: '', query: '', ua: '', cmd, ts, raw: line };
  };

  // Clear visible results when changing log so Step 5 preview reflects current selection only after running
  useEffect(() => {
    setResults(null);
  }, [logChoice]);

  const runCheck = async () => {
    setChecking(true);
    setResults(null);
    try {
      // Prefer guided rules when enabled
      let rules = [];
      if (useGuided && builderRules.length > 0) {
        rules = builderRules;
      } else {
        const parsed = JSON.parse(rulesText || '{}');
        rules = Array.isArray(parsed?.rules) ? parsed.rules : Array.isArray(parsed) ? parsed : [];
      }
      let res = await fetch(logChoice);
      if (!res.ok) {
        throw new Error(`Failed to load ${logChoice} (HTTP ${res.status})`);
      }
      let ct = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
      let text = await res.text();
      // Detect accidental HTML (SPA fallback). Instead of failing hard, warn and continue so UI stays usable.
      if (/text\/html/i.test(ct) || (/^\s*</.test(text) && /<html/i.test(text))) {
        const alt = logChoice.startsWith('/') ? logChoice.slice(1) : logChoice;
        try {
          const res2 = await fetch(alt);
          if (res2.ok) {
            ct = res2.headers?.get?.('content-type') || '';
            text = await res2.text();
          } else {
            setToast({ id: Date.now(), message: 'Warning: log request returned HTML (SPA fallback). Using fallback content; matches may be zero.' });
            setTimeout(()=> setToast(null), 3500);
          }
        } catch {
          setToast({ id: Date.now(), message: 'Warning: log request returned HTML (SPA fallback). Matches may be zero.' });
          setTimeout(()=> setToast(null), 3500);
        }
      }
      setRawPreview(text.split(/\r?\n/).slice(0, 5));
      const lines = text.split(/\r?\n/).filter(Boolean);
      const isWeb = /web-access/.test(logChoice);
  const parsedLines = lines.map(ln => isWeb ? parseWebAccess(ln) : parseSshCommands(ln)).filter(Boolean);
  setParsedCount(parsedLines.length);
  setParsedPreview(parsedLines.slice(0, 3));

  const outcomes = rules.map(rule => {
        const field = String(rule.field || '').toLowerCase();
        const type = String(rule.type || 'regex').toLowerCase();
        const match = rule.match;
        let re = null;
        if (type === 'regex' && typeof match === 'string') {
          try { re = new RegExp(match, 'i'); } catch (e) { re = null; }
        }
        const samples = [];
        const perIp = new Map();
        let total = 0;
        for (const pl of parsedLines) {
          const val = (field === 'path') ? pl.path
                    : (field === 'query') ? pl.query
                    : (field === 'ua') ? pl.ua
                    : (field === 'cmd') ? pl.cmd
                    : '';
          if (val == null) continue;
          let hit = false;
          if (type === 'regex' && re) hit = re.test(val);
          else if (type === 'exact' && typeof match === 'string') hit = (val === match);
          else if (type === 'contains' && typeof match === 'string') hit = val.toLowerCase().includes(match.toLowerCase());
          else if (type === 'any' && Array.isArray(match)) hit = match.some(s => val.toLowerCase().includes(String(s).toLowerCase()));
          else if (typeof match === 'string') hit = val.toLowerCase().includes(match.toLowerCase());
          // Optional method gating (either rule.method or threshold.method)
          const requiredMethod = (rule.method || rule.threshold?.method || '').toString();
          if (requiredMethod) {
            const ok = (pl.method || '').toUpperCase() === requiredMethod.toUpperCase();
            if (!ok) hit = false;
          }
          if (hit) {
            total++;
            if (samples.length < 3) samples.push(pl.raw);
            const c = (perIp.get(pl.ip) || 0) + 1;
            perIp.set(pl.ip, c);
          }
        }
        // threshold hint (best-effort, no time-windowing)
        let threshold = null;
        let thresholdBreaches = [];
        if (rule.threshold && rule.threshold.by === 'ip' && rule.threshold.count) {
          const limit = Number(rule.threshold.count) || 0;
          perIp.forEach((cnt, ip) => { if (cnt >= limit) thresholdBreaches.push({ ip, count: cnt }); });
          threshold = { limit, by: 'ip', breaches: thresholdBreaches };
        }
        return { id: rule.id || '', name: rule.name || '', total, samples, threshold };
      });

      const rs = { file: logChoice, rules: outcomes };
      setResults(rs);
      // Update per-file map and persist both forms for compatibility
      const newMap = { ...resultsByFile, [logChoice]: rs };
      setResultsByFile(newMap);
      try {
        sessionStorage.setItem('signature-practical-last-check', JSON.stringify(rs));
        sessionStorage.setItem('signature-practical-all-checks', JSON.stringify(newMap));
      } catch {}
      setHasRunCheck(true);
  const tm = outcomes.reduce((acc, r) => acc + (Number(r.total) || 0), 0);
      setTotalMatches(tm);
    } catch (e) {
      setResults({ error: `Invalid rules JSON or log could not be read. ${e?.message ? `Details: ${e.message}` : ''}` });
    } finally {
      setChecking(false);
    }
  };

  const ruleCount = (() => {
    if (useGuided) return builderRules.length;
    try {
      const parsed = JSON.parse(rulesText || '[]');
      return Array.isArray(parsed?.rules) ? parsed.rules.length : (Array.isArray(parsed) ? parsed.length : 0);
    } catch { return 0; }
  })();

  // Compute total across all logs checked for robust display/gating
  const computedTotalMatches = useMemo(() => {
    // If no rules are currently defined, don't show legacy totals
    if (ruleCount === 0) return 0;
    const files = Object.values(resultsByFile || {});
    if (files.length === 0) {
      if (!results || !Array.isArray(results?.rules)) return 0;
      return results.rules.reduce((acc, r) => acc + (Number(r?.total) || 0), 0);
    }
    return files.reduce((acc, rf) => acc + (Array.isArray(rf.rules) ? rf.rules.reduce((a, r) => a + (Number(r?.total) || 0), 0) : 0), 0);
  }, [resultsByFile, results, ruleCount]);
  const perFileTotals = useMemo(() => {
    if (ruleCount === 0) return {};
    const out = {};
    Object.entries(resultsByFile || {}).forEach(([file, rs]) => {
      out[file] = Array.isArray(rs?.rules) ? rs.rules.reduce((a, r) => a + (Number(r?.total) || 0), 0) : 0;
    });
    return out;
  }, [resultsByFile, ruleCount]);
  const meetsCriteria = ruleCount >= 3 && computedTotalMatches >= 3 && hasRunCheck;

  const getUsedRules = () => (useGuided ? builderRules : (() => {
    try { const p = JSON.parse(rulesText || '[]'); return Array.isArray(p?.rules) ? p.rules : (Array.isArray(p) ? p : []); } catch { return []; }
  })());

  const onAttachmentChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) { setAttachment(null); return; }
    if (file.size > 5 * 1024 * 1024) { // 5MB
      alert('File too large (max 5MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result || '').split(',')[1] || '';
      setAttachment({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, base64 });
    };
    reader.readAsDataURL(file);
  };

  const submitToInstructor = async () => {
    const usedRules = getUsedRules();
    const totalsRuleCount = usedRules.length;
    const totalsTotalMatches = computedTotalMatches;
    if (totalsRuleCount < 3 || totalsTotalMatches < 3) {
      alert('Please build at least 3 rules and achieve at least 3 total matches before submitting.');
      return;
    }
    const payload = {
      student_id: user?.id || 0,
      student_name: user?.name || user?.email || (studentName || 'Student'),
      module_slug: slug,
      module_title: title,
      submission_type: 'practical',
      payload: {
        notes: reportNotes,
        rules: usedRules,
        results: results || null, // last-run for convenience
        file: results?.file || logChoice,
        results_by_file: resultsByFile, // full breakdown across logs
        attachments: attachment ? [{
          name: attachment.name,
          type: attachment.type,
          size: attachment.size,
          base64: attachment.base64,
        }] : [],
      },
      totals_rule_count: totalsRuleCount,
  totals_total_matches: totalsTotalMatches,
    };
    setSubmitting(true);
    try {
      const res = await fetch('/api/student/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(user?.token ? { 'Authorization': `Bearer ${user.token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Submit failed');
      const data = await res.json().catch(()=>({}));
      setSubmittedId(data?.id || 'local');
      alert('Submitted to instructor.');
    } catch (e) {
      // Fallback to local cache so it can be synced later
      const cacheKey = 'student-submissions-cache';
      const cache = JSON.parse(localStorage.getItem(cacheKey) || '[]');
      cache.push({ id: `local-${Date.now()}`, ...payload });
      localStorage.setItem(cacheKey, JSON.stringify(cache));
      alert('Offline: saved locally; will appear to instructors once backend is reachable.');
    } finally {
      setSubmitting(false);
    }
  };

  // Beginner-friendly guidance in Step 5 based on current rules vs chosen log
  const currentRules = useMemo(() => getUsedRules(), [useGuided, builderRules, rulesText]);
  const warnHttpWithCmd = useMemo(() => /web-access/.test(logChoice) && currentRules.some(r => String(r.field||'').toLowerCase() === 'cmd'), [logChoice, currentRules]);
  const warnSshWithHttpFields = useMemo(() => /ssh-commands/.test(logChoice) && currentRules.some(r => ['path','query','ua'].includes(String(r.field||'').toLowerCase())), [logChoice, currentRules]);
  const warnSshMethod = useMemo(() => /ssh-commands/.test(logChoice) && currentRules.some(r => !!r.method), [logChoice, currentRules]);

  const generateReportMarkdown = () => {
    const dateStr = new Date().toISOString().slice(0,10);
    const usedRules = useGuided ? builderRules : (() => {
      try { const p = JSON.parse(rulesText || '[]'); return Array.isArray(p?.rules) ? p.rules : (Array.isArray(p) ? p : []); } catch { return []; }
    })();
  const rulesTableRows = usedRules.map((r, idx) => `| ${r.id || `R-${idx+1}`} | ${r.name || `${r.field} ${r.type}`} | ${r.field || ''} | ${r.type || ''} | ${r.method || 'Any'} | ${r.threshold?.count ? `per IP ≥ ${r.threshold.count}` : '—'} |`).join('\n');
    const findings = (results?.rules || []).map(r => `### ${r.id || r.name || 'Rule'}\n\n- Matches: ${r.total}\n- Sample lines:\n${(r.samples||[]).slice(0,2).map(s=>`  - ${s}`).join('\n')}${(r.samples||[]).length?"\n":""}- Tuning notes: ____\n`).join('\n');
    const breaches = (results?.rules || []).flatMap(r => (r.threshold?.breaches||[]).map(b=>`- ${b.ip} (${b.count}) for ${r.id||r.name||'rule'}`)).join('\n') || '- None';
  const md = `# Signature Hunt — Report\n\nStudent: ${studentName || '_____'}\n\nModule: Signature-Based Detection — Practical\n\nDate: ${dateStr}\n\n## Rules Summary\n\nProvide 3–5 rules.\n\n| ID | Name | Field | Type | Method | Threshold |\n|----|------|-------|------|--------|-----------|\n${rulesTableRows}\n|  |  |  |  |  |  |\n\n## Findings By Rule\n\n${findings}\n## Threshold Scenario\n\n${breaches}\n\n## Notes\n\n${reportNotes || '_____'}\n`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'signature-hunt-report.md'; a.click();
    URL.revokeObjectURL(url);
  };

  const generateReportDocx = async () => {
    try {
      const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType, Footer, PageNumber } = await import('docx');
      const dateStr = new Date().toISOString().slice(0,10);
      const usedRules = useGuided ? builderRules : (() => {
        try { const p = JSON.parse(rulesText || '[]'); return Array.isArray(p?.rules) ? p.rules : (Array.isArray(p) ? p : []); } catch { return []; }
      })();
      const rulesHeader = new TableRow({
        children: ['ID','Name','Field','Type','Method','Threshold'].map(h=> new TableCell({ children: [new Paragraph({ children:[new TextRun({ text: h, bold: true })] })] }))
      });
      const rulesRows = usedRules.map((r, idx) => new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(r.id || `R-${idx+1}`)] }),
          new TableCell({ children: [new Paragraph(r.name || `${r.field} ${r.type}`)] }),
          new TableCell({ children: [new Paragraph(r.field || '')] }),
          new TableCell({ children: [new Paragraph(String(r.type || ''))] }),
          new TableCell({ children: [new Paragraph(r.method || 'Any')] }),
          new TableCell({ children: [new Paragraph(r.threshold?.count ? `per IP ≥ ${r.threshold.count}` : '—')] }),
        ]
      }));
      const rulesTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          rulesHeader,
          ...rulesRows,
          new TableRow({ children: [
            new TableCell({ children: [new Paragraph(' ')] }),
            new TableCell({ children: [new Paragraph(' ')] }),
            new TableCell({ children: [new Paragraph(' ')] }),
            new TableCell({ children: [new Paragraph(' ')] }),
            new TableCell({ children: [new Paragraph(' ')] }),
            new TableCell({ children: [new Paragraph(' ')] }),
          ]})
        ]
      });

      const findingsParas = (results?.rules || []).flatMap(r => [
        new Paragraph({ text: `${r.id || r.name || 'Rule'} — Matches: ${r.total}`, heading: HeadingLevel.HEADING_3 }),
        new Paragraph({ text: 'What it detects: briefly describe the pattern.' }),
        new Paragraph({ text: 'Sample lines:' }),
        ...(r.samples || []).slice(0,2).map(s => new Paragraph({ text: s })),
        new Paragraph({ text: 'Tuning notes: mention anchors, exclusions, or encodings handled.' }),
        new Paragraph(' '),
      ]);

      const breachesList = (results?.rules || []).flatMap(r => (r.threshold?.breaches||[]).map(b=>`- ${b.ip} (${b.count}) for ${r.id||r.name||'rule'}`));

      const doc = new Document({
        sections: [
          {
            headers: {},
            footers: {
              default: new Footer({
                children: [
                  new Paragraph({ alignment: AlignmentType.RIGHT, children: [ new TextRun('Signature-Based Detection — Practical | Page '), PageNumber.CURRENT ] })
                ]
              })
            },
            children: [
              new Paragraph({ text: 'Practical Exercise — Signature-Based', heading: HeadingLevel.HEADING_2 }),
              new Paragraph({ text: 'Signature Hunt — Report', heading: HeadingLevel.TITLE }),
              new Paragraph({ text: 'Module: Signature-Based Detection — Practical', heading: HeadingLevel.HEADING_3 }),
              new Paragraph(`Student: ${studentName || '_____'}  |  Date: ${dateStr}`),
              new Paragraph(' '),
              new Paragraph({ text: 'How to read this report', heading: HeadingLevel.HEADING_2 }),
              new Paragraph('This document summarizes the rules you built, their matches on sample logs, and any threshold conditions. Use it to demonstrate detection coverage and tuning decisions.'),
              new Paragraph(' '),
              new Paragraph({ text: 'Rules Summary', heading: HeadingLevel.HEADING_2 }),
              rulesTable,
              new Paragraph(' '),
              new Paragraph({ text: 'Findings By Rule', heading: HeadingLevel.HEADING_2 }),
              ...findingsParas,
              new Paragraph(' '),
              new Paragraph({ text: 'Threshold Scenario', heading: HeadingLevel.HEADING_2 }),
              ...(breachesList.length ? breachesList.map(t => new Paragraph(t)) : [new Paragraph('- None')]),
              new Paragraph(' '),
              new Paragraph({ text: 'Notes & Recommendations', heading: HeadingLevel.HEADING_2 }),
              new Paragraph(reportNotes || 'Add brief notes on false positives, exclusions to add, and next steps.'),
            ]
          }
        ]
      });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'signature-hunt-report.docx'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // Fallback to markdown if docx lib fails
      generateReportMarkdown();
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-screen">
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 mb-6 border border-blue-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{title} — Practical Exercise</h1>
            <p className="text-gray-600 mt-2 text-lg">A guided, step‑by‑step activity to apply signatures on real logs.</p>
            <div className="flex items-center gap-4 mt-3">
              <div className="bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                <span className="text-sm font-medium text-blue-700">Time Spent: </span>
                <span className="text-sm font-bold text-blue-900">{(()=>{ const s=timeSpentSeconds||0; const m=Math.floor(s/60); const r=s%60; return `${m}m ${r}s`; })()}</span>
              </div>
              <div className="bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                <span className="text-sm font-medium text-green-700">Step {currentStep} of {totalSteps}</span>
              </div>
            </div>
          </div>
          <span className="text-sm font-medium text-purple-700 bg-purple-100 px-3 py-2 rounded-xl border border-purple-200">Estimated: 10–20 mins</span>
        </div>
        
        {/* Enhanced Stepper */}
        <div className="mt-6 hidden md:block">
          <ol className="grid grid-cols-6 gap-3">
            {['Overview','Review','Assets','Build','Test','Report'].map((label, i)=>{
              const step=i+1; const active=step===currentStep; const done=step<currentStep;
              return (
                <li key={i} className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 ${
                  active ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-purple-50 shadow-md transform scale-105' : 
                  done ? 'border-green-400 bg-green-50' : 
                  'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}>
                  <span className={`h-8 w-8 flex items-center justify-center rounded-full text-sm font-bold transition-all duration-200 ${
                    active ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg' : 
                    done ? 'bg-green-500 text-white' : 
                    'bg-gray-300 text-gray-700'
                  }`}>
                    {done ? '✓' : step}
                  </span>
                  <span className={`text-sm font-medium ${active ? 'text-blue-800' : done ? 'text-green-800' : 'text-gray-600'}`}>{label}</span>
                  {active && <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>}
                </li>
              );
            })}
          </ol>

          {/* Enhanced progress bar */}
          <div className="mt-4 relative">
            <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full shadow-inner">
              <div className="h-3 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 rounded-full transition-all duration-500 ease-out shadow-lg" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-sm font-medium text-gray-700 mt-2">
              <span className="bg-white px-3 py-1 rounded-lg shadow-sm border border-gray-200">{pct}% Complete</span>
              <span className="bg-white px-3 py-1 rounded-lg shadow-sm border border-gray-200">Progress Saved</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 space-y-6 border border-blue-100">
        {/* Step 1: Overview */}
        {currentStep===1 && (
          <div className="rounded-xl border-2 border-blue-200 p-6 bg-gradient-to-br from-blue-50 via-white to-purple-50 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">1</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900">What you'll do</h2>
            </div>
            <p className="text-gray-700 text-lg leading-relaxed mb-4">Find known malicious patterns in sample HTTP and SSH logs using signatures. You'll build a few simple rules and test them here.</p>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  </span>
                  Learning Objectives
                </h3>
                <ul className="space-y-2 text-sm text-gray-800">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 font-bold">✓</span>
                    Pick patterns (e.g., /wp-login.php brute force, sqlmap UA, ../ traversal, curl | bash dropper).
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 font-bold">✓</span>
                    Create rules with field, match type (contains/exact/regex), optional method and threshold.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 font-bold">✓</span>
                    Run the rules, inspect matches, and tighten to reduce false positives.
                  </li>
                </ul>
              </div>
              
              <div className="bg-white rounded-lg p-4 shadow-sm border border-purple-100">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  </span>
                  Skills You'll Gain
                </h3>
                <ul className="space-y-2 text-sm text-gray-800">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 font-bold">→</span>
                    Translate theory into practice: map fields (path, query, UA, command) and choose the right match type.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 font-bold">→</span>
                    Detect common indicators from the module: SQLi probes, traversal/LFI-RFI, scanner/tool UAs, and auth brute-force.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 font-bold">→</span>
                    Apply thresholds and document findings in a concise report for instructor review.
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="pt-6">
              <button 
                onClick={()=>setCurrentStep(2)} 
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Start Practical Exercise →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Theory refresh */}
        {currentStep===2 && (
          <div className="rounded-xl border-2 border-green-200 p-6 bg-gradient-to-br from-green-50 via-white to-blue-50 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">2</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Theory Refresh</h2>
            </div>
            <p className="text-gray-700 text-lg leading-relaxed mb-6">This hands‑on directly applies what you covered in the theory:</p>
            
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 shadow-sm border border-green-100">
                <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Rule Anatomy & Patterns
                </h4>
                <p className="text-sm text-gray-700">Fields (path, query, user‑agent, command), exact vs regex.</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
                <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  Common Attack Indicators
                </h4>
                <p className="text-sm text-gray-700">SQLi probes, path traversal, scanner/tool user‑agents, login brute force.</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm border border-purple-100">
                <h4 className="font-semibold text-purple-800 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  Tuning to Reduce False Positives
                </h4>
                <p className="text-sm text-gray-700">Anchors, escaping, narrowing context.</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm border border-amber-100">
                <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                  Thresholds
                </h4>
                <p className="text-sm text-gray-700">Converting raw matches into alerts with simple frequency guards.</p>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 mt-4">
              <div className="text-sm font-medium text-gray-900 mb-3">Quick links to review:</div>
              <div className="grid md:grid-cols-2 gap-2">
                <a className="text-blue-600 hover:text-blue-800 hover:underline text-sm transition-colors" href="/student/theoretical/signature-based-detection/theory?lesson=1">Introduction to IDS (Module 1)</a>
                <a className="text-blue-600 hover:text-blue-800 hover:underline text-sm transition-colors" href="/student/theoretical/signature-based-detection/theory?lesson=2">Signature vs Anomaly (Module 2)</a>
                <a className="text-blue-600 hover:text-blue-800 hover:underline text-sm transition-colors" href="/student/theoretical/signature-based-detection/theory?lesson=3">Signature Detection Workflow (Module 2)</a>
                <a className="text-blue-600 hover:text-blue-800 hover:underline text-sm transition-colors" href="/student/theoretical/signature-based-detection/theory?lesson=5">Snort and Suricata (Module 3)</a>
                <a className="text-blue-600 hover:text-blue-800 hover:underline text-sm transition-colors" href="/student/theoretical/signature-based-detection/theory?lesson=6">Traffic Capture & Rule Databases (Module 3)</a>
                <a className="text-blue-600 hover:text-blue-800 hover:underline text-sm transition-colors" href="/student/theoretical/signature-based-detection/theory?lesson=8">Limitations of Signature‑Based NIDS (Module 4)</a>
              </div>
            </div>
            
            <div className="pt-6">
              <button 
                onClick={()=>setCurrentStep(3)} 
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-xl hover:from-green-700 hover:to-blue-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Next: Get Assets →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Assets */}
        {currentStep===3 && (
          <div className="rounded-xl border p-4 bg-gradient-to-br from-sky-50 to-emerald-50">
            <h2 className="text-lg font-semibold text-gray-900">Get the assets</h2>
            <p className="text-gray-700 mt-2">Download the sample logs and starter rules, and optionally export a report. You’ll use these in the next steps.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
              <a href="/samples/web-access.log" download className="group block rounded-xl border-2 border-blue-100 bg-white p-5 hover:border-blue-300 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-sm">📄</span>
                  </div>
                  <div className="text-sm font-bold text-gray-900">web-access.log</div>
                </div>
                <div className="text-xs text-gray-600 mb-3">HTTP access log (SQLi, traversal, tool UAs)</div>
                <div className="inline-block px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg group-hover:from-blue-600 group-hover:to-blue-700 font-medium shadow-sm">Download</div>
              </a>
              <a href="/samples/ssh-commands.log" download className="group block rounded-xl border-2 border-green-100 bg-white p-5 hover:border-green-300 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-green-600 font-bold text-sm">🖥️</span>
                  </div>
                  <div className="text-sm font-bold text-gray-900">ssh-commands.log</div>
                </div>
                <div className="text-xs text-gray-600 mb-3">Cowrie‑style commands (wget/curl droppers)</div>
                <div className="inline-block px-4 py-2 text-sm bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg group-hover:from-green-600 group-hover:to-green-700 font-medium shadow-sm">Download</div>
              </a>
              <a href="/samples/rules.scaffold.json" download className="group block rounded-xl border-2 border-purple-100 bg-white p-5 hover:border-purple-300 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <span className="text-purple-600 font-bold text-sm">⚙️</span>
                  </div>
                  <div className="text-sm font-bold text-gray-900">rules.scaffold.json</div>
                </div>
                <div className="text-xs text-gray-600 mb-3">Starter rules you can tighten</div>
                <div className="inline-block px-4 py-2 text-sm bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg group-hover:from-purple-600 group-hover:to-purple-700 font-medium shadow-sm">Download</div>
              </a>
              
              <div className="group block rounded-xl border-2 border-amber-100 bg-white p-5 hover:border-amber-300 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <span className="text-amber-600 font-bold text-sm">📄</span>
                  </div>
                  <div className="text-sm font-bold text-gray-900">Report (Markdown)</div>
                </div>
                <div className="text-xs text-gray-600 mb-3">Generate a .md report from your current rules and results</div>
                <button onClick={generateReportMarkdown} className="inline-block px-4 py-2 text-sm bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 font-medium shadow-sm">Generate</button>
              </div>
              
              <div className="group block rounded-xl border-2 border-red-100 bg-white p-5 hover:border-red-300 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <span className="text-red-600 font-bold text-sm">📄</span>
                  </div>
                  <div className="text-sm font-bold text-gray-900">Report (DOCX)</div>
                </div>
                <div className="text-xs text-gray-600 mb-3">Generate a Word report from your current rules and results</div>
                <button onClick={generateReportDocx} className="inline-block px-4 py-2 text-sm bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 font-medium shadow-sm">Generate</button>
              </div>
            </div>
            <div className="pt-4 flex items-center justify-between">
              <div className="text-xs text-gray-600">Next: you’ll build 3 simple rules using a guided form.</div>
              <button 
                onClick={()=>setCurrentStep(4)} 
                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-sky-600 text-white rounded-xl hover:from-emerald-700 hover:to-sky-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Next: Build Rules →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Build rules */}
        {currentStep===4 && (
          <div className="rounded-xl border p-4 bg-white">
            <h2 className="text-lg font-semibold text-gray-900">Build your rules</h2>
            <p className="text-gray-700 mt-2 text-sm">Use the guided builder or switch to JSON if you prefer.</p>

            <div className="flex items-center gap-4 text-sm mt-3">
              <label className="flex items-center gap-2">
                <input type="radio" checked={useGuided} onChange={()=>setUseGuided(true)} /> Guided (recommended)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={!useGuided} onChange={()=>setUseGuided(false)} /> Advanced (paste JSON)
              </label>
            </div>

            {useGuided && (
              <div className="mt-3 grid md:grid-cols-6 gap-2 items-end">
                <div>
                  <label className="text-xs text-gray-600">Field</label>
                  <select value={brField} onChange={e=>setBrField(e.target.value)} className="w-full border rounded p-2 text-sm">
                    <option value="path">path</option>
                    <option value="query">query</option>
                    <option value="ua">user-agent</option>
                    <option value="cmd">command</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Match type</label>
                  <select value={brType} onChange={e=>setBrType(e.target.value)} className="w-full border rounded p-2 text-sm">
                    <option value="contains">contains</option>
                    <option value="exact">exact</option>
                    <option value="regex">regex</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-600">Pattern</label>
                  <input value={brPattern} onChange={e=>setBrPattern(e.target.value)} placeholder="/wp-login.php or sqlmap or \\bOR\\b\\s*1=1" className="w-full border rounded p-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">HTTP method</label>
                  <select value={brMethod} onChange={e=>setBrMethod(e.target.value)} className="w-full border rounded p-2 text-sm">
                    <option value="">Any</option>
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Threshold per IP</label>
                  <input value={brThreshold} onChange={e=>setBrThreshold(e.target.value)} placeholder="e.g., 3" className="w-full border rounded p-2 text-sm" />
                </div>
                <div className="md:col-span-6">
                  <button onClick={addGuidedRule} className="px-3 py-2 bg-[#206EA6] text-white rounded">Add rule</button>
                  <button onClick={()=>addStarterRules('http3')} className="ml-2 px-3 py-2 border rounded text-sm">Insert HTTP starters</button>
                  <button onClick={()=>addStarterRules('lfi_rfi')} className="ml-2 px-3 py-2 border rounded text-sm">Insert LFI/RFI starters</button>
                  <button onClick={()=>addStarterRules('ssh_dropper')} className="ml-2 px-3 py-2 border rounded text-sm">Insert SSH starters</button>
                </div>
              </div>
            )}

            {!useGuided && (
              <div className="mt-3">
                <div className="text-sm text-gray-600">Paste your rules.json or load the scaffold.</div>
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={loadScaffoldIntoText} className="px-3 py-1.5 border rounded text-sm">Load scaffold</button>
                </div>
                <textarea value={rulesText} onChange={e=>setRulesText(e.target.value)} className="w-full min-h-[180px] p-2 border rounded font-mono text-xs mt-2" placeholder='{"rules":[{"id":"R-1","field":"path","type":"contains","match":"/wp-login.php"}]}'></textarea>
              </div>
            )}

            <div className="mt-3 text-sm">
              {builderRules.length === 0 ? (
                <div className="text-gray-500">
                  No rules yet. Try examples:
                  <ul className="list-disc ml-5 mt-1 space-y-0.5">
                    <li><span className="font-semibold">path contains</span> <span className="font-mono">/wp-login.php</span> (brute‑force attempts)</li>
                    <li><span className="font-semibold">ua contains</span> <span className="font-mono">sqlmap</span> or <span className="font-mono">Nikto</span> (scanner/tool user‑agents)</li>
                    <li><span className="font-semibold">path contains</span> <span className="font-mono">../</span> or <span className="font-mono">/etc/passwd</span> (path traversal/LFI)</li>
                    <li><span className="font-semibold">query contains</span> <span className="font-mono">include=http://</span> (RFI)</li>
                    <li><span className="font-semibold">query regex</span> <span className="font-mono">\bOR\b\s*1=1</span> (SQLi)</li>
                    <li><span className="font-semibold">cmd contains</span> <span className="font-mono">curl</span> or <span className="font-mono">wget</span> plus <span className="font-mono">| bash</span>/<span className="font-mono">| sh</span> (dropper)</li>
                  </ul>
                </div>
              ) : (
                <ul className="space-y-2">
                  {builderRules.map((r, i) => (
                    <li key={i} className="flex items-center justify-between border rounded p-2">
                      <div className="text-gray-800">
                        <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded mr-2">{r.id}</span>
                        <span className="font-semibold">{r.field}</span> {r.type} <span className="font-mono">{String(r.match)}</span>
                        {r.method ? <span className="ml-2 text-xs text-gray-500">[{r.method}]</span> : null}
                        {r.threshold ? <span className="ml-2 text-xs text-gray-500">[per IP ≥ {r.threshold.count}]</span> : null}
                      </div>
                      <button onClick={()=>removeGuidedRule(i)} className="text-red-600 text-xs hover:underline">Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="pt-3"><button onClick={()=>setCurrentStep(5)} className="px-4 py-2 bg-[#206EA6] text-white rounded">Next: Test & tune</button></div>
          </div>
        )}

        {/* Step 5: Test & tune */}
        {currentStep===5 && (
          <div className="rounded-xl border p-4 bg-white">
            <h2 className="text-lg font-semibold text-gray-900">Test & tune</h2>
            <p className="text-gray-700 mt-2 text-sm">Pick a log file and run your rules. Inspect matches and tighten your patterns.</p>
            <div className="mt-2 text-[12px] text-gray-700">
              Quick start:
              <div className="mt-1 flex flex-wrap gap-2">
                <button onClick={()=>preloadStarters('http3')} className="px-2 py-1 border rounded text-xs">HTTP examples</button>
                <button onClick={()=>preloadStarters('lfi_rfi')} className="px-2 py-1 border rounded text-xs">LFI/RFI examples</button>
                <button onClick={()=>preloadStarters('ssh_dropper')} className="px-2 py-1 border rounded text-xs">SSH dropper example</button>
              </div>
            </div>
            <div className="mt-2 text-[12px] text-gray-700 bg-gray-50 border rounded p-2">
              Tip: HTTP logs expose <span className="font-medium">path</span>, <span className="font-medium">query</span>, <span className="font-medium">ua</span>, and request <span className="font-medium">method</span> (GET/POST). SSH logs expose <span className="font-medium">cmd</span> only. Method gating applies to HTTP rules.
            </div>
            <div className="flex items-center gap-3 mt-3">
              <label className="text-sm text-gray-700">Log file</label>
              <select value={logChoice} onChange={e=>setLogChoice(e.target.value)} className="border rounded p-1 text-sm">
                <option value="/samples/web-access.log">web-access.log (HTTP)</option>
                <option value="/samples/ssh-commands.log">ssh-commands.log (SSH/Cowrie)</option>
              </select>
              <a className="text-xs text-blue-700 hover:underline" href={logChoice} target="_blank" rel="noreferrer">Open log</a>
              <button onClick={runCheck} disabled={checking || (useGuided ? builderRules.length===0 : !rulesText.trim())} className="px-3 py-1.5 bg-[#206EA6] text-white rounded disabled:opacity-50">{checking ? 'Checking…' : 'Run check'}</button>
            </div>
            <div className="mt-2 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded p-2">
              Tip: For <span className="font-medium">HTTP</span> logs, fields <span className="font-mono">path</span>, <span className="font-mono">query</span>, and <span className="font-mono">ua</span> are populated and you can gate by method GET/POST. For <span className="font-medium">SSH</span> logs, use <span className="font-mono">cmd</span> (method doesn’t apply).
            </div>
            {(warnHttpWithCmd || warnSshWithHttpFields || warnSshMethod) && (
              <div className="mt-2 text-xs rounded p-2 border bg-amber-50 border-amber-200 text-amber-800">
                {warnHttpWithCmd && <div>HTTP log selected: rules on <span className="font-mono">cmd</span> won’t match. Use <span className="font-mono">path</span>, <span className="font-mono">query</span>, or <span className="font-mono">ua</span>.</div>}
                {warnSshWithHttpFields && <div>SSH log selected: rules on <span className="font-mono">path</span>/<span className="font-mono">query</span>/<span className="font-mono">ua</span> won’t match. Use <span className="font-mono">cmd</span>.</div>}
                {warnSshMethod && <div>SSH log selected: HTTP method gating (GET/POST) doesn’t apply here; remove method from these rules.</div>}
              </div>
            )}
            {results && (
              <div className="mt-3 text-sm">
                {results.error ? (
                  <div className="text-red-600">
                    {results.error}
                    {rawPreview.length>0 && (
                      <div className="mt-2 text-xs text-gray-700">
                        Raw preview (first lines):
                        <pre className="bg-white border rounded p-2 overflow-auto text-[11px] leading-snug">{rawPreview.join('\n')}</pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-gray-700">Results for <span className="font-mono">{results.file}</span></div>
                    <div className="text-xs text-gray-600 bg-gray-50 border rounded p-2">
                      Parsed lines: <span className="font-semibold">{parsedCount}</span>
                      {parsedPreview.length>0 && (
                        <>
                          <div className="mt-1 text-gray-700">Preview (first 3 parsed entries):</div>
                          <pre className="bg-white border rounded p-2 overflow-auto text-[11px] leading-snug">{JSON.stringify(parsedPreview, null, 2)}</pre>
                        </>
                      )}
                    </div>
                    <div className="grid gap-3">
                      {results.rules.map((r,i)=> (
                        <div key={i} className="p-3 border rounded">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{r.id ? `${r.id} — ` : ''}{r.name || 'Rule'}</div>
                            <div className="text-xs text-gray-600">Matches: <span className="font-semibold">{r.total}</span></div>
                          </div>
                          {r.samples.length > 0 && (
                            <div className="mt-2">
                              <div className="text-xs text-gray-500 mb-1">Sample lines</div>
                              <pre className="bg-gray-50 p-2 rounded overflow-auto text-[11px] leading-snug">{r.samples.join('\n')}</pre>
                            </div>
                          )}
                          {r.threshold && r.threshold.breaches.length > 0 && (
                            <div className="mt-2 text-xs text-gray-700">
                              Threshold (by IP ≥ {r.threshold.limit}): {r.threshold.breaches.map(b=>`${b.ip}(${b.count})`).join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="pt-3"><button onClick={()=>setCurrentStep(6)} className="px-4 py-2 bg-[#206EA6] text-white rounded">Next: Report & complete</button></div>
          </div>
        )}

        {/* Step 6: Report & complete */}
        {currentStep===6 && (
          <div className="rounded-xl border p-4 bg-white">
            <h2 className="text-lg font-semibold text-gray-900">Review, export, and complete</h2>
            {/* Summary cards */}
            <div className="grid sm:grid-cols-3 gap-3 mt-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-gray-500">Rules created</div>
                <div className="text-2xl font-bold">{ruleCount}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-gray-500">Total matches</div>
                <div className="text-2xl font-bold">{computedTotalMatches}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-gray-500">Requirement</div>
                <div className={`text-sm font-semibold ${meetsCriteria? 'text-green-700':'text-red-700'}`}>{meetsCriteria ? 'Met (≥3 rules and ≥3 matches)' : 'Not met yet'}</div>
              </div>
            </div>
                {ruleCount > 0 && Object.keys(perFileTotals).length > 1 && (
                  <div className="mt-2 text-xs text-gray-700">
                    Breakdown: {Object.entries(perFileTotals).map(([file, cnt], i)=> (
                      <span key={file} className="mr-2">
                        <span className="font-mono">{file.replace('/samples/','')}</span>: {cnt}{i < Object.entries(perFileTotals).length-1 ? ',' : ''}
                      </span>
                    ))}
                  </div>
                )}
            {/* Export form */}
            <div className="rounded-lg border bg-white p-4 mt-4 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600">Student name (optional)</label>
                  <input value={studentName} onChange={e=>setStudentName(e.target.value)} className="w-full border rounded p-2 text-sm" placeholder="Your name" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Notes (optional)</label>
                  <input value={reportNotes} onChange={e=>setReportNotes(e.target.value)} className="w-full border rounded p-2 text-sm" placeholder="Highlights, threshold rationale, tools used" />
                </div>
              </div>
              <div className="text-xs text-gray-600">Attach any file you want to include in your submission (optional). Max 5MB.</div>
              <div>
                <input type="file" onChange={onAttachmentChange} />
                {attachment && (
                  <div className="mt-1 text-xs text-gray-700">Attached: <span className="font-mono">{attachment.name}</span> ({Math.round(attachment.size/1024)} KB)</div>
                )}
              </div>
              <div className="flex items-center gap-2">
        <button onClick={submitToInstructor} disabled={submitting || !meetsCriteria} className="px-3 py-2 bg-[#206EA6] text-white rounded disabled:opacity-50">{submitting? 'Submitting…' : (submittedId? 'Submitted' : 'Submit to Instructor')}</button>
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm mt-3">
              <input type="checkbox" className="mt-1" checked={ack} onChange={e=>setAck(e.target.checked)} />
              <span>I understand this will mark the practical as completed.</span>
            </label>
      {!meetsCriteria && (
              <div className="mt-2 text-xs text-red-700">Need at least 3 rules and a total of 3 matches. Build rules in Step 4 and run the check in Step 5.</div>
            )}
            <div className="flex items-center gap-3 pt-3">
              <button onClick={markCompleted} disabled={!ack || !meetsCriteria} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">Mark as Completed</button>
              <Link to="/learning-modules" className="text-blue-600 hover:underline">Back to Modules</Link>
            </div>
          </div>
        )}
      </div>
    {toast && (
      <div className="fixed bottom-4 right-4 bg-gray-900 text-white text-sm px-4 py-2 rounded shadow-lg flex items-center gap-2 animate-fadeIn" role="status" aria-live="polite">
        <span>✅</span>
        <span>{toast.message}</span>
        <button onClick={()=>setToast(null)} className="ml-1 text-white/70 hover:text-white" aria-label="Dismiss">×</button>
      </div>
    )}
    </div>
  );
};

export default SignaturePractical;
