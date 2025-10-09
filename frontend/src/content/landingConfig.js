// Centralized content configuration for Landing Page (truthful mode)
// Adjust counts and flags here as the platform evolves.

export const FEATURES = [
  {
    icon: '/module.svg',
    title: 'Interactive Simulations',
    desc: 'Student simulation views (attack / defend / observe) for hands-on context.'
  },
  {
    icon: '/module.svg',
    title: 'Core Detection Tracks',
    desc: 'Signature, Anomaly and Hybrid learning flows with structured sections.'
  },
  {
    icon: '/dashboardicon.svg',
    title: 'Module-Based Lessons',
    desc: 'Markdown-driven lessons you can extend quickly without rebuilds.'
  },
  {
    icon: '/settings.svg',
    title: 'Quizzes & Assessments',
    desc: 'Lightweight knowledge checks & assessment screens per detection type.'
  },
  {
    icon: '/terminal.svg',
    title: 'Terminal Integration',
    desc: 'Back-end Cowrie integration & websocket terminal scaffolding.'
  },
  {
    icon: '/dashboardicon.svg',
    title: 'Role Separation',
    desc: 'Student and Instructor flows with dedicated login screens.'
  }
];

export const ROADMAP = [
  { label: 'Instructor Progress Analytics', status: 'planned' },
  { label: 'Adaptive Recommendations', status: 'planned' },
  { label: 'Expanded Anomaly ML Walkthroughs', status: 'in-progress' },
  { label: 'Hybrid Correlation Playbooks', status: 'planned' },
  { label: 'Documentation & Blog', status: 'planned' },
];

export const STATS = [
  { n: '3', l: 'Detection Tracks' },
  { n: '2+', l: 'Simulation Modes' },
  { n: '1', l: 'Terminal Integration' },
  { n: 'Growing', l: 'Content Library' }
];

export const FAQ = [
  { q: 'Do I need prior IDS experience?', a: 'No. Content starts at the fundamentals and builds gradually.' },
  { q: 'Are simulations browser-based?', a: 'Yes. Interactions run in the browser with backend services providing data.' },
  { q: 'Is progress fully analytics-driven?', a: 'Currently basic persistence; richer analytics are on the roadmap.' },
  { q: 'Can instructors see learner metrics?', a: 'Instructor role exists; deeper dashboards are planned.' },
  { q: 'How often is content updated?', a: 'Core tracks are stable; iterations happen as new detection topics are added.' }
];

export const TEAM = [
  { img:'/avatar1.png', name:'Hanz Hendrick Lacsi', role:'Lead Developer', bio:'Full‑stack & security enthusiast driving core architecture.' },
  { img:'/avatar2.png', name:'Danlie Ken Gregory', role:'Team Leader', bio:'Coordinates feature direction & learning structure.' },
  { img:'/avatar3.png', name:'Angel Bless Mendoza', role:'UI/UX Designer', bio:'Designs clean, accessible learning experience flows.' }
];

export const PARTNERS = ['/logo.svg','/logo2.svg','/dashboardicon.svg','/settings.svg'];
