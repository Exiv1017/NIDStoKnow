import Sidebar from '../../../components/Sidebar';
import { useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import useTimeSpentTracker from '../../../hooks/useTimeSpentTracker';
import AuthContext from '../../../context/AuthContext';

const HybridOverviewPage = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  useTimeSpentTracker({
    studentId: user?.id,
    studentName: user?.name || 'Student',
    moduleName: 'Hybrid Detection',
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
          <h1 className="text-3xl font-bold mb-4 text-blue-700">Hybrid Detection <span className="text-lg font-medium text-blue-400">Overview</span></h1>
          <div className="mb-8 p-6 bg-white border border-blue-100 rounded-xl shadow-sm text-gray-800 text-lg">
            <p className="mb-4">Hybrid detection combines the strengths of both signature-based and anomaly-based methods. By using both known threat signatures and monitoring for unusual activity, hybrid systems can detect a wider range of attacks, including both known and unknown threats.</p>
            <ul className="list-disc ml-6 mb-4">
              <li>Detects both known and unknown threats</li>
              <li>Reduces false positives and negatives</li>
              <li>May require more resources and careful tuning</li>
            </ul>
            <p className="mb-2">This approach provides more comprehensive protection, but may be more complex to manage and configure than single-method systems.</p>
          </div>
          <button
            className="px-6 py-2 rounded bg-blue-500 text-white font-semibold hover:bg-blue-600 transition"
            onClick={() => navigate('/student/theoretical/hybrid-detection/theory')}
          >
            Start Theory
          </button>
        </div>
      </main>
    </div>
  );
};

export default HybridOverviewPage;
