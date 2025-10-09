import { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../../components/Sidebar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import useTimeSpentTracker from '../../../hooks/useTimeSpentTracker';
import AuthContext from '../../../context/AuthContext';
// imported hybrid lesson content
import hybrid_what from '../../../content/modules/hybrid-detection/01-what-is-hybrid.md?raw';
import hybrid_how from '../../../content/modules/hybrid-detection/02-how-it-works.md?raw';
import hybrid_adv from '../../../content/modules/hybrid-detection/03-advantages.md?raw';
import hybrid_limits from '../../../content/modules/hybrid-detection/04-limitations.md?raw';
import hybrid_best from '../../../content/modules/hybrid-detection/05-best-practices.md?raw';
import useServerLessonProgress from '../../../hooks/useServerLessonProgress';

const MIN_LESSON_TIME = 20000; // 20 seconds
const PASSING_SCORE = 70;

const hybridTheoryLessons = [
  { title: "What is Hybrid Detection?", content: hybrid_what },
  { title: "How Hybrid Detection Works", content: hybrid_how },
  { title: "Advantages of Hybrid Detection", content: hybrid_adv },
  { title: "Limitations of Hybrid Detection", content: hybrid_limits },
  { title: "Best Practices for Hybrid Detection", content: hybrid_best },
];

// --- Helper components and renderLessonContent copied from TheoryModulePage.jsx ---
// (removed duplicate import of ReactMarkdown and remarkGfm)
// (removed duplicate import of useState)

const WatchBlock = ({ url }) => (
  <div className="my-3 p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
    <span className="font-semibold">Watch:</span>{' '}
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-700 underline hover:text-blue-900"
    >
      Click here to watch a short video introduction.
    </a>
  </div>
);

const TryItBlock = ({ children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-3">
      <button
        className="font-semibold text-yellow-700 bg-yellow-100 px-3 py-1 rounded hover:bg-yellow-200"
        onClick={() => setOpen(o => !o)}
      >
        Try it {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="mt-2 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
          {children}
        </div>
      )}
    </div>
  );
};

const QuizBlock = ({ question }) => {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState('');
  const handleSubmit = e => {
    e.preventDefault();
    setSubmitted(true);
    if (question.toLowerCase().includes('hybrid')) {
      if (answer.trim().toLowerCase() === 'true') setFeedback('Correct! Hybrid detection can detect both known and unknown threats.');
      else setFeedback('Incorrect. Hybrid detection can detect both known and unknown threats.');
    } else {
      setFeedback('Answer submitted!');
    }
  };
  return (
    <div className="my-3 p-3 bg-green-50 border-l-4 border-green-400 rounded">
      <div className="font-semibold mb-2">Quiz:</div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label>{question}</label>
        <input
          className="border rounded px-2 py-1"
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          disabled={submitted}
          placeholder="Type your answer..."
        />
        <button
          type="submit"
          className="self-start px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          disabled={submitted || !answer.trim()}
        >
          Submit
        </button>
        {feedback && <div className="text-green-700 font-medium mt-1">{feedback}</div>}
      </form>
    </div>
  );
};

const DiagramBlock = ({ children }) => (
  <div className="my-3 p-3 bg-indigo-50 border-l-4 border-indigo-400 rounded font-mono whitespace-pre-wrap">
    <div className="font-semibold mb-1">Diagram:</div>
    {children}
  </div>
);

const ExampleBlock = ({ children }) => (
  <div className="my-3 p-3 bg-gray-100 border-l-4 border-gray-400 rounded">
    <div className="font-semibold mb-1">Example:</div>
    {children}
  </div>
);

const InteractiveBlock = ({ children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-3">
      <button
        className="font-semibold text-purple-700 bg-purple-100 px-3 py-1 rounded hover:bg-purple-200"
        onClick={() => setOpen(o => !o)}
      >
        Interactive {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="mt-2 p-3 bg-purple-50 border-l-4 border-purple-400 rounded">
          {children}
        </div>
      )}
    </div>
  );
};

function renderLessonContent(content) {
  const blocks = content.split(/\n\n+/);
  return blocks.map((block, idx) => {
    if (/\*\*Watch:?\*\*/i.test(block) || block.startsWith('**Watch')) {
      const match = block.match(/\((https?:[^)]+)\)/);
      return <WatchBlock key={idx} url={match ? match[1] : '#'} />;
    }
    if (/\*\*Try it:?\*\*/i.test(block) || block.startsWith('**Try it')) {
      const text = block.replace(/\*\*Try it:?\*\*/i, '').replace(/^>\s*/, '').trim();
      return <TryItBlock key={idx}>{text}</TryItBlock>;
    }
    if (/\*\*Quiz:?\*\*/i.test(block) || block.startsWith('**Quiz')) {
      const text = block.replace(/\*\*Quiz:?\*\*/i, '').replace(/^-\s*/, '').trim();
      return <QuizBlock key={idx} question={text} />;
    }
    if (/\*\*Diagram:?\*\*/i.test(block) || block.startsWith('**Diagram')) {
      const text = block.replace(/\*\*Diagram:?\*\*/i, '').trim();
      return <DiagramBlock key={idx}>{text}</DiagramBlock>;
    }
    if (/\*\*Example:?\*\*/i.test(block) || block.startsWith('**Example')) {
      const text = block.replace(/\*\*Example:?\*\*/i, '').trim();
      return <ExampleBlock key={idx}>{text}</ExampleBlock>;
    }
    if (/\*\*Interactive:?\*\*/i.test(block) || block.startsWith('**Interactive')) {
      const text = block.replace(/\*\*Interactive:?\*\*/i, '').trim();
      return <InteractiveBlock key={idx}>{text}</InteractiveBlock>;
    }
    if (/\*\*Key Points:?\*\*/i.test(block) || block.startsWith('**Key Points')) {
      const lines = block.split('\n').slice(1).map(l => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
      return (
        <div key={idx} className="my-3 p-3 bg-cyan-50 border-l-4 border-cyan-400 rounded">
          <div className="font-semibold mb-1">Key Points:</div>
          <ul className="list-disc ml-6">
            {lines.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </div>
      );
    }
    return <ReactMarkdown key={idx} remarkPlugins={[remarkGfm]}>{block}</ReactMarkdown>;
  });
}

const HybridTheoryPage = () => {
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);
  const [lessonTimers, setLessonTimers] = useState({});
  const [showAssessment, setShowAssessment] = useState(false);
  const lessonContentRef = useRef(null);
  const [assessmentScore, setAssessmentScore] = useState(null);
  const [assessmentAnswers, setAssessmentAnswers] = useState({});

  const { user } = useContext(AuthContext);
  const serverLessonProgress = useServerLessonProgress({ moduleTitle: 'Hybrid Detection', lessons: hybridTheoryLessons, user });
  // --- Time Spent Tracking ---
  useTimeSpentTracker({
    studentId: user?.id,
    studentName: user?.name || 'Student',
    moduleName: 'Hybrid Detection',
    lessonName: hybridTheoryLessons[currentLessonIdx]?.title || 'Theory',
    lessonsCompleted: currentLessonIdx + 1,
    totalLessons: hybridTheoryLessons.length,
    engagementScore: 0, // Do not use readingProgress here
    endpoint: '/api/student/progress',
    authToken: user?.token || null,
  });

  const lessons = hybridTheoryLessons;
  const currentLesson = lessons[currentLessonIdx];

  useEffect(() => {
    setCurrentLessonIdx(0);
    setShowAssessment(false);
    setAssessmentScore(null);
    setAssessmentAnswers({});
  }, []);

  useEffect(() => {
    if (!currentLesson) return;
    const lessonKey = `${currentLessonIdx}`;
    if (lessonTimers[lessonKey]) return;
    const timer = setTimeout(() => {
      setLessonTimers(prev => ({ ...prev, [lessonKey]: true }));
    }, MIN_LESSON_TIME);
    return () => clearTimeout(timer);
  }, [currentLessonIdx]);

  const isLessonComplete = (lessonIdx) => lessonTimers[`${lessonIdx}`];

  // Persist to server once timer marks completion
  useEffect(()=>{
    if(!user?.id) return;
    if(lessonTimers[`${currentLessonIdx}`]){
      serverLessonProgress.markComplete(currentLessonIdx);
    }
  }, [lessonTimers, currentLessonIdx, user?.id, serverLessonProgress]);
  const allLessonsComplete = lessons.every((_, idx) => isLessonComplete(idx));

  // --- Assessment logic (mocked for now) ---
  const questions = [
    { id: 1, q: 'What is hybrid detection?', options: ['A', 'B', 'C'], answer: 0 },
    { id: 2, q: 'What is a limitation?', options: ['X', 'Y', 'Z'], answer: 1 },
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

  // --- Navigation logic ---
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

  // --- Progress ---
  const lessonProgress = ((currentLessonIdx) / lessons.length) * 100;

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
  {/* Sidebar provided by ModuleLayout */}
      <main className="flex-1 min-h-screen flex justify-center">
  <div className="max-w-7xl w-full p-6">
          <h1 className="text-2xl font-bold mb-4 text-gray-800 flex items-center gap-2">
            <span className="inline-block px-2 py-1 rounded text-blue-700 bg-blue-50">Hybrid Detection <span className="text-base font-medium text-blue-400">Theory</span></span>
          </h1>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-gray-600">Lesson {currentLessonIdx + 1} of {lessons.length}</span>
              <span className="text-xs text-gray-400">Progress: {Math.round(lessonProgress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded h-2">
              <div className="bg-blue-400 h-2 rounded transition-all duration-500" style={{ width: `${lessonProgress}%` }}></div>
            </div>
          </div>

          {!showAssessment ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 mb-8 shadow-sm w-full" style={{minWidth:'0'}}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-700">Lesson {currentLessonIdx + 1} of {lessons.length}</span>
                {isLessonComplete(currentLessonIdx) && (
                  <span className="text-green-500 text-sm flex items-center gap-1">✓ Completed</span>
                )}
              </div>
              <h2 className="text-xl font-semibold mb-2 text-blue-700">{currentLesson.title}</h2>
              <div
                ref={lessonContentRef}
                className="prose max-w-none border border-gray-100 rounded-lg p-5 bg-gray-50 mb-4 text-gray-900"
                style={{ fontSize: '1.08rem', lineHeight: '1.7' }}
              >
                {renderLessonContent(currentLesson.content)}
              </div>
              <div className="flex justify-between mt-4">
                <button
                  className="px-4 py-1 rounded bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition disabled:opacity-50"
                  onClick={handlePrevLesson}
                  disabled={currentLessonIdx === 0}
                >
                  ◀ Previous
                </button>
                <button
                  className="px-4 py-1 rounded bg-blue-500 text-white font-medium hover:bg-blue-600 transition disabled:opacity-50"
                  onClick={handleNextLesson}
                  disabled={!isLessonComplete(currentLessonIdx)}
                >
                  {currentLessonIdx < lessons.length - 1 ? 'Next ▶' : 'Take Assessment'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-8 mb-8 shadow-sm w-full" style={{minWidth:'0'}}>
              <h2 className="text-xl font-semibold mb-3 text-blue-700">Assessment</h2>
              <p className="mb-4 text-gray-700">Test your understanding of hybrid detection.</p>
              <form onSubmit={handleAssessmentSubmit} className="space-y-5">
                {questions.map((q, idx) => (
                  <div key={q.id} className="mb-3">
                    <div className="font-medium mb-1 text-gray-800">{q.q}</div>
                    <div className="space-y-1">
                      {q.options.map((opt, oidx) => (
                        <label key={oidx} className="flex items-center space-x-2 cursor-pointer text-gray-700">
                          <input
                            type="radio"
                            name={`q${q.id}`}
                            value={oidx}
                            checked={assessmentAnswers[q.id] === oidx}
                            onChange={() => handleAssessmentChange(q.id, oidx)}
                            required
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  type="submit"
                  className="px-4 py-1 rounded bg-blue-500 text-white font-medium hover:bg-blue-600 transition"
                >
                  Submit Assessment
                </button>
              </form>
              {assessmentScore !== null && (
                <div className="mt-5">
                  <div className={assessmentScore >= PASSING_SCORE ? 'text-green-500 font-semibold' : 'text-red-400 font-semibold'}>
                    {assessmentScore >= PASSING_SCORE ? 'Assessment Passed!' : 'Assessment Not Passed'} (Score: {Math.round(assessmentScore)}%)
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// --- Helper components and renderLessonContent copied from TheoryModulePage.jsx ---

export default HybridTheoryPage;
