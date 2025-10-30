import { useState, useContext, useEffect } from 'react';
import AuthContext from '../../context/AuthContext';
import InstructorSidebar from '../../components/InstructorSidebar';
import { Pie, Bar } from 'react-chartjs-2';
import InstructorNotificationsBell from '../../components/instructor/InstructorNotificationsBell';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
} from 'chart.js';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title
);

const InstructorDashboard = () => {
  const { user } = useContext(AuthContext);
  // Optional room scoping: if the page URL contains ?room_id=<id>, append it to instructor API calls
  const roomId = (typeof window !== 'undefined') ? new URLSearchParams(window.location.search).get('room_id') : null;
  // Notifications handled by shared bell component
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  // --- Student progress state ---
  // student progress feature removed

  // --- State for dynamic dashboard data ---
  const [modules, setModules] = useState([]);
  const [stats, setStats] = useState({ totalStudents: 0, activeModules: 0, avgCompletion: 0, feedbackCount: 0, atRisk: 0 });
  const [notifications, setNotifications] = useState([]);
  const [assessmentTrend, setAssessmentTrend] = useState([]); // Array of numbers (avg scores per week)
  const [recentActivity, setRecentActivity] = useState([]);
  const [moduleRequestCounts, setModuleRequestCounts] = useState({ pending: 0, approved: 0, rejected: 0 });

  // Helper: build Authorization header if token present
  const authHeader = () => (user?.token ? { 'Authorization': `Bearer ${user.token}` } : {});

  // Function to fetch notifications
  const fetchNotifications = () => {
    fetch('/api/instructor/notifications', {
      headers: authHeader()
    })
      .then(res => res.json())
      .then(data => Array.isArray(data) ? setNotifications(data) : setNotifications([]))
      .catch((err) => { setNotifications([]); console.error('Notifications fetch error:', err); });
  };

  // Fetch unread notification count
  const fetchNotificationsCount = () => {
    fetch('/api/instructor/notifications/count', {
      headers: authHeader()
    })
      .then(res => res.json())
      .then(data => setUnreadCount(typeof data?.count === 'number' ? data.count : 0))
      .catch((err) => { setUnreadCount(0); console.error('Notifications count error:', err); });
  };

  // --- Fetch dashboard data from backend ---
  // Helper to fetch stats (for event-driven refresh)
  const fetchStats = () => {
    try {
      const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
      let statsUrl = `${API_BASE}/api/instructor/stats`;
      if (roomId) statsUrl += `?room_id=${encodeURIComponent(roomId)}`;
      fetch(statsUrl.replace(/([^:]?)\/\/+/g,'$1/'), { headers: authHeader() })
        .then(res => res.json())
        .then(data => setStats(data && typeof data === 'object' ? data : { totalStudents: 0, activeModules: 0, avgCompletion: 0, feedbackCount: 0 }))
        .catch((err) => { setStats({ totalStudents: 0, activeModules: 0, avgCompletion: 0, feedbackCount: 0 }); console.error('Stats fetch error:', err); });
    } catch (e) {
      setStats({ totalStudents: 0, activeModules: 0, avgCompletion: 0, feedbackCount: 0 });
      console.error('Stats fetch setup error:', e);
    }
  };

  useEffect(() => {
    // Fetch modules (room-scoped when room_id present)
    try {
      const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
      let modulesUrl = `${API_BASE}/api/instructor/modules`;
      if (roomId) modulesUrl += `?room_id=${encodeURIComponent(roomId)}`;
      fetch(modulesUrl.replace(/([^:]?)\/\/+/g,'$1/'), { headers: authHeader() })
        .then(res => res.json())
        .then(data => Array.isArray(data) ? setModules(data) : setModules([]))
        .catch((err) => { setModules([]); console.error('Modules fetch error:', err); });
    } catch (e) {
      setModules([]);
      console.error('Modules fetch setup error:', e);
    }
    // Fetch stats
  fetchStats();
  // Fetch notifications initially
  fetchNotifications();
  fetchNotificationsCount();
    // Fetch module requests (for instructor's own submissions)
    fetch('/api/instructor/module-requests', { headers: authHeader() })
      .then(res => res.json())
      .then(data => {
        if(Array.isArray(data)){
          const pending = data.filter(r=>r.status==='pending').length;
          const approved = data.filter(r=>r.status==='approved').length;
            const rejected = data.filter(r=>r.status==='rejected').length;
          setModuleRequestCounts({ pending, approved, rejected });
        } else {
          setModuleRequestCounts({ pending:0, approved:0, rejected:0 });
        }
      })
      .catch(()=> setModuleRequestCounts({ pending:0, approved:0, rejected:0 }));
    // Fetch assessment performance trend (quiz scores). Fallback to feedback-trend if needed.
  try {
    const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
    let assessUrl = `${API_BASE}/api/instructor/assessment-trend`;
    if (roomId) assessUrl += `?room_id=${encodeURIComponent(roomId)}`;
    fetch(assessUrl.replace(/([^:]?)\/\/+/g,'$1/'), { headers: authHeader() })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if(Array.isArray(data) && data.length){
          setAssessmentTrend(data);
        } else {
          // fallback
          let feedbackUrl = `${API_BASE}/api/instructor/feedback-trend`;
          if (roomId) feedbackUrl += `?room_id=${encodeURIComponent(roomId)}`;
          fetch(feedbackUrl.replace(/([^:]?)\/\/+/g,'$1/'), { headers: authHeader() })
            .then(r=>r.json())
            .then(d=> setAssessmentTrend(Array.isArray(d)? d: []))
            .catch(()=> setAssessmentTrend([]));
        }
      })
      .catch(()=> setAssessmentTrend([]));
  } catch (e) { setAssessmentTrend([]); console.error('Assessment trend fetch setup error:', e); }
    // Fetch recent activity (room-scoped when room_id present)
    try {
      const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
      let recentUrl = `${API_BASE}/api/instructor/recent-activity`;
      if (roomId) recentUrl += `?room_id=${encodeURIComponent(roomId)}`;
      fetch(recentUrl.replace(/([^:]?)\/\/+/g,'$1/'), { headers: authHeader() })
        .then(res => res.json())
        .then(data => Array.isArray(data) ? setRecentActivity(data) : setRecentActivity([]))
        .catch((err) => { setRecentActivity([]); console.error('Recent activity fetch error:', err); });
    } catch (e) {
      setRecentActivity([]);
      console.error('Recent activity fetch setup error:', e);
    }

    // Listen for studentsChanged event to refresh stats
    const handleStudentsChanged = () => {
      fetchStats();
    };
    window.addEventListener('studentsChanged', handleStudentsChanged);

    // Set up periodic refresh every 30 seconds (notifications + requests)
    const interval = setInterval(() => {
      fetchNotifications();
      fetchNotificationsCount();
      fetch('/api/instructor/module-requests', { headers: authHeader() })
        .then(res=>res.json())
        .then(data=>{
          if(Array.isArray(data)){
            const pending = data.filter(r=>r.status==='pending').length;
            const approved = data.filter(r=>r.status==='approved').length;
            const rejected = data.filter(r=>r.status==='rejected').length;
            setModuleRequestCounts({ pending, approved, rejected });
          }
        })
        .catch(()=>{});
    }, 30000);

    // Cleanup interval and event listener on component unmount
    return () => {
      clearInterval(interval);
      window.removeEventListener('studentsChanged', handleStudentsChanged);
    };
  }, []);
  // Removed duplicate notification interval useEffect (merged into single effect above)

  // Defensive chart data
  // Helper to abbreviate module names for display in charts
  const abbreviateModule = (name) => {
    const n = (name || '').toLowerCase();
    if (n.includes('anomaly')) return 'ABD'; // Anomaly-Based Detection
    if (n.includes('hybrid')) return 'HD';   // Hybrid Detection
    if (n.includes('signature')) return 'SBD'; // Signature-Based Detection
    return name || '';
  };

  // student display helper removed with progress feature

  const studentEnrollmentData = {
    // Show full names in the legend
    labels: Array.isArray(modules) ? modules.map((m) => m.name) : [],
    datasets: [
      {
        // Prefer explicit module.students from backend, then studentsWithProgress, then global stats.totalStudents
        data: Array.isArray(modules)
          ? modules.map((m) => (typeof m.students === 'number' ? m.students : (typeof m.studentsWithProgress === 'number' ? m.studentsWithProgress : (stats.totalStudents || 0))))
          : [],
        backgroundColor: ['#1E5780', '#206EA6', '#A3A3A3'],
        borderWidth: 1,
      },
    ],
  };

  // Build multi-line labels to show index on top line and abbreviation under it (e.g., "0\nSBD")
  const moduleCompletionData = {
    labels: Array.isArray(modules)
      ? modules.map((m, i) => [String(i), abbreviateModule(m.name)])
      : [],
    datasets: [
      {
        label: 'Completion %',
        // Compute completion defensively on the client using finishedCount / denominator
        // denominator: prefer m.students (explicit total students for module), then m.studentsWithProgress, then global stats.totalStudents
        data: Array.isArray(modules)
          ? modules.map((m) => {
              const finished = Number(m?.finishedCount || 0);
              const denom = (typeof m?.students === 'number' && m.students > 0)
                ? m.students
                : (typeof m?.studentsWithProgress === 'number' && m.studentsWithProgress > 0)
                  ? m.studentsWithProgress
                  : (typeof stats?.totalStudents === 'number' && stats.totalStudents > 0)
                    ? stats.totalStudents
                    : 0;
              if (denom <= 0) {
                // Fall back to any server-provided completion value or 0
                return (typeof m?.completion === 'number') ? Math.max(0, Math.min(100, Math.round(m.completion))) : 0;
              }
              const percent = Math.round((finished / denom) * 100);
              // Clamp to 0..100
              return Math.max(0, Math.min(100, percent));
            })
          : [],
        backgroundColor: '#22c55e',
        borderRadius: 6,
      },
    ],
  };

  const assessmentTrendData = {
    labels: Array.isArray(assessmentTrend) ? assessmentTrend.map((_, i) => `Week ${i + 1}`) : [],
    datasets: [
      {
        label: 'Avg Score',
        data: Array.isArray(assessmentTrend) ? assessmentTrend : [],
        backgroundColor: '#60a5fa',
        borderRadius: 6,
      },
    ],
  };

  // student progress data and at-risk computation removed

  // Helper function to format notification time
  const formatNotificationTime = (timeString) => {
    try {
      const date = new Date(timeString);
      const now = new Date();
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));
      const diffInHours = Math.floor(diffInMinutes / 60);
      const diffInDays = Math.floor(diffInHours / 24);
      
      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
      if (diffInHours < 24) return `${diffInHours} hours ago`;
      if (diffInDays < 7) return `${diffInDays} days ago`;
      
      // For older notifications, show the actual date
      return date.toLocaleDateString();
    } catch (error) {
      return timeString; // Fallback to original string if parsing fails
    }
  };

  // Function to delete a specific notification
  const deleteNotification = async (notificationId) => {
    try {
      console.log('Deleting notification:', notificationId);
      const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
      const response = await fetch(`${API_BASE}/api/instructor/notifications/${notificationId}`.replace(/([^:]?)\/\/+/g,'$1/'), {
        method: 'DELETE',
        headers: user?.token ? { 'Authorization': `Bearer ${user.token}` } : {}
      });
      
      if (response.ok) {
        console.log('Notification deleted successfully');
        // Remove the notification from the local state
        setNotifications(prevNotifications => {
          const updated = prevNotifications.filter(n => n.id !== notificationId);
          console.log('Updated notifications:', updated);
          return updated;
        });
        // Also refresh unread count
        fetchNotificationsCount();
      } else {
        console.error('Failed to delete notification:', response.status);
        const errorText = await response.text();
        console.error('Error details:', errorText);
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // formatDuration removed with progress feature

  // Function to mark a specific notification as read (without deletion)
  const markNotificationRead = async (notificationId) => {
    try {
      const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
      const response = await fetch(`${API_BASE}/api/instructor/notifications/${notificationId}/read`.replace(/([^:]?)\/\/+/g,'$1/'), {
        method: 'PATCH',
        headers: user?.token ? { 'Authorization': `Bearer ${user.token}` } : {}
      });
      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        fetchNotificationsCount();
      } else {
        console.error('Failed to mark notification read:', response.status);
      }
    } catch (e) {
      console.error('Error marking notification read:', e);
    }
  };

  // Function to mark all notifications as read
  const markAllAsRead = async () => {
    try {
      console.log('Marking all notifications as read');
      const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
      const response = await fetch(`${API_BASE}/api/instructor/notifications/mark-all-read`.replace(/([^:]?)\/\/+/g,'$1/'), {
        method: 'POST',
        headers: user?.token ? { 'Authorization': `Bearer ${user.token}` } : {}
      });
      
      if (response.ok) {
        console.log('All notifications marked as read');
        // Clear all notifications from the local state
        setNotifications([]);
        setIsNotificationOpen(false);
        fetchNotificationsCount();
      } else {
        console.error('Failed to mark all notifications as read:', response.status);
        const errorText = await response.text();
        console.error('Error details:', errorText);
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  // Function to manually trigger a test notification (for testing purposes)
  const createTestNotification = async () => {
    try {
      const response = await fetch('/api/instructor/notifications/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.token ? { 'Authorization': `Bearer ${user.token}` } : {}),
        },
        body: JSON.stringify({
          message: `Test notification created at ${new Date().toLocaleTimeString()}`,
          notification_type: 'info'
        })
      });
      
      if (response.ok) {
        console.log('Test notification created');
        // Refresh notifications immediately
        fetchNotifications();
      }
    } catch (error) {
      console.error('Error creating test notification:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <InstructorSidebar />
      <main className="ml-64 overflow-y-auto">
        <div className="p-4 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-black mb-1">Welcome Back, {user?.name}</h1>
              <p className="text-gray-600 text-base">Here are your instructor insights</p>
            </div>
            <div className="relative">
              <InstructorNotificationsBell refreshIntervalMs={30000} appearance="light" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-10">
            <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow border border-gray-100 flex flex-col items-center">
              <h3 className="text-lg font-medium text-gray-600 mb-1">Total Students</h3>
              <p className="text-4xl font-extrabold text-[#1E5780] mt-2">{stats.totalStudents}</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow border border-gray-100 flex flex-col items-center">
              <h3 className="text-lg font-medium text-gray-600 mb-1">Active Modules</h3>
              <p className="text-4xl font-extrabold text-[#1E5780] mt-2">{stats.activeModules}</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow border border-gray-100 flex flex-col items-center">
              <h3 className="text-lg font-medium text-gray-600 mb-1">Avg. Completion</h3>
              <p className="text-4xl font-extrabold text-[#1E5780] mt-2">{stats.avgCompletion}%</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow border border-gray-100 flex flex-col items-center">
              <h3 className="text-lg font-medium text-gray-600 mb-1">At‑Risk Students</h3>
              <p className="text-4xl font-extrabold text-[#1E5780] mt-2">{stats.atRisk}</p>
              <span className="text-xs text-gray-400 mt-1">Progress &lt; 20% &amp; low engagement</span>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow border border-gray-100 flex flex-col items-center">
              <h3 className="text-lg font-medium text-gray-600 mb-1">My Module Requests</h3>
              <p className="text-4xl font-extrabold text-[#1E5780] mt-2">{moduleRequestCounts.pending}</p>
              <div className="flex gap-2 text-[10px] mt-2">
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">A {moduleRequestCounts.approved}</span>
                <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-semibold">R {moduleRequestCounts.rejected}</span>
              </div>
              <a href="/instructor/manage-modules" className="mt-3 text-xs text-blue-600 hover:underline">Manage</a>
            </div>
          </div>

          <div className="mb-8">
            <hr className="border-t border-gray-300" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 items-stretch">
            <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-shadow p-6 flex flex-col items-center border border-gray-100 h-full">
              <h3 className="text-lg font-semibold mb-4 text-[#0E6BA8]">Student Enrollment</h3>
              <div className="w-full h-80 flex items-center justify-center">
                {stats.totalStudents > 0 ? (
                  <div className="w-full h-full">
                    <Pie data={studentEnrollmentData} options={{ plugins: { legend: { position: 'bottom' } }, maintainAspectRatio: false }} />
                  </div>
                ) : (
                  <div className="text-center text-gray-500">
                    <div className="text-lg font-medium mb-2">No students joined yet</div>
                    <div className="text-sm">Once students join your room, enrollment charts will appear here.</div>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-shadow p-6 flex flex-col items-center border border-gray-100 h-full">
              <h3 className="text-lg font-semibold mb-4 text-[#0E6BA8]">Module Completion</h3>
              <div className="w-full h-80 flex items-center justify-center">
                {stats.totalStudents > 0 ? (
                  <div className="w-full h-full">
                    <Bar data={moduleCompletionData} options={{
                      plugins: { legend: { display: false } },
                      scales: {
                        y: { min: 0, max: 100, ticks: { stepSize: 20, autoSkip: false } },
                        x: { ticks: { autoSkip: false } }
                      },
                      maintainAspectRatio: false,
                    }} />
                  </div>
                ) : (
                  <div className="text-center text-gray-500">
                    <div className="text-lg font-medium mb-2">No progress data</div>
                    <div className="text-sm">Module completion will be shown once students complete lessons.</div>
                  </div>
                )}
              </div>
              {/* Minimal legend for abbreviations */}
              <div className="text-xs text-gray-500 mt-3 text-center">
                <span className="font-medium text-gray-600">ABD</span> = Anomaly‑Based Detection, <span className="font-medium text-gray-600">HD</span> = Hybrid Detection, <span className="font-medium text-gray-600">SBD</span> = Signature‑Based Detection
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-shadow p-6 flex flex-col items-center border border-gray-100 h-full">
              <h3 className="text-lg font-semibold mb-1 text-[#0E6BA8]">Assessment Performance Trend</h3>
              <span className="text-xs text-gray-400 mb-4">Weekly Avg Quiz %</span>
              <div className="w-full h-80 flex items-center justify-center">
                {stats.totalStudents > 0 ? (
                  <div className="w-full h-full">
                    <Bar data={assessmentTrendData} options={{
                      plugins: { legend: { display: false } },
                      scales: { y: { beginAtZero: true, max: 100, ticks: { stepSize: 20 } } },
                      maintainAspectRatio: false,
                    }} />
                  </div>
                ) : (
                  <div className="text-center text-gray-500">
                    <div className="text-lg font-medium mb-2">No assessment data</div>
                    <div className="text-sm">Assessment trends appear after students attempt quizzes.</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mb-8">
            <hr className="border-t border-gray-300" />
          </div>

          <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-shadow border border-gray-100 mb-12">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-[#0E6BA8]">Student Activity</h2>
            </div>
            <div className="p-6">
              {stats.totalStudents > 0 ? (
                <ul className="space-y-4">
                  {recentActivity.map((item) => (
                    <li key={item.id} className="flex items-center justify-between">
                      <span className="text-gray-800 font-medium">{item.activity}</span>
                      <span className="text-xs text-gray-400">{item.time}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center text-gray-500">
                  <div className="text-lg font-medium mb-2">No recent activity</div>
                  <div className="text-sm">Activity will appear here once students join and interact with modules.</div>
                </div>
              )}
            </div>
          </div>

          <div className="mb-8">
            <hr className="border-t border-gray-300" />
          </div>

          {/* Learning Progress Table */}
          {/* Learning Progress feature removed per request */}
        </div>
      </main>
    </div>
  );
};

export default InstructorDashboard;