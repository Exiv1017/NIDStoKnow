import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'frontend/src/content/modules');

const TRACK_DIRS = ['signature', 'anomaly', 'hybrid']; // directory names under modules/
const TITLE_FROM = (md) => {
  // 1) YAML frontmatter: ---\n...title: X...\n---
  if (md.startsWith('---')) {
    const end = md.indexOf('\n---', 3);
    if (end !== -1) {
      const fm = md.slice(3, end).split(/\r?\n/);
      for (const line of fm) {
        const m = line.match(/^\s*title\s*:\s*(.+)\s*$/i);
        if (m) return m[1].trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
      }
    }
  }
  // 2) First H1
  const h1 = md.match(/^\s*#\s+(.+)\s*$/m);
  if (h1) return h1[1].trim();
  return null;
};

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch { return ''; }
}

function scanTrack(trackDirAbs) {
  // Collect: { [moduleNumber]: { lessons: { [lessonNumber]: {file,title}}, quiz: bool } }
  const map = new Map();
  for (const fname of (fs.existsSync(trackDirAbs) ? fs.readdirSync(trackDirAbs) : [])) {
    const fpath = path.join(trackDirAbs, fname);
    if (!fs.statSync(fpath).isFile()) continue;
    // moduleN-lessonM.md
    let m = fname.match(/^module(\d+)-lesson(\d+)\.md$/i);
    if (m) {
      const mod = Number(m[1]); const les = Number(m[2]);
      const md = readFileSafe(fpath);
      const title = TITLE_FROM(md) || `Lesson ${les}`;
      if (!map.has(mod)) map.set(mod, { lessons: new Map(), quiz: false });
      map.get(mod).lessons.set(les, { file: fname, title });
      continue;
    }
    // moduleN-quiz.md
    m = fname.match(/^module(\d+)-quiz\.md$/i);
    if (m) {
      const mod = Number(m[1]);
      if (!map.has(mod)) map.set(mod, { lessons: new Map(), quiz: true });
      else map.get(mod).quiz = true;
      continue;
    }
  }

  // Summary (optional)
  const summary = { has: false, quiz: false, title: 'Summary' };
  for (const fname of (fs.existsSync(trackDirAbs) ? fs.readdirSync(trackDirAbs) : [])) {
    if (/^summary\.md$/i.test(fname)) {
      summary.has = true;
      const md = readFileSafe(path.join(trackDirAbs, fname));
      const t = TITLE_FROM(md);
      if (t) summary.title = t;
    } else if (/^summary-quiz\.md$/i.test(fname)) {
      summary.quiz = true;
    }
  }

  // Build ordered output lines
  const lines = [];
  const orderedMods = [...map.keys()].sort((a,b)=>a-b);
  for (const mod of orderedMods) {
    const modObj = map.get(mod);
    lines.push(`Module ${mod}: Module ${mod}`);
    const lessons = [...modObj.lessons.keys()].sort((a,b)=>a-b);
    for (const les of lessons) {
      const t = modObj.lessons.get(les).title;
      lines.push(`${mod}.${les} ${t}`);
    }
    if (modObj.quiz) lines.push('Module Quiz');
    lines.push('');
  }
  if (summary.has) {
    lines.push('Summary');
    if (summary.quiz) lines.push('Quiz');
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

function printTrack(trackName) {
  const trackDirAbs = path.join(ROOT, trackName);
  const label =
    trackName === 'signature' ? 'Signature-Based Detection' :
    trackName === 'anomaly'   ? 'Anomaly-Based Detection'   :
    trackName === 'hybrid'    ? 'Hybrid Detection'          : trackName;
  if (!fs.existsSync(trackDirAbs)) {
    console.log(`${label}\n(no modules found)\n`);
    return;
  }
  console.log(label);
  const out = scanTrack(trackDirAbs);
  console.log(out ? out : '(no modules found)');
  console.log('');
}

printTrack('signature');
printTrack('anomaly');
printTrack('hybrid');