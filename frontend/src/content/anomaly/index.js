// Anomaly track content registry (Modules 1-4 + Summary)
// Mirrors signature index structure for reuse in TheoryModulePage.

const lid = (n) => `anom-${n}`;

export const anomalyModules = [
  {
    module: 1,
    code: 'm1',
    title: 'Foundations',
    lessons: [
      { order: 1, id: lid(1), slug: 'anomaly-introduction', title: 'Introduction to Anomaly Detection', minutes: 8, tags:['concepts','overview'], import: () => import('../modules/anomaly-based-detection/module1-lesson1.md?raw') },
      { order: 2, id: lid(2), slug: 'anomaly-baselining', title: 'Baselining Concepts', minutes: 9, tags:['baseline','behavior'], import: () => import('../modules/anomaly-based-detection/module1-lesson2.md?raw') },
      { order: 3, id: lid(3), slug: 'anomaly-data-quality', title: 'Data Quality & Preparation', minutes: 9, tags:['data','quality'], import: () => import('../modules/anomaly-based-detection/module1-lesson3.md?raw') },
    ],
    practical: { slug: 'anomaly-m1-practical', title: 'Practical: Baseline Snapshot & Drift Indicators', minutes: 15, description: 'Collect a 24h feature snapshot and document three drift watch metrics.' },
    assessment: { slug: 'anomaly-m1-assessment', title: 'Assessment: Foundational Concepts', minutes: 8, description: 'Covers baselining risks, data quality and anomaly categories.' }
  },
  {
    module: 2,
    code: 'm2',
    title: 'Detection Techniques',
    lessons: [
      { order: 1, id: lid(4), slug: 'anomaly-how-it-works', title: 'How It Works', minutes: 10, tags:['workflow','engine'], import: () => import('../modules/anomaly-based-detection/module2-lesson1.md?raw') },
      { order: 2, id: lid(5), slug: 'anomaly-process', title: 'Detection Process Pipeline', minutes: 10, tags:['process','pipeline'], import: () => import('../modules/anomaly-based-detection/module2-lesson2.md?raw') },
      { order: 3, id: lid(6), slug: 'anomaly-ml-overview', title: 'Machine Learning Overview', minutes: 11, tags:['ml','overview'], import: () => import('../modules/anomaly-based-detection/module2-lesson3.md?raw') },
    ],
    practical: { slug: 'anomaly-m2-practical', title: 'Practical: Feature Engineering Drill', minutes: 18, description: 'Derive three stability features and justify their selection.' },
    assessment: { slug: 'anomaly-m2-assessment', title: 'Assessment: Techniques & Pipeline', minutes: 8, description: 'Validates understanding of pipeline ordering and feature prep.' }
  },
  {
    module: 3,
    code: 'm3',
    title: 'Modeling & Evaluation',
    lessons: [
      { order: 1, id: lid(7), slug: 'anomaly-types', title: 'Types of Anomalies', minutes: 8, tags:['types'], import: () => import('../modules/anomaly-based-detection/module3-lesson1.md?raw') },
      { order: 2, id: lid(8), slug: 'anomaly-advantages', title: 'Advantages & Strengths', minutes: 8, tags:['advantages'], import: () => import('../modules/anomaly-based-detection/module3-lesson2.md?raw') },
      { order: 3, id: lid(9), slug: 'anomaly-limitations', title: 'Limitations & Risks', minutes: 8, tags:['limitations'], import: () => import('../modules/anomaly-based-detection/module3-lesson3.md?raw') },
    ],
    practical: { slug: 'anomaly-m3-practical', title: 'Practical: Threshold Tuning Lab', minutes: 20, description: 'Tune anomaly score threshold against precision/recall trade-offs.' },
    assessment: { slug: 'anomaly-m3-assessment', title: 'Assessment: Modeling & Evaluation', minutes: 9, description: 'Scenario questions on metrics, ensembles and calibration.' }
  },
  {
    module: 4,
    code: 'm4',
    title: 'Operationalization',
    lessons: [
      { order: 1, id: lid(10), slug: 'anomaly-best-practices', title: 'Best Practices', minutes: 7, tags:['best-practices'], import: () => import('../modules/anomaly-based-detection/module4-lesson1.md?raw') },
      { order: 2, id: lid(11), slug: 'anomaly-future', title: 'Future Directions', minutes: 7, tags:['future'], import: () => import('../modules/anomaly-based-detection/module4-lesson2.md?raw') },
      { order: 3, id: lid(12), slug: 'anomaly-summary', title: 'Summary & Review', minutes: 6, tags:['summary','review'], import: () => import('../modules/anomaly-based-detection/module4-lesson3.md?raw') },
    ],
    practical: { slug: 'anomaly-m4-practical', title: 'Practical: Drift Injection Simulation', minutes: 16, description: 'Simulate drift and capture mitigation actions.' },
    assessment: { slug: 'anomaly-m4-assessment', title: 'Assessment: Operations & Hardening', minutes: 8, description: 'Focus on lifecycle, drift handling and response readiness.' }
  },
  { module: 5, code: 'summary', title: 'Summary & Review', lessons: [ { order: 1, id: lid(13), slug: 'anomaly-summary-review', title: 'Summary Review', minutes: 6, tags:['summary'], import: () => import('../modules/anomaly-based-detection/summary.md?raw') } ], practical: { slug: 'anomaly-summary-practical', title: 'Practical: Consolidated Playbook', minutes: 14, description: 'Assemble an anomaly operations playbook.' }, assessment: { slug: 'anomaly-summary-assessment', title: 'Capstone Assessment', minutes: 10, description: 'Cross-module integration scenarios.' } }
];

export const anomalyLessons = anomalyModules.flatMap(m => m.lessons);
export const anomalyLessonCount = anomalyLessons.length;
export function getAnomalyLesson(index){ return anomalyLessons[index] || null; }
export function findAnomalyLessonBySlug(slug){ return anomalyLessons.find(l=>l.slug===slug) || null; }

// Placeholder quizzes (reuse signature structure, update later)
export const anomalyModuleQuizzes = {
  m1:{questions:[
    { q: 'Core focus of anomaly-based detection?', options:['Exact signature matching','Modeling normal behavior','Random packet mutation'], ans:1 },
    { q: 'Baseline quality most depends on:', options:['Short noisy sampling window','Representative stable data','Ignoring seasonal patterns'], ans:1 },
    { q: 'Early baseline pitfall?', options:['Including known bad traffic in training','Excluding outliers from training','Segmenting by asset type'], ans:0 },
    { q: 'Data quality step that reduces false anomalies?', options:['Dropping enrichment fields','Normalization & feature hygiene','Random feature duplication'], ans:1 },
    { q: 'Why track feature drift?', options:['To disable retraining','To know when models degrade','To shrink telemetry sources'], ans:1 }
  ]},
  m2:{questions:[
    { q: 'Unsupervised technique commonly used for distance-based anomaly scoring?', options:['K-Means clustering','SHA-256 hashing','Port knocking'], ans:0 },
    { q: 'Pipeline stage that converts raw events into features?', options:['Inference','Feature extraction','Alert triage'], ans:1 },
    { q: 'Reason to bucket categorical features?', options:['Reduce cardinality explosion','Increase dimensionality arbitrarily','Hide categorical meaning'], ans:0 },
    { q: 'Windowing is important because it:', options:['Prevents batching','Captures temporal context','Eliminates need for baselines'], ans:1 },
    { q: 'Rolling retrain schedule helps with:', options:['Ignoring environment changes','Adapting to gradual shifts','Guaranteeing zero drift'], ans:1 }
  ]},
  m3:{questions:[
    { q: 'Precision vs recall tension arises because:', options:['Labels are always perfect','Threshold changes shift both metrics','Models never score near decision boundary'], ans:1 },
    { q: 'Evaluation approach without labeled anomalies?', options:['Pure accuracy metric','Proxy validation & expert review','Supervised ROC only'], ans:1 },
    { q: 'Common score calibration goal?', options:['Uniform random scores','Mapped probability-like outputs','Eliminate threshold tuning'], ans:1 },
    { q: 'Benefit of ensemble anomaly models?', options:['Single point of failure','Capture complementary behaviors','Remove need for baselines'], ans:1 },
    { q: 'Root cause analysis aided by:', options:['Discarding feature attribution','Providing top contributing features','Hiding model versioning'], ans:1 }
  ]},
  m4:{questions:[
    { q: 'Operational risk of low alert volume?', options:['Analyst fatigue','Missed silent drift','Storage saturation'], ans:1 },
    { q: 'Playbooks help by:', options:['Standardizing triage steps','Preventing knowledge transfer','Forcing ad-hoc responses'], ans:0 },
    { q: 'Maturing anomaly program adds:', options:['No feedback loops','Feedback to retraining & tuning','Permanent static thresholds'], ans:1 },
    { q: 'Why tag false positives explicitly?', options:['So they reoccur','To improve label-aware refinement','To hide operator actions'], ans:1 },
    { q: 'Future-oriented improvement path?', options:['Eliminate evaluation telemetry','Automated drift detection & retrain gating','Freeze feature schemas forever'], ans:1 }
  ]},
  summary:{questions:[
    { q: 'Key advantage over pure signature systems?', options:['Detects novel patterns','Requires zero data prep','Guaranteed zero false positives'], ans:0 },
    { q: 'Healthy baseline practice?', options:['Segment by context (host / service)','Merge all traffic indiscriminately','Train only during incidents'], ans:0 },
    { q: 'Model evaluation without ground truth leans on:', options:['Heuristic scoring + analyst validation','Perfect labeled datasets','Ignoring uncertainty'], ans:0 },
    { q: 'Operational excellence metric?', options:['Mean time to triage anomaly','Number of disabled feedback loops','Random seed value'], ans:0 },
    { q: 'Hybrid detection stack goal?', options:['Complement strengths of different approaches','Eliminate need for telemetry','Remove all signature maintenance'], ans:0 }
  ]}
};
