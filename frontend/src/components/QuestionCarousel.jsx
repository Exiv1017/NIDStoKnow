import React, { useEffect, useMemo, useState } from 'react';
import { FiCheckCircle, FiXCircle, FiArrowRight, FiArrowLeft, FiHelpCircle } from 'react-icons/fi';

// Generic, lightweight carousel supporting varied question types.
// Question shape by type:
// - single: { type: 'single', prompt, choices: [..], correct: index }
// - multi: { type: 'multi', prompt, choices: [..], correct: [indexes] }
// - boolean: { type: 'boolean', prompt, correct: true|false }
// - text: { type: 'text', prompt, correctText: '...' }
// - blank: { type: 'blank', promptWithBlank: 'Use ____ to ...', correctText: '...' }
// - order: { type: 'order', prompt, items: ['a','b','c'], correctOrder: ['a','b','c'] }
// - match: { type: 'match', prompt, pairs: [{left:'A', right:'1'},...]} // answer is mapping left->right
// - arrange: { type: 'arrange', prompt, tokens: ['foo','bar'], correctOrder: ['foo','bar'] }
// - slider: { type: 'slider', prompt, min:0, max:10, correctRange:[3,7] }
// - dropdown: { type: 'dropdown', prompt, options:['a','b'], correct:'a' }
// - hotspot: { type: 'hotspot', prompt, text:'log line here', hotspots:[{start:10,end:15}], allowMulti:false }
// - matrix: { type: 'matrix', prompt, rows:['r1'], cols:['c1'], correctCells: [['r1','c1']] }
// - toggle: { type: 'toggle', prompt, items:[{label:'A', correct:true}, ...] }
// - classify: { type: 'classify', prompt, text:'...', labels:['Benign','Malicious'], correct:'Malicious' }
// - number: { type: 'number', prompt, correct: 42 }

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

// Added onQuestionChecked: fires whenever user checks (submits) a question with its correctness
// Added autoFinishOnLast: if true, automatically invokes finish logic after last question is checked
const QuestionCarousel = ({ questions, onPass, passThreshold = 0.8, onComplete, intro, onQuestionChecked, autoFinishOnLast = false }) => {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // id -> answer value by type
  const [results, setResults] = useState({}); // id -> { correct: boolean }
  const [submittedAll, setSubmittedAll] = useState(false);
  const [started, setStarted] = useState(false);

  const current = questions[idx];
  const [showHint, setShowHint] = useState(false);

  const scoreInfo = useMemo(() => {
    // Only count questions that have been explicitly checked (exist in results)
    let correct = 0;
    const attempted = Object.keys(results).length;
    for (const [qid, res] of Object.entries(results)) {
      if (res?.correct) correct++;
    }
    const total = questions.length;
    const ratio = attempted ? correct / total : 0; // ratio relative to total for pass threshold
    return { correct, attempted, total, ratio };
  }, [results, questions.length]);

  const allAnswered = useMemo(() => questions.every(q => answers[q.id] !== undefined), [answers, questions]);

  function isCorrect(q, a) {
    try {
      switch (q.type) {
        case 'single': return Number(a) === Number(q.correct);
        case 'multi': return Array.isArray(a) && setsEqual(new Set(a.map(Number)), new Set(q.correct.map(Number)));
        case 'boolean': return Boolean(a) === Boolean(q.correct);
        case 'text': return String(a).trim().toLowerCase() === String(q.correctText || '').trim().toLowerCase();
        case 'blank': return String(a).trim().toLowerCase() === String(q.correctText || '').trim().toLowerCase();
        case 'order': return Array.isArray(a) && arraysEqual(a, q.correctOrder);
        case 'match': {
          // a is object {left->right}
          const m = a || {};
          return (q.pairs || []).every(p => String(m[p.left]) === String(p.right));
        }
        case 'arrange': return Array.isArray(a) && arraysEqual(a, q.correctOrder);
        case 'slider': {
          const v = Number(a);
          const [min, max] = q.correctRange || [q.correct, q.correct];
          return v >= Number(min) && v <= Number(max);
        }
        case 'dropdown': return String(a) === String(q.correct);
        case 'hotspot': {
          // a is array of ranges [{start,end}]
          const norm = (arr) => (arr || []).map(r => `${r.start}-${r.end}`).sort();
          return arraysEqual(norm(a), norm(q.hotspots || []));
        }
        case 'matrix': {
          // a is set of keys `${row}|${col}`
          const ans = new Set(a || []);
          const corr = new Set((q.correctCells || []).map(([r,c]) => `${r}|${c}`));
          return setsEqual(ans, corr);
        }
        case 'toggle': return (q.items || []).every((it, i) => Boolean((a||[])[i]) === Boolean(it.correct));
        case 'classify': return String(a) === String(q.correct);
        case 'number': return Number(a) === Number(q.correct);
        default: return false;
      }
    } catch (_) { return false; }
  }

  const setAnswer = (val) => setAnswers(prev => ({ ...prev, [current.id]: val }));

  const checkCurrent = () => {
    const a = answers[current.id];
    if (a === undefined) return; // nothing to check
    const ok = isCorrect(current, a);
    setResults(prev => ({ ...prev, [current.id]: { correct: ok } }));
    if (onQuestionChecked) {
      try { onQuestionChecked({ id: current.id, correct: ok, answer: a }); } catch (_) {}
    }
    // If this is the last question and autoFinishOnLast is enabled, finish automatically
    if (autoFinishOnLast && idx === questions.length - 1) {
      // We need a slight defer so state (results) includes this last check
      setTimeout(() => finish(), 0);
    }
  };

  const finish = () => {
    setSubmittedAll(true);
    const passed = scoreInfo.ratio >= passThreshold;
    if (onComplete) onComplete(scoreInfo);
    if (passed && onPass) onPass(scoreInfo);
  };

  const Nav = () => (
    <div className="flex items-center justify-between mt-4">
      <button className="inline-flex items-center gap-2 px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 transition" onClick={() => handlePrev()} disabled={idx===0}><FiArrowLeft /> Prev</button>
      <div className="text-sm text-gray-600">{idx+1} / {questions.length}</div>
      <button className="inline-flex items-center gap-2 px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition" onClick={() => handleNext()} disabled={idx===questions.length-1 || !results[current.id]}>Next <FiArrowRight /></button>
    </div>
  );

  const Progress = () => (
    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mb-4">
      <div className="bg-gradient-to-r from-indigo-500 to-blue-500 h-2 transition-all duration-300" style={{width: `${((idx+1)/questions.length)*100}%`}} />
    </div>
  );

  const Badge = () => submittedAll ? (
    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${scoreInfo.ratio>=passThreshold?'bg-green-100 text-green-800':'bg-red-100 text-red-800'}`}>
      {Math.round(scoreInfo.ratio*100)}% {scoreInfo.ratio>=passThreshold ? 'Passed' : 'Try again'}
    </div>
  ) : null;

  const ProgressDots = () => (
    <div className="flex items-center gap-2">
      {questions.map((q,i)=>{
        const answered = answers[q.id] !== undefined;
        const checked = !!results[q.id];
        const isCurrent = i===idx;
        const bg = isCurrent ? 'bg-blue-600' : (checked ? 'bg-green-500' : (answered ? 'bg-yellow-400' : 'bg-gray-300'));
        const ring = isCurrent ? 'ring-2 ring-blue-300' : '';
        return <div key={q.id} className={`w-2.5 h-2.5 rounded-full ${bg} ${ring}`} title={`Q${i+1}`}></div>;
      })}
    </div>
  );

  const handlePrev = () => setIdx(i => Math.max(0, i-1));
  const handleNext = () => setIdx(i => Math.min(questions.length-1, i+1));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight' && results[current.id]) handleNext();
      if (e.key === 'Enter' && answers[current.id] !== undefined && !results[current.id]) checkCurrent();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, answers, results, current]);

  const renderQuestion = () => {
    switch (current.type) {
      case 'single':
        return (
          <div className="space-y-2">
            {(current.choices||[]).map((c,i)=> (
              <label key={i} className="flex items-center gap-2">
                <input type="radio" name={`q_${current.id}`} checked={answers[current.id]===i} onChange={()=>setAnswer(i)} />
                <span>{c}</span>
              </label>
            ))}
          </div>
        );
      case 'multi':
        return (
          <div className="space-y-2">
            {(current.choices||[]).map((c,i)=> {
              const arr = Array.isArray(answers[current.id]) ? answers[current.id] : [];
              const toggle = () => {
                const s = new Set(arr);
                s.has(i) ? s.delete(i) : s.add(i);
                setAnswer(Array.from(s));
              };
              return (
                <label key={i} className="flex items-center gap-2">
                  <input type="checkbox" checked={arr.includes(i)} onChange={toggle} />
                  <span>{c}</span>
                </label>
              );
            })}
          </div>
        );
      case 'boolean':
        return (
          <div className="space-x-4">
            <label className="inline-flex items-center gap-2"><input type="radio" name={`q_${current.id}`} checked={answers[current.id]===true} onChange={()=>setAnswer(true)} /> True</label>
            <label className="inline-flex items-center gap-2"><input type="radio" name={`q_${current.id}`} checked={answers[current.id]===false} onChange={()=>setAnswer(false)} /> False</label>
          </div>
        );
      case 'text':
        return <input className="w-full border rounded px-3 py-2" value={answers[current.id]||''} onChange={e=>setAnswer(e.target.value)} placeholder="Type your answer..."/>;
      case 'blank':
        return (
          <div className="space-y-2">
            <div className="text-gray-800">{(current.promptWithBlank||'').replace('____','_____')}</div>
            <input className="w-full border rounded px-3 py-2" value={answers[current.id]||''} onChange={e=>setAnswer(e.target.value)} placeholder="Fill the blank"/>
          </div>
        );
      case 'order': {
        const arr = Array.isArray(answers[current.id]) ? answers[current.id] : (current.items||[]);
        const move = (i,dir)=>{
          const copy = [...arr];
          const j = i+dir;
          if (j<0||j>=copy.length) return;
          const t = copy[i]; copy[i]=copy[j]; copy[j]=t;
          setAnswer(copy);
        };
        return (
          <ul className="space-y-2">
            {arr.map((it,i)=> (
              <li key={i} className="flex items-center justify-between border rounded px-3 py-2">
                <span>{it}</span>
                <div className="space-x-2">
                  <button className="px-2 py-1 bg-gray-200 rounded" onClick={()=>move(i,-1)}>↑</button>
                  <button className="px-2 py-1 bg-gray-200 rounded" onClick={()=>move(i,1)}>↓</button>
                </div>
              </li>
            ))}
          </ul>
        );
      }
      case 'match': {
        const lefts = (current.pairs||[]).map(p=>p.left);
        const rights = (current.pairs||[]).map(p=>p.right);
        const map = answers[current.id] || {};
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {lefts.map((l,i)=> (
              <div key={i} className="flex items-center gap-3">
                <span className="min-w-[120px]">{l}</span>
                <select className="border rounded px-2 py-1" value={map[l]||''} onChange={e=>setAnswer({...map,[l]:e.target.value})}>
                  <option value="">Select...</option>
                  {rights.map((r,ri)=>(<option key={ri} value={r}>{r}</option>))}
                </select>
              </div>
            ))}
          </div>
        );
      }
      case 'arrange': {
        const arr = Array.isArray(answers[current.id]) ? answers[current.id] : (current.tokens||[]);
        const move = (i,dir)=>{
          const copy = [...arr];
          const j = i+dir; if (j<0||j>=copy.length) return; const t=copy[i]; copy[i]=copy[j]; copy[j]=t; setAnswer(copy);
        };
        return (
          <div className="flex flex-wrap gap-2">
            {arr.map((t,i)=> (
              <div key={i} className="flex items-center gap-2 border rounded px-2 py-1 bg-gray-50">
                <code>{t}</code>
                <div className="space-x-1">
                  <button className="px-1 bg-gray-200 rounded" onClick={()=>move(i,-1)}>↑</button>
                  <button className="px-1 bg-gray-200 rounded" onClick={()=>move(i,1)}>↓</button>
                </div>
              </div>
            ))}
          </div>
        );
      }
      case 'slider': {
        const v = Number(answers[current.id] ?? current.min ?? 0);
        return (
          <div className="space-y-2">
            <input type="range" min={current.min||0} max={current.max||10} value={v} onChange={e=>setAnswer(Number(e.target.value))} className="w-full"/>
            <div className="text-sm text-gray-600">Value: {v}</div>
          </div>
        );
      }
      case 'dropdown':
        return (
          <select className="border rounded px-2 py-2" value={answers[current.id]||''} onChange={e=>setAnswer(e.target.value)}>
            <option value="">Select...</option>
            {(current.options||[]).map((o,i)=>(<option key={i} value={o}>{o}</option>))}
          </select>
        );
      case 'hotspot': {
        const text = current.text || '';
        // Simplified: toggle select word tokens by index, then compare to hotspots mapped to token index ranges
        const tokens = text.split(/\s+/);
        const selected = new Set((answers[current.id]||[]));
        const toggle = (i)=>{ const s=new Set(selected); s.has(i)?s.delete(i):s.add(i); setAnswer(Array.from(s)); };
        const hotspotTokens = new Set();
        (current.hotspots||[]).forEach(h=>{
          // map char ranges to token indexes roughly
          let acc=0; for (let i=0;i<tokens.length;i++){ const start=acc; const end=acc+tokens[i].length; if (!(end<h.start || start>h.end)) hotspotTokens.add(i); acc=end+1; }
        });
        const correctSet = hotspotTokens;
        return (
          <div className="flex flex-wrap gap-2">
            {tokens.map((t,i)=>{
              const isSel = selected.has(i);
              return (
                <button key={i} type="button" onClick={()=>toggle(i)} className={`px-2 py-1 rounded border ${isSel?'bg-yellow-200 border-yellow-400':'bg-gray-50'}`}>{t}</button>
              );
            })}
          </div>
        );
      }
      case 'matrix': {
        const key = (r,c)=>`${r}|${c}`;
        const set = new Set(answers[current.id]||[]);
        const toggle = (r,c)=>{ const s=new Set(set); const k=key(r,c); s.has(k)?s.delete(k):s.add(k); setAnswer(Array.from(s)); };
        return (
          <div className="overflow-x-auto">
            <table className="min-w-[400px] border">
              <thead><tr><th className="border px-2 py-1"></th>{(current.cols||[]).map((c,i)=>(<th key={i} className="border px-2 py-1 text-sm">{c}</th>))}</tr></thead>
              <tbody>
                {(current.rows||[]).map((r,ri)=>(
                  <tr key={ri}>
                    <td className="border px-2 py-1 text-sm font-medium">{r}</td>
                    {(current.cols||[]).map((c,ci)=>{
                      const k=key(r,c); const checked=set.has(k);
                      return (<td key={ci} className="border px-2 py-1 text-center"><input type="checkbox" checked={checked} onChange={()=>toggle(r,c)} /></td>);
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      case 'toggle': {
        const arr = Array.isArray(answers[current.id]) ? answers[current.id] : (current.items||[]).map(()=>false);
        const setIdx = (i,v)=>{ const copy=[...arr]; copy[i]=v; setAnswer(copy); };
        return (
          <div className="space-y-2">
            {(current.items||[]).map((it,i)=>(
              <label key={i} className="flex items-center justify-between border rounded px-3 py-2">
                <span>{it.label}</span>
                <input type="checkbox" checked={!!arr[i]} onChange={e=>setIdx(i,e.target.checked)} />
              </label>
            ))}
          </div>
        );
      }
      case 'classify': {
        const labs = current.labels || ['Benign','Malicious'];
        return (
          <div className="space-x-3">
            {labs.map((l,i)=>(
              <label key={i} className="inline-flex items-center gap-2">
                <input type="radio" name={`q_${current.id}`} checked={answers[current.id]===l} onChange={()=>setAnswer(l)} /> {l}
              </label>
            ))}
          </div>
        );
      }
      case 'number':
        return <input type="number" className="w-40 border rounded px-3 py-2" value={answers[current.id] ?? ''} onChange={e=>setAnswer(e.target.value)} />;
      default:
        return <div>Unsupported question type.</div>;
    }
  };

  if (!started) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl p-[1px] bg-gradient-to-br from-indigo-100 via-blue-100 to-emerald-100">
          <div className="rounded-2xl border shadow-sm bg-white p-6 space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{intro?.title || 'Quiz'}</h2>
              <div className="mt-1 h-1 w-24 bg-blue-600 rounded"></div>
            </div>
            <p className="text-gray-700">{intro?.lead || "Let’s check your knowledge about the concepts you just learned."}</p>
            <p className="text-gray-700">{intro?.details || `This is a ${questions.length}-question quiz. You must get ${Math.round(passThreshold*100)}% to pass. Don’t worry—you can retake it as many times as needed.`}</p>
            <div className="flex items-center gap-3 pt-2">
              <button className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={()=>setStarted(true)}>Start Quiz</button>
              {intro?.onRetake && (
                <button className="px-4 py-2 rounded text-blue-700 hover:text-blue-800" onClick={intro.onRetake}>Take Again</button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-600 flex items-center gap-3">
          <span>Pass threshold: {Math.round(passThreshold*100)}%</span>
          <ProgressDots />
        </div>
        <Badge />
      </div>
      <Progress />
      <div className="rounded-2xl p-[1px] bg-gradient-to-br from-indigo-100 via-blue-100 to-emerald-100">
        <div className="rounded-2xl border shadow-sm bg-white p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="text-lg font-semibold text-gray-900">{current.prompt}</div>
            {current.hint && (
              <button type="button" onClick={()=>setShowHint(v=>!v)} className="inline-flex items-center gap-1 text-sm text-blue-700 hover:text-blue-800">
                <FiHelpCircle /> Hint
              </button>
            )}
          </div>
          {showHint && current.hint && (
            <div className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded px-3 py-2">{current.hint}</div>
          )}
        {renderQuestion()}
        {results[current.id] && (
          <div className={`mt-2 px-3 py-2 rounded flex items-center gap-2 ${results[current.id].correct ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200 shake'}`}>
            {results[current.id].correct ? <FiCheckCircle className="text-green-600 animate-bounce" /> : <FiXCircle className="text-red-600" />}
            <span className="font-medium">{results[current.id].correct ? 'Correct!' : 'Incorrect'}</span>
          </div>
        )}
        <div className="flex items-center gap-3 pt-2">
          {!results[current.id] && (
            <button className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50 transition hover:translate-y-[-1px] hover:shadow" disabled={answers[current.id]===undefined} onClick={checkCurrent}>Submit</button>
          )}
          {!autoFinishOnLast && idx === questions.length-1 && results[current.id] && (
            <button className="px-4 py-2 rounded bg-emerald-600 text-white transition hover:translate-y-[-1px] hover:shadow" onClick={finish}>Finish</button>
          )}
        </div>
        </div>
      </div>
      <Nav />
  <div className="mt-3 text-sm text-gray-600">Overall: {scoreInfo.correct} / {scoreInfo.total} correct (Attempted: {scoreInfo.attempted})</div>
    </div>
  );
};

export default QuestionCarousel;
