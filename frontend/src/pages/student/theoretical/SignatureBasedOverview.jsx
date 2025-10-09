import React, { useContext } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../../../context/AuthContext';
import useTimeSpentTracker from '../../../hooks/useTimeSpentTracker';

const SignatureBasedOverview = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  // Use the reusable time spent tracker hook with all required fields
  useTimeSpentTracker({
    studentId: user?.id,
    studentName: user?.name || 'Student',
    moduleName: 'Signature-Based Detection',
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
          <h1 className="text-3xl font-bold mb-4 text-blue-700">Signature-Based Detection <span className="text-lg font-medium text-blue-400">Overview</span></h1>
          <div className="mb-8 p-6 bg-white border border-blue-100 rounded-xl shadow-sm text-gray-800 text-lg">
            <p className="mb-4">Signature-based detection is a method of identifying known threats by comparing network traffic or system activity against a database of known attack patterns, or "signatures." This approach is particularly effective against known threats and is widely used in intrusion detection systems (IDS) and antivirus software.</p>
            <ul className="list-disc ml-6 mb-4">
              <li>Identifies known attack patterns</li>
              <li>Low false positive rate</li>
              <li>Fast detection of known threats</li>
              <li>Easy to implement and maintain</li>
            </ul>
            <p className="mb-2">This approach provides excellent protection against known threats, but requires regular updates to signature databases to remain effective against evolving attack patterns.</p>
          </div>
          <button
            className="px-6 py-2 rounded bg-blue-500 text-white font-semibold hover:bg-blue-600 transition"
            onClick={() => navigate('/student/theoretical/signature-based-detection/theory')}
          >
            Start Theory
          </button>
        </div>
      </main>
    </div>
  );
};

export default SignatureBasedOverview;