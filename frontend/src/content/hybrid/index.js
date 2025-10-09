// Hybrid track content registry: combines signature + anomaly strengths
// Includes full lesson set (placeholder), quizzes (mirroring 5-unit pattern), practical exercise, and assessment metadata

const hid = (n) => `hyb-${n}`;

export const hybridModules = [
  {
    module: 1,
    code: 'm1',
    title: 'Integrated Detection Foundations',
    lessons: [
      { order: 1, id: hid(1), slug: 'hybrid-concept', title: 'What is Hybrid Detection?', minutes: 7, tags:['overview'], import: () => import('../modules/hybrid-detection/module1-lesson1.md?raw') },
      { order: 2, id: hid(2), slug: 'hybrid-scope', title: 'Scope & Alignment', minutes: 7, tags:['scoping'], import: () => import('../modules/hybrid-detection/module1-lesson2.md?raw') },
      { order: 3, id: hid(3), slug: 'hybrid-telemetry', title: 'Telemetry Fusion', minutes: 8, tags:['telemetry'], import: () => import('../modules/hybrid-detection/module1-lesson3.md?raw') }
    ]
  },
  {
    module: 2,
    code: 'm2',
    title: 'Correlation & Enrichment',
    lessons: [
      { order: 1, id: hid(4), slug: 'hybrid-correlation', title: 'Correlation Layers', minutes: 8, tags:['correlation'], import: () => import('../modules/hybrid-detection/module2-lesson1.md?raw') },
      { order: 2, id: hid(5), slug: 'hybrid-context', title: 'Context Enrichment', minutes: 7, tags:['context'], import: () => import('../modules/hybrid-detection/module2-lesson2.md?raw') },
      { order: 3, id: hid(6), slug: 'hybrid-prioritization', title: 'Risk Prioritization', minutes: 8, tags:['risk'], import: () => import('../modules/hybrid-detection/module2-lesson3.md?raw') }
    ]
  },
  {
    module: 3,
    code: 'm3',
    title: 'Adaptive Modeling',
    lessons: [
      { order: 1, id: hid(7), slug: 'hybrid-feedback', title: 'Feedback Loop Integration', minutes: 8, tags:['feedback'], import: () => import('../modules/hybrid-detection/module3-lesson1.md?raw') },
      { order: 2, id: hid(8), slug: 'hybrid-model-routing', title: 'Model Routing Strategy', minutes: 9, tags:['models'], import: () => import('../modules/hybrid-detection/module3-lesson2.md?raw') },
      { order: 3, id: hid(9), slug: 'hybrid-thresholds', title: 'Combined Threshold Governance', minutes: 8, tags:['thresholds'], import: () => import('../modules/hybrid-detection/module3-lesson3.md?raw') }
    ]
  },
  {
    module: 4,
    code: 'm4',
    title: 'Operations & Response',
    lessons: [
      { order: 1, id: hid(10), slug: 'hybrid-alert-flow', title: 'Unified Alert Flow', minutes: 7, tags:['operations'], import: () => import('../modules/hybrid-detection/module4-lesson1.md?raw') },
      { order: 2, id: hid(11), slug: 'hybrid-playbooks', title: 'Composite Playbooks', minutes: 7, tags:['playbooks'], import: () => import('../modules/hybrid-detection/module4-lesson2.md?raw') },
      { order: 3, id: hid(12), slug: 'hybrid-hardening', title: 'Continuous Hardening', minutes: 7, tags:['hardening'], import: () => import('../modules/hybrid-detection/module4-lesson3.md?raw') }
    ]
  },
  { module: 5, code: 'summary', title: 'Summary & Integration', lessons: [ { order: 1, id: hid(13), slug: 'hybrid-summary', title: 'Hybrid Summary & Integration', minutes: 6, tags:['summary'], import: () => import('../modules/hybrid-detection/summary.md?raw') } ] }
];

export const hybridLessons = hybridModules.flatMap(m => m.lessons);
export const hybridLessonCount = hybridLessons.length;
export function getHybridLesson(index){ return hybridLessons[index] || null; }
export function findHybridLessonBySlug(slug){ return hybridLessons.find(l=>l.slug===slug) || null; }

// Quizzes (pattern: 5 module quizzes)
export const hybridModuleQuizzes = {
  m1:{questions:[
    { q:'Primary aim of hybrid detection?', options:['Eliminate analytics','Fuse complementary strengths','Ignore context'], ans:1 },
    { q:'Fusion risk if unmanaged?', options:['Signal dilution','Improved context','Lower blind spots'], ans:0 },
    { q:'Foundational fusion artifact?', options:['Telemetry normalization map','Random packet discard','Arbitrary feature masking'], ans:0 },
    { q:'Good initial KPI?', options:['Time-to-qualified alert','Random seed value','Line count of rules'], ans:0 },
    { q:'Baseline alignment avoids?', options:['Cross-source skew','Stable correlation','Reduction of context'], ans:0 }
  ]},
  m2:{questions:[
    { q:'Correlation layer purpose?', options:['Combine weak signals','Remove context','Guarantee no false positives'], ans:0 },
    { q:'Risk score inflation occurs when?', options:['Stacking unweighted scores','Applying decay factors','Normalizing scales'], ans:0 },
    { q:'Context enrichment adds?', options:['Investigative pivots','Noise only','Data loss'], ans:0 },
    { q:'Priority inversion fix?', options:['Weighting strategy review','Disable model routing','Randomize severities'], ans:0 },
    { q:'Useful enrichment field?', options:['Asset criticality','Random nonce','Line number in log file'], ans:0 }
  ]},
  m3:{questions:[
    { q:'Feedback loops enable?', options:['Adaptive tuning','Permanent static states','Removing model diversity'], ans:0 },
    { q:'Routing strategy chooses?', options:['Best model per event/class','Random analyzer each time','Only signature engine'], ans:0 },
    { q:'Governance ensures?', options:['Threshold consistency','Arbitrary drift','Hidden escalation paths'], ans:0 },
    { q:'Blending scores requires?', options:['Normalization & weighting','Discarding provenance','Hiding model identity'], ans:0 },
    { q:'Ensemble conflict resolution via?', options:['Defined precedence rules','Ignoring disagreements','Deleting low scores'], ans:0 }
  ]},
  m4:{questions:[
    { q:'Unified alert flow reduces?', options:['Handoff friction','Operational clarity','Feedback data'], ans:0 },
    { q:'Composite playbooks produce?', options:['Standardized multi-signal response','Random triage','Opaque escalations'], ans:0 },
    { q:'Continuous hardening tracks?', options:['Regression & drift','Static invariance','Random failures'], ans:0 },
    { q:'Hybrid telemetry retention guided by?', options:['Value & cost model','Arbitrary vendor defaults','Coin flips'], ans:0 },
    { q:'Lifecycle dashboard should show?', options:['Model freshness & gaps','Only raw bytes','Unsorted debug output'], ans:0 }
  ]},
  summary:{questions:[
    { q:'Hybrid objective?', options:['Exploit complementary detection layers','Replace all analysis teams','Eliminate tuning needs'], ans:0 },
    { q:'Correlation sanity check metric?', options:['False positive precision','Random ID parity','Disk sector reuse'], ans:0 },
    { q:'Playbook maturity signal?', options:['Reduced variance in triage time','Unbounded alert reopen rate','Hidden automation'], ans:0 },
    { q:'Score blending anti-pattern?', options:['Ignoring scale alignment','Normalizing distributions','Documenting weight rationale'], ans:0 },
    { q:'Lifecycle success indicator?', options:['Predictable improvement cadence','Random drift excursions unmanaged','Undocumented tuning'], ans:0 }
  ]}
};

// Practical & Assessment metadata (one global per track for now)
export const hybridPractical = {
  slug: 'hybrid-practical',
  title: 'Practical Exercise: Correlated Case Build',
  description: 'Build a multi-source incident case by correlating signature alerts with anomaly scores and enrichment context.'
};

export const hybridAssessment = {
  slug: 'hybrid-assessment',
  title: 'Hybrid Assessment',
  description: 'Scenario-based evaluation measuring ability to reason across fused signals and adaptive responses.'
};
