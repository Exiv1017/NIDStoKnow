import React, { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
// Intro text block (added to satisfy imports expecting IntroTextBlock)ints helper used by multiple interactive/engagement blocks
function awardPoints(amount = 5, reason = 'interaction') {
  try {
    const key = 'lms:xp-points';
    const current = parseInt(localStorage.getItem(key) || '0', 10) || 0;
    const next = current + amount;
    localStorage.setItem(key, String(next));
    const histKey = 'lms:xp-history';
    const hist = JSON.parse(localStorage.getItem(histKey) || '[]');
    hist.push({ ts: Date.now(), amount, reason });
    localStorage.setItem(histKey, JSON.stringify(hist.slice(-100)));
    window.dispatchEvent(new CustomEvent('xp:updated', { detail: { points: next } }));
  } catch(e) {}
}

/*******************************************************
 * MEDIA HELPERS
 *******************************************************/
function normalizeVideoUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const qp = (name) => u.searchParams.get(name);
    const withoutParams = (base, paramsObj) => {
      const nu = new URL(base);
      Object.entries(paramsObj || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') nu.searchParams.set(k, String(v));
      });
      return nu.toString();
    };

    // Handle YouTube variants
    if (host.includes('youtube.com') || host.includes('youtu.be') || host.includes('youtube-nocookie.com')) {
      // Extract video id
      let id = '';
      if (host.includes('youtu.be')) {
        id = (u.pathname || '/').split('/')[1] || '';
      } else if (u.pathname.startsWith('/watch')) {
        id = qp('v') || '';
      } else if (u.pathname.startsWith('/embed/')) {
        id = (u.pathname.split('/')[2] || '').split('?')[0];
      }
      id = id.replace(/[^a-zA-Z0-9_-]/g, '');
      if (!id) return url; // fallback

      // Support start time via t or start
      let start = qp('start');
      const t = qp('t');
      if (!start && t) {
        // Convert formats like 1m30s or 90s or 90
        const m = String(t).match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?|(\d+)/);
        if (m) {
          const hrs = parseInt(m[1] || '0', 10) || 0;
          const mins = parseInt(m[2] || '0', 10) || 0;
          const secs = parseInt(m[3] || m[4] || '0', 10) || 0;
          start = String(hrs * 3600 + mins * 60 + secs);
        }
      }

      // Build a clean, privacy-enhanced embed URL (drop tracking params like "si")
      const base = `https://www.youtube-nocookie.com/embed/${id}`;
      const params = {
        rel: '0',
        modestbranding: '1',
        playsinline: '1',
      };
      if (start) params.start = start;
      const clean = withoutParams(base, params);
      return clean;
    }

    // Handle Vimeo
    if (host.includes('vimeo.com')) {
      // https://vimeo.com/VIDEO_ID -> https://player.vimeo.com/video/VIDEO_ID
      const parts = (u.pathname || '').split('/').filter(Boolean);
      const id = parts.find(p => /^(\d+)$/.test(p));
      if (id) return `https://player.vimeo.com/video/${id}`;
      // Already player domain? keep as-is
      if (host.includes('player.vimeo.com')) return url;
    }

    return url;
  } catch {
    return url;
  }
}

/*******************************************************
 * COURSE UI BLOCKS
 *******************************************************/
export const PointsTrackerBlock = () => {
  const [points, setPoints] = useState(0);
  useEffect(() => {
    try { setPoints(parseInt(localStorage.getItem('lms:xp-points') || '0', 10) || 0); } catch {}
    const h = (e) => setPoints(e.detail.points);
    window.addEventListener('xp:updated', h);
    return () => window.removeEventListener('xp:updated', h);
  }, []);
  return (
    <div className="my-4 p-4 rounded-xl bg-gradient-to-r from-[#1E5780] to-[#1E5780]/80 text-white shadow-lg flex items-center justify-between">
      <div>
        <div className="text-xs uppercase tracking-wide opacity-80">XP / Points</div>
        <div className="text-2xl font-bold">{points}</div>
      </div>
      <button onClick={() => awardPoints(1,'manual-boost')} className="text-xs px-3 py-1 bg-white/20 rounded hover:bg-white/30 transition-colors">+1</button>
    </div>
  );
};

/*******************************************************
 * CONTENT BLOCKS
 *******************************************************/
export const HighlightBox = ({ children, tone='indigo', title }) => {
  // Light mode only: neutral white surface with colored left border.
  const tones = {
    indigo:  { lightBorder:'border-l-[#1E5780]', icon:'text-[#1E5780]' },
    emerald: { lightBorder:'border-l-[#1E5780]',icon:'text-[#1E5780]' },
    amber:   { lightBorder:'border-l-amber-500',  icon:'text-amber-600' },
    rose:    { lightBorder:'border-l-rose-500',    icon:'text-rose-600' }
  };
  const set = tones[tone] || tones.indigo;
  return (
    <div className={`my-6 p-6 rounded-xl border border-[#E3E3E3] shadow-md bg-white ${set.lightBorder} border-l-4`}> 
      {title && <h4 className="font-semibold mb-3 text-black">{title}</h4>}
      <div className="text-black leading-relaxed text-sm">{children}</div>
    </div>
  );
};
export const QuoteBlock = ({ quote, cite }) => (
  <blockquote className="my-6 border-l-4 border-[#1E5780] pl-4 italic text-black bg-[#1E5780]/5 py-3 rounded-r">
    <p className="mb-2">“{quote}”</p>
    {cite && <cite className="not-italic text-sm font-medium text-[#1E5780]">— {cite}</cite>}
  </blockquote>
);
export const ImageOverlayBlock = ({ src, title, text }) => (
  <div className="relative my-6 group rounded-xl overflow-hidden shadow-lg">
    <img src={src} alt={title||text||'image'} className="w-full object-cover max-h-80" />
    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-90 group-hover:opacity-95 transition" />
    <div className="absolute bottom-0 p-5 text-white">
      {title && <div className="text-lg font-semibold mb-1">{title}</div>}
      <div className="text-sm opacity-90 leading-relaxed max-w-prose">{text}</div>
    </div>
  </div>
);
export const IconList = ({ items = [] }) => {
  const compact = Array.isArray(items) && items.length > 0 && items.every(it => !it.text || String(it.text).trim() === '');
  if (compact) {
    return (
      <ul className="grid sm:grid-cols-2 gap-5 my-6">
        {items.map((it, i) => (
          <li
            key={i}
            className="p-5 rounded-xl border border-[#E3E3E3] bg-white shadow-sm hover:shadow-md hover:border-[#1E5780]/40 transition-all flex items-center gap-4"
          >
            <div className="h-9 w-9 flex items-center justify-center rounded-full bg-[#1E5780]/10 text-[#1E5780] text-base leading-none shadow-inner select-none">
              {it.icon || '•'}
            </div>
            <div className="flex-1 text-[15px] font-semibold text-black leading-snug hyphens-none break-words">
              {it.title}
            </div>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="grid sm:grid-cols-2 gap-5 my-6">
      {items.map((it, i) => (
        <li
          key={i}
          className="group relative p-5 rounded-xl border border-[#E3E3E3] bg-white shadow-sm hover:shadow-md hover:border-[#1E5780]/50 transition-all flex items-start gap-4"
        >
          <div className="h-10 w-10 flex items-center justify-center rounded-full bg-[#1E5780]/10 text-[#1E5780] text-xl leading-none shadow-inner select-none">
            {it.icon || '🔹'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-black mb-1 leading-snug hyphens-none break-words" title={it.title}>
              {it.title}
            </div>
            <div className="text-black/80 text-sm leading-relaxed">
              {it.text}
            </div>
          </div>
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1E5780] opacity-0 group-hover:opacity-100 transition-opacity select-none" aria-hidden>
            ›
          </span>
        </li>
      ))}
    </ul>
  );
};
export const ContentBlock = ({ title, children }) => {
  const centerListForThis = typeof title === 'string' && /threats\s+happening\s+in\s+cyberspace/i.test(title);
  const base = "text-black text-[17px] leading-[1.75] space-y-6 prose prose-lg max-w-none [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:space-y-3 [&_li]:leading-[1.75] [&_li]:marker:text-[#1E5780]/70 [&_li>p]:text-left [&_table]:border-collapse [&_table]:w-full [&_th]:bg-[#E3E3E3]/30 [&_th]:border [&_th]:border-[#E3E3E3] [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:font-semibold [&_th]:text-[#1E5780] [&_td]:border [&_td]:border-[#E3E3E3] [&_td]:px-4 [&_td]:py-3 [&_td]:text-black [&_strong]:text-[#1E5780] [&_strong]:font-semibold [&_code]:bg-[#E3E3E3]/30 [&_code]:px-2 [&_code]:py-1 [&_code]:rounded [&_code]:text-black";
  const centerList = "[&_ul]:mx-auto [&_ul]:inline-block [&_ul]:text-left [&_ul]:ml-0 [&_ul]:pl-6 [&_ul]:list-none";
  return (
    <section className="my-16 mx-auto max-w-4xl">
      {title && (
        <h2 className="text-3xl font-bold text-[#1E5780] mb-8 tracking-tight leading-tight">
          {title}
        </h2>
      )}
      <div className={`${base} ${centerListForThis ? centerList : ''}`}>
        {children}
      </div>
    </section>
  );
};


// Intro text block (added to satisfy imports expecting IntroTextBlock)
export const IntroTextBlock = ({ children }) => (
  <div className="my-16 mx-auto max-w-4xl">
    <p className="text-[19px] leading-[1.8] font-normal text-black tracking-tight">
      {children}
    </p>
  </div>
);
export const CalloutBlock = ({ kind='note', children }) => {
  const styles = { 
    tip:{icon:'💡',wrap:'from-[#E3E3E3]/30 to-[#E3E3E3]/10 border-[#1E5780] text-[#1E5780]'}, 
    note:{icon:'📝',wrap:'from-[#E3E3E3]/30 to-[#E3E3E3]/10 border-[#1E5780] text-[#1E5780]'}, 
    warning:{icon:'⚠️',wrap:'from-[#E3E3E3]/30 to-[#E3E3E3]/10 border-[#1E5780] text-[#1E5780]'} 
  };
  const style = styles[kind] || styles.note;
  return (
    <div className={`my-6 p-5 bg-gradient-to-r border-l-4 rounded-xl shadow-md ${style.wrap}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">{style.icon}</span>
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  );
};
export const ImageCaptionBlock = ({ src, alt, caption, source }) => (
  <figure className="my-6">
    <img src={src} alt={alt||caption||'image'} className="rounded-lg shadow" />
    {(caption||source) && (
      <figcaption className="mt-2 text-xs text-black/60">
        {caption}
        {source ? (<><span>{caption? ' — ' : ''}</span><a href={source} target="_blank" rel="noreferrer" className="text-[#1E5780] hover:underline">Source</a></>) : null}
      </figcaption>) }
  </figure>
);
export const VideoEmbedBlock = ({ url }) => (
  <div className="my-6">
    <div className="aspect-video w-full rounded-xl overflow-hidden shadow">
      <iframe
        src={normalizeVideoUrl(url)}
        title="Lesson video"
        className="w-full h-full"
        frameBorder="0"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      ></iframe>
    </div>
  </div>
);
export const InfographicBlock = ({ src, caption }) => (
  <figure className="my-8 p-4 rounded-xl border border-[#E3E3E3] bg-gradient-to-br from-[#E3E3E3]/20 to-[#E3E3E3]/10 shadow-sm">
    {src && <img src={src} alt={caption||'infographic'} className="mx-auto max-h-96 object-contain rounded-lg shadow" />}
    {caption && <figcaption className="mt-3 text-center text-sm text-black/70">{caption}</figcaption>}
  </figure>
);

/*******************************************************
 * INTERACTIVE BLOCKS
 *******************************************************/
export const FlipCard = ({ front, back }) => {
  const [flipped, setFlipped] = useState(false);
  
  // Determine if content is long and needs smaller text
  const frontIsLong = front && front.length > 50;
  const backIsLong = back && back.length > 100;
  
  return (
    <div className="relative min-h-44 cursor-pointer [perspective:1000px]">
      <div 
        onClick={()=>{ setFlipped(f=>!f); awardPoints(1,'flip'); }} 
        className={`relative rounded-xl shadow-lg transition-transform duration-500 [transform-style:preserve-3d] ${flipped ? '[transform:rotateY(180deg)]':''}`}
      >
        {/* Front side */}
        <div className={`p-4 flex flex-col justify-center items-center bg-white border border-[#E3E3E3] rounded-xl hover:shadow-xl transition-shadow min-h-44 ${flipped ? '[backface-visibility:hidden]' : ''}`}>
          <div className={`font-semibold text-black text-center leading-tight break-words hyphens-auto max-w-full ${frontIsLong ? 'text-base' : 'text-lg'}`}>
            {front}
          </div>
          <div className="mt-3 text-xs text-black/60 bg-[#E3E3E3] px-3 py-1 rounded-full flex-shrink-0">Click to flip</div>
        </div>
        {/* Back side */}
        <div className={`absolute inset-0 p-4 flex flex-col justify-center items-center bg-[#1E5780] text-white rounded-xl shadow-xl min-h-44 [transform:rotateY(180deg)] ${flipped ? '' : '[backface-visibility:hidden]'}`}>
          <div className={`font-medium text-center leading-relaxed text-white break-words hyphens-auto max-w-full flex-grow flex items-center justify-center ${backIsLong ? 'text-xs' : 'text-sm'}`}>
            {back}
          </div>
          <div className="mt-3 text-[10px] opacity-75 bg-white/20 px-3 py-1 rounded-full text-white flex-shrink-0">Click to flip back</div>
        </div>
      </div>
    </div>
  );
};
export const FlipCardDeck = ({ cards=[] }) => <div className="my-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">{cards.map((c,i)=><FlipCard key={i} front={c.front} back={c.back} />)}</div>;
// Masonry-like two column layout so expanding one card doesn't vertically shift the other column's cards.
export const ExpandableCardGroup = ({ items=[] }) => {
  if (!items.length) return null;
  const isOdd = items.length % 2 === 1;
  const isSingle = items.length === 1;
  return (
    <div className={`my-8 grid gap-5 ${isSingle ? 'grid-cols-1 justify-items-center' : 'md:grid-cols-2'}`}>
      {items.map((it, i) => {
        const isLastSingle = isOdd && i === items.length - 1 && items.length > 1;
        const wrapClass = [
          isLastSingle ? 'md:col-span-2 md:justify-self-center md:w-[calc(50%-0.625rem)]' : '',
          isSingle ? 'w-full' : ''
        ].join(' ').trim();
        return (
          <div key={i} className={wrapClass}>
            <ExpandableCard title={it.title} body={it.body} />
          </div>
        );
      })}
    </div>
  );
};
export const ExpandableCard = ({ title, body }) => {
  const [open, setOpen] = useState(false);
  const toggle = () => {
    setOpen(o => !o);
    if (!open) awardPoints(1, 'expand');
  };
  return (
    <div className="border border-[#E3E3E3] rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden">
      <button
        onClick={toggle}
        className={`w-full flex items-center justify-between px-5 py-4 text-left font-semibold text-black transition-colors ${open ? 'bg-[#1E5780]/5 border-b border-[#1E5780]' : 'hover:bg-[#1E5780]/10'}`}
      >
        <span>{title}</span>
        <span className={`transition-transform duration-200 text-[#1E5780] ${open ? 'rotate-90' : ''}`}>›</span>
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm leading-relaxed bg-[#1E5780] text-white border-t-0">
          <div className="pt-4 hyphens-none break-words [&_a]:underline [&_a]:text-white hover:[&_a]:text-white/90 [&_strong]:text-white">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{body}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};
export const Carousel = ({ slides=[] }) => { 
  const [idx,setIdx]=useState(0); if(!slides.length) 
    return null; 
  const prev=()=>setIdx(i=>i===0?slides.length-1:i-1); 
  const next=()=>setIdx(i=>i===slides.length-1?0:i+1); 
  return (<div className="my-8 mx-auto max-w-md relative border border-[#1E5780] rounded-xl overflow-hidden bg-[#1E5780] shadow">
    <div className="px-12 py-6 pb-12 min-h-[140px]">
      <h4 className="font-semibold text-white mb-2 text-center">
        {slides[idx].title}
      </h4>
      <div className="text-white/90 text-sm leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {slides[idx].content}
        </ReactMarkdown>
      </div>
    </div>
    <button onClick={()=>{prev(); awardPoints(1,'carousel');}} aria-label="Previous"
      className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-[#1E5780] border border-white/70 rounded-full w-8 h-8 flex items-center justify-center shadow z-10 focus:outline-none focus:ring-2 focus:ring-white/70">
        ‹
    </button>
    <button onClick={()=>{next(); awardPoints(1,'carousel');}} aria-label="Next" className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-[#1E5780] border border-white/70 rounded-full w-8 h-8 flex items-center justify-center shadow z-10 focus:outline-none focus:ring-2 focus:ring-white/70">
      ›
    </button>
    <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">{slides.map((_,i)=><span key={i} onClick={()=>setIdx(i)} className={`w-2.5 h-2.5 rounded-full cursor-pointer transition-colors ${i===idx?'bg-white':'bg-white/40 hover:bg-white/60'}`} />)}</div></div>); };

// TimelineFancy (visual chronological list)
export const TimelineFancy = ({ events = [] }) => (
  <div className="my-10 relative pl-4">
    <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#1E5780]/50 via-[#1E5780]/70 to-[#1E5780]/90" />
    <ul className="space-y-6">
      {events.map((ev,i)=>(
        <li key={i} className="relative pl-6">
          <div className="absolute -left-0.5 top-1 w-3 h-3 rounded-full bg-gradient-to-br from-[#1E5780] to-[#1E5780]/80 border-2 border-white shadow" />
          <div className="text-xs font-semibold uppercase tracking-wide text-[#1E5780] mb-1">{ev.when}</div>
          <div className="font-semibold text-black mb-1">{ev.title}</div>
          <div className="text-black/70 text-sm leading-relaxed"><ReactMarkdown remarkPlugins={[remarkGfm]}>{ev.detail || ''}</ReactMarkdown></div>
        </li>
      ))}
    </ul>
  </div>
);
export const HotspotImage = ({ src, spots = [] }) => {
  const [active, setActive] = useState(null);
  const toggle = (i) => setActive(active === i ? null : i);
  return (
    <div className="my-8">
      <div className="relative inline-block max-w-full">
        <img src={src} alt="hotspot" className="rounded-xl shadow max-h-[420px] object-contain" />
        {spots.map((s, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            style={{ left: s.x + '%', top: s.y + '%' }}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#1E5780] text-white text-sm font-semibold shadow hover:scale-110 transition"
          >
            {i + 1}
          </button>
        ))}
        {active !== null && spots[active] && (
          <div className="absolute z-10 left-1/2 top-full mt-3 -translate-x-1/2 w-72 max-w-[90vw] bg-white border border-[#E3E3E3] rounded-xl shadow-lg p-4">
            <div className="flex justify-between items-start mb-1">
              <div className="font-semibold text-black">{spots[active].title || 'Detail'}</div>
              <button className="text-black/50 hover:text-black" onClick={() => setActive(null)}>✕</button>
            </div>
            <div className="text-black/70 text-sm leading-relaxed">{spots[active].content}</div>
          </div>
        )}
      </div>
    </div>
  );
};
export const DragOrderBlock = ({ items = [], prompt = 'Arrange in correct order' }) => {
  // Generate a deterministic id per item (label+expectedIndex) so React keys stay stable across shuffles and showAnswer toggles.
  const withIds = useMemo(() => items.map(it => ({ ...it, _id: `${it.label}-${it.expectedIndex}` })), [items]);
  const seed = () => withIds.slice().sort(() => Math.random() - 0.5);
  const [order, setOrder] = useState(seed);
  const [checked, setChecked] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  const onDragStart = (e, idx) => { e.dataTransfer.setData('text/plain', String(idx)); };
  const onDrop = (e, idx) => {
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (isNaN(from) || from === idx) return;
    setOrder(cur => {
      const next = [...cur];
      const [m] = next.splice(from, 1);
      next.splice(idx, 0, m);
      return next;
    });
  };
  const onCheck = () => {
    setChecked(true);
    const correct = order.every((o, i) => o.expectedIndex === i);
    awardPoints(correct ? 5 : 1, correct ? 'drag-order-correct' : 'drag-order-attempt');
  };
  const reset = () => { setOrder(seed()); setChecked(false); setShowAnswer(false); };

  const correct = order.every((o, i) => o.expectedIndex === i);

    return (
  <div className="my-10 p-6 rounded-2xl border border-[#E3E3E3] bg-white shadow-lg">
      <div className="flex items-start justify-between mb-4">
        <div>
            <div className="font-semibold text-[#1E5780] mb-2 flex items-center gap-2 text-lg"><span>🧩</span>{prompt}</div>
            <div className="text-xs text-black/70">Drag items until the sequence reflects the correct pipeline.</div>
        </div>
        <div className="flex gap-2">
            <button onClick={reset} className="px-3 py-2 rounded-lg border border-[#E3E3E3] text-xs bg-[#E3E3E3]/30 hover:bg-[#E3E3E3]/50 text-black transition-colors">Reset</button>
            <button onClick={()=>setShowAnswer(s=>!s)} className="px-3 py-2 rounded-lg border border-[#E3E3E3] text-xs bg-[#E3E3E3]/30 hover:bg-[#E3E3E3]/50 text-black transition-colors">{showAnswer?'Hide':'Show'} Answer</button>
        </div>
      </div>
      <ul className="space-y-3" role="list">
        {(showAnswer ? withIds : order).map((o, i) => (
          <li
            key={o._id}
            draggable={!showAnswer}
            onDragStart={(e) => !showAnswer && onDragStart(e, i)}
            onDragOver={(e) => !showAnswer && e.preventDefault()}
            onDrop={(e) => !showAnswer && onDrop(e, i)}
              className={`px-4 py-3 rounded-lg border text-sm flex items-center gap-4 bg-white border-[#E3E3E3] hover:border-[#1E5780] hover:bg-[#E3E3E3]/20 cursor-${showAnswer?'default':'move'} transition-all ${checked && !showAnswer && o.expectedIndex === i ? '!bg-green-50 !border-green-400' : ''}`}
            aria-label={`Step ${i+1}: ${o.label}`}
          >
              <span className="w-7 h-7 flex items-center justify-center rounded-full bg-[#1E5780] text-white text-xs font-semibold shadow-sm">{i + 1}</span>
              <span className="flex-1 font-medium text-black">{o.label}</span>
              {!showAnswer && <span className="text-black/50 text-sm">↕</span>}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center gap-4">
          <button onClick={onCheck} className="px-5 py-2 rounded-lg bg-[#1E5780] hover:bg-[#1E5780]/90 text-white text-sm font-medium shadow-md disabled:opacity-50 transition-colors" disabled={showAnswer}>Check</button>
        {checked && !showAnswer && (
            <span className={`text-sm font-medium ${correct ? 'text-[#1E5780]':'text-black/70'}`}>{correct ? 'Correct order! ✅':'Not correct yet.'}</span>
        )}
      </div>
    </div>
  );
};
export const MatchingPairs = ({ pairs = [] }) => {
  const seed = () => pairs.map((p, i) => ({ i, text: p.b })).sort(() => Math.random() - 0.5);
  const [left] = useState(() => pairs.map((p, i) => ({ i, text: p.a })));
  const [right, setRight] = useState(seed);
  const [selLeft, setSelLeft] = useState(null);
  const [matches, setMatches] = useState([]);
  const [attempts, setAttempts] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const reset = () => { setRight(seed()); setSelLeft(null); setMatches([]); setAttempts(0); setShowAnswer(false); };

  const selectLeft = (i) => setSelLeft(i === selLeft ? null : i);
  const selectRight = (idx) => {
    if (selLeft === null || showAnswer) return;
    setAttempts(a => a + 1);
    const lItem = left[selLeft];
    const rItem = right[idx];
    if (lItem.i === rItem.i) {
      setMatches(m => [...m, lItem.i]);
      awardPoints(2, 'match-correct');
    } else {
      awardPoints(0, 'match-wrong');
    }
    setSelLeft(null);
  };

  const complete = matches.length === pairs.length && pairs.length > 0;

  return (
    <div className="my-12 p-6 rounded-2xl border border-[#E3E3E3] bg-white shadow-lg">
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="font-semibold text-[#1E5780] flex items-center gap-2 mb-2 text-lg"><span>🧠</span>Match the Pairs</div>
          <div className="text-xs text-black/70">Select a term then its correct definition.</div>
        </div>
        <div className="flex gap-2">
          <button onClick={reset} className="px-3 py-2 rounded-lg border border-[#E3E3E3] text-xs bg-[#E3E3E3]/30 hover:bg-[#E3E3E3]/50 text-black transition-colors">Reset</button>
          <button onClick={()=>setShowAnswer(s=>!s)} className="px-3 py-2 rounded-lg border border-[#E3E3E3] text-xs bg-[#E3E3E3]/30 hover:bg-[#E3E3E3]/50 text-black transition-colors">{showAnswer?'Hide':'Show'} Answer</button>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <ul className="space-y-3" role="list">
          {left.map((l, i) => (
            <li key={i}>
              <button
                onClick={() => selectLeft(i)}
                disabled={showAnswer || matches.includes(l.i)}
                className={`w-full text-left px-4 py-3 rounded-lg border text-sm font-medium transition-all ${matches.includes(l.i)? '!bg-green-50 !border-green-400 text-green-700':''} ${selLeft === i ? 'border-[#1E5780] bg-[#1E5780]/5':'border-[#E3E3E3] bg-white hover:border-[#1E5780]'}`}
              >
                {l.text}
              </button>
            </li>
          ))}
        </ul>
        <ul className="space-y-3" role="list">
          {(showAnswer ? pairs.map(p=>({ i:p.i, text:p.b })) : right).map((r, i) => (
            <li key={i}>
              <button
                onClick={() => selectRight(i)}
                disabled={showAnswer || matches.includes(r.i)}
                className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${matches.includes(r.i)? '!bg-green-50 !border-green-400 text-green-700':'border-[#E3E3E3] bg-white hover:border-[#1E5780]'}`}
              >
                {r.text}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-6 text-xs flex items-center gap-4 text-black/70">
        <span>Attempts: <strong>{attempts}</strong></span>
        <span>Matched: <strong>{matches.length}/{pairs.length}</strong></span>
        {complete && <span className="text-green-600 font-medium text-sm">All matched! 🎉</span>}
      </div>
    </div>
  );
};

// Pitfalls block: styled list plus mitigation message
export const PitfallsBlock = ({ items = [], mitigation }) => (
  <div className="my-10 rounded-2xl border border-[#E3E3E3] bg-white px-6 py-7 shadow-sm">
    <div className="flex items-center gap-3 mb-5">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 font-semibold text-base shadow-inner">⚠️</span>
      <h4 className="m-0 text-lg font-semibold tracking-tight text-black">Common Pitfalls</h4>
    </div>
    <ul className="space-y-2.5 text-[15px] leading-relaxed text-black pl-5 list-disc marker:text-amber-500">
      {items.map((it,i)=>(<li key={i} className="[&_strong]:text-black font-medium" dangerouslySetInnerHTML={{ __html: it }} />))}
    </ul>
    {mitigation && (
      <div className="mt-6 text-sm bg-[#E3E3E3]/30 border border-[#E3E3E3] rounded-xl p-4 flex items-start gap-3 shadow-sm">
        <div className="text-amber-500 text-lg leading-none">🛠</div>
        <div className="text-black" dangerouslySetInnerHTML={{ __html: mitigation }} />
      </div>
    )}
  </div>
);
export const FillBlank = ({ text, answer }) => {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const correct = submitted && value.trim().toLowerCase() === String(answer).trim().toLowerCase();

  const onSubmit = () => {
    setSubmitted(true);
    awardPoints(value.trim().toLowerCase() === String(answer).toLowerCase() ? 3 : 1, 'fill-blank');
  };

  return (
    <div className="my-6 p-5 rounded-xl bg-gradient-to-br from-sky-50 to-sky-100 border border-sky-200">
      <div className="text-black mb-3 text-sm leading-relaxed">{text.replace('____', '____')}</div>
      <div className="flex items-center gap-3">
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          disabled={submitted}
          className="px-3 py-1.5 rounded border border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm"
          placeholder="Type answer"
        />
        {!submitted && (
          <button
            onClick={onSubmit}
            disabled={!value.trim()}
            className="px-4 py-1.5 rounded bg-sky-600 text-white text-sm disabled:opacity-40"
          >
            Check
          </button>
        )}
      </div>
      {submitted && (
        <div className={`mt-3 text-sm font-medium ${correct ? 'text-green-700' : 'text-red-600'}`}>
          {correct ? 'Correct ✅' : `Answer: ${answer}`}
        </div>
      )}
    </div>
  );
};
export const HoverRevealBlock = ({ items = [] }) => (
  <div className="my-8 grid md:grid-cols-2 gap-4">
    {items.map((it, i) => (
      <div
        key={i}
        className="relative group p-4 border rounded-xl bg-white shadow-sm overflow-hidden"
      >
        <div className="font-semibold text-black mb-1">{it.title}</div>
        <div className="text-sm text-black/70 line-clamp-2 group-hover:opacity-0 transition-opacity duration-300">Hover to reveal more…</div>
        <div className="absolute inset-0 p-4 flex items-center justify-center text-sm text-white bg-[#1E5780]/95 opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-center leading-relaxed">
          {it.detail}
        </div>
      </div>
    ))}
  </div>
);
export const TabsBlock = ({ items=[] }) => { const [active,setActive]=useState(0); if(!items.length) return null; return (<div className="my-6 bg-white rounded-xl border border-[#E3E3E3] shadow-sm"><div className="flex flex-wrap border-b border-[#E3E3E3]">{items.map((it,i)=>(<button key={i} onClick={()=>setActive(i)} className={`px-4 py-2 text-sm font-medium transition-colors ${i===active?'text-[#1E5780] border-b-2 border-[#1E5780]':'text-black/70 hover:text-[#1E5780]'}`}>{it.label}</button>))}</div><div className="p-4 text-black leading-relaxed"><ReactMarkdown remarkPlugins={[remarkGfm]}>{items[active]?.content||''}</ReactMarkdown></div></div>); };
export const StepperBlock = ({ steps=[] }) => (<div className="my-6"><ol className="relative border-l-2 border-blue-200 ml-3">{steps.map((s,i)=>(<li key={i} className="mb-6 ml-4"><div className="absolute -left-3 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow">{i+1}</div><h4 className="text-blue-800 font-semibold">{s.title}</h4><div className="text-gray-700"><ReactMarkdown remarkPlugins={[remarkGfm]}>{s.detail}</ReactMarkdown></div></li>))}</ol></div>);
export const WatchBlock = ({ url }) => (<div className="my-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-500 rounded-lg shadow-sm"><div className="flex items-center gap-2 mb-2"><span className="text-2xl">🎬</span><span className="font-semibold text-blue-800">Watch & Learn</span></div><a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline hover:text-blue-900">Click here to watch a short video introduction</a></div>);
export const TryItBlock = ({ children }) => { const [open,setOpen]=useState(false); return (<div className="my-4"><button className="flex items-center gap-2 font-semibold text-yellow-800 bg-gradient-to-r from-yellow-100 to-yellow-200 px-4 py-2 rounded-lg hover:from-yellow-200 hover:to-yellow-300" onClick={()=>setOpen(o=>!o)}><span className="text-xl">💡</span> Try it {open ? '▲':'▼'}</button>{open && (<div className="mt-3 p-4 bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-yellow-500 rounded-lg">{children}</div>)}</div>); };
export const DiagramBlock = ({ children, title = 'Process Flow' }) => {
  const toText = (node) => {
    if (typeof node === 'string') return node;
    if (!node || !node.props) return '';
    const kids = React.Children.toArray(node.props.children);
    return kids.map(toText).join('\n');
  };
  const raw = React.Children.toArray(children).map(toText).join('\n');
  const lines = raw.split(/\r?\n/).map(l => l.trimEnd());

  // Find the primary boxes line [A] → [B] → [C]
  const boxesLineIdx = lines.findIndex(l => /\[[^\]]+\]/.test(l));
  const extractBoxes = (s) => Array.from(s.matchAll(/\[([^\]]+)\]/g)).map(m => m[1].trim());
  const boxes = boxesLineIdx >= 0 ? extractBoxes(lines[boxesLineIdx]) : [];

  // Extract optional Operational flow: ... line
  const flowLineIdx = lines.findIndex(l => /Operational\s+flow:/i.test(l));
  const flowSteps = flowLineIdx >= 0 ? lines[flowLineIdx].split(/Operational\s+flow:/i)[1].trim() : '';
  const flowParts = flowSteps ? flowSteps.split(/\s*→\s*/).map(s => s.trim()).filter(Boolean) : [];

  // Collect columns of bullets under each box (next few lines after a pipe divider)
  let columns = [];
  if (boxesLineIdx >= 0) {
    // Find an optional divider line made of pipes (|)
    let r = boxesLineIdx + 1;
    if (r < lines.length && /^\s*\|(\s*\|)+\s*$/.test(lines[r])) {
      r += 1;
    } else {
      // Skip any empty/whitespace-only lines
      while (r < lines.length && /^\s*$/.test(lines[r])) r++;
    }
    const rows = [];
    while (r < lines.length) {
      const ln = lines[r].trim();
      if (!ln || /Operational\s+flow:/i.test(ln)) break;
      // Split on 1+ tabs OR 2+ spaces to approximate columns
      const parts = ln.split(/(?:\t+|\s{2,})/).map(s => s.trim()).filter(Boolean);
      if (!parts.length) break;
      rows.push(parts);
      r++;
    }
    // Build column arrays
    columns = Array.from({ length: boxes.length }, () => []);
    rows.forEach(parts => {
      for (let i = 0; i < boxes.length; i++) {
        const val = parts[i] || '';
        if (val) columns[i].push(val);
      }
    });
  }

  const canVisualize = boxes.length > 0 && columns.length === boxes.length && columns.some(col => col.length);

  if (!canVisualize) {
    // Fallback to original ASCII render
    return (
      <div className="my-20 mx-auto max-w-4xl">
        <div className="text-gray-600 text-sm font-medium mb-4 uppercase tracking-wider">{title}</div>
        <div className="bg-[#E3E3E3]/30 border border-[#E3E3E3] rounded-lg p-8">
          <pre className="font-mono text-[14px] whitespace-pre-wrap text-black leading-7 overflow-x-auto">{raw}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="my-20 mx-auto max-w-5xl">
      <div className="text-black/70 text-sm font-medium mb-4 uppercase tracking-wider">{title}</div>
      <div className="relative rounded-2xl border border-[#E3E3E3] bg-white p-6 md:p-8 shadow-lg overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="flex flex-col md:flex-row md:items-stretch gap-6 md:gap-8">
            {boxes.map((label, i) => (
              <React.Fragment key={i}>
                <div className="flex-1 min-w-[160px]">
                  <div className="rounded-xl border border-[#E3E3E3] bg-gradient-to-b from-[#E3E3E3]/20 to-white p-4 text-center font-semibold text-[#1E5780] shadow-md">
                    {label}
                  </div>
                  {columns[i] && columns[i].length > 0 && (
                    <ul className="mt-4 text-sm text-black space-y-1 list-disc ml-5">
                      {columns[i].map((it, j) => (
                        <li key={j}>{it}</li>
                      ))}
                    </ul>
                  )}
                </div>
                {i < boxes.length - 1 && (
                  <div className="hidden md:flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#1E5780]">
                      <path d="M5 12h12m0 0-4-4m4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {flowParts.length > 0 && (
        <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
          {flowParts.map((step, idx) => (
            <React.Fragment key={idx}>
              <span className="px-3 py-1 rounded-full border border-[#E3E3E3] bg-[#E3E3E3]/30 text-black text-xs font-medium">
                {step}
              </span>
              {idx < flowParts.length - 1 && <span className="text-gray-400">→</span>}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
export const ExampleBlock = ({ children, title="Real-World Example" }) => (
  <div className="my-6 p-6 bg-gradient-to-r from-[#E3E3E3]/20 to-[#E3E3E3]/10 border border-[#E3E3E3] rounded-xl shadow-sm">
    <div className="flex items-center gap-3 mb-4">
      <span className="text-2xl">💼</span>
      <span className="font-semibold text-[#1E5780] text-lg">{title}</span>
    </div>
    <div className="text-black leading-relaxed prose prose-lg max-w-none [&_code]:bg-[#E3E3E3]/30 [&_code]:px-2 [&_code]:py-1 [&_code]:rounded [&_code]:text-black [&_strong]:text-[#1E5780] [&_strong]:font-semibold">
      {children}
    </div>
  </div>
);
export const InteractiveBlock = ({ children, title="Interactive Content" }) => { 
  const [open,setOpen]=useState(false); 
  return (
    <div className="my-6">
      <button 
        className="flex items-center gap-3 font-semibold text-[#1E5780] bg-gradient-to-r from-[#E3E3E3]/30 to-[#E3E3E3]/20 px-6 py-3 rounded-lg hover:from-[#E3E3E3]/40 hover:to-[#E3E3E3]/30 border border-[#E3E3E3] transition-all duration-200" 
        onClick={()=>setOpen(o=>!o)}
      >
        <span className="text-xl">⚡</span> 
        {title} {open? '▲':'▼'}
      </button>
      {open && (
        <div className="mt-4 p-6 bg-gradient-to-r from-[#E3E3E3]/10 to-white border-l-4 border-[#1E5780] rounded-lg shadow-sm">
          <div className="text-black leading-relaxed">
            {children}
          </div>
        </div>
      )}
    </div>
  ); 
};

/*******************************************************
 * CASE STUDY / SCENARIO BLOCKS
 *******************************************************/
export const ScenarioBlock = ({ title, children }) => (
  <div className="my-16 mx-auto max-w-4xl">
    <div className="rounded-2xl p-8 shadow-sm border border-[#E3E3E3] bg-white">
      <div className="text-[11px] uppercase tracking-wider font-semibold mb-3 text-black/70">Case Study</div>
      {title && (
        <h3 className="text-2xl font-semibold mb-6 tracking-tight text-black">
          {title}
        </h3>
      )}
      <div className="prose prose-slate max-w-none text-[17px] leading-[1.7] text-black space-y-5 [&_ul]:list-disc [&_ul]:ml-6 [&_li]:marker:text-black/50">
        {children}
      </div>
    </div>
  </div>
);
export const PersonaCard = ({ name, role, goals, pains }) => (<div className="my-6 p-5 rounded-xl border border-[#E3E3E3] bg-white shadow-sm"><div className="font-semibold text-black mb-1">{name}</div><div className="text-xs text-black/70 mb-3 uppercase tracking-wide">{role}</div><div className="grid sm:grid-cols-2 gap-4 text-sm"><div><div className="font-medium text-[#1E5780] mb-1">Goals</div><ul className="list-disc ml-5 space-y-1 text-black/70">{(goals||[]).map((g,i)=><li key={i}>{g}</li>)}</ul></div><div><div className="font-medium text-[#1E5780] mb-1">Pain Points</div><ul className="list-disc ml-5 space-y-1 text-black/70">{(pains||[]).map((g,i)=><li key={i}>{g}</li>)}</ul></div></div></div>);
export const CaseStudySection = ({ variant='background', title, children }) => { 
  const styles={
    background:'from-[#E3E3E3]/30 to-[#E3E3E3]/10 border-[#E3E3E3] text-black', 
    issues:'from-[#E3E3E3]/40 to-[#E3E3E3]/20 border-[#1E5780] text-black', 
    solution:'from-[#E3E3E3]/20 to-white border-[#1E5780] text-black', 
    results:'from-[#E3E3E3]/30 to-[#E3E3E3]/10 border-[#1E5780] text-black', 
    narrative:'from-[#E3E3E3]/20 to-white border-[#1E5780] text-black'
  }; 
  const cls=styles[variant]||styles.background; 
  const label={
    background:'Background', 
    issues:'Issues / Challenges', 
    solution:'New Way of Working', 
    results:'Results / Outcome', 
    narrative:'Scenario Narrative'
  }[variant]||'Case Study'; 
  return (
    <div className={`my-8 p-6 rounded-2xl border bg-gradient-to-br ${cls} shadow-sm`}>
      <div className="text-xs uppercase tracking-wide font-semibold opacity-70 mb-2">{label}</div>
      {title && <h4 className="font-semibold text-lg mb-3">{title}</h4>}
      <div className="text-sm leading-relaxed whitespace-pre-line">{children}</div>
    </div>
  ); 
};

/*******************************************************
 * ASSESSMENT & KNOWLEDGE CHECK BLOCKS
 *******************************************************/
export const MCQInline = ({ children }) => { const raw=Array.isArray(children)? children.map(c=>String(c)).join('\n'): String(children); const lines=raw.split(/\n+/).map(l=>l.trim()).filter(Boolean); if(!lines.length) return null; const question=lines.shift(); const options=lines.map(l=> l.replace(/^\*/, '').trim()); let answerIndex=lines.findIndex(l=>/^\*/.test(l)); if(answerIndex<0) answerIndex=0; const [sel,setSel]=useState(null); const [show,setShow]=useState(false); return (<div className="my-6 p-5 rounded-xl border bg-white shadow-sm"><div className="font-semibold text-indigo-700 mb-2 flex items-center gap-2"><span>📝</span><span>{question}</span></div><ul className="space-y-2 mb-3">{options.map((o,i)=>(<li key={i}><button disabled={show} onClick={()=>setSel(i)} className={`w-full text-left text-sm px-3 py-2 rounded border transition ${sel===i&&!show?'border-indigo-500 bg-indigo-50':'border-slate-200 hover:bg-slate-50'} ${show && i===answerIndex?'!bg-green-50 !border-green-400':''} ${show && sel===i && i!==answerIndex?'!bg-red-50 !border-red-300':''}`}>{o}</button></li>))}</ul>{!show ? (<button disabled={sel===null} onClick={()=>setShow(true)} className="px-4 py-1.5 rounded bg-indigo-600 text-white text-sm disabled:opacity-50">Check</button>) : (<div className={`text-sm font-medium ${sel===answerIndex?'text-green-700':'text-red-600'}`}>{sel===answerIndex? 'Correct ✅' : `Answer: ${options[answerIndex]}`}</div>)}</div>); };
export const TrueFalseInline = ({ statement, answer='true' }) => { const correct=/^true$/i.test(String(answer)); const [sel,setSel]=useState(null); const [show,setShow]=useState(false); return (<div className="my-6 p-5 rounded-xl border bg-white shadow-sm"><div className="font-semibold text-indigo-700 mb-3 flex items-center gap-2"><span>✔️</span><span>{statement}</span></div><div className="flex gap-2 mb-3">{['True','False'].map((lbl,i)=>(<button key={i} disabled={show} onClick={()=>setSel(i===0)} className={`px-4 py-1.5 rounded border text-sm ${sel===(i===0)&&!show?'border-indigo-500 bg-indigo-50':'border-slate-200 hover:bg-slate-50'} ${show && ((i===0)===correct)?'!bg-green-50 !border-green-400':''} ${show && sel===(i===0) && ((i===0)!==correct)?'!bg-red-50 !border-red-300':''}`}>{lbl}</button>))}</div>{!show ? (<button disabled={sel===null} onClick={()=>setShow(true)} className="px-4 py-1.5 rounded bg-indigo-600 text-white text-sm disabled:opacity-50">Check</button>) : (<div className={`text-sm font-medium ${sel===correct?'text-green-700':'text-red-600'}`}>{sel===correct? 'Correct ✅' : `Answer: ${correct ? 'True':'False'}`}</div>)}</div>); };
export const ProgressQuizBlock = ({ questions=[] }) => { const qs=questions.length? questions : [{ q:'Quick check: IDS stands for?', options:['Intrusion Detection System','Internet Data Stream','Internal Domain Service'], ans:0 }]; const [answers,setAnswers]=useState(Array(qs.length).fill(null)); const [submitted,setSubmitted]=useState(false); const correctCount=answers.reduce((s,a,i)=> s+(a===qs[i].ans?1:0),0); const handleSubmit=()=>{ if(answers.some(a=>a===null)) return; setSubmitted(true);}; return (<div className="my-8 p-5 rounded-xl border bg-white shadow-sm"><div className="flex items-center gap-2 mb-3 font-semibold text-indigo-700"><span>🧪</span><span>Progress Quiz</span></div>{qs.map((qq,i)=>(<div key={i} className="mb-4"><div className="font-medium text-sm mb-2">{i+1}. {qq.q}</div><div className="space-y-1">{qq.options.map((opt,oi)=>{ const chosen=answers[i]===oi; const showCorrect=submitted && oi===qq.ans; const wrong=submitted && chosen && oi!==qq.ans; return (<button key={oi} disabled={submitted} onClick={()=>setAnswers(a=>{ const c=[...a]; c[i]=oi; return c; })} className={`w-full text-left text-sm px-3 py-1.5 rounded border transition ${chosen? 'border-indigo-500 bg-indigo-50':'border-slate-200 hover:bg-slate-50'} ${showCorrect?'!bg-green-50 !border-green-400':''} ${wrong?'!bg-red-50 !border-red-300':''}`}>{opt}</button>); })}</div></div>))}{!submitted ? (<div className="flex justify-between items-center"><div className="text-xs text-slate-500">Answered {answers.filter(a=>a!==null).length}/{qs.length}</div><button disabled={answers.some(a=>a===null)} onClick={handleSubmit} className="px-4 py-1.5 rounded bg-indigo-600 text-white text-sm disabled:opacity-50">Check</button></div>) : (<div className={`mt-2 text-sm font-medium ${correctCount===qs.length? 'text-green-700':'text-indigo-700'}`}>Score: {correctCount}/{qs.length}</div>)}</div>); };
export const MCQuizBlock = ({ question, children }) => { const raw=Array.isArray(children)? children.map(c=>String(c)).join('\n'): String(children||''); const options=raw.split(/\n+/).map(l=>l.trim()).filter(Boolean).map(l=>{ const m=l.match(/^[-*]\s*\[(x|X| )\]\s*(.+)$/); if(m) return { text:m[2].trim(), correct:/x/i.test(m[1]) }; return null; }).filter(Boolean); const [selected,setSelected]=useState(null); const [submitted,setSubmitted]=useState(false); const correctIndex=options.findIndex(o=>o.correct); const onSelect=i=>{ if(!submitted) setSelected(i); }; const onSubmit=()=>{ if(selected==null) return; setSubmitted(true); awardPoints(selected===correctIndex?5:1, selected===correctIndex?'mc-quiz-correct':'mc-quiz-attempt'); }; return (<div className="my-8 p-6 rounded-xl border bg-white shadow-sm">{question && <h4 className="font-semibold text-slate-800 mb-4 text-sm">{question}</h4>}<ul className="space-y-2 mb-4">{options.map((o,i)=>(<li key={i}><button onClick={()=>onSelect(i)} disabled={submitted} className={`w-full text-left text-sm px-3 py-2 rounded-md border transition ${selected===i? 'border-indigo-500 bg-indigo-50':'border-slate-200 hover:border-indigo-300'} ${submitted && i===correctIndex? '!bg-green-50 !border-green-500':''} ${submitted && selected===i && i!==correctIndex? '!bg-red-50 !border-red-400':''}`}>{o.text}</button></li>))}</ul>{!submitted ? (<button onClick={onSubmit} disabled={selected==null} className="px-4 py-1.5 rounded bg-indigo-600 text-white text-sm disabled:opacity-50">Submit</button>) : (<div className={`text-sm font-medium ${selected===correctIndex? 'text-green-700':'text-red-700'}`}>{selected===correctIndex? 'Correct! ✅':'Not quite. Review and continue.'}</div>)}</div>); };
export const QuizBlock = ({ question }) => { const [answer,setAnswer]=useState(''); const [submitted,setSubmitted]=useState(false); return (<div className="my-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-lg"><div className="flex items-center gap-2 mb-3"><span className="text-2xl">🧠</span><span className="font-semibold text-green-800">Knowledge Check</span></div><div className="text-gray-800 font-medium mb-2">{question}</div><div className="flex gap-2"><input className="border rounded px-2 py-1" value={answer} onChange={e=>setAnswer(e.target.value)} disabled={submitted} placeholder="Type answer" /><button className="px-3 py-1.5 bg-green-600 text-white rounded disabled:opacity-50" disabled={submitted || !answer.trim()} onClick={()=>setSubmitted(true)}>{submitted?'Submitted':'Submit'}</button></div></div>); };
export const FinalAssessmentBlock = ({ children, title='Final Assessment' }) => (<div className="my-10 p-8 rounded-2xl border-2 border-indigo-300 bg-gradient-to-br from-white to-indigo-50 shadow"><h3 className="text-xl font-bold text-indigo-700 mb-4 flex items-center gap-2"><span>🎓</span>{title}</h3><div className="text-sm text-gray-700 leading-relaxed space-y-4">{children || 'Complete all module quizzes to unlock the final assessment.'}</div></div>);
export const KeyPointsBlock = ({ points=[] }) => { if(!Array.isArray(points)||!points.length) return null; return (<div className="my-8 mx-auto w-full max-w-xl p-6 rounded-2xl bg-gradient-to-br from-indigo-50 to-sky-50 border border-indigo-200 shadow-sm"><div className="flex items-center gap-2 mb-4"><h4 className="font-semibold tracking-wide text-indigo-800 text-sm uppercase">Key Points</h4></div><ul className="space-y-2 list-disc ml-5 text-[15px] leading-relaxed text-gray-800">{points.map((p,i)=>(<li key={i}>{p}</li>))}</ul></div>); };

/*******************************************************
 * ENGAGEMENT BLOCKS
 *******************************************************/
export const ReflectionBlock = ({ prompt }) => {
  const key = 'lms:reflection:' + (prompt.slice(0,40).toLowerCase().replace(/[^a-z0-9]+/g,'-'));
  const [text,setText] = useState('');
  const [saved,setSaved] = useState(false);
  useEffect(()=>{ try { setText(localStorage.getItem(key)||''); } catch {}},[key]);
  const save = () => {
    try {
      localStorage.setItem(key,text);
      awardPoints(2,'reflection');
      setSaved(true);
      setTimeout(()=>setSaved(false),1500);
    } catch {}
  };
  return (
    <div className="my-8 p-5 rounded-xl border border-[#E3E3E3] bg-white shadow-sm">
      <div className="font-semibold text-black mb-2 flex items-center gap-2">
        <span>🪞</span> Reflection
      </div>
      <div className="text-sm text-black mb-3 leading-relaxed">{prompt}</div>
      <textarea
        value={text}
        onChange={e=>setText(e.target.value)}
        rows={4}
        className="w-full rounded-md border border-[#E3E3E3] focus:ring-2 focus:ring-[#1E5780] focus:border-[#1E5780] text-sm p-2 resize-y"
        placeholder="Type your reflection (saved locally)"
      />
      <div className="mt-3 flex items-center gap-3">
        <button onClick={save} className="px-4 py-1.5 rounded bg-[#1E5780] hover:bg-[#1E5780]/90 text-white text-sm transition-colors">Save</button>
        {saved && <span className="text-xs text-green-600 font-medium">Saved ✓</span>}
      </div>
    </div>
  );
};
export const PollBlock = ({ question, options=[] }) => { const key='lms:poll:'+(question.slice(0,40).toLowerCase().replace(/[^a-z0-9]+/g,'-')); const [results,setResults]=useState(null); useEffect(()=>{ try { const s=localStorage.getItem(key); if(s) setResults(JSON.parse(s)); } catch {} },[key]); const vote=(idx)=>{ if(results) return; const base=options.map(()=> Math.floor(Math.random()*20)+5); base[idx]+=10; const total=base.reduce((a,b)=>a+b,0); const pct=base.map(n=>Math.round((n/total)*100)); const payload={counts:base,pct}; setResults(payload); awardPoints(2,'poll-vote'); try { localStorage.setItem(key, JSON.stringify(payload)); } catch {}; }; return (<div className="my-8 p-5 rounded-xl border bg-white shadow-sm"><div className="font-semibold text-gray-800 mb-3">Poll: {question}</div>{!results ? (<ul className="space-y-2">{options.map((o,i)=>(<li key={i}><button onClick={()=>vote(i)} className="w-full text-left px-3 py-2 rounded-md border bg-gray-50 hover:border-indigo-300 text-sm">{o}</button></li>))}</ul>) : (<ul className="space-y-2">{options.map((o,i)=>(<li key={i} className="px-3 py-2 rounded-md border bg-gray-50 flex items-center justify-between text-sm"><span>{o}</span><span className="font-medium text-indigo-700">{results.pct[i]}%</span></li>))}</ul>)}{results && <div className="mt-3 text-xs text-gray-500">Results stored locally.</div>}</div>); };
export const DoDontBlock = ({ doItems=[], dontItems=[] }) => (<div className="my-10 grid md:grid-cols-2 gap-6"><div className="p-5 rounded-xl border bg-emerald-50 border-emerald-200"><div className="font-semibold text-emerald-800 mb-3 flex items-center gap-2"><span>✅</span> Do</div><ul className="space-y-2 text-sm text-emerald-900 list-disc ml-5">{doItems.map((d,i)=><li key={i}>{d}</li>)}</ul></div><div className="p-5 rounded-xl border bg-rose-50 border-rose-200"><div className="font-semibold text-rose-800 mb-3 flex items-center gap-2"><span>⛔</span> Don't</div><ul className="space-y-2 text-sm text-rose-900 list-disc ml-5">{dontItems.map((d,i)=><li key={i}>{d}</li>)}</ul></div></div>);
export const NextStepsBlock = ({ steps=[] }) => (<div className="my-8 p-5 rounded-xl border bg-white shadow-sm"><div className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><span>➡️</span> Next Steps</div><ol className="list-decimal ml-5 space-y-1 text-sm text-gray-700 leading-relaxed">{steps.map((s,i)=><li key={i}>{s}</li>)}</ol></div>);
export const DiscussionBlock = ({ prompt, children, storageKey }) => { const key=storageKey || `discussion-${(prompt||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,40)}`; const [value,setValue]=useState(''); useEffect(()=>{ try { const v=localStorage.getItem(key); if(v) setValue(v);} catch {} },[key]); const onChange=e=>{ const v=e.target.value; setValue(v); try { localStorage.setItem(key,v);} catch {} }; return (<div className="my-8 p-6 rounded-xl border border-indigo-200 bg-indigo-50/40"><div className="flex items-start gap-3"><div className="text-xl">💬</div><div className="flex-1">{prompt && <h4 className="font-semibold text-indigo-800 mb-2 text-sm">{prompt}</h4>}{children && <div className="text-slate-700 text-sm mb-3 leading-relaxed">{children}</div>}<textarea value={value} onChange={onChange} rows={4} placeholder="Share your thoughts..." className="w-full text-sm rounded-md border border-indigo-300 focus:ring-indigo-500 focus:border-indigo-500 bg-white/70 p-2" /><div className="mt-1 text-[11px] text-slate-500">Saved locally.</div></div></div></div>); };
export const ButtonRow = ({ items=[] }) => (<div className="flex flex-wrap gap-2 my-3">{items.map((it,i)=>(<a key={i} href={it.href} target="_blank" rel="noreferrer" className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm">{it.label}</a>))}</div>);
export const ObjectivesBlock = ({ objectives=[] }) => (
  <div className="my-8 mx-auto w-full max-w-2xl p-6 rounded-2xl shadow-lg border border-[#E3E3E3] bg-white relative">
    <div className="absolute inset-y-0 left-0 w-1.5 rounded-l-2xl bg-gradient-to-b from-[#1E5780] to-green-500" aria-hidden="true"></div>
    <div className="flex items-center gap-3 mb-4 pl-2">
      <span className="text-xl">🎯</span>
      <span className="font-semibold text-[#1E5780] tracking-wide">Learning Objectives</span>
    </div>
    <ul className="space-y-3">
      {objectives.map((o,i)=>(
        <li key={i} className="flex items-start gap-3 text-black text-[15px] leading-relaxed">
          <span className="mt-1 text-emerald-600">•</span>
          <span>{o}</span>
        </li>
      ))}
    </ul>
  </div>
);
export const ChecklistBlock = ({ items=[] }) => { const key= typeof window!=='undefined'? `lms:checklist:${window.location.pathname}`:'lms:checklist'; const [checked,setChecked]=useState(()=>{ try { return JSON.parse(localStorage.getItem(key)||'{}'); } catch { return {}; } }); const toggle=(label)=> setChecked(prev=>{ const next={...prev, [label]: !prev[label]}; try { localStorage.setItem(key, JSON.stringify(next)); } catch {}; return next; }); return (<div className="my-4 p-4 bg-gradient-to-r from-slate-50 to-gray-50 border-l-4 border-slate-400 rounded-lg shadow-sm"><div className="flex items-center gap-2 mb-3"><span className="text-2xl">🧩</span><span className="font-semibold text-slate-800">Checklist</span></div><ul className="space-y-2">{items.map((label,i)=>(<li key={i} className="flex items-center gap-3 text-gray-800"><input type="checkbox" checked={!!checked[label]} onChange={()=>toggle(label)} className="w-4 h-4 accent-blue-600" /><span className={checked[label]? 'line-through text-gray-500':''}>{label}</span></li>))}</ul></div>); };
export const TimelineBlock = ({ events=[] }) => (<div className="my-6"><div className="space-y-4">{events.map((ev,i)=>(<div key={i} className="flex items-start gap-3"><div className="w-2 h-2 mt-2 rounded-full bg-[#1E5780]"></div><div><div className="font-semibold text-[#1E5780]">{ev.when} — {ev.title}</div>{ev.detail && <div className="text-black/70"><ReactMarkdown remarkPlugins={[remarkGfm]}>{ev.detail}</ReactMarkdown></div>}</div></div>))}</div></div>);
export const GlossaryBlock = ({ terms=[] }) => (<div className="my-6 p-4 bg-gradient-to-r from-[#E3E3E3]/30 to-[#E3E3E3]/10 border-l-4 border-[#1E5780] rounded-lg shadow-sm"><div className="flex items-center gap-2 mb-3"><span className="text-2xl">📚</span><span className="font-semibold text-[#1E5780]">Glossary</span></div><dl className="grid md:grid-cols-2 gap-4">{terms.map((t,i)=>(<div key={i}><dt className="font-semibold text-black">{t.term}</dt><dd className="text-black/70"><ReactMarkdown remarkPlugins={[remarkGfm]}>{t.definition}</ReactMarkdown></dd></div>))}</dl></div>);
export const ResourceListBlock = ({ items=[] }) => (<div className="my-6 p-4 bg-white rounded-lg border shadow-sm"><div className="flex items-center gap-2 mb-3"><span className="text-2xl">🔗</span><span className="font-semibold text-gray-900">Resources</span></div><ul className="list-disc ml-6 text-blue-800">{items.map((it,i)=>(<li key={i}><a className="hover:underline" href={it.href} target="_blank" rel="noreferrer">{it.label}</a></li>))}</ul></div>);
export const AudioEmbedBlock = ({ src, title='Audio' }) => (<div className="my-8 p-5 rounded-xl border bg-white shadow-sm"><div className="flex items-center gap-2 mb-2 text-indigo-700 font-semibold"><span>🎧</span><span>{title}</span></div>{src ? (<audio controls className="w-full"><source src={src} />Your browser does not support the audio element.</audio>) : <div className="text-sm text-gray-500">No audio source provided.</div>}</div>);

/*******************************************************
 * SUMMARY & WRAP-UP BLOCKS
 *******************************************************/
export const CertificateBlock = ({ title='Certificate of Completion', message='Congratulations on completing this module!', namePlaceholder='Your Name' }) => { const [name,setName]=useState(''); const display=name.trim()||namePlaceholder; return (<div className="my-10 p-8 rounded-2xl border-2 border-dashed border-[#E3E3E3] bg-white shadow relative overflow-hidden"><div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(30,87,128,0.08),transparent_60%)]" /><div className="relative"><h3 className="text-2xl font-bold text-[#1E5780] mb-4 text-center">{title}</h3><p className="text-center text-black mb-6 max-w-2xl mx-auto leading-relaxed">{message}</p><div className="max-w-sm mx-auto mb-6"><label className="block text-xs font-medium text-black/70 mb-1 tracking-wide uppercase">Name to display</label><input value={name} onChange={e=>setName(e.target.value)} placeholder={namePlaceholder} className="w-full px-3 py-2 rounded-md border border-[#E3E3E3] focus:outline-none focus:ring-2 focus:ring-[#1E5780] text-black" /></div><div className="mx-auto max-w-xl p-6 rounded-xl bg-gradient-to-br from-[#E3E3E3]/30 to-[#E3E3E3]/20 border border-[#E3E3E3] shadow-sm"><div className="text-center"><div className="text-sm uppercase tracking-widest text-[#1E5780] font-semibold mb-2">Awarded To</div><div className="text-3xl font-extrabold text-[#1E5780] mb-4 break-words">{display}</div><div className="text-[13px] text-black/70 leading-relaxed">For successfully completing the module and demonstrating understanding of the key concepts in Network Intrusion Detection.</div></div><div className="mt-8 flex items-center justify-between text-xs text-black/70"><div><div className="font-semibold text-black">Instructor</div><div className="mt-1 h-8 border-b border-[#E3E3E3] w-32" /></div><div className="text-[#1E5780] select-none font-semibold tracking-widest text-lg">✔</div><div className="text-right"><div className="font-semibold text-black">Date</div><div className="mt-1 text-black/70">{new Date().toLocaleDateString()}</div></div></div></div></div></div>); };
export const WrapUpBlock = ({ children, title='Key Takeaways' }) => (
  <div className="my-24 mx-auto max-w-4xl">
    <h3 className="text-2xl font-semibold text-[#1E5780] mb-8 tracking-tight">
      {title}
    </h3>
    <div className="text-black text-[17px] leading-[1.75] space-y-6 pl-6 border-l-2 border-[#E3E3E3]">
      {children}
    </div>
  </div>
);

/*******************************************************
 * AGGREGATED EXPORT LIST
 *******************************************************/
export default {
  // Utility / Course UI
  PointsTrackerBlock,
  // Content
  HighlightBox, QuoteBlock, ImageOverlayBlock, IconList, ContentBlock, CalloutBlock, ImageCaptionBlock, VideoEmbedBlock, InfographicBlock,
  IntroTextBlock,
  // Interactive
  FlipCard, FlipCardDeck, ExpandableCardGroup, ExpandableCard, Carousel, TimelineFancy, HotspotImage, DragOrderBlock, MatchingPairs, FillBlank, HoverRevealBlock, TabsBlock, StepperBlock, WatchBlock, TryItBlock, DiagramBlock, ExampleBlock, InteractiveBlock,
  // Case Study / Scenario
  ScenarioBlock, PersonaCard, CaseStudySection,
  // Assessment / Knowledge Check
  MCQInline, TrueFalseInline, ProgressQuizBlock, MCQuizBlock, QuizBlock, FinalAssessmentBlock, KeyPointsBlock,
  // Engagement
  ReflectionBlock, PollBlock, DoDontBlock, NextStepsBlock, DiscussionBlock, ButtonRow, ObjectivesBlock, ChecklistBlock, TimelineBlock, GlossaryBlock, ResourceListBlock, AudioEmbedBlock,
  // Summary / Wrap-Up
  CertificateBlock, WrapUpBlock,
};
