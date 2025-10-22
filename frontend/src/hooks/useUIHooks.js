import React, { useEffect, useRef } from 'react';

// Reveal-on-scroll hook using IntersectionObserver
export const useRevealOnScroll = (selector = '.reveal', options = { root: null, rootMargin: '0px', threshold: 0.12 }) => {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.IntersectionObserver) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal--visible');
          observer.unobserve(entry.target);
        }
      });
    }, options);
    document.querySelectorAll(selector).forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [selector, JSON.stringify(options)]);
};

// Animated counter (requestAnimationFrame)
export const AnimatedNumber = ({ value, duration = 900, className = '' }) => {
  const ref = useRef(null);
  useEffect(() => {
    let raf;
    let start;
    const el = ref.current;
    const from = 0;
    const to = Number(value) || 0;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const cur = Math.floor(from + (to - from) * progress);
      if (el) el.textContent = cur;
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return React.createElement('span', { ref, className }, 0);
};

// Simple parallax hook: elements with data-parallax will be moved based on scroll
export const useParallax = ({ selector = '[data-parallax]', maxTranslate = 60 } = {}) => {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nodes = Array.from(document.querySelectorAll(selector));
    if (!nodes.length) return;
    let ticking = false;
    const update = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      nodes.forEach(node => {
        const speed = parseFloat(node.getAttribute('data-parallax-speed') || '0.2');
        const rect = node.getBoundingClientRect();
        // compute a small translate based on viewport position
        const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * -1;
        const translate = Math.max(Math.min(offset * speed, maxTranslate), -maxTranslate);
        node.style.transform = `translate3d(0, ${translate}px, 0)`;
      });
      ticking = false;
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, [selector, maxTranslate]);
};

export default null;
