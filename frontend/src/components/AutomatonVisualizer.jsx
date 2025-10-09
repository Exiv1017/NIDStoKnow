import React, { useState, useEffect, useCallback } from 'react';

/*
  AutomatonVisualizer
  - Builds a simplified Aho–Corasick trie client-side from provided signatures (string patterns only).
  - Step-through Algorithm 1 (insertion + fail link BFS) with a single Step control.
  - After build, allows interactive search highlighting traversal states (Algorithm 2 conceptual demo).
  - Focuses on clarity over full graph rendering: shows active node path, queue state, node table.
*/

function buildEmpty() {
  return { id: 0, char: '', parent: null, children: {}, outputs: [], fail: 0, depth: 0, path: '' };
}

const AutomatonVisualizer = ({ signatures }) => {
  const patterns = (signatures || [])
    .filter(s => !s.regex) // Only include AC string patterns
    .map(s => s.pattern)
    .filter((v, i, a) => v && a.indexOf(v) === i) // unique
    .sort((a,b)=> a.localeCompare(b));

  const [nodes, setNodes] = useState({ 0: buildEmpty() });
  const [nextId, setNextId] = useState(1);
  const [stage, setStage] = useState('idle'); // idle | inserting | fail | done
  const [pIndex, setPIndex] = useState(0);
  const [cIndex, setCIndex] = useState(0);
  const [queue, setQueue] = useState([]); // node ids for BFS
  const [log, setLog] = useState([]);
  const [activeNode, setActiveNode] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [searchTrace, setSearchTrace] = useState([]); // {i,ch,node,outputs,failHops}
  const [autoPlay, setAutoPlay] = useState(false);

  const appendLog = (msg) => setLog(l => [...l.slice(-499), msg]);

  const reset = () => {
    setNodes({ 0: buildEmpty() });
    setNextId(1);
    setStage('inserting');
    setPIndex(0);
    setCIndex(0);
    setQueue([]);
    setLog([]);
    setActiveNode(0);
    setSearchText('');
    setSearchTrace([]);
    setAutoPlay(false);
    appendLog('Reset: starting insertion stage.');
  };

  useEffect(() => {
    if (stage === 'idle' && patterns.length > 0) {
      setStage('inserting');
      appendLog('Initialized insertion stage.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patterns.length]);

  const stepInsertion = () => {
    if (pIndex >= patterns.length) {
      // Transition to fail stage
      const rootChildren = Object.values(nodes[0].children).map(id => id);
      // set fail of root children to root
      setNodes(prev => {
        const copy = { ...prev };
        rootChildren.forEach(id => { copy[id] = { ...copy[id], fail: 0 }; });
        return copy;
      });
      setQueue(rootChildren);
      setStage('fail');
      appendLog(`Insertion complete. Transition to fail-link stage with ${rootChildren.length} root children.`);
      return;
    }
    const pattern = patterns[pIndex];
    if (cIndex < pattern.length) {
      const ch = pattern[cIndex];
      // Navigate / create
      setNodes(prev => {
        // Find path starting from root each new pattern insertion per pseudocode
        let current = 0;
        // Walk pattern up to cIndex already inserted for stability
        for (let i=0;i<cIndex;i++) {
          const stepCh = pattern[i];
            current = prev[current].children[stepCh];
        }
        let parent = current;
        if (!prev[parent].children[ch]) {
          const id = nextId;
          const newNode = { id, char: ch, parent, children: {}, outputs: [], fail: null, depth: prev[parent].depth + 1, path: (prev[parent].path + ch) };
          const copy = { ...prev };
          copy[parent] = { ...copy[parent], children: { ...copy[parent].children, [ch]: id } };
          copy[id] = newNode;
          setNextId(id + 1);
          appendLog(`Created node '${newNode.path}' (id=${id}).`);
          setActiveNode(id);
          return copy;
        } else {
          const id = prev[parent].children[ch];
          setActiveNode(id);
          appendLog(`Traversed existing node '${prev[id].path}'.`);
          return prev;
        }
      });
      setCIndex(cIndex + 1);
    } else {
      // Append pattern to output
      setNodes(prev => {
        let current = 0;
        for (let i=0;i<pattern.length;i++) current = prev[current].children[pattern[i]];
        const copy = { ...prev };
        copy[current] = { ...copy[current], outputs: [...copy[current].outputs, pattern] };
        appendLog(`Marked output at '${copy[current].path}' for pattern '${pattern}'.`);
        return copy;
      });
      setPIndex(pIndex + 1);
      setCIndex(0);
    }
  };

  const stepFail = () => {
    if (queue.length === 0) {
      setStage('done');
      appendLog('Fail-link stage complete. Automaton ready.');
      return;
    }
    const [currentId, ...rest] = queue;
    const currentNode = nodes[currentId];
    // For each child compute fail link
    const childEntries = Object.entries(currentNode.children);
    if (childEntries.length === 0) {
      setQueue(rest);
      appendLog(`Processed node '${currentNode.path}' (leaf).`);
      return;
    }
    // Process one child per step for clarity
    const [ch, childId] = childEntries[0];
    // Remove processed child from iteration by cloning structure (we track progress via log only; not removing child actually)
    // Compute fail
    let f = nodes[currentNode.fail ?? 0];
    let hops = 0;
    while (f && f.id !== 0 && !f.children[ch]) { f = nodes[f.fail]; hops++; }
    let targetFail = 0;
    if (f.children[ch] && f.children[ch] !== childId) targetFail = f.children[ch];
    // Update child
    setNodes(prev => {
      const copy = { ...prev };
      const child = { ...copy[childId], fail: targetFail };
      // inherit outputs
      if (child.fail && copy[child.fail].outputs.length) {
        child.outputs = [...new Set([...child.outputs, ...copy[child.fail].outputs])];
      }
      copy[childId] = child;
      return copy;
    });
    // Enqueue remaining children (all) when first touched
    setQueue(q => [...rest, ...childEntries.slice(1).map(e => e[1]), childId]); // ensure child processed later siblings still considered
    setActiveNode(childId);
    appendLog(`Fail link for '${nodes[childId].path}' via ${hops} hop(s) -> '${targetFail === 0 ? 'root' : nodes[targetFail].path}'.`);
  };

  const step = () => {
    if (stage === 'inserting') stepInsertion();
    else if (stage === 'fail') stepFail();
  };

  // Auto-play basic interval
  useEffect(() => {
    if (!autoPlay) return;
    if (stage === 'done') { setAutoPlay(false); return; }
    const t = setTimeout(step, 500);
    return () => clearTimeout(t);
  }, [autoPlay, stage, pIndex, cIndex, queue, nodes]);

  const performSearch = useCallback(() => {
    if (stage !== 'done' || !searchText) { setSearchTrace([]); return; }
    let node = nodes[0];
    const trace = [];
    for (let i=0;i<searchText.length;i++) {
      const ch = searchText[i];
      let failHops = 0;
      while (node.id !== 0 && !node.children[ch]) { node = nodes[node.fail]; failHops++; }
      if (node.children[ch]) node = nodes[node.children[ch]]; else node = nodes[0];
      trace.push({ i, ch, node: node.path || 'root', outputs: [...node.outputs], failHops });
    }
    setSearchTrace(trace);
  }, [searchText, nodes, stage]);

  useEffect(() => { performSearch(); }, [performSearch]);

  const nodeList = Object.values(nodes).sort((a,b)=> a.depth - b.depth || a.path.localeCompare(b.path));
  const totalNodes = nodeList.length;
  const totalOutputs = nodeList.reduce((acc,n)=> acc + n.outputs.length,0);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Aho–Corasick Visualizer</h2>
          <p className="text-gray-500 text-sm">Interactive build + search demo (client-side approximation).</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="px-3 py-1.5 text-xs font-semibold rounded bg-gray-100 hover:bg-gray-200">Reset</button>
          {stage !== 'done' && (
            <>
              <button onClick={step} className="px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700">Step</button>
              <button onClick={()=> setAutoPlay(p=>!p)} className={`px-3 py-1.5 text-xs font-semibold rounded ${autoPlay ? 'bg-yellow-500 text-white' : 'bg-green-600 text-white hover:bg-green-700'}`}>{autoPlay ? 'Pause Auto' : 'Auto-Play'}</button>
            </>
          )}
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        <div className="space-y-4 md:col-span-1">
          <div className="bg-gray-50 p-3 rounded border">
            <h3 className="font-semibold text-sm text-gray-700 mb-2">Status</h3>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>Stage: <span className="font-medium text-gray-800">{stage}</span></li>
              <li>Patterns: {patterns.length}</li>
              <li>Current Pattern: {pIndex < patterns.length ? patterns[pIndex] : '-'}</li>
              <li>Char Index: {cIndex}</li>
              <li>Nodes: {totalNodes}</li>
              <li>Total Outputs: {totalOutputs}</li>
              {stage === 'fail' && <li>Queue Length: {queue.length}</li>}
            </ul>
          </div>
          <div className="bg-gray-50 p-3 rounded border max-h-48 overflow-auto">
            <h3 className="font-semibold text-sm text-gray-700 mb-2">Patterns (string only)</h3>
            <ol className="list-decimal list-inside space-y-1 text-xs text-gray-700">
              {patterns.map((p,i)=>(
                <li key={p} className={i===pIndex && stage!=='done' ? 'font-semibold text-blue-700' : ''}>{p}</li>
              ))}
              {patterns.length===0 && <li className="text-gray-400 italic">(none)</li>}
            </ol>
          </div>
          <div className="bg-gray-50 p-3 rounded border max-h-48 overflow-auto">
            <h3 className="font-semibold text-sm text-gray-700 mb-2">Build Log</h3>
            <ul className="text-[10px] space-y-1 font-mono text-gray-600">
              {log.slice().reverse().map((l,i)=>(<li key={i}>{l}</li>))}
            </ul>
          </div>
        </div>
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white border rounded p-3 h-64 overflow-auto">
            <h3 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-2">Nodes Table <span className="text-[10px] text-gray-400">(active node highlighted)</span></h3>
            <table className="w-full text-[11px] text-left">
              <thead className="text-gray-500">
                <tr>
                  <th className="py-1 pr-2">ID</th>
                  <th className="py-1 pr-2">Path</th>
                  <th className="py-1 pr-2">Fail</th>
                  <th className="py-1 pr-2">Outputs</th>
                </tr>
              </thead>
              <tbody>
                {nodeList.map(n => (
                  <tr key={n.id} className={n.id===activeNode ? 'bg-blue-50' : ''}>
                    <td className="py-0.5 pr-2">{n.id}</td>
                    <td className="py-0.5 pr-2 font-mono">{n.path || 'root'}</td>
                    <td className="py-0.5 pr-2 text-gray-600">{n.fail === 0 ? 'root' : (nodes[n.fail]?.path || '')}</td>
                    <td className="py-0.5 pr-2">{n.outputs.map(o => <span key={o} className="inline-block bg-gray-200 rounded px-1 mr-1 mb-0.5">{o}</span>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-white border rounded p-3 space-y-3">
            <h3 className="font-semibold text-sm text-gray-700">Algorithm 2 Search Demo</h3>
            {stage !== 'done' ? (
              <div className="text-xs text-gray-500">Finish the build first to enable search.</div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  placeholder="Type text to search..."
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                />
                <div className="max-h-40 overflow-auto border rounded p-2 text-[11px] font-mono bg-gray-50">
                  {searchTrace.length === 0 && searchText && (
                    <div className="text-gray-500">(no steps)</div>
                  )}
                  {searchTrace.map(t => (
                    <div key={t.i} className="flex items-start gap-2">
                      <span className="text-gray-400">{t.i.toString().padStart(3,'0')}</span>
                      <span>ch='{t.ch}' node={t.node || 'root'} failHops={t.failHops} {t.outputs.length>0 && 'matches'} {t.outputs.length>0 && t.outputs.map(o=>`[${o}]`).join(' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="text-[10px] text-gray-400">
            Note: This is a pedagogical reconstruction from current signature patterns (string type only); actual backend automaton uses the compiled ahocorasick module.
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutomatonVisualizer;
