// Signature track content registry (Modules 1-4 + Summary)
// User mapping provided: Module 3 (3.1 Traffic Capture & Analysis, 3.2 Rule Databases),
// Module 4 (4.1 Real-World Application, 4.2 Limitations of Signature-Based NIDS, 4.3 Future & Hybrid Use)
// Total: 10 core lessons + 1 summary.
// Assumption Notes:
// - Module 2 lesson titles: User only explicitly confirmed workflow related mapping; kept existing lesson2 slug 'signature-detection-workflow'.
//   Added a third lesson placeholder 'Extended Workflow Techniques' (slug 'extended-workflow-techniques') to cover advanced operational practices; rename if you prefer a different focus.
// - Tag arrays are heuristic for potential filtering (concepts, workflow, capture, etc.). Adjust if you have a defined taxonomy.
// - Minutes are rough estimates; refine after real content length finalized.

// Helper to build consistent lesson ids
const lid = (n) => `sig-${n}`;

export const signatureModules = [
  {
    module: 1,
    code: 'm1',
    title: 'Foundations',
    lessons: [
      { order: 1, id: lid(1), slug: 'basics-of-cybersecurity', title: 'Basics of Cybersecurity', minutes: 8, tags:['concepts','overview'], import: () => import('../modules/signature-based-detection/module1-lesson1.md?raw') },
      { order: 2, id: lid(2), slug: 'introduction-to-ids', title: 'Introduction to IDS', minutes: 11, tags:['rules','syntax'], import: () => import('../modules/signature-based-detection/module1-lesson2.md?raw') },
    ]
  },
  {
    module: 2,
    code: 'm2',
    title: 'Workflow & Maintenance',
    lessons: [
      { order: 1, id: lid(3), slug: 'signature-based-vs-anomaly-based-detection', title: 'Signature-Based vs Anomaly-Based Detection', minutes: 9, tags:['optimization','advanced'], import: () => import('../modules/signature-based-detection/module2-lesson1.md?raw') },
      { order: 2, id: lid(4), slug: 'signature-detection-workflow', title: 'Signature Detection Workflow', minutes: 10, tags:['workflow','engine'], import: () => import('../modules/signature-based-detection/module2-lesson2.md?raw') },
      { order: 3, id: lid(5), slug: 'extended-workflow-techniques', title: 'Extended Workflow Techniques', minutes: 10, tags:['workflow','engine'], import: () => import('../modules/signature-based-detection/module2-lesson3.md?raw') },
    ]
  },
  {
    module: 3,
    code: 'm3',
    title: 'Common IDS Tools',
    lessons: [
      { order: 1, id: lid(6), slug: 'snort-suricata', title: 'Snort and Suricata', minutes: 9, tags:['capture','analysis'], import: () => import('../modules/signature-based-detection/module3-lesson1.md?raw') },
      { order: 2, id: lid(7), slug: 'traffic-capture-rule-databases', title: 'Traffic Capture & Rule Databases', minutes: 8, tags:['maintenance','rules'], import: () => import('../modules/signature-based-detection/module3-lesson2.md?raw') },
    ]
  },
  {
    module: 4,
    code: 'm4',
    title: 'Application & Evolution',
    lessons: [
      { order: 1, id: lid(8), slug: 'real-world-application', title: 'Real-World Application', minutes: 7, tags:['application','cases'], import: () => import('../modules/signature-based-detection/module4-lesson1.md?raw') },
      { order: 2, id: lid(9), slug: 'limitations-of-signature-nids', title: 'Limitations of Signature-Based NIDS', minutes: 7, tags:['limitations','gaps'], import: () => import('../modules/signature-based-detection/module4-lesson2.md?raw') },
      { order: 3, id: lid(10), slug: 'future-hybrid-use', title: 'Future & Hybrid Use', minutes: 7, tags:['future','hybrid'], import: () => import('../modules/signature-based-detection/module4-lesson3.md?raw') },
    ]
  },
  {
    module: 5,
    code: 'summary',
    title: 'Summary & Review',
    lessons: [
      { order: 1, id: lid(11), slug: 'summary-review', title: 'Summary & Review', minutes: 6, tags:['summary','review'], import: () => import('../modules/signature-based-detection/summary.md?raw') }
    ]
  }
];

// Flatten for existing consumers
export const signatureLessons = signatureModules.flatMap(m => m.lessons);

export function getSignatureLesson(index) {
  return signatureLessons[index] || null;
}

export function findSignatureLessonBySlug(slug) {
  return signatureLessons.find(l => l.slug === slug) || null;
}

export const signatureLessonCount = signatureLessons.length;

// QUIZ STUBS: placeholder short quiz per module (to be expanded)
export const signatureModuleQuizzes = {
  m1: { questions: [
    { q: 'Primary goal of a Network IDS?', options:['Block all malicious traffic automatically','Detect and alert on suspicious patterns','Replace endpoint protection'], ans:1 },
    { q: 'Signatures are most effective against:', options:['Zero-day exploits','Previously observed threats','Random encrypted data'], ans:1 },
    { q: 'Key limitation of pure signature systems?', options:['They require no tuning','They miss unknown attack variants','They always over-consume CPU'], ans:1 },
    { q: 'Which layer is often parsed first for normalization?', options:['Transport','Application','Link'], ans:0 },
    { q: 'Good foundational practice when starting an IDS program?', options:['Deploy all community rules blindly','Baseline normal network behavior','Disable logging for performance'], ans:1 }
  ] },
  m2: { questions: [
    { q: 'Workflow first step after receiving a new intel signature?', options:['Deploy straight to production','Assess relevance & environment impact','Convert to anomaly detector'], ans:1 },
    { q: 'Maintenance task that reduces false positives?', options:['Removing all thresholds','Continuous rule tuning & pruning','Disabling flow tracking'], ans:1 },
    { q: 'Version controlling rule sets helps with:', options:['Obfuscating changes','Reverting problematic updates','Preventing collaboration'], ans:1 },
    { q: 'Extended workflow technique for resilience?', options:['Single staging environment only','Canary / phased rollout','Immediate full replacement'], ans:1 },
    { q: 'Metric indicating workflow efficiency?', options:['Mean time to author & deploy','Number of unused rules kept','Packet loss percentage'], ans:0 }
  ] },
  m3: { questions: [
    { q: 'Traffic capture component purpose?', options:['Generate attack traffic','Mirror packets for inspection','Encrypt payloads in-line'], ans:1 },
    { q: 'Why normalize payloads before matching?', options:['To increase packet size','To reduce evasions & variance','To randomize signatures'], ans:1 },
    { q: 'Healthy rule database characteristic?', options:['Many overlapping duplicates','Clear ownership & metadata','Unbounded growth'], ans:1 },
    { q: 'Capture gap risk mitigation?', options:['Ignore dropped packets','Monitor span health & loss','Disable NIC offloads'], ans:1 },
    { q: 'Storing rule metadata enables:', options:['Faster encryption','Better auditing & lifecycle decisions','Automatic exploit patching'], ans:1 }
  ] },
  m4: { questions: [
    { q: 'Real-world deployment challenge?', options:['Perfect data fidelity','Environmental noise & variability','Zero false positives guaranteed'], ans:1 },
    { q: 'Limitation of signature NIDS vs anomaly?', options:['Hard to tune for precision','Cannot detect novel behaviors','Consumes zero resources'], ans:1 },
    { q: 'Hybrid approach benefit?', options:['Eliminates need for signatures','Combines deterministic + behavioral coverage','Removes tuning requirements'], ans:1 },
    { q: 'Future direction for scaling rule ops?', options:['Manual diff reviews only','Automation & CI for rule QA','Removing metadata fields'], ans:1 },
    { q: 'When to retire a rule?', options:['After one detection','When obsolete / superseded','Never remove any rules'], ans:1 }
  ] },
  summary: { questions: [] }
};
// Populate summary quiz (comprehensive review)
signatureModuleQuizzes.summary.questions = [
  { q: 'Core advantage of signature-based detection?', options:['Zero configuration needed','Deterministic detection of known threats','Automatic creation of new rules'], ans:1 },
  { q: 'Primary mitigation for signature blind spots?', options:['Rely on signatures only','Introduce anomaly / behavioral layers','Disable outdated rules'], ans:1 },
  { q: 'Healthy rule lifecycle includes:', options:['Never removing any rule','Versioning, review, retirement','Obfuscating metadata'], ans:1 },
  { q: 'Capture fidelity impacts:', options:['Only storage cost','Detection accuracy and coverage','Frontend user experience only'], ans:1 },
  { q: 'Hybrid NIDS future direction focus:', options:['Reducing context enrichment','Automation & scalable QA of rules','Eliminating telemetry sources'], ans:1 }
];
