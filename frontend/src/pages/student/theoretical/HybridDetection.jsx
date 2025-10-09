import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hyb_intro from '../../../content/modules/hybrid-detection/01-intro.md?raw';
import hyb_arch from '../../../content/modules/hybrid-detection/02-architecture.md?raw';
import hyb_integ from '../../../content/modules/hybrid-detection/03-integration.md?raw';
import hyb_adv from '../../../content/modules/hybrid-detection/04-advantages.md?raw';
import hyb_impl from '../../../content/modules/hybrid-detection/05-implementation.md?raw';
import hyb_chal from '../../../content/modules/hybrid-detection/06-challenges.md?raw';
import hyb_perf from '../../../content/modules/hybrid-detection/07-performance.md?raw';
import hyb_apps from '../../../content/modules/hybrid-detection/08-applications.md?raw';
import hyb_integ2 from '../../../content/modules/hybrid-detection/09-integration.md?raw';
import hyb_comp from '../../../content/modules/hybrid-detection/10-compliance.md?raw';

const MIN_LESSON_TIME = 20000; // 20 seconds
const PASSING_SCORE = 70;

const hybridDetectionTheoryLessons = [
  { title: 'Introduction to Hybrid Detection', content: hyb_intro },
  { title: 'Core Components and Architecture', content: hyb_arch },
  { title: 'Detection Methodologies Integration', content: hyb_integ },
  { title: 'Advantages and Benefits', content: hyb_adv },
  { title: 'Implementation Strategies', content: hyb_impl },
  { title: 'Challenges and Solutions', content: hyb_chal },
  { title: 'Performance Optimization', content: hyb_perf },
  { title: 'Real-World Applications', content: hyb_apps },
  { title: 'Integration with Security Ecosystems', content: hyb_integ2 },
  { title: 'Compliance and Regulatory Considerations', content: hyb_comp },
  { title: 'Future Trends and Evolution', content: hyb_perf },
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
    
    // Improved quiz logic for hybrid detection questions
    if (question.toLowerCase().includes('primary goal')) {
      if (answer.trim().toLowerCase() === 'b') {
        setFeedback('✅ Correct! The primary goal is to combine strengths while minimizing weaknesses of individual detection methods.');
      } else {
        setFeedback('❌ Incorrect. The main goal is to combine the strengths of different detection methods.');
      }
    } else if (question.toLowerCase().includes('trade-off')) {
      if (answer.trim().toLowerCase() === 'b') {
        setFeedback('✅ Correct! Parallel processing trades higher resource usage for comprehensive coverage.');
      } else {
        setFeedback('❌ Try again. Think about what parallel processing requires more of.');
      }
    } else if (question.toLowerCase().includes('false positives')) {
      if (answer.trim().toLowerCase() === 'c') {
        setFeedback('✅ Correct! Hybrid systems typically achieve 40-60% reduction in false positives.');
      } else {
        setFeedback('❌ Try again. Hybrid systems are quite effective at reducing false positives.');
      }
    } else if (question.toLowerCase().includes('phased implementation')) {
      if (answer.trim().toLowerCase() === 'b') {
        setFeedback('✅ Correct! Phased implementation allows for risk mitigation and learning.');
      } else {
        setFeedback('❌ Try again. Think about why gradual deployment might be beneficial.');
      }
    } else if (question.toLowerCase().includes('correlation complexity')) {
      if (answer.trim().toLowerCase() === 'b') {
        setFeedback('✅ Correct! Advanced correlation algorithms are key to managing complexity.');
      } else {
        setFeedback('❌ Try again. Think about what can help process multiple alert sources intelligently.');
      }
    } else if (question.toLowerCase().includes('performance metric')) {
      if (answer.trim().toLowerCase() === 'c') {
        setFeedback('✅ Correct! The balance of speed and accuracy is most important.');
      } else {
        setFeedback('❌ Try again. Think about what matters most in detection systems.');
      }
    } else if (question.toLowerCase().includes('national security')) {
      if (answer.trim().toLowerCase() === 'c') {
        setFeedback('✅ Correct! Government and Defense sector is most critical for national security.');
      } else {
        setFeedback('❌ Try again. Which sector would be most important for protecting national interests?');
      }
    } else if (question.toLowerCase().includes('soar platforms')) {
      if (answer.trim().toLowerCase() === 'b') {
        setFeedback('✅ Correct! SOAR integration provides automated response capabilities.');
      } else {
        setFeedback('❌ Try again. Think about what SOAR stands for and its main purpose.');
      }
    } else if (question.toLowerCase().includes('72 hours')) {
      if (answer.trim().toLowerCase() === 'c') {
        setFeedback('✅ Correct! GDPR requires breach notification within 72 hours.');
      } else {
        setFeedback('❌ Try again. Which European regulation has this strict notification requirement?');
      }
    } else if (question.toLowerCase().includes('significant driver')) {
      if (answer.trim().toLowerCase() === 'b') {
        setFeedback('✅ Correct! AI integration is expected to be the most significant driver of evolution.');
      } else {
        setFeedback('❌ Try again. Think about which technology is transforming cybersecurity most dramatically.');
      }
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
          placeholder="Type your answer (A, B, C, or D)..."
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

const BestPracticesBlock = ({ practices }) => (
  <div className="my-4 p-4 bg-gradient-to-r from-emerald-50 to-green-50 border-l-4 border-emerald-500 rounded-lg shadow-sm glass-effect">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-2xl">✅</span>
      <span className="font-semibold text-emerald-800">Best Practices</span>
    </div>
    <ul className="space-y-2">
      {practices.map((practice, i) => (
        <li key={i} className="flex items-start gap-2 text-gray-800">
          <span className="text-emerald-600 mt-1">•</span>
          <span className="leading-relaxed">{practice}</span>
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
    
    // Best Practices block
    if (/\*\*Best Practices:?\*\*/i.test(block) || block.startsWith('**Best Practices')) {
      const lines = block.split('\n').slice(1).map(l => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
      return <BestPracticesBlock key={idx} practices={lines} />;
    }
    
    // Challenge/Solution blocks
    if (block.includes('**Challenge:') || block.includes('**Solution:')) {
      return (
        <div key={idx} className="my-4 p-4 bg-gradient-to-r from-orange-50 to-orange-100 border-l-4 border-orange-500 rounded-lg shadow-sm glass-effect">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">⚡</span>
            <span className="font-semibold text-orange-800">Challenge & Solution</span>
          </div>
          <div className="prose prose-sm max-w-none text-orange-700">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{block}</ReactMarkdown>
          </div>
        </div>
      );
    }
    
    // Numbered sections (1., 2., etc.)
    if (/^\*\*\d+\./.test(block)) {
      return (
        <div key={idx} className="my-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-l-4 border-gray-400 rounded-lg shadow-sm glass-effect">
          <div className="prose prose-lg max-w-none text-gray-800">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{block}</ReactMarkdown>
          </div>
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

const HybridDetection = () => {
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);
  const [lessonTimers, setLessonTimers] = useState({});
  const [showAssessment, setShowAssessment] = useState(false);
  const [assessmentScore, setAssessmentScore] = useState(null);
  const [assessmentAnswers, setAssessmentAnswers] = useState({});
  const [lessonStartTime, setLessonStartTime] = useState(Date.now());
  const [readingProgress, setReadingProgress] = useState(0);
  const lessonContentRef = useRef(null);
  
  const currentLesson = hybridDetectionTheoryLessons[currentLessonIdx];
  
  const assessmentQuestions = [
    {
      question: "What is the main advantage of hybrid detection over single-method approaches?",
      options: [
        "It's faster than other methods",
        "It combines strengths of multiple detection techniques",
        "It requires less computational resources",
        "It only detects known threats"
      ],
      correct: 1
    },
    {
      question: "Which two detection methods does hybrid detection typically combine?",
      options: [
        "Signature-based and heuristic-based",
        "Anomaly-based and behavioral-based", 
        "Signature-based and anomaly-based",
        "Protocol-based and content-based"
      ],
      correct: 2
    },
    {
      question: "What is a key challenge in implementing hybrid detection systems?",
      options: [
        "Limited threat detection capability",
        "Resource management and alert correlation",
        "Only works with known signatures",
        "Cannot detect zero-day attacks"
      ],
      correct: 1
    },
    {
      question: "What percentage reduction in false positives can hybrid systems typically achieve?",
      options: [
        "10-20%",
        "25-35%",
        "40-60%",
        "70-80%"
      ],
      correct: 2
    },
    {
      question: "Which integration approach offers the best balance of speed and comprehensive coverage?",
      options: [
        "Sequential processing only",
        "Parallel processing with correlation",
        "Manual analysis only",
        "Signature-based detection only"
      ],
      correct: 1
    }
  ];

  useEffect(() => {
    setLessonStartTime(Date.now());
    setReadingProgress(0);
  }, [currentLessonIdx]);

  // Scroll tracking for reading progress
  useEffect(() => {
    const handleScroll = () => {
      if (lessonContentRef.current) {
        const element = lessonContentRef.current;
        const scrollTop = window.scrollY;
        const elementTop = element.offsetTop;
        const elementHeight = element.scrollHeight;
        const windowHeight = window.innerHeight;
        
        const scrolled = Math.max(0, scrollTop - elementTop + windowHeight);
        const progress = Math.min(100, (scrolled / elementHeight) * 100);
        
        setReadingProgress(progress);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentLessonIdx]);

  const handleNextLesson = () => {
    const timeSpent = Date.now() - lessonStartTime;
    const lessonKey = `lesson-${currentLessonIdx}`;
    
    setLessonTimers(prev => ({
      ...prev,
      [lessonKey]: timeSpent
    }));

    if (timeSpent < MIN_LESSON_TIME) {
      alert(`Please spend at least ${MIN_LESSON_TIME / 1000} seconds reading this lesson to ensure proper understanding.`);
      return;
    }

    if (currentLessonIdx < hybridDetectionTheoryLessons.length - 1) {
      setCurrentLessonIdx(currentLessonIdx + 1);
    } else {
      setShowAssessment(true);
    }
  };

  const handlePreviousLesson = () => {
    if (currentLessonIdx > 0) {
      setCurrentLessonIdx(currentLessonIdx - 1);
    }
  };

  const handleAssessmentSubmit = () => {
    let correct = 0;
    assessmentQuestions.forEach((q, idx) => {
      if (assessmentAnswers[idx] === q.correct) {
        correct++;
      }
    });
    const score = Math.round((correct / assessmentQuestions.length) * 100);
    setAssessmentScore(score);

    // Submit progress
    const user = JSON.parse(localStorage.getItem('student_user') || '{}');
    if (user.id) {
      const progressData = {
        studentId: user.id,
        moduleName: 'Hybrid Detection',
        lessonTitle: 'Assessment Complete',
        completed: score >= PASSING_SCORE,
        timeSpent: Object.values(lessonTimers).reduce((sum, time) => sum + time, 0),
        engagementScore: Math.min(100, readingProgress + (score >= PASSING_SCORE ? 20 : 0))
      };
      
      fetch('http://localhost:8000/student/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(progressData)
      }).catch(console.error);
    }
  };

  if (showAssessment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex">
        <main className="flex-1 min-h-screen flex justify-center">
          <div className="max-w-7xl w-full p-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-8 glass-effect">
              <h2 className="text-2xl font-bold text-[#1E5780] mb-6">Assessment: Hybrid Detection</h2>
              
              {assessmentScore === null ? (
                <div className="space-y-6">
                  {assessmentQuestions.map((q, idx) => (
                    <div key={idx} className="p-4 border border-gray-200 rounded-lg">
                      <p className="font-medium mb-3">{q.question}</p>
                      <div className="space-y-2">
                        {q.options.map((option, optIdx) => (
                          <label key={optIdx} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`q${idx}`}
                              value={optIdx}
                              onChange={(e) => setAssessmentAnswers(prev => ({
                                ...prev,
                                [idx]: parseInt(e.target.value)
                              }))}
                              className="text-[#1E5780]"
                            />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  <button
                    onClick={handleAssessmentSubmit}
                    className="px-6 py-3 bg-[#1E5780] text-white rounded-lg hover:bg-[#164666] transition-colors font-medium"
                    disabled={Object.keys(assessmentAnswers).length < assessmentQuestions.length}
                  >
                    Submit Assessment
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className={`text-6xl font-bold ${assessmentScore >= PASSING_SCORE ? 'text-green-600' : 'text-red-600'}`}>
                    {assessmentScore}%
                  </div>
                  <div className={`text-xl ${assessmentScore >= PASSING_SCORE ? 'text-green-700' : 'text-red-700'}`}>
                    {assessmentScore >= PASSING_SCORE ? 'Congratulations! You passed!' : 'Keep studying and try again!'}
                  </div>
                  <Link
                    to="/student/learning-modules"
                    className="inline-block px-6 py-3 bg-[#1E5780] text-white rounded-lg hover:bg-[#164666] transition-colors font-medium"
                  >
                    Back to Modules
                  </Link>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex">
      <main className="flex-1 min-h-screen flex justify-center">
  <div className="max-w-7xl w-full p-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-8 glass-effect">
            {/* Progress indicator */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">
                  Lesson {currentLessonIdx + 1} of {hybridDetectionTheoryLessons.length}
                </span>
                <span className="text-sm text-gray-600">
                  {Math.round(readingProgress)}% read
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-[#1E5780] to-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentLessonIdx + 1) / hybridDetectionTheoryLessons.length) * 100}%` }}
                ></div>
              </div>
            </div>

            <h1 className="text-3xl font-bold text-[#1E5780] mb-2">Hybrid Detection</h1>
            <h2 className="text-xl text-gray-700 mb-6">{currentLesson.title}</h2>

            <div ref={lessonContentRef} className="prose prose-lg max-w-none mb-8">
              {renderLessonContent(currentLesson.content)}
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between items-center pt-6 border-t border-gray-200">
              <button
                onClick={handlePreviousLesson}
                disabled={currentLessonIdx === 0}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              <span className="text-sm text-gray-600">
                Lesson {currentLessonIdx + 1} of {hybridDetectionTheoryLessons.length}
              </span>
              
              <button
                onClick={handleNextLesson}
                className="px-6 py-2 bg-[#1E5780] text-white rounded-lg hover:bg-[#164666] transition-colors"
              >
                {currentLessonIdx === hybridDetectionTheoryLessons.length - 1 ? 'Take Assessment' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HybridDetection;
