import React, { useState, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { KeyPointsBlock, CalloutBlock, ImageCaptionBlock, VideoEmbedBlock, DiagramBlock,
  ObjectivesBlock, FlipCardDeck, ExpandableCardGroup, DragOrderBlock, MatchingPairs,
  PollBlock, ReflectionBlock, ScenarioBlock, IconList, HighlightBox, PitfallsBlock, GlossaryBlock, Carousel } from '../../../../components/LessonBlocks.jsx';

// Lightweight subset of the giant parser; we will progressively migrate additional block types.
// This keeps initial refactor low-risk while establishing a clean extension point.

const SectionFallback = ({ block, idx }) => (
  <div key={idx} className="prose prose-lg max-w-none text-black leading-relaxed [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:space-y-2 [&_li]:leading-[1.75] [&_li]:marker:text-[#1E5780]/70 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:space-y-2 [&_strong]:text-[#1E5780] [&_strong]:font-semibold">
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{block}</ReactMarkdown>
  </div>
);

// Lightweight inline components for newly standardized bracket blocks
const IntroBlock = ({ text }) => (
  <div className="rounded-md bg-indigo-50 border border-indigo-200 p-4 text-gray-800">
    <p className="m-0">{text}</p>
  </div>
);

const ProcessBlock = ({ title, steps }) => (
  <div className="rounded-md border border-slate-200 p-4 bg-white shadow-sm">
    {title && <h4 className="mt-0 mb-3 font-semibold text-indigo-700 text-sm tracking-wide uppercase">{title}</h4>}
    <ol className="list-decimal ml-5 space-y-1">
      {steps.map((s,i)=>(
        <li key={i} className="pl-1"><strong>{s.name}</strong>{s.desc && <> — {s.desc}</>}</li>
      ))}
    </ol>
  </div>
);

const ExampleBlock = ({ title, body }) => (
  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
    {title && <h4 className="m-0 mb-2 font-semibold text-emerald-700">{title}</h4>}
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{body}</ReactMarkdown>
  </div>
);

const GatedRationaleBlock = ({ body, target }) => {
  const [visible, setVisible] = useState(false);
  useEffect(()=> {
    if (!target) { setVisible(true); return; }
    const onReveal = (e) => {
      const d = e.detail || {};
      if (d.question === target || d.prompt === target) {
        setVisible(true);
      }
    };
    window.addEventListener('lesson.mcq.reveal', onReveal);
    window.addEventListener('lesson.scenarioQuiz.reveal', onReveal);
    return ()=> {
      window.removeEventListener('lesson.mcq.reveal', onReveal);
      window.removeEventListener('lesson.scenarioQuiz.reveal', onReveal);
    };
  }, [target]);
  if (!visible) return (
    <div className="rounded-md border border-dashed border-emerald-300 bg-emerald-50/40 p-4 text-sm text-emerald-700 italic">Reveal the answer to see the rationale.</div>
  );
  return <ExampleBlock title="Rationale" body={body} />;
};

const DidYouKnowBlock = ({ body }) => (
  <div className="rounded-md bg-amber-50 border border-amber-200 p-4 text-sm">
    <strong className="text-amber-700">Did You Know?</strong>
    <div className="mt-1"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{body}</ReactMarkdown></div>
  </div>
);

const QuizPromptBlock = ({ title, prompt }) => (
  <div className="rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-5 shadow-sm" role="group" aria-label={title || 'Quiz'}>
    <div className="flex items-center gap-2 mb-2">
      <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#1E5780]/10 text-[#1E5780] text-[11px] font-semibold tracking-wide">QUIZ</span>
      <h4 className="m-0 font-semibold text-[#1E5780] text-sm">{title || 'Quiz'}</h4>
    </div>
    <p className="m-0 leading-relaxed text-sm text-black">{prompt}</p>
  </div>
);

const MCQBlock = ({ question, options, answer }) => {
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const onSelect = useCallback((opt) => {
    if (revealed) return; // lock after reveal
    setSelected(opt);
    // fire lightweight custom event for analytics
    window.dispatchEvent(new CustomEvent('lesson.mcq.select', { detail: { question, choice: opt, correct: opt === answer } }));
  }, [answer, question, revealed]);
  const reveal = () => {
    if (!revealed) {
      setRevealed(true);
      window.dispatchEvent(new CustomEvent('lesson.mcq.reveal', { detail: { question, answer } }));
    }
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" role="group" aria-label={question}>
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[11px] font-semibold tracking-wide">MCQ</span>
        <p className="font-medium m-0 text-slate-800">{question}</p>
      </div>
      <ul className="space-y-2 m-0 p-0" role="listbox" aria-activedescendant={selected || undefined}>
        {options.map((opt,i)=> {
          const isCorrect = opt === answer;
          const isSelected = opt === selected;
          const stateClass = revealed
            ? (isCorrect ? 'border-[#1E5780] bg-[#1E5780]/10 text-[#1E5780]' : (isSelected ? 'border-black/30 bg-black/5 text-black/70' : 'border-[#E3E3E3]'))
            : (isSelected ? 'border-[#1E5780] bg-[#1E5780]/10' : 'border-[#E3E3E3] hover:border-[#1E5780]');
          return (
            <li key={i}>
              <button type="button" role="option" aria-selected={isSelected}
                onClick={()=>onSelect(opt)} disabled={revealed}
                className={`w-full text-left rounded-md border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E5780] ${stateClass}`}> 
                <span className="font-medium leading-snug">{opt}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap gap-4 items-center">
        <button type="button" onClick={reveal} disabled={revealed || selected==null}
          className="text-xs tracking-wide uppercase rounded px-3 py-1.5 bg-[#1E5780] text-white font-semibold disabled:opacity-40 shadow-sm">{revealed ? 'Answer Revealed' : 'Reveal Answer'}</button>
        {revealed && (
          <span className="text-sm text-[#1E5780] font-medium">Correct Answer: {answer}</span>
        )}
      </div>
    </div>
  );
};

const ScenarioQuizBlock = ({ prompt, options, answer }) => {
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);

  // Attempt to split combined prompt produced by parser into segments (Title — narrative — question)
  const segments = prompt.split(/\s+—\s+/); // em dash separated
  let title = segments[0] || 'Scenario';
  let narrative = '';
  let question = '';
  if (segments.length === 2) {
    narrative = segments[1];
  } else if (segments.length >= 3) {
    narrative = segments.slice(1, segments.length - 1).join(' — ');
    question = segments[segments.length - 1];
  }
  // Heuristic: if question not isolated, try to detect a trailing question mark chunk
  if (!question && /\?\s*$/.test(narrative)) {
    question = narrative;
    narrative = '';
  }

  const onSelect = useCallback((opt)=> {
    if (revealed) return;
    setSelected(opt);
    window.dispatchEvent(new CustomEvent('lesson.scenarioQuiz.select', { detail: { prompt, choice: opt, correct: opt === answer } }));
  }, [answer, prompt, revealed]);
  const reveal = () => {
    if (!revealed) {
      setRevealed(true);
      window.dispatchEvent(new CustomEvent('lesson.scenarioQuiz.reveal', { detail: { prompt, answer } }));
    }
  };

  return (
  <div className="rounded-lg border border-[#E3E3E3] bg-gradient-to-br from-[#E3E3E3]/20 to-white p-5 shadow-sm space-y-4" role="group" aria-label={prompt}>
    <div className="flex items-start justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#1E5780]/10 text-[#1E5780] text-[10px] font-semibold tracking-wide shrink-0">SCENARIO</span>
          <h4 className="m-0 font-semibold text-[#1E5780] text-sm leading-snug">{title}</h4>
        </div>
      </div>
      {narrative && (
        <div className="text-sm leading-relaxed text-black/70">
          {narrative}
        </div>
      )}
      {question && (
        <p className="m-0 font-medium text-black text-sm">{question}</p>
      )}
      {options?.length>0 && (
        <ul className="space-y-2 m-0 p-0" role="listbox" aria-activedescendant={selected || undefined}>
          {options.map((o,i)=> {
            const isCorrect = o === answer;
            const isSelected = o === selected;
            const stateClass = revealed
              ? (isCorrect ? 'border-[#1E5780] bg-[#1E5780]/10 text-[#1E5780]' : (isSelected ? 'border-black/30 bg-black/5 text-black/70' : 'border-[#E3E3E3]'))
              : (isSelected ? 'border-[#1E5780] bg-[#1E5780]/10' : 'border-[#E3E3E3] hover:border-[#1E5780]');
            return (
              <li key={i}>
                <button type="button" role="option" aria-selected={isSelected}
                  onClick={()=>onSelect(o)} disabled={revealed}
                  className={`w-full text-left rounded-md border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E5780] ${stateClass}`}>{o}</button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="pt-2 flex flex-wrap gap-4 items-center">
        <button type="button" onClick={reveal} disabled={revealed || selected==null}
          className="text-xs tracking-wide uppercase rounded px-3 py-1.5 bg-[#1E5780] text-white font-semibold disabled:opacity-40 shadow-sm">{revealed ? 'Answer Revealed' : 'Reveal Answer'}</button>
        {revealed && <span className="text-sm text-[#1E5780] font-medium">Correct Answer: {answer}</span>}
      </div>
    </div>
  );
};

const NextStepsBlock = ({ text }) => (
  <div className="rounded-md bg-slate-50 border border-slate-200 p-4 text-sm">
    <strong className="text-slate-700">Next Steps:</strong> <span>{text}</span>
  </div>
);

function extractKeyPoints(raw) {
  try {
    if (!raw || typeof raw !== 'string') return [];
    let m = raw.match(/\*\*Key Points:?\*\*[\r\n]+([\s\S]*?)(?=\n\n|$)/i);
    if (m && m[1]) {
      const items = m[1].split(/\n/)
        .map(l => l.trim())
        .filter(l => /^[-*+]/.test(l))
        .map(l => l.replace(/^[-*+]\s*/, '').trim())
        .filter(Boolean);
      if (items.length) return items.slice(0, 10);
    }
    return [];
  } catch { return []; }
}

export const parseBlocks = (content) => {
  try {
    if (content == null) return [];
    // Some loaders might pass an object (ESM module with default) or even a Promise accidentally.
    if (typeof content === 'object' && !Array.isArray(content)) {
      // ESM module shape { default: 'markdown...' }
      if ('default' in content && typeof content.default === 'string') {
        content = content.default;
      } else if (typeof content.toString === 'function' && content.toString !== Object.prototype.toString) {
        content = content.toString();
      } else {
        // As a last resort, stringify keys for debugging instead of throwing.
        console.warn('[LessonContent] Non-string content passed to parseBlocks; keys:', Object.keys(content));
        content = JSON.stringify(content, null, 2);
      }
    }
    const text = Array.isArray(content) ? content.join('\n\n') : String(content);
    if (!text.trim()) return [];
    const rawBlocks = text.split(/\n\n+/);
    return rawBlocks;
  } catch (e) {
    console.error('[LessonContent] parseBlocks error:', e);
    return [];
  }
};

export const LessonContent = ({ content }) => {
  const allBlocks = parseBlocks(content);
  const keyPoints = extractKeyPoints(typeof content === 'string' ? content : (content && typeof content.default === 'string' ? content.default : String(content||'')));

  // Track last interactive (MCQ / ScenarioQuiz) identifier for gated rationale blocks
  let lastInteractiveId = null;

  return (
  <article className="space-y-8 prose-override-justify">
      {allBlocks.map((block, idx) => {
        // Trim leading/trailing spaces for pattern checks
        const raw = block.trim();

        // Interactive pattern: [[Objectives]] followed by list
        if (/^\[\[Objectives\]\]/i.test(raw)) {
          const lines = raw.split(/\n/).slice(1).filter(l=>/^[-*]/.test(l.trim()));
            const objectives = lines.map(l=> l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
          return <ObjectivesBlock key={idx} objectives={objectives} />;
        }
        // Intro: [[Intro]] single paragraph
        if (/^\[\[Intro\]\]/i.test(raw)) {
          const text = raw.split(/\n/).slice(1).join(' ').trim();
            if (text) return <IntroBlock key={idx} text={text} />;
        }
        // Process: [[Process: label=...]] lines Step :: Description
        if (/^\[\[Process/i.test(raw)) {
          const header = raw.split(/\n/)[0];
          const titleMatch = header.match(/\[\[Process(?::\s*label=)?([^\]]*)\]\]/i);
          const title = titleMatch && titleMatch[1] ? titleMatch[1].trim() : '';
          const steps = raw.split(/\n/).slice(1).filter(Boolean).map(l=>{
            const parts = l.split(/::/).map(s=>s.trim());
            return { name: parts[0] || l.trim(), desc: parts.slice(1).join(' :: ').trim() };
          }).filter(s=>s.name);
          if (steps.length) return <ProcessBlock key={idx} title={title} steps={steps} />;
        }
        // Diagram: [[Diagram: Title]] content on same or following lines
        if (/^\[\[Diagram/i.test(raw)) {
          const header = raw.split(/\n/)[0];
          const title = (header.match(/\[\[Diagram:?([^\]]*)\]\]/i)||[])[1]?.trim();
          const body = raw.split(/\n/).slice(1).join('\n');
          return <DiagramBlock key={idx}>{title ? `${title}\n${body}`.trim() : body.trim()}</DiagramBlock>;
        }
        // Example: [[Example: Title]] lines
        if (/^\[\[Example/i.test(raw)) {
          const header = raw.split(/\n/)[0];
          const title = (header.match(/\[\[Example:?([^\]]*)\]\]/i)||[])[1]?.trim();
          const body = raw.split(/\n/).slice(1).join('\n').trim();
          if (title && /rationale/i.test(title) && lastInteractiveId) {
            return <GatedRationaleBlock key={idx} body={body} target={lastInteractiveId} />;
          }
          return <ExampleBlock key={idx} title={title} body={body} />;
        }
        // DidYouKnow: [[DidYouKnow]]
        if (/^\[\[DidYouKnow\]\]/i.test(raw)) {
          const body = raw.split(/\n/).slice(1).join('\n').trim();
          return <DidYouKnowBlock key={idx} body={body} />;
        }
        // MCQ: [[MCQ: Question]] options separated by |
        if (/^\[\[MCQ:/i.test(raw)) {
          const header = raw.match(/^\[\[MCQ:(.+?)\]\]/i);
          const question = header?.[1]?.trim() || 'Question';
          const optionLine = raw.split(/\n/).slice(1).join(' ').trim();
          let options = [];
          if (optionLine.includes('|')) {
            options = optionLine.split('|').map(s=>s.replace(/\*+/g,'').trim()).filter(Boolean);
          }
          // Answer can be marked either by wrapping in *answer* or leading *answer (no trailing asterisk)
          let answerMatch = (optionLine.match(/\*([^|*]+)\*/)||[])[1]?.trim();
          if (!answerMatch) {
            const lead = optionLine.split('|').map(s=>s.trim())[0];
            if (/^\*/.test(lead)) answerMatch = lead.replace(/^\*/,'').trim();
          }
          lastInteractiveId = question;
          return <MCQBlock key={idx} question={question} options={options} answer={answerMatch} />;
        }
        // Quiz prompt: [[Quiz: Title]] question (either same line after marker or following lines)
        if (/^\[\[Quiz:/i.test(raw)) {
          const headerMatch = raw.match(/^\[\[Quiz:\s*([^\]]+)\]\]/i);
          const title = headerMatch?.[1]?.trim() || 'Quiz';
          const after = raw.replace(/^\[\[Quiz:[^\]]+\]\]/i,'').trim();
          let prompt = after;
          if (!prompt) {
            // look at subsequent lines if any
            const lines = raw.split(/\n/).slice(1).map(l=>l.trim()).filter(Boolean);
            prompt = lines.join(' ');
          }
          if (prompt) return <QuizPromptBlock key={idx} title={title} prompt={prompt} />;
        }
        // ScenarioQuiz: [[ScenarioQuiz: Title]] then lines: (narrative + optional Question:) then one line of options separated by |
        if (/^\[\[ScenarioQuiz:/i.test(raw)) {
          const header = raw.match(/^\[\[ScenarioQuiz:(.+?)\]\]/i);
          const title = header?.[1]?.trim() || 'Scenario';
          const lines = raw.split(/\n/).slice(1).filter(l=>l.trim());
          if (!lines.length) return <ScenarioQuizBlock key={idx} prompt={title} options={[]} answer={null} />;
          // Find the first line that looks like an option list (contains at least one pipe and creates >=2 segments)
          const optionIdx = lines.findIndex(l => l.includes('|') && l.split('|').length >= 2);
          if (optionIdx === -1) {
            // No options found; treat entire block as narrative prompt
            const narrative = lines.join(' ');
            const promptCombined = `${title}: ${narrative}`.trim();
            lastInteractiveId = promptCombined;
            return <ScenarioQuizBlock key={idx} prompt={promptCombined} options={[]} answer={null} />;
          }
            const narrativeLines = lines.slice(0, optionIdx);
            const optionLine = lines[optionIdx];
            const questionLineIndex = narrativeLines.findIndex(l=>/^Question:/i.test(l));
            let narrativeText = '';
            if (narrativeLines.length) {
              const narrativeOnly = narrativeLines.filter((_,i)=> i !== questionLineIndex);
              narrativeText = narrativeOnly.join(' ');
            }
            let questionText = '';
            if (questionLineIndex !== -1) {
              questionText = narrativeLines[questionLineIndex].replace(/^Question:\s*/i,'').trim();
            }
            const combinedPrompt = [title, narrativeText, questionText].filter(Boolean).join(' — ');
            const options = optionLine.split('|').map(s=>s.replace(/\*+/g,'').trim()).filter(Boolean);
            let answerMatch = (optionLine.match(/\*([^|*]+)\*/)||[])[1]?.trim();
            if (!answerMatch) {
              const lead = optionLine.split('|').map(s=>s.trim())[0];
              if (/^\*/.test(lead)) answerMatch = lead.replace(/^\*/,'').trim();
            }
            lastInteractiveId = combinedPrompt;
            return <ScenarioQuizBlock key={idx} prompt={combinedPrompt} options={options} answer={answerMatch} />;
        }
        // NextSteps: [[NextSteps]] single line
        if (/^\[\[NextSteps\]\]/i.test(raw)) {
          const text = raw.split(/\n/).slice(1).join(' ').trim();
          return <NextStepsBlock key={idx} text={text} />;
        }
        // Key Points bracket variant: [[Key Points]] list lines
        if (/^\[\[Key Points\]\]/i.test(raw)) {
          const pts = raw.split(/\n/).slice(1).map(l=>l.trim()).filter(Boolean);
          if (pts.length) return <KeyPointsBlock key={idx} points={pts} />;
        }
        // Reflection without colon: [[Reflection]] prompt
        if (/^\[\[Reflection\]\]/i.test(raw)) {
          const prompt = raw.split(/\n/).slice(1).join(' ').trim();
          if (prompt) return <ReflectionBlock key={idx} prompt={prompt} />;
        }
        // Flip cards: first line marker then lines: front | back
        if (/^\[\[FlipCards(?::[^\]]*)?\]\]/i.test(raw)) {
          const cards = raw.split(/\n/).slice(1)
            .map(l=>l.split('|').map(s=>s.trim()))
            .filter(p=>p.length>=2 && p[0] && p[1])
            .map(p=>({ front:p[0], back:p[1] }));
          if(cards.length) return <FlipCardDeck key={idx} cards={cards} />;
        }
        // Carousel: support either an HTML comment header or bracket shortcode, then lines for slides
        // Accepted formats for each line:
        // - Bullet or plain line with "**Title** — content" or "Title — content" (em dash or hyphen)
        // - Pipe-separated: "Title | content"
        if (/^<!--\s*Carousel\s*-->/i.test(raw) || /^\[\[Carousel(?::[^\]]*)?\]\]/i.test(raw)) {
          const lines = raw.split(/\n/).slice(1).filter(l=>l.trim());
          const candidates = lines.filter(l=>/^[-*]\s+/.test(l.trim())).map(l=>l.replace(/^[-*]\s+/, ''))
            .concat(lines.filter(l=>!/^[-*]\s+/.test(l.trim())));
          const slides = candidates.map((lineRaw)=>{
            const line = lineRaw.trim();
            // Try pipe format first
            if (line.includes('|')) {
              const parts = line.split('|').map(s=>s.trim());
              if (parts[0]) return { title: parts[0].replace(/^\*\*|\*\*$/g,'').replace(/^\*|\*$/g,'').trim(), content: (parts.slice(1).join(' | ').trim()) };
            }
            // Bold title with dash
            let m = line.match(/^\*\*([^*]+)\*\*\s*[—-]\s*(.+)$/);
            if (m) return { title: m[1].trim(), content: (m[2]||'').trim() };
            // Plain title with dash
            const partsDash = line.split(/\s+[—-]\s+/);
            if (partsDash.length >= 2) {
              const title = partsDash[0].replace(/^\*\*|\*\*$/g,'').replace(/^\*|\*$/g,'').trim();
              const content = partsDash.slice(1).join(' — ').trim();
              if (title) return { title, content };
            }
            // Fallback: treat whole line as title
            return line ? { title: line.replace(/^\*\*|\*\*$/g,'').replace(/^\*|\*$/g,'').trim(), content: '' } : null;
          }).filter(Boolean);
          if (slides.length) return <Carousel key={idx} slides={slides} />;
        }
        // Expandables: [[Expand]] lines Title :: Body
        if (/^\[\[Expandables?(?::[^\]]*)?\]\]/i.test(raw)) {
          const lines = raw.split(/\n/).slice(1).filter(l=>l.trim());
          const items = lines
            .map(l=>{
              let parts = l.split(/::/);
              if(parts.length<2) parts = l.split(/\|/); // fallback to pipe delimiter
              parts = parts.map(s=>s.trim());
              return parts;
            })
            .filter(p=>p.length>=2 && p[0] && p[1])
            .map(p=>({ title:p[0].replace(/^[-*]\s*/, ''), body:p.slice(1).join(' ').trim() }));
          if(items.length) return <ExpandableCardGroup key={idx} items={items} />;
        }
        // Drag order: [[DragOrder]] each bullet list item in correct order
        if (/^\[\[DragOrder\]\]/i.test(raw)) {
          const items = raw.split(/\n/).slice(1)
            .filter(l=>/^[-*]/.test(l.trim()))
            .map((l,i)=>({ label: l.replace(/^[-*]\s*/, '').trim(), expectedIndex:i }));
          if(items.length>1) return <DragOrderBlock key={idx} items={items} prompt="Arrange the correct processing order" />;
        }
        // Matching pairs: [[Match]] term :: definition
        if (/^\[\[Match(?::[^\]]*)?\]\]/i.test(raw)) {
          const pairs = raw.split(/\n/).slice(1)
            .map(l=> l.split(/::/).map(s=>s.trim()))
            .filter(p=>p.length>=2 && p[0] && p[1])
            .map(p=>({ a:p[0], b:p[1] }));
          if(pairs.length) return <MatchingPairs key={idx} pairs={pairs} />;
        }
        // Glossary: [[Glossary]] lines: Term :: Definition
        if (/^\[\[Glossary\]\]/i.test(raw)) {
          const terms = raw.split(/\n/).slice(1)
            .map(l=> l.split(/::/).map(s=>s.trim()))
            .filter(p=>p.length>=2 && p[0] && p[1])
            .map(p=>({ term: p[0], definition: p.slice(1).join(' :: ') }));
          if(terms.length) return <GlossaryBlock key={idx} terms={terms} />;
        }
        // Poll: [[Poll: Question]] then bullet list options
        if (/^\[\[Poll:/i.test(raw)) {
          const q = (raw.match(/^\[\[Poll:(.+?)\]\]/i)||[])[1]?.trim() || 'Poll';
          const options = raw.split(/\n/).slice(1).filter(l=>/^[-*]/.test(l.trim())).map(l=>l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
          if(options.length>=2) return <PollBlock key={idx} question={q} options={options} />;
        }
        // Reflection: [[Reflection: prompt text]]
        if (/^\[\[Reflection:/i.test(raw)) {
          const prompt = (raw.match(/^\[\[Reflection:(.+)\]\]/i)||[])[1]?.trim() || 'Reflect on this lesson';
          return <ReflectionBlock key={idx} prompt={prompt} />;
        }
        // Scenario: [[Scenario: Title]] body text after first line
        if (/^\[\[Scenario:/i.test(raw)) {
          const title = (raw.match(/^\[\[Scenario:(.+)\]\]/i)||[])[1]?.trim();
          const body = raw.split(/\n/).slice(1).join('\n');
          return <ScenarioBlock key={idx} title={title}><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{body}</ReactMarkdown></ScenarioBlock>;
        }
        // Icon list: [[Icons]] each line icon | title | text
        if (/^\[\[Icons\]\]/i.test(raw)) {
          const items = raw.split(/\n/).slice(1)
            .map(l=> l.split('|').map(s=>s.trim()))
            .filter(p=>p.length>=3)
            .map(p=>({ icon:p[0], title:p[1], text:p[2] }));
          if(items.length) return <IconList key={idx} items={items} />;
        }
        // Highlight box: [[Highlight: tone=amber title=Something]]\nContent
        if (/^\[\[Highlight:/i.test(raw)) {
          const header = raw.split(/\n/)[0];
          const toneMatch = header.match(/tone=(\w+)/i);
            const titleMatch = header.match(/title=([^\]]+)/i);
          const tone = toneMatch?.[1] || 'indigo';
          const title = titleMatch?.[1]?.trim();
          const body = raw.split(/\n/).slice(1).join('\n');
          return <HighlightBox key={idx} tone={tone} title={title}><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{body}</ReactMarkdown></HighlightBox>;
        }
        // Pitfalls: [[Pitfalls]] then bullet list and a line starting with Mitigation:
        if (/^\[\[Pitfalls\]\]/i.test(raw)) {
          const body = raw.split(/\n/).slice(1);
          const mitigationLineIndex = body.findIndex(l=>/^Mitigation:/i.test(l.trim()));
          let mitigationHtml = '';
          let listLines = body;
            if (mitigationLineIndex !== -1) {
              mitigationHtml = body[mitigationLineIndex].replace(/^Mitigation:\s*/i,'<strong>Mitigation:</strong> ');
              listLines = body.slice(0, mitigationLineIndex);
            }
          const items = listLines
            .filter(l=>/^[-*]/.test(l.trim()))
            .map(l=> l.replace(/^[-*]\s*/, '').trim())
            .filter(Boolean)
            .map(txt=> txt.replace(/\b(Alert fatigue|Assuming|Rule set stagnation|Ignoring)/i, m=>`<strong>${m}</strong>`));
          if(items.length) return <PitfallsBlock key={idx} items={items} mitigation={mitigationHtml} />;
        }
        if (/^\*\*Image:?\*\*/i.test(block)) {
          const body = block.replace(/^\*\*Image:?\*\*/i,'').trim();
            const parts = body.split('|').map(s=>s.trim());
            const first = parts[0] || '';
            let imgUrl = '';
            let m = first.match(/\[([^\]]+)\]\((https?:[^)]+)\)/);
            if (m) { imgUrl = m[2]; } else { const m2 = first.match(/\((https?:[^)]+)\)/); if (m2) imgUrl = m2[1]; }
            if (imgUrl) {
              const caption = (parts[1] || '').trim();
              let sourceUrl = '';
              const third = parts[2] || '';
              const sm = third.match(/\[([^\]]+)\]\((https?:[^)]+)\)/);
              if (sm) sourceUrl = sm[2];
              return <ImageCaptionBlock key={idx} src={imgUrl} caption={caption} source={sourceUrl} />;
            }
        }
        if (/^\*\*Video:?\*\*/i.test(block)) {
          let m = block.match(/\[([^\]]+)\]\((https?:[^)]+)\)/); if (m) return <VideoEmbedBlock key={idx} url={m[2]} />;
          m = block.match(/\((https?:[^)]+)\)/); if (m) return <VideoEmbedBlock key={idx} url={m[1]} />;
        }
        if (/^\*\*Diagram:?\*\*/i.test(block)) {
          const text = block.replace(/^\*\*Diagram:?\*\*/i,'').trim();
          return <DiagramBlock key={idx}>{text}</DiagramBlock>;
        }
        if (/^\*\*(Tip|Note|Warning):?\*\*/i.test(block)) {
          const kind = (block.match(/^\*\*(Tip|Note|Warning):?\*\*/i)||[])[1]?.toLowerCase() || 'note';
          const text = block.replace(/^\*\*(Tip|Note|Warning):?\*\*/i,'').trim();
          return <CalloutBlock key={idx} kind={kind}><ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown></CalloutBlock>;
        }
        if (/^\*\*Key Points:?\*\*/i.test(block)) {
          const lines = block.split('\n').slice(1).map(l=>l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
          return <KeyPointsBlock key={idx} points={lines} />;
        }
        return <SectionFallback key={idx} block={block} idx={idx} />;
      })}
      {keyPoints.length>0 && (
        <div className="max-w-md mx-auto text-justify">
          <KeyPointsBlock points={keyPoints} />
        </div>
      )}
    </article>
  );
};

export default LessonContent;
