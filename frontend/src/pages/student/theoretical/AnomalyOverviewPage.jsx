import Sidebar from '../../../components/Sidebar';
import { useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import useTimeSpentTracker from '../../../hooks/useTimeSpentTracker';
import AuthContext from '../../../context/AuthContext';

const AnomalyOverviewPage = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  useTimeSpentTracker({
    studentId: user?.id,
    studentName: user?.name || 'Student',
    moduleName: 'Anomaly-Based Detection',
    lessonName: 'Overview',
    lessonsCompleted: 0,
    totalLessons: 0,
    engagementScore: 0,
    authToken: user?.token || null
  });

  return (
    <div className="flex min-h-screen bg-[#f5f8fa] font-sans">
  {/* Sidebar provided by ModuleLayout */}
      <main className="flex-1 bg-[#f5f8fa]">
        <div className="max-w-3xl mx-auto p-8">
          <h1 className="text-3xl font-bold mb-4 text-blue-700">Anomaly-Based Detection <span className="text-lg font-medium text-blue-400">Overview</span></h1>
          <div className="mb-8 p-6 bg-white border border-blue-100 rounded-xl shadow-sm text-gray-800 text-lg">
            <p className="mb-4">Anomaly-based detection identifies threats by looking for unusual patterns or behaviors that deviate from what is considered normal. Unlike signature-based detection, which relies on known patterns, anomaly-based systems can detect new and unknown threats by learning what is typical and flagging anything that stands out.</p>
            <ul className="list-disc ml-6 mb-4">
              <li>Detects zero-day and evolving threats</li>
              <li>Learns normal behavior and flags deviations</li>
              <li>Can result in more false positives if normal is not well defined</li>
            </ul>
            <p className="mb-2">This approach is especially useful for identifying zero-day attacks and evolving threats, but it requires a good understanding of what 'normal' looks like in your environment.</p>
          </div>
          <button
            className="px-6 py-2 rounded bg-blue-500 text-white font-semibold hover:bg-blue-600 transition"
            onClick={() => navigate('/student/theoretical/anomaly-based-detection/theory?lesson=0')}
          >
            Start Theory
          </button>
        </div>
      </main>
    </div>
  );
};

export default AnomalyOverviewPage;
