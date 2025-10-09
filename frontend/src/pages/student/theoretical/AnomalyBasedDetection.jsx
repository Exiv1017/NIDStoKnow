import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MIN_LESSON_TIME = 20000; // 20 seconds
const PASSING_SCORE = 70;

const anomalyBasedTheoryLessons = [
  {
    title: 'Introduction to Anomaly-Based Detection',
    content: `Welcome to the world of anomaly-based detection! This approach to cybersecurity is like having a security guard who knows what "normal" looks like and gets suspicious when things seem off.

**Watch:**
[Click here to watch a short video introduction to anomaly detection.](https://www.youtube.com/watch?v=6pWcV1lQ1nE)

Anomaly-based detection is a cybersecurity technique that identifies threats by looking for unusual patterns or behaviors that deviate from the normal baseline of activity.

**Try it:**
> Can you think of a time when you noticed something was 'off' or unusual in your daily routine? How did you spot it? This is similar to how anomaly detection works!

**Key Points:**
- Detects unknown or new threats by monitoring deviations from normal behavior
- Useful for identifying zero-day attacks and advanced persistent threats
- Can adapt to changing environments and user behaviors
- Works by establishing baselines of normal activity

**Quiz:**
- True or False: Anomaly-based detection can identify threats that have never been seen before?`,
  },
  {
    title: 'How Anomaly-Based Detection Works',
    content: `Anomaly-based systems operate in phases: learning, monitoring, and alerting. Let's break down this process step by step.

**Diagram:**
Phase 1: Learning Normal Behavior
[Historical Data] -> [Pattern Analysis] -> [Baseline Profile]

Phase 2: Real-time Monitoring
[Live Activity] -> [Compare to Baseline] -> [Calculate Deviation Score]

Phase 3: Decision Making
[Deviation Score] -> [Threshold Check] -> [Alert or Continue]

The system first learns what 'normal' looks like by analyzing historical data over weeks or months. It then continuously monitors ongoing activity and flags anything that significantly deviates from this baseline as suspicious.

**Interactive:**
- Try adjusting the sensitivity threshold: What happens if you make the system more or less sensitive to anomalies?

**Example:**
If a user typically logs in from their office in New York between 9 AM and 6 PM on weekdays, but suddenly logs in from Russia at 3 AM on a Sunday, the system would flag this as a high-risk anomaly requiring immediate attention.

**Key Points:**
- Requires a training period to establish normal baselines
- Uses statistical models to identify deviations
- Continuously updates its understanding of normal behavior
- Effectiveness depends on the quality of baseline data`,
  },
  {
    title: 'Types of Anomalies in Cybersecurity',
    content: `Not all anomalies are created equal. Understanding different types helps security teams prioritize their response and reduce false positives.

## Point Anomalies
A single data point that is anomalous compared to the rest of the dataset.

**Example:**
A user who normally downloads 50MB per day suddenly downloads 10GB in one session.

## Contextual Anomalies
Data points that are anomalous only in a specific context, but might be normal otherwise.

**Example:**
Accessing the company database at 2 AM might be normal for night-shift workers but suspicious for day-shift employees.

## Collective Anomalies
A collection of data points that together form an anomalous pattern, even though individual points might seem normal.

**Example:**
Multiple users from the same department all changing their passwords within a short time frame might indicate a targeted attack.

**Try it:**
- Think of a real-world scenario for each type of anomaly. How would you distinguish between them?

**Interactive:**
- Can you identify which type of anomaly each scenario represents?

**Quiz:**
- A series of small file transfers that together indicate data exfiltration would be classified as what type of anomaly?`,
  },
  {
    title: 'Statistical Methods in Anomaly Detection',
    content: `Anomaly detection relies heavily on statistical methods to identify unusual patterns. Let's explore the most common approaches.

## Statistical Distribution Analysis
Systems analyze data distributions and flag points that fall outside expected ranges.

**Example:**
If login attempts typically range from 10-50 per hour, 200 attempts in one hour would be flagged.

## Machine Learning Approaches
Modern systems use ML algorithms to learn complex patterns and relationships.

**Key Points:**
- Clustering algorithms group similar behaviors
- Neural networks can detect subtle pattern changes
- Ensemble methods combine multiple detection techniques
- Supervised learning uses labeled anomaly examples

**Diagram:**
Normal Distribution Curve
    |
    |   *
    |  ***
    | *****  <- Normal Range
    |*******
    |*********
ANOMALY!   ANOMALY!
(outlier)  (outlier)

**Interactive:**
- How might seasonal patterns (like increased online shopping during holidays) affect anomaly detection systems?

**Try it:**
> Consider your own online behavior: What patterns would be considered "normal" for you, and what would trigger an anomaly alert?

**Quiz:**
- Which machine learning technique is commonly used to group similar behaviors in anomaly detection?`,
  },
  {
    title: 'Network-Based Anomaly Detection',
    content: `Network anomaly detection monitors traffic patterns, connection behaviors, and communication protocols to identify threats.

## Traffic Volume Analysis
Monitors the amount of data flowing through network segments.

**Example:**
A sudden spike in outbound traffic from a server that normally has minimal external communication could indicate data exfiltration.

## Protocol Anomalies
Detects unusual protocol usage or malformed packets.

**Key Points:**
- Port scanning attempts show unusual connection patterns
- DDoS attacks create traffic volume anomalies
- Command and control communication has distinct patterns
- Encrypted tunnel usage outside normal hours

**Diagram:**
Network Monitoring Points:
[Internet] <-> [Firewall] <-> [Internal Network] <-> [Servers]
              ^anomaly        ^anomaly              ^anomaly
              detection       detection             detection

**Watch:**
[Network anomaly detection in action - see how traffic patterns reveal threats](https://www.youtube.com/watch?v=example)

**Interactive:**
- What network behaviors in your organization would you consider suspicious?

**Example:**
A workstation that normally communicates only with local file servers suddenly starts making frequent connections to external IP addresses in foreign countries, especially during off-hours.

**Try it:**
> Think about your home network: What would be normal vs. abnormal traffic patterns?`,
  },
  {
    title: 'User Behavior Analytics (UBA)',
    content: `User Behavior Analytics focuses on identifying anomalies in how users interact with systems and data.

## Baseline User Profiles
Systems create detailed profiles of normal user behavior patterns.

**Key Metrics Monitored:**
- Login times and locations
- Applications accessed
- Data access patterns
- File operations (create, modify, delete)
- Network resource usage

**Example:**
Sarah, an HR manager, typically accesses employee records during business hours from her office computer. If her account suddenly starts accessing financial databases at midnight from a home computer, this would trigger multiple anomaly flags.

**Interactive:**
- What aspects of your daily computer usage would create a "normal" profile?

**Diagram:**
User Profile Building:
Week 1-4: [Observation] -> [Pattern Recognition] -> [Baseline Creation]
Week 5+:  [Real-time Monitoring] -> [Deviation Detection] -> [Alert Generation]

**Try it:**
> Consider a scenario where an employee's behavior changes due to a legitimate reason (new role, remote work). How should the system adapt?

**Key Points:**
- Accounts for role-based access differences
- Adapts to gradual behavior changes
- Identifies potential insider threats
- Reduces false positives through contextual analysis

**Quiz:**
- What would be considered a behavioral anomaly for a typical office worker?`,
  },
  {
    title: 'Advantages of Anomaly-Based Detection',
    content: `Anomaly-based detection offers several critical advantages that make it an essential component of modern cybersecurity strategies.

## 1. Zero-Day Threat Detection
Can identify new, previously unseen attacks that don't match known signatures.

**Example:**
When WannaCry ransomware first appeared, signature-based systems couldn't detect it, but anomaly detection systems flagged the unusual file encryption behavior.

## 2. Adaptive Learning
Continuously learns and adapts to new patterns of normal behavior over time.

## 3. Insider Threat Detection
Excellent at identifying malicious insider activities that might appear normal to signature-based systems.

## 4. Advanced Persistent Threat (APT) Detection
Can identify long-term, low-profile attacks that gradually change behavior over time.

## 5. Comprehensive Coverage
Monitors all types of activities, not just known attack patterns.

**Key Points:**
- Proactive rather than reactive security approach
- Reduces reliance on threat intelligence updates
- Effective against sophisticated, targeted attacks
- Complements signature-based detection systems

**Interactive:**
- How would you convince a skeptical manager to invest in anomaly detection systems?

**Try it:**
> Think of a creative attack method that might bypass traditional security but would be caught by anomaly detection.

**Quiz:**
- What is the primary advantage of anomaly-based detection over signature-based detection?`,
  },
  {
    title: 'Challenges and Limitations',
    content: `While powerful, anomaly-based detection systems face several significant challenges that security teams must address.

## High False Positive Rates
Normal but unusual activities can trigger false alarms.

**Example:**
A legitimate software update that changes system behavior might be flagged as suspicious, requiring manual verification.

## Baseline Quality Issues
The effectiveness depends heavily on the quality and completeness of training data.

**Key Challenges:**
- Requires extensive training periods
- Difficulty distinguishing between benign and malicious anomalies
- Resource-intensive processing requirements
- Complex tuning and configuration needs

**Interactive:**
- Why might a new employee trigger more false positives than a long-time employee?

## Evasion Techniques
Sophisticated attackers can slowly modify their behavior to avoid detection.

**Example:**
Gradually increasing data exfiltration over months to blend with normal traffic growth.

**Try it:**
> How would you design an attack to evade anomaly detection systems?

**Diagram:**
Challenge Resolution Process:
[Anomaly Detected] -> [Analysis] -> [False Positive?] -> [Tune System] -> [Reduce Future FPs]
                                   -> [True Positive?] -> [Investigate] -> [Incident Response]

**Best Practices:**
- Regularly update baseline models
- Combine with signature-based detection
- Implement proper alerting hierarchies
- Continuously tune sensitivity thresholds

**Quiz:**
- What is a major challenge when implementing anomaly-based detection systems?`,
  },
  {
    title: 'Implementation Strategies',
    content: `Successfully implementing anomaly-based detection requires careful planning and a phased approach.

## Phase 1: Planning and Preparation
Define objectives, select appropriate tools, and prepare your environment.

**Key Steps:**
- Identify critical assets and data flows
- Define normal business operations
- Select appropriate detection algorithms
- Plan for baseline training period

## Phase 2: Deployment and Training
Deploy systems in monitoring mode and collect baseline data.

**Example:**
Deploy network monitoring sensors at key network segments and collect 30-60 days of traffic patterns before enabling alerting.

**Diagram:**
Implementation Timeline:
Months 1-2: [Planning] -> [Tool Selection] -> [Infrastructure Setup]
Months 3-4: [Baseline Collection] -> [Model Training] -> [Threshold Tuning]
Month 5+:   [Production Monitoring] -> [Continuous Improvement]

## Phase 3: Tuning and Optimization
Refine detection algorithms and reduce false positives.

**Interactive:**
- What metrics would you use to measure the success of your anomaly detection implementation?

**Try it:**
> Design a deployment plan for a small company with 100 employees and 50 servers.

**Best Practices:**
- Start with non-critical systems for testing
- Maintain detailed logs of all detected anomalies
- Regularly review and update detection rules
- Train security staff on system operation

**Key Points:**
- Requires significant initial investment in time and resources
- Success depends on organizational commitment
- Benefits increase over time as systems learn
- Integration with existing security tools is crucial

**Quiz:**
- What is the recommended first step in implementing anomaly-based detection?`,
  },
  {
    title: 'Real-World Applications and Case Studies',
    content: `Let's explore how anomaly-based detection is being used successfully in various industries and scenarios.

## Financial Services
Banks use anomaly detection to identify fraudulent transactions and insider trading.

**Example:**
A trading algorithm detects unusual trading patterns that preceded several major financial scandals, helping prevent market manipulation.

## Healthcare
Hospitals monitor access to patient records and medical devices for HIPAA compliance and patient safety.

**Case Study:**
A hospital's anomaly detection system identified that a nurse was accessing patient records outside their assigned ward, revealing an identity theft scheme.

## E-commerce
Online retailers monitor for account takeovers and fraudulent purchasing patterns.

**Interactive:**
- What types of anomalies would you expect to see in an e-commerce environment?

## Government and Defense
Critical infrastructure protection and national security monitoring.

**Example:**
Power grid operators use anomaly detection to identify potential cyber attacks on industrial control systems before they can cause widespread outages.

**Try it:**
> Choose an industry you're familiar with and identify three types of anomalies that would be critical to detect.

**Key Success Factors:**
- Industry-specific tuning and customization
- Integration with existing security operations
- Regular model updates and refinement
- Staff training and awareness programs

**Diagram:**
Multi-Industry Deployment:
[Finance] -> [Fraud Detection] -> [Real-time Transaction Monitoring]
[Healthcare] -> [Privacy Protection] -> [Access Pattern Analysis]  
[Retail] -> [Account Security] -> [Behavioral Analysis]

**Quiz:**
- In which industry would detecting unusual data access patterns be most critical for regulatory compliance?`,
  },
  {
    title: 'Future of Anomaly-Based Detection',
    content: `Anomaly-based detection continues to evolve with advances in artificial intelligence, machine learning, and computing power.

## Artificial Intelligence Integration
AI systems can identify complex, multi-dimensional anomalies that traditional statistical methods might miss.

**Emerging Technologies:**
- Deep learning neural networks for pattern recognition
- Natural language processing for log analysis
- Computer vision for behavioral analysis
- Quantum computing for complex calculations

## Cloud and Edge Computing
Distributed anomaly detection systems provide better coverage and faster response times.

**Example:**
IoT devices with embedded anomaly detection can identify and respond to threats locally, without relying on cloud connectivity.

**Interactive:**
- How might privacy regulations affect the future development of anomaly detection systems?

## Predictive Anomaly Detection
Future systems will predict potential anomalies before they occur, enabling proactive security measures.

**Try it:**
> Imagine you're designing an anomaly detection system for the year 2030. What capabilities would it have?

**Key Trends:**
- Increased automation and reduced false positives
- Better integration with incident response systems
- Enhanced privacy-preserving techniques
- Cross-organizational threat intelligence sharing

**Watch:**
[The future of AI in cybersecurity and anomaly detection](https://www.youtube.com/watch?v=future-example)

**Diagram:**
Evolution Timeline:
2020s: [Statistical Models] -> [Basic ML] -> [Rule-based Systems]
2030s: [AI Integration] -> [Predictive Analysis] -> [Autonomous Response]

**Quiz:**
- What emerging technology is expected to significantly improve anomaly detection capabilities?`,
  },
];

// Enhanced interactive components
const WatchBlock = ({ url }) => (
  <div className="my-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-500 rounded-lg shadow-sm glass-effect">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-2xl">🎬</span>
      <span className="font-semibold text-blue-800">Watch & Learn</span>
    </div>
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-700 underline hover:text-blue-900 transition-colors duration-200 font-medium"
    >
      Click here to watch a short video introduction
    </a>
  </div>
);

const TryItBlock = ({ children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-4">
      <button
        className="flex items-center gap-2 font-semibold text-yellow-800 bg-gradient-to-r from-yellow-100 to-yellow-200 px-4 py-2 rounded-lg hover:from-yellow-200 hover:to-yellow-300 transition-all duration-200 shadow-sm glass-effect"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-xl">💡</span>
        Try it {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="mt-3 p-4 bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-yellow-500 rounded-lg shadow-sm glass-effect animate-fadeIn">
          <div className="text-gray-800 leading-relaxed">{children}</div>
        </div>
      )}
    </div>
  );
};

const QuizBlock = ({ question }) => {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (question.toLowerCase().includes('zero-day') || question.toLowerCase().includes('never been seen')) {
      if (answer.trim().toLowerCase() === 'true')
        setFeedback('✅ Correct! Anomaly-based detection can identify new threats.');
      else setFeedback('❌ Incorrect. Anomaly-based detection can identify new threats.');
    } else if (question.toLowerCase().includes('limitation')) {
      if (answer.trim().toLowerCase() === 'b')
        setFeedback('✅ Correct! High false positive rate is a limitation.');
      else setFeedback('❌ Try again. Think about what anomaly systems might flag incorrectly.');
    } else {
      setFeedback('✅ Answer submitted! Great thinking!');
    }
  };
  
  return (
    <div className="my-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-lg shadow-sm glass-effect">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🧠</span>
        <span className="font-semibold text-green-800">Knowledge Check</span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="text-gray-800 font-medium">{question}</div>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={submitted}
          placeholder="Type your answer..."
        />
        <button
          type="submit"
          className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={submitted || !answer.trim()}
        >
          Submit Answer
        </button>
        {feedback && (
          <div className="text-green-700 font-medium mt-2 p-2 bg-white rounded border border-green-200">
            {feedback}
          </div>
        )}
      </form>
    </div>
  );
};

const DiagramBlock = ({ children }) => (
  <div className="my-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500 rounded-lg shadow-sm glass-effect">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-2xl">📊</span>
      <span className="font-semibold text-indigo-800">Process Diagram</span>
    </div>
    <pre className="font-mono text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-white p-3 rounded border border-indigo-200">
      {children}
    </pre>
  </div>
);

const ExampleBlock = ({ children }) => (
  <div className="my-4 p-4 bg-gradient-to-r from-gray-50 to-slate-50 border-l-4 border-gray-500 rounded-lg shadow-sm glass-effect">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-2xl">💼</span>
      <span className="font-semibold text-gray-800">Real-World Example</span>
    </div>
    <div className="text-gray-800 leading-relaxed">{children}</div>
  </div>
);

const InteractiveBlock = ({ children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-4">
      <button
        className="flex items-center gap-2 font-semibold text-purple-800 bg-gradient-to-r from-purple-100 to-purple-200 px-4 py-2 rounded-lg hover:from-purple-200 hover:to-purple-300 transition-all duration-200 shadow-sm glass-effect"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-xl">⚡</span>
        Interactive {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="mt-3 p-4 bg-gradient-to-r from-purple-50 to-violet-50 border-l-4 border-purple-500 rounded-lg shadow-sm glass-effect animate-fadeIn">
          <div className="text-gray-800 leading-relaxed">{children}</div>
        </div>
      )}
    </div>
  );
};

const KeyPointsBlock = ({ points }) => (
  <div className="my-4 p-4 bg-gradient-to-r from-cyan-50 to-teal-50 border-l-4 border-cyan-500 rounded-lg shadow-sm glass-effect">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-2xl">🔑</span>
      <span className="font-semibold text-cyan-800">Key Points</span>
    </div>
    <ul className="space-y-2">
      {points.map((point, i) => (
        <li key={i} className="flex items-start gap-2 text-gray-800">
          <span className="text-cyan-600 mt-1">•</span>
          <span className="leading-relaxed">{point}</span>
        </li>
      ))}
    </ul>
  </div>
);

// Enhanced lesson content parser
function renderLessonContent(content) {
  const blocks = content.split(/\n\n+/);
  return blocks.map((block, idx) => {
    // Watch block
    if (/\*\*Watch:?\*\*/i.test(block) || block.startsWith('**Watch')) {
      const match = block.match(/\((https?:[^)]+)\)/);
      return <WatchBlock key={idx} url={match ? match[1] : '#'} />;
    }
    // Try it block
    if (/\*\*Try it:?\*\*/i.test(block) || block.startsWith('**Try it')) {
      const text = block.replace(/\*\*Try it:?\*\*/i, '').replace(/^>\s*/, '').trim();
      return <TryItBlock key={idx}>{text}</TryItBlock>;
    }
    // Quiz block
    if (/\*\*Quiz:?\*\*/i.test(block) || block.startsWith('**Quiz')) {
      const text = block.replace(/\*\*Quiz:?\*\*/i, '').replace(/^-\s*/, '').trim();
      return <QuizBlock key={idx} question={text} />;
    }
    // Diagram block
    if (/\*\*Diagram:?\*\*/i.test(block) || block.startsWith('**Diagram')) {
      const text = block.replace(/\*\*Diagram:?\*\*/i, '').trim();
      return <DiagramBlock key={idx}>{text}</DiagramBlock>;
    }
    // Example block
    if (/\*\*Example:?\*\*/i.test(block) || block.startsWith('**Example')) {
      const text = block.replace(/\*\*Example:?\*\*/i, '').trim();
      return <ExampleBlock key={idx}>{text}</ExampleBlock>;
    }
    // Interactive block
    if (/\*\*Interactive:?\*\*/i.test(block) || block.startsWith('**Interactive')) {
      const text = block.replace(/\*\*Interactive:?\*\*/i, '').trim();
      return <InteractiveBlock key={idx}>{text}</InteractiveBlock>;
    }
    // Key Points block
    if (/\*\*Key Points:?\*\*/i.test(block) || block.startsWith('**Key Points')) {
      const lines = block.split('\n').slice(1).map(l => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
      return <KeyPointsBlock key={idx} points={lines} />;
    }
    // Best Practices block (treat as Key Points)
    if (/\*\*Best Practices:?\*\*/i.test(block) || block.startsWith('**Best Practices')) {
      const lines = block.split('\n').slice(1).map(l => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
      return (
        <div key={idx} className="my-4 p-4 bg-gradient-to-r from-emerald-50 to-green-50 border-l-4 border-emerald-500 rounded-lg shadow-sm glass-effect">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">✅</span>
            <span className="font-semibold text-emerald-800">Best Practices</span>
          </div>
          <ul className="space-y-2">
            {lines.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-gray-800">
                <span className="text-emerald-600 mt-1">•</span>
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    // Default: markdown with enhanced styling
    return (
      <div key={idx} className="prose prose-lg max-w-none text-gray-800 leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{block}</ReactMarkdown>
      </div>
    );
  });
}

const AnomalyBasedDetection = () => {
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);
  const [lessonTimers, setLessonTimers] = useState({});
  const [showAssessment, setShowAssessment] = useState(false);
  const [assessmentScore, setAssessmentScore] = useState(null);
  const [assessmentAnswers, setAssessmentAnswers] = useState({});
  
  const lessons = anomalyBasedTheoryLessons;
  const currentLesson = lessons[currentLessonIdx];

  useEffect(() => {
    if (!currentLesson) return;
    const lessonKey = `${currentLessonIdx}`;
    if (lessonTimers[lessonKey]) return;
    const timer = setTimeout(() => {
      setLessonTimers(prev => ({ ...prev, [lessonKey]: true }));
    }, MIN_LESSON_TIME);
    return () => clearTimeout(timer);
  }, [currentLessonIdx, currentLesson, lessonTimers]);

  const isLessonComplete = (lessonIdx) => lessonTimers[`${lessonIdx}`];
  const allLessonsComplete = lessons.every((_, idx) => isLessonComplete(idx));

  // Assessment logic
  const questions = [
    { id: 1, q: 'What is the main advantage of anomaly-based detection?', options: ['Fast scanning', 'Detects unknown threats', 'Low cost', 'Easy setup'], answer: 1 },
    { id: 2, q: 'What is a limitation of anomaly-based detection?', options: ['Cannot detect any threats', 'High false positive rate', 'Too expensive', 'Only works at night'], answer: 1 },
  ];
  
  const handleAssessmentChange = (qid, idx) => {
    setAssessmentAnswers(prev => ({ ...prev, [qid]: idx }));
  };
  
  const handleAssessmentSubmit = (e) => {
    e.preventDefault();
    let correct = 0;
    questions.forEach(q => {
      if (assessmentAnswers[q.id] === q.answer) correct++;
    });
    const score = (correct / questions.length) * 100;
    setAssessmentScore(score);
  };

  const handleNextLesson = () => {
    if (currentLessonIdx < lessons.length - 1) {
      setCurrentLessonIdx(idx => idx + 1);
    } else {
      setShowAssessment(true);
    }
  };
  
  const handlePrevLesson = () => {
    if (currentLessonIdx > 0) {
      setCurrentLessonIdx(idx => idx - 1);
    }
  };

  const lessonProgress = ((currentLessonIdx + 1) / lessons.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex">
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .glass-effect {
          backdrop-filter: blur(10px);
          background: rgba(255, 255, 255, 0.8);
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-pulse {
          animation: pulse 2s infinite;
        }
      `}</style>
      
      <main className="flex-1 min-h-screen flex justify-center">
  <div className="max-w-7xl w-full p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-4">
              Anomaly-Based Detection
            </h1>
            <div className="text-lg text-gray-600 mb-6">
              Learn how systems detect threats by identifying unusual patterns and behaviors
            </div>
            
            {/* Progress indicator */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-700">
                  Lesson {currentLessonIdx + 1} of {lessons.length}
                </span>
                <span className="text-sm text-gray-500">
                  Progress: {Math.round(lessonProgress)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${lessonProgress}%` }}
                ></div>
              </div>
            </div>
          </div>

          {!showAssessment ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-8 mb-8 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-600 bg-blue-50 px-3 py-1 rounded-full">
                  Lesson {currentLessonIdx + 1} of {lessons.length}
                </span>
                {isLessonComplete(currentLessonIdx) && (
                  <span className="text-green-600 text-sm flex items-center gap-1 bg-green-50 px-3 py-1 rounded-full">
                    ✓ Completed
                  </span>
                )}
              </div>
              
              <h2 className="text-2xl font-bold mb-6 text-gray-800">
                {currentLesson.title}
              </h2>
              
              <div className="prose prose-lg max-w-none mb-6">
                {renderLessonContent(currentLesson.content)}
              </div>
              
              <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                <button
                  className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handlePrevLesson}
                  disabled={currentLessonIdx === 0}
                >
                  ← Previous
                </button>
                
                <div className="text-center">
                  <div className="text-sm text-gray-500 mb-1">
                    {!isLessonComplete(currentLessonIdx) && "Reading time: ~20 seconds"}
                  </div>
                </div>
                
                <button
                  className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  onClick={handleNextLesson}
                  disabled={!isLessonComplete(currentLessonIdx)}
                >
                  {currentLessonIdx < lessons.length - 1 ? 'Next →' : 'Take Assessment'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-8 mb-8 shadow-xl">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">
                Assessment
              </h2>
              <p className="text-gray-600 mb-6">
                Test your understanding of anomaly-based detection concepts.
              </p>
              
              <form onSubmit={handleAssessmentSubmit} className="space-y-6">
                {questions.map((q, idx) => (
                  <div key={q.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="font-medium mb-3 text-gray-800">{q.q}</div>
                    <div className="space-y-2">
                      {q.options.map((opt, oidx) => (
                        <label
                          key={oidx}
                          className="flex items-center space-x-3 cursor-pointer text-gray-700 hover:bg-white p-2 rounded transition-colors"
                        >
                          <input
                            type="radio"
                            name={`q${q.id}`}
                            value={oidx}
                            checked={assessmentAnswers[q.id] === oidx}
                            onChange={() => handleAssessmentChange(q.id, oidx)}
                            required
                            className="text-blue-600"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                
                <button
                  type="submit"
                  className="px-6 py-3 rounded-lg bg-gradient-to-r from-green-600 to-green-700 text-white font-medium hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg"
                >
                  Submit Assessment
                </button>
              </form>
              
              {assessmentScore !== null && (
                <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200">
                  <div className={`text-lg font-semibold ${
                    assessmentScore >= PASSING_SCORE ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {assessmentScore >= PASSING_SCORE ? '🎉 Assessment Passed!' : '📚 Keep Learning'} 
                    <span className="ml-2">(Score: {Math.round(assessmentScore)}%)</span>
                  </div>
                  {assessmentScore >= PASSING_SCORE && (
                    <p className="text-green-700 mt-2">
                      Great job! You've mastered the concepts of anomaly-based detection.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center mt-8">
            <Link 
              to="/student/learning-modules"
              className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200 font-medium"
            >
              ← Back to Modules
            </Link>
            <Link 
              to="/student/theoretical/hybrid-detection"
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-colors duration-200 font-medium shadow-lg"
            >
              Next: Hybrid Detection →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AnomalyBasedDetection;