import { useMemo, useState, useContext, useEffect, useRef } from 'react';
import AuthContext from '../../context/AuthContext';
import InstructorSidebar from '../../components/InstructorSidebar';

const sectionList = [
  { key: 'overview', label: 'Overview' },
  { key: 'theory', label: 'Theory' },
  { key: 'practical', label: 'Practical Exercise' },
  { key: 'assessment', label: 'Assessment' },
];

const CreateContent = () => {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('overview');
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleDescription, setModuleDescription] = useState('');
  const [category, setCategory] = useState('Signature-Based NIDS');
  const [difficulty, setDifficulty] = useState('Beginner');
  const [estimatedTime, setEstimatedTime] = useState('10–15 mins');
  const [visibility, setVisibility] = useState('Public');
  const [schedule, setSchedule] = useState('');
  const [status, setStatus] = useState('Draft'); // Draft | Published
  const [showPreview, setShowPreview] = useState(true);
  const [sections, setSections] = useState({
    overview: { title: '', content: '' },
    theory: [
      {
        moduleNumber: 1,
        lessons: [
          { title: '', content: '', blocks: [] },
        ],
        assessment: { title: '', content: '' },
      },
    ],
    practical: { title: '', content: '' },
    assessment: { title: '', content: '' },
  });
  const [previewTab, setPreviewTab] = useState('overview'); // overview | theory | practical | assessment
  const [collapsedTheory, setCollapsedTheory] = useState([]); // indices of collapsed theory modules
  const [lastSaved, setLastSaved] = useState(null);
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const autosaveTimer = useRef(null);
  const [dirty, setDirty] = useState(false);
  const [mdPreview, setMdPreview] = useState({}); // key -> bool

  // --- Simple Markdown renderer (lightweight, no external deps) ---
  const mdToHtml = (raw='') => {
    // escape html
    let text = raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    // headings
    text = text.replace(/^### (.*)$/gm,'<h4 class="font-semibold mt-3 mb-1 text-sm">$1</h4>');
    text = text.replace(/^## (.*)$/gm,'<h3 class="font-semibold mt-4 mb-1 text-base">$1</h3>');
    text = text.replace(/^# (.*)$/gm,'<h2 class="font-semibold mt-5 mb-2 text-lg">$1</h2>');
    // bold / italic
    text = text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g,'<em>$1</em>');
    // inline code
    text = text.replace(/`([^`]+)`/g,'<code class="px-1 py-0.5 rounded bg-gray-100 text-[11px]">$1</code>');
    // unordered lists (simple)
    text = text.replace(/^(?:-|\*) (.*)$/gm,'<li class="ml-4 list-disc">$1</li>');
    // wrap consecutive <li>
    text = text.replace(/(<li[\s\S]*?<\/li>\n?)+/g, m => `<ul class="my-2 pl-2 text-sm">${m.replace(/\n/g,'')}</ul>`);
    // paragraphs (split blank lines)
    text = text.split(/\n{2,}/).map(p=> p.trim().startsWith('<')? p : `<p class="text-sm leading-relaxed mb-2">${p.replace(/\n/g,'<br/>')}</p>`).join('');
    return text;
  };

  const toggleMd = (key) => setMdPreview(prev => ({...prev, [key]: !prev[key]}));
  const markDirty = () => setDirty(true);

  // Load draft on mount
  useEffect(()=>{
    try {
      const stored = localStorage.getItem('module-draft');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && !moduleTitle && !moduleDescription) {
          setModuleTitle(parsed.title || '');
          setModuleDescription(parsed.description || '');
          setCategory(parsed.category || 'Signature-Based NIDS');
          setDifficulty(parsed.difficulty || 'Beginner');
          setEstimatedTime(parsed.estimatedTime || '10–15 mins');
          setVisibility(parsed.visibility || 'Public');
          setSchedule(parsed.schedule || '');
          if (parsed.sections) setSections(parsed.sections);
          setLastSaved(parsed.lastSaved || new Date().toISOString());
        }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave effect (debounced)
  useEffect(()=>{
    if (!autosaveEnabled) return; 
    if (!dirty) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(()=>{
      try {
        const payload = {title: moduleTitle, description: moduleDescription, category, difficulty, estimatedTime, visibility, schedule, sections, status, lastSaved: new Date().toISOString()};
        localStorage.setItem('module-draft', JSON.stringify(payload));
        setLastSaved(payload.lastSaved);
        setDirty(false);
      } catch {}
    }, 1200);
    return () => clearTimeout(autosaveTimer.current);
  }, [moduleTitle, moduleDescription, category, difficulty, estimatedTime, visibility, schedule, sections, status, autosaveEnabled, dirty]);

  const toggleCollapseModule = (idx) => {
    setCollapsedTheory(prev => prev.includes(idx) ? prev.filter(i=>i!==idx) : [...prev, idx]);
  };

  const handleSectionChange = (key, field, value) => {
    setSections({
      ...sections,
      [key]: {
        ...sections[key],
        [field]: value,
      },
    });
    markDirty();
  };

  // --- Theory Handlers ---
  const addTheoryModule = () => {
    setSections(prev => ({
      ...prev,
      theory: [
        ...prev.theory,
        {
          moduleNumber: prev.theory.length + 1,
          lessons: [{ title: '', content: '', blocks: [] }],
          assessment: { title: '', content: '' },
        },
      ],
    }));
    markDirty();
  };

  const removeTheoryModule = (idx) => {
    setSections(prev => ({
      ...prev,
      theory: prev.theory.filter((_, i) => i !== idx).map((mod, i) => ({ ...mod, moduleNumber: i + 1 })),
    }));
    markDirty();
  };

  const moveTheoryModule = (idx, dir) => {
    setSections(prev => {
      const arr = [...prev.theory];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= arr.length) return prev;
      const [item] = arr.splice(idx,1);
      arr.splice(newIdx,0,item);
      return { ...prev, theory: arr.map((m,i)=>({...m, moduleNumber: i+1})) };
    });
    markDirty();
  };

  const handleTheoryModuleChange = (idx, field, value) => {
    setSections(prev => ({
      ...prev,
      theory: prev.theory.map((mod, i) =>
        i === idx ? { ...mod, [field]: value } : mod
      ),
    }));
  };

  const addLesson = (modIdx) => {
    setSections(prev => ({
      ...prev,
      theory: prev.theory.map((mod, i) =>
  i === modIdx ? { ...mod, lessons: [...mod.lessons, { title: '', content: '', blocks: [] }] } : mod
      ),
    }));
    markDirty();
  };

  const removeLesson = (modIdx, lessonIdx) => {
    setSections(prev => ({
      ...prev,
      theory: prev.theory.map((mod, i) =>
        i === modIdx ? { ...mod, lessons: mod.lessons.filter((_, j) => j !== lessonIdx) } : mod
      ),
    }));
    markDirty();
  };

  const moveLesson = (modIdx, lessonIdx, dir) => {
    setSections(prev => ({
      ...prev,
      theory: prev.theory.map((mod, i) => {
        if (i !== modIdx) return mod;
        const arr = [...mod.lessons];
        const newIdx = lessonIdx + dir;
        if (newIdx < 0 || newIdx >= arr.length) return mod;
        const [item] = arr.splice(lessonIdx,1);
        arr.splice(newIdx,0,item);
        return { ...mod, lessons: arr };
      })
    }));
    markDirty();
  };

  const handleLessonChange = (modIdx, lessonIdx, field, value) => {
    setSections(prev => ({
      ...prev,
      theory: prev.theory.map((mod, i) =>
        i === modIdx
          ? {
              ...mod,
              lessons: mod.lessons.map((lesson, j) =>
                j === lessonIdx ? { ...lesson, [field]: value } : lesson
              ),
            }
          : mod
      ),
    }));
    markDirty();
  };

  const handleAssessmentChange = (modIdx, field, value) => {
    setSections(prev => ({
      ...prev,
      theory: prev.theory.map((mod, i) =>
        i === modIdx ? { ...mod, assessment: { ...mod.assessment, [field]: value } } : mod
      ),
    }));
    markDirty();
  };

  // ---- Validation & computed preview model ----
  const canPublish = useMemo(() => {
    if (!moduleTitle.trim() || !moduleDescription.trim()) return false;
    const hasOverview = sections.overview.title.trim() && sections.overview.content.trim();
    if (!hasOverview) return false;
    const firstTheory = sections.theory?.[0];
    const firstLesson = firstTheory?.lessons?.[0];
    const hasAtLeastOneLesson = Boolean(firstLesson?.title?.trim() && firstLesson?.content?.trim());
    return hasAtLeastOneLesson;
  }, [moduleTitle, moduleDescription, sections]);

  const validationIssues = useMemo(()=>{
    const issues = [];
    if (!moduleTitle.trim()) issues.push('Module title required');
    if (!moduleDescription.trim()) issues.push('Module description required');
    if (!sections.overview.title.trim()) issues.push('Overview title required');
    if (!sections.overview.content.trim()) issues.push('Overview content required');
    if (!sections.theory.length) issues.push('At least one theory module needed');
    let anyLesson = false;
    sections.theory.forEach((m,i)=>{
      if (!m.lessons.length) issues.push(`Module ${i+1} needs at least one lesson`);
      m.lessons.forEach((l,j)=>{
        const hasBlockContent = Array.isArray(l.blocks) && l.blocks.some(b=>{
          if(b.type==='text') return (b.text||'').trim();
            if(b.type==='image') return (b.url||'').trim();
            if(b.type==='video') return (b.url||'').trim();
            return false;
        });
        const lessonComplete = l.title.trim() && ((l.content||'').trim() || hasBlockContent);
        if (lessonComplete) anyLesson = true; else issues.push(`Module ${i+1} Lesson ${j+1} incomplete`);
      });
    });
    if (!anyLesson) issues.push('At least one complete lesson (title & content) required');
    return issues;
  }, [moduleTitle, moduleDescription, sections]);

  // Generate a student-facing module preview object similar to LearningModules.jsx
  const modulePreview = useMemo(() => {
    const overviewComplete = Boolean(sections.overview.title.trim() && sections.overview.content.trim());
    return {
      id: 'preview',
      title: moduleTitle || 'Untitled Module',
      description: moduleDescription || 'Module description will appear here.',
      difficulty,
      estimatedTime,
      lastAccessed: '—',
      progress: 0,
      status,
      category,
      visibility,
      schedule,
      sections: [
        { name: 'Overview', locked: false, completed: false },
        { name: 'Theory', locked: !overviewComplete, completed: false },
        { name: 'Practical Exercise', locked: !overviewComplete, completed: false },
        { name: 'Assessment', locked: !overviewComplete, completed: false },
      ],
      theoryModules: (sections.theory || []).map((m) => ({
        title: `Module ${m.moduleNumber}`,
        lessons: (m.lessons || []).map((l) => ({
          title: l.title || 'Untitled Lesson',
          content: l.content || 'Lesson content...',
        })),
        assessment: { ...m.assessment },
      })),
      practical: sections.practical,
      assessmentSection: sections.assessment,
    };
  }, [sections, moduleTitle, moduleDescription, difficulty, estimatedTime, status, category, visibility, schedule]);

  // --- Preview helpers (lightweight copy of styles from LearningModules) ---
  const getDifficultyBadge = (d) => {
    const styles = {
      Beginner: 'bg-green-100 text-green-800',
      Intermediate: 'bg-yellow-100 text-yellow-800',
      Advanced: 'bg-red-100 text-red-800',
    };
    return styles[d] || 'bg-gray-100 text-gray-800';
  };

  const sectionPill = (s) => {
    const base = 'px-3 py-1 rounded-full text-sm font-medium';
    if (s.locked) return `${base} bg-gray-100 text-gray-500 cursor-not-allowed`; 
    return `${base} bg-[#206EA6] text-white`;
  };

  const handleSaveDraft = () => {
    setStatus('Draft');
    // Optional: persist to localStorage to avoid losing work
    try {
      localStorage.setItem('module-draft', JSON.stringify({
        title: moduleTitle,
        description: moduleDescription,
        category,
        difficulty,
        estimatedTime,
        visibility,
        schedule,
        sections,
        status: 'Draft',
        lastSaved: new Date().toISOString()
      }));
      setLastSaved(new Date().toISOString());
      setDirty(false);
    } catch (e) {
      // ignore storage errors silently
    }
    // Non-blocking feedback
    setToast('Draft saved locally');
    setTimeout(()=> setToast(''), 2500);
  };

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  // Warn on tab close if dirty (unsaved edits not yet autosaved)
  useEffect(()=>{
    if (!dirty) return; 
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const handlePublish = async () => {
    if (!canPublish || submitting) {
      if (!canPublish) alert('Complete required fields before publishing.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        instructor_id: user?.id || 0,
        module_name: moduleTitle.trim() || 'Untitled Module',
        category: category || 'uncategorized',
        details: moduleDescription.slice(0,1000),
        content: {
          meta: {
            title: moduleTitle,
            description: moduleDescription,
            category,
            difficulty,
            estimatedTime,
            visibility,
            schedule,
            status: 'draft'
          },
            overview: sections.overview,
            theory: sections.theory,
            practical: sections.practical,
            assessment: sections.assessment
        }
      };
        const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
        const res = await fetch(`${API_BASE}/api/instructor/module-request`.replace(/([^:]?)\/\/+/g,'$1/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.token ? { 'Authorization': `Bearer ${user.token}` } : {})
        },
        body: JSON.stringify(payload)
      });
      let data=null; try { data = await res.json(); } catch {}
      if (!res.ok) throw new Error(data?.detail || data?.error || `Request failed (${res.status})`);
      setStatus('Published');
      setToast('Submitted for admin review');
      setTimeout(()=> setToast(''), 3000);
    } catch (e) {
      console.error('Publish failed', e);
      alert('Failed to submit module for review: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <InstructorSidebar />
      <main className="ml-64 overflow-y-auto">
        <div className="p-4 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h1 className="text-3xl font-bold flex flex-wrap items-center gap-3">
                Create New Module
                <span className={`text-xs px-2 py-1 rounded-full border ${status === 'Published' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>{status}</span>
                {validationIssues.length > 0 && (
                  <span className="text-[11px] px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold">{validationIssues.length} issue{validationIssues.length!==1?'s':''}</span>
                )}
                {dirty && autosaveEnabled && <span className="text-[11px] text-gray-500">Saving…</span>}
                {lastSaved && !dirty && <span className="text-[11px] text-gray-400">Saved {new Date(lastSaved).toLocaleTimeString()}</span>}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" className="rounded" checked={showPreview} onChange={() => setShowPreview(v => !v)} />
                  Live Preview
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" className="rounded" checked={autosaveEnabled} onChange={()=> setAutosaveEnabled(v=>!v)} />
                  Autosave
                </label>
                {/* AI Helper removed per user request */}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="px-5 py-2 border border-[#1E5780] text-[#1E5780] rounded-lg hover:bg-[#1E5780] hover:text-white font-semibold transition-colors shadow"
                onClick={handleSaveDraft}
              >
                Save as Draft
              </button>
              <button
                className={`px-5 py-2 rounded-lg font-semibold transition-colors shadow ${canPublish ? 'bg-[#1E5780] text-white hover:bg-[#164666]' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                onClick={handlePublish}
                disabled={!canPublish}
              >
                {submitting ? 'Submitting…' : 'Publish & Send'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-md border border-gray-100">
            <div className="border-b">
              <nav className="flex" aria-label="Tabs">
                {sectionList.map((section) => (
                  <button
                    key={section.key}
                    onClick={() => setActiveTab(section.key)}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === section.key
                        ? 'border-[#1E5780] text-[#1E5780]' : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {section.label}
                  </button>
                ))}
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'settings'
                      ? 'border-[#1E5780] text-[#1E5780]' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Settings
                </button>
              </nav>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: authoring form */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Module Title</label>
                    <input
                      type="text"
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780] ${!moduleTitle.trim()?'border-red-300 bg-red-50':''}`}
                      placeholder="Enter module title"
                      value={moduleTitle}
                      onChange={e => { setModuleTitle(e.target.value); markDirty(); }}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">Description</label>
                      <button type="button" onClick={()=>toggleMd('moduleDescription')} className="text-[11px] text-indigo-600 hover:underline">{mdPreview.moduleDescription? 'Edit' : 'Preview MD'}</button>
                    </div>
                    {mdPreview.moduleDescription ? (
                      <div className="border rounded-lg p-3 bg-gray-50 prose-sm max-h-60 overflow-auto" dangerouslySetInnerHTML={{__html: mdToHtml(moduleDescription || '')}} />
                    ) : (
                      <textarea
                        rows="4"
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780] ${!moduleDescription.trim()?'border-red-300 bg-red-50':''}`}
                        placeholder="Enter module description"
                        value={moduleDescription}
                        onChange={e => { setModuleDescription(e.target.value); markDirty(); }}
                      ></textarea>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780]"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                    >
                      <option>Signature-Based NIDS</option>
                      <option>Anomaly-Based NIDS</option>
                      <option>Hybrid NIDS</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                      <select
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780]"
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                      >
                        <option>Beginner</option>
                        <option>Intermediate</option>
                        <option>Advanced</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Time</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780]"
                        placeholder="e.g., 10–15 mins"
                        value={estimatedTime}
                        onChange={(e) => setEstimatedTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Section Title</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780]"
                      placeholder="Overview title"
                      value={sections.overview.title}
                      onChange={e => handleSectionChange('overview', 'title', e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">Section Content</label>
                      <button type="button" onClick={()=>toggleMd('overviewContent')} className="text-[11px] text-indigo-600 hover:underline">{mdPreview.overviewContent? 'Edit' : 'Preview MD'}</button>
                    </div>
                    {mdPreview.overviewContent ? (
                      <div className={`border rounded-lg p-3 bg-gray-50 max-h-72 overflow-auto text-sm ${!sections.overview.content.trim()?'border-red-300 bg-red-50':''}`} dangerouslySetInnerHTML={{__html: mdToHtml(sections.overview.content)}} />
                    ) : (
                      <textarea
                        rows="6"
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780] ${!sections.overview.content.trim()?'border-red-300 bg-red-50':''}`}
                        placeholder="Overview content"
                        value={sections.overview.content}
                        onChange={e => handleSectionChange('overview', 'content', e.target.value)}
                      ></textarea>
                    )}
                  </div>
                </div>
              )}
              {activeTab === 'theory' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold tracking-tight">Theory Modules</h2>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="px-4 py-2 bg-[#1E5780] text-white rounded-lg hover:bg-[#164666] font-semibold text-sm shadow"
                        onClick={addTheoryModule}
                      >
                        + Module
                      </button>
                    </div>
                  </div>
                  {sections.theory.map((module, modIdx) => {
                    const collapsed = collapsedTheory.includes(modIdx);
                    const totalLessons = module.lessons.length;
                    const completeness = module.lessons.filter(l=>l.title.trim() && l.content.trim()).length;
                    const allDone = completeness === totalLessons && totalLessons>0;
                    return (
                      <div key={modIdx} className="border rounded-xl bg-white shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50/60">
                          <div className="flex items-center gap-3 min-w-0">
                            <button type="button" onClick={()=>toggleCollapseModule(modIdx)} className="w-6 h-6 flex items-center justify-center rounded-full border text-[10px] font-semibold bg-white hover:bg-gray-100">
                              {collapsed? '+':'–'}
                            </button>
                            <div className="min-w-0">
                              <div className="font-semibold text-sm truncate">Module {module.moduleNumber}</div>
                              <div className="text-[11px] text-gray-500">{totalLessons} lesson{totalLessons!==1?'s':''} • {completeness}/{totalLessons} complete</div>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${allDone? 'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>{allDone? 'Ready':'Draft'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <button type="button" disabled={modIdx===0} onClick={()=>moveTheoryModule(modIdx,-1)} className={`w-6 h-6 flex items-center justify-center rounded border text-[11px] ${modIdx===0?'opacity-30 cursor-not-allowed':'hover:bg-gray-100'}`}>↑</button>
                              <button type="button" disabled={modIdx===sections.theory.length-1} onClick={()=>moveTheoryModule(modIdx,1)} className={`w-6 h-6 flex items-center justify-center rounded border text-[11px] ${modIdx===sections.theory.length-1?'opacity-30 cursor-not-allowed':'hover:bg-gray-100'}`}>↓</button>
                            </div>
                            {sections.theory.length > 1 && (
                              <button
                                type="button"
                                className="text-xs text-red-500 hover:underline"
                                onClick={() => removeTheoryModule(modIdx)}
                              >Remove</button>
                            )}
                          </div>
                        </div>
                        {!collapsed && (
                          <div className="p-4 space-y-6">
                            <div>
                              <h4 className="font-semibold mb-3 text-sm flex items-center gap-2">Lessons <span className="text-[10px] text-gray-500 font-normal">(Fill title & content)</span></h4>
                              <div className="space-y-4">
                                {module.lessons.map((lesson, lessonIdx) => {
                                  const complete = lesson.title.trim() && lesson.content.trim();
                                  const key = `theory_mod_${modIdx}_lesson_${lessonIdx}`;
                                  return (
                                    <div key={lessonIdx} className={`border rounded-lg p-4 bg-gradient-to-br from-white to-gray-50 relative ${!complete?'border-amber-300':''}`}>
                                      <div className="flex items-start justify-between mb-3 gap-3">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-sm">Lesson {lessonIdx + 1}</span>
                                          <div className="flex gap-1">
                                            <button type="button" disabled={lessonIdx===0} onClick={()=>moveLesson(modIdx, lessonIdx,-1)} className={`w-5 h-5 flex items-center justify-center rounded border text-[10px] ${lessonIdx===0?'opacity-30 cursor-not-allowed':'hover:bg-gray-100'}`}>↑</button>
                                            <button type="button" disabled={lessonIdx===module.lessons.length-1} onClick={()=>moveLesson(modIdx, lessonIdx,1)} className={`w-5 h-5 flex items-center justify-center rounded border text-[10px] ${lessonIdx===module.lessons.length-1?'opacity-30 cursor-not-allowed':'hover:bg-gray-100'}`}>↓</button>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button type="button" onClick={()=>toggleMd(key)} className="text-[10px] text-indigo-600 hover:underline">{mdPreview[key]? 'Edit':'Preview'}</button>
                                          {module.lessons.length > 1 && (
                                            <button
                                              type="button"
                                              className="text-[11px] text-red-500 hover:underline"
                                              onClick={() => removeLesson(modIdx, lessonIdx)}
                                            >Remove</button>
                                          )}
                                        </div>
                                      </div>
                                      <input
                                        type="text"
                                        className={`w-full px-3 py-2 border rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-[#1E5780] text-sm ${!lesson.title.trim()?'border-red-300 bg-red-50':''}`}
                                        placeholder="Lesson title"
                                        value={lesson.title}
                                        onChange={e => handleLessonChange(modIdx, lessonIdx, 'title', e.target.value)}
                                      />
                                      {mdPreview[key] ? (
                                        <div className={`w-full border rounded-lg p-3 bg-gray-50 text-xs max-h-40 overflow-auto ${!lesson.content.trim()?'border-red-300 bg-red-50':''}`} dangerouslySetInnerHTML={{__html: mdToHtml(lesson.content)}} />
                                      ) : (
                                        <textarea
                                          rows="3"
                                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780] text-sm leading-relaxed ${!lesson.content.trim()?'border-red-300 bg-red-50':''}`}
                                          placeholder="Lesson content"
                                          value={lesson.content}
                                          onChange={e => handleLessonChange(modIdx, lessonIdx, 'content', e.target.value)}
                                        ></textarea>
                                      )}
                                      {!complete && <div className="text-[10px] text-amber-600 mt-1">Incomplete lesson</div>}
                                    </div>
                                  );
                                })}
                              </div>
                              <button
                                type="button"
                                className="mt-4 px-3 py-1.5 bg-[#1E5780] text-white rounded hover:bg-[#164666] text-xs font-semibold shadow"
                                onClick={() => addLesson(modIdx)}
                              >+ Lesson</button>
                            </div>
                            <div>
                              <h4 className="font-semibold mb-2 text-sm">Module Assessment (optional)</h4>
                              <input
                                type="text"
                                className="w-full px-3 py-2 border rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-[#1E5780] text-sm"
                                placeholder="Assessment title"
                                value={module.assessment.title}
                                onChange={e => handleAssessmentChange(modIdx, 'title', e.target.value)}
                              />
                              <textarea
                                rows="3"
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780] text-sm"
                                placeholder="Assessment content / sample questions"
                                value={module.assessment.content}
                                onChange={e => handleAssessmentChange(modIdx, 'content', e.target.value)}
                              ></textarea>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {activeTab === 'practical' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold tracking-tight">Practical Exercise Authoring</h2>
                  <div className="border rounded-xl p-5 bg-white shadow-sm space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Section Title</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780]"
                        placeholder="Practical Exercise title"
                        value={sections.practical.title}
                        onChange={e => handleSectionChange('practical', 'title', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Section Content / Tasks</label>
                      <div className="flex items-center justify-between mb-1">
                        <span className="block text-xs text-gray-500">Write markdown or plain text</span>
                        <button type="button" onClick={()=>toggleMd('practical')} className="text-[11px] text-indigo-600 hover:underline">{mdPreview.practical? 'Edit':'Preview MD'}</button>
                      </div>
                      {mdPreview.practical ? (
                        <div className="w-full border rounded-lg p-3 bg-gray-50 text-sm max-h-72 overflow-auto" dangerouslySetInnerHTML={{__html: mdToHtml(sections.practical.content)}} />
                      ) : (
                        <textarea
                          rows="10"
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780] leading-relaxed text-sm"
                          placeholder={`Describe the hands-on lab, steps, expected outputs, hints...`}
                          value={sections.practical.content}
                          onChange={e => handleSectionChange('practical', 'content', e.target.value)}
                        ></textarea>
                      )}
                      <p className="text-[11px] text-gray-500 mt-1">Tip: Break steps with blank lines. Learners will see formatted blocks.</p>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'assessment' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold tracking-tight">Final Assessment Authoring</h2>
                  <div className="border rounded-xl p-5 bg-white shadow-sm space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Assessment Title</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780]"
                        placeholder="Assessment title"
                        value={sections.assessment.title}
                        onChange={e => handleSectionChange('assessment', 'title', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Overview / Question Pool</label>
                      <div className="flex items-center justify-between mb-1">
                        <span className="block text-xs text-gray-500">Write markdown or plain text</span>
                        <button type="button" onClick={()=>toggleMd('finalAssessment')} className="text-[11px] text-indigo-600 hover:underline">{mdPreview.finalAssessment? 'Edit':'Preview MD'}</button>
                      </div>
                      {mdPreview.finalAssessment ? (
                        <div className="w-full border rounded-lg p-3 bg-gray-50 text-sm max-h-72 overflow-auto" dangerouslySetInnerHTML={{__html: mdToHtml(sections.assessment.content)}} />
                      ) : (
                        <textarea
                          rows="10"
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780] leading-relaxed text-sm"
                          placeholder={`Describe scoring rules, learning objectives, include sample questions (one per line) ...`}
                          value={sections.assessment.content}
                          onChange={e => handleSectionChange('assessment', 'content', e.target.value)}
                        ></textarea>
                      )}
                      <p className="text-[11px] text-gray-500 mt-1">You can later map these into structured quiz items.</p>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'settings' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold tracking-tight">Module Settings</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="border rounded-xl bg-white p-5 shadow-sm space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
                        <select
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780]"
                          value={visibility}
                          onChange={e => setVisibility(e.target.value)}
                        >
                          <option>Public</option>
                          <option>Private</option>
                          <option>Password Protected</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Release</label>
                        <input
                          type="datetime-local"
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780]"
                          value={schedule}
                          onChange={e => setSchedule(e.target.value)}
                        />
                        <p className="text-[11px] text-gray-500 mt-1">Leave blank for immediate availability.</p>
                      </div>
                    </div>
                    <div className="border rounded-xl bg-white p-5 shadow-sm space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                        <select
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780]"
                          value={difficulty}
                          onChange={(e) => setDifficulty(e.target.value)}
                        >
                          <option>Beginner</option>
                          <option>Intermediate</option>
                          <option>Advanced</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Time</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780]"
                          placeholder="e.g., 10–15 mins"
                          value={estimatedTime}
                          onChange={(e) => setEstimatedTime(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <select
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E5780]"
                          value={category}
                          onChange={e => setCategory(e.target.value)}
                        >
                          <option>Signature-Based NIDS</option>
                          <option>Anomaly-Based NIDS</option>
                          <option>Hybrid NIDS</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Right: live preview (revamped) */}
              {showPreview && (
                <aside className="order-first lg:order-none">
                  <div className="sticky top-4">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 overflow-hidden">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h2 className="text-xl font-semibold tracking-tight">Student Preview</h2>
                          <p className="text-xs text-gray-500 mt-1">Mirrors the learner-facing experience.</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full border ${status === 'Published' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>{status}</span>
                      </div>
                      {/* Overview header card */}
                      <div className="border rounded-xl p-4 bg-gradient-to-br from-white to-gray-50">
                        <div className="flex justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold truncate" title={modulePreview.title}>{modulePreview.title}</h3>
                            <p className="text-gray-600 mt-1 text-sm line-clamp-3 whitespace-pre-wrap">{modulePreview.description}</p>
                            <div className="flex items-center flex-wrap gap-2 mt-2 text-[11px] font-medium">
                              <span className={`px-2 py-1 rounded-full ${getDifficultyBadge(modulePreview.difficulty)}`}>{modulePreview.difficulty}</span>
                              <span className="text-gray-500 flex items-center gap-1">⏱ {modulePreview.estimatedTime}</span>
                              <span className="text-gray-500 flex items-center gap-1">🔒 {modulePreview.visibility}</span>
                            </div>
                          </div>
                          <div className="w-32 text-right">
                            <span className="text-xs text-gray-500">Progress</span>
                            <div className="w-full bg-gray-200 h-2 rounded-full mt-1 overflow-hidden">
                              <div className="h-2 bg-indigo-500 rounded-full transition-all" style={{ width: '0%' }} />
                            </div>
                            <div className="text-[11px] text-gray-500 mt-1">0%</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-4">
                          {modulePreview.sections.map(sec => {
                            const key = sec.name.toLowerCase().split(' ')[0];
                            const active = previewTab === key;
                            const locked = sec.locked;
                            return (
                              <button
                                key={sec.name}
                                disabled={locked}
                                onClick={()=>!locked && setPreviewTab(key)}
                                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${locked ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : active ? 'bg-[#206EA6] text-white shadow' : 'bg-gray-200/70 text-gray-700 hover:bg-gray-300'}`}
                              >{sec.name}</button>
                            );
                          })}
                        </div>
                      </div>
                      {/* Tab content */}
                      <div className="mt-5">
                        {previewTab === 'overview' && (
                          <div className="space-y-5">
                            <div>
                              <h4 className="text-sm font-semibold mb-2 text-gray-800">Section Status</h4>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {modulePreview.sections.map(s => (
                                  <div key={s.name} className={`px-2 py-2 rounded-lg border flex items-center justify-between ${s.locked? 'bg-gray-50 text-gray-500 border-gray-200':'bg-white text-gray-700'}`}> 
                                    <span className="font-medium">{s.name}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.locked? 'bg-gray-200 text-gray-600':'bg-emerald-100 text-emerald-700'}`}>{s.locked? 'Locked':'Ready'}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold mb-2 text-gray-800">Theory Outline</h4>
                              {modulePreview.theoryModules.length === 0 ? (
                                <div className="text-xs text-gray-500">No theory modules yet.</div>
                              ) : (
                                <ul className="text-xs space-y-1">
                                  {modulePreview.theoryModules.map((tm,i)=>(
                                    <li key={i} className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span><span className="font-medium text-gray-700">{tm.title}</span><span className="text-gray-500">{tm.lessons.length} lesson{tm.lessons.length!==1?'s':''}</span></li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        )}
                        {previewTab === 'theory' && (
                          <div className="space-y-4">
                            {modulePreview.theoryModules.length === 0 && (
                              <div className="text-xs text-gray-500">Add theory modules to see a preview.</div>
                            )}
                            {modulePreview.theoryModules.map((tm,i)=>(
                              <div key={i} className="border rounded-lg p-3 bg-white shadow-sm">
                                <div className="flex justify-between items-center mb-2">
                                  <h5 className="font-semibold text-sm">{tm.title}</h5>
                                  <span className="text-[10px] text-gray-500">{tm.lessons.length} lessons</span>
                                </div>
                                <ul className="space-y-1 text-xs">
                                  {tm.lessons.map((l,li)=>(
                                    <li key={li} className="flex items-start gap-2">
                                      <span className="mt-1 w-2 h-2 rounded-full bg-indigo-400"></span>
                                      <div className="flex-1">
                                        <div className="font-medium text-gray-700">{l.title}</div>
                                        {li===0 && i===0 && (
                                          <div className="text-[11px] text-gray-600 line-clamp-3 whitespace-pre-wrap mt-0.5">{l.content}</div>
                                        )}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        )}
                        {previewTab === 'practical' && (
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-gray-800">{sections.practical.title || 'Practical Exercise Title'}</h4>
                            <div className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed bg-gray-50 border rounded-lg p-3 max-h-48 overflow-auto">
                              {(sections.practical.content || 'Practical exercise instructions...').slice(0,800)}{sections.practical.content.length>800?'…':''}
                            </div>
                            <div className="text-[11px] text-gray-500">Learners will perform hands-on tasks here.</div>
                          </div>
                        )}
                        {previewTab === 'assessment' && (
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-gray-800">{sections.assessment.title || 'Assessment Title'}</h4>
                            <div className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed bg-gray-50 border rounded-lg p-3 max-h-48 overflow-auto">
                              {(sections.assessment.content || 'Assessment instructions / question pool preview...').slice(0,800)}{sections.assessment.content.length>800?'…':''}
                            </div>
                            <div className="text-[11px] text-gray-500">Passing criteria & scoring logic will appear to learners.</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </aside>
              )}
            </div>
          </div>
          {toast && (
            <div className="fixed bottom-4 right-4 bg-black text-white px-4 py-2 text-sm rounded shadow-lg">{toast}</div>
          )}
        </div>
      </main>
      {/* AI Helper panel removed */}
    </div>
  );
};

export default CreateContent; 