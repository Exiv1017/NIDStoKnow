import { useState, useEffect, useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import StudentNotificationsBell from '../../components/student/StudentNotificationsBell';
// Sidebar provided by ModuleLayout; do not render here to avoid duplication
import AuthContext from '../../context/AuthContext';
import useModuleSummaries from '../../hooks/useModuleSummaries.js';
import { Pie, Bar } from 'react-chartjs-2';
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

// Base URL for API requests. Defaults to same-origin when not provided.
const API_BASE = (typeof window !== 'undefined' && (window.__API_BASE__ || import.meta.env.VITE_API_URL)) || '';
const apiUrl = (path) => `${API_BASE}${path}`.replace(/([^:]?)\/\/+/g,'$1/');

const StudentDashboard = () => {
  const { user } = useContext(AuthContext);
  const [studentName, setStudentName] = useState('Student');
  const [profile, setProfile] = useState({ joinDate: '', avatar: null });
  // Notifications panel handled by shared bell component
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [modules, setModules] = useState([]);
  const [assignedModules, setAssignedModules] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [stats, setStats] = useState({
    totalModules: 0,
    completedModules: 0,
    averageProgress: 0,
    totalTimeSpent: 0,
    engagementScore: 0,
    quizzesPassed: 0,
    totalQuizzes: 0
  });
  const [loading, setLoading] = useState(true);
  const [dueSoonCount, setDueSoonCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);

  // Helper to format notification time for better readability
  const formatNotificationTime = (timeString) => {
    try {
      const date = new Date(timeString);
      const now = new Date();
      const diffMs = now - date;
      const mins = Math.floor(diffMs / 60000);
      const hours = Math.floor(mins / 60);
      const days = Math.floor(hours / 24);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
      if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
      if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
      return date.toLocaleDateString();
    } catch {
      return timeString || '';
    }
  };

  // Function to generate resume URL based on last lesson
  const getResumeUrl = (moduleName, lastLesson) => {
    console.log(`getResumeUrl: Module=${moduleName}, LastLesson=${lastLesson}`);
    
    // Map module names to their learning modules theory routes
    const moduleRoutes = {
      'Signature-Based NIDS': '/student/theoretical/signature-based-detection/theory',
      'Anomaly-Based NIDS': '/student/theoretical/anomaly-based-detection/theory', 
      'Hybrid NIDS': '/student/theoretical/hybrid-detection/theory',
      'Signature-Based Detection': '/student/theoretical/signature-based-detection/theory',
      'Anomaly-Based Detection': '/student/theoretical/anomaly-based-detection/theory',
      'Hybrid Detection': '/student/theoretical/hybrid-detection/theory'
    };
    
    // Get the theory route for this module
    const theoryRoute = moduleRoutes[moduleName];
    
    if (theoryRoute) {
      console.log(`Taking user to learning module theory: ${theoryRoute}`);
      return theoryRoute;
    }
    
    // Fallback to learning modules main page
    console.log(`Module not recognized, returning learning modules main page`);
    return `/learning-modules`;
  };

  // Friendly due date formatter
  const formatDueDate = (d) => {
    try {
      const dt = new Date(d);
      if (isNaN(dt)) return d || '';
      return dt.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return d || '';
    }
  };

  // Move fetchDashboardData outside useEffect so it can be reused
  const fetchDashboardData = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    console.log("Fetching dashboard for user:", user?.id); // Added log
    try {
      const response = await fetch(apiUrl(`/api/student/dashboard/${user.id}`));
      if (response.ok) {
        const data = await response.json();
        setStudentName(data.studentName);
        setModules(data.modules);
        setAssignedModules(data.assignedModules);
  setStats(prev=>({ ...prev, ...data.stats }));
        // Log progress data for debugging
        console.log('Modules:', data.modules);
        console.log('Assigned Modules:', data.assignedModules);
        console.log('Stats:', data.stats);
        // Log lastLesson data specifically
        data.modules.forEach(module => {
          console.log(`Module ${module.name}: lastLesson = ${module.lastLesson}`);
        });
        // Log Signature-Based NIDS module details
        const signatureModule = data.modules.find(m => m.name === 'Signature-Based NIDS');
        if (signatureModule) {
          console.log('Signature-Based NIDS module:', signatureModule);
        } else {
          console.log('Signature-Based NIDS module not found in modules array.');
        }
      } else {
        // Fallback data for new accounts: show modules for progress area, but no assigned modules yet
        const defaultModules = [
          { name: 'Signature-Based Detection', progress: 0, lastAccessed: 'Never', structure: { hasOverview: true, theoryLessons: 3, hasPracticalExercise: true, hasAssessment: true } },
          { name: 'Anomaly-Based Detection', progress: 0, lastAccessed: 'Never', structure: { hasOverview: true, theoryLessons: 3, hasPracticalExercise: true, hasAssessment: true } },
          { name: 'Hybrid Detection', progress: 0, lastAccessed: 'Never', structure: { hasOverview: true, theoryLessons: 3, hasPracticalExercise: true, hasAssessment: true } },
        ];
        setModules(defaultModules);
        setAssignedModules([]); // no assignments until instructor creates them
      }
      // Fetch real assignments (instructor-assigned) and merge/override
      try {
        const assignRes = await fetch(apiUrl(`/api/student/${user.id}/assignments`), {
          headers: user?.token ? { 'Authorization': `Bearer ${user.token}` } : {}
        });
        if (assignRes.ok) {
          const rows = await assignRes.json();
          if (Array.isArray(rows) && rows.length > 0) {
            // Normalize to dashboard card shape
            const mapped = rows.map(r => ({
              name: r.moduleName || r.moduleSlug || 'Module',
              moduleSlug: r.moduleSlug,
              dueDate: r.dueDate || null,
              status: (r.status || 'assigned').replace(/^(\w)/, (m)=>m.toUpperCase()).replace(/-(\w)/g, (_,c)=>' '+c.toUpperCase()), // assigned -> Assigned, in-progress -> In Progress
              progress: 0,
              lastLesson: null,
              instructorAssigned: true,
              notes: r.notes || null
            }));
            setAssignedModules(mapped);
            // Update due soon/overdue counts from real assignments
            try {
              const now = new Date();
              const soonMs = 3 * 24 * 60 * 60 * 1000;
              let overdue = 0, dueSoon = 0;
              for (const a of mapped) {
                if (!a?.dueDate) continue;
                const d = new Date(a.dueDate);
                if (!isNaN(d)) {
                  if (d < now) overdue++;
                  else if (d - now <= soonMs) dueSoon++;
                }
              }
              setOverdueCount(overdue);
              setDueSoonCount(dueSoon);
            } catch {}
          }
        }
      } catch {}

      const notifResponse = await fetch(apiUrl(`/api/student/notifications`),
        { headers: user?.token ? { 'Authorization': `Bearer ${user.token}` } : {} }
      );
      if (notifResponse.ok) {
        const notifData = await notifResponse.json();
        setNotifications(notifData);
      }
    } catch (error) {
      // Error fallback: show generic modules for progress but no assignments
      const defaultModules = [
        { name: 'Signature-Based Detection', progress: 0, lastAccessed: 'Never', structure: { hasOverview: true, theoryLessons: 3, hasPracticalExercise: true, hasAssessment: true } },
        { name: 'Anomaly-Based Detection', progress: 0, lastAccessed: 'Never', structure: { hasOverview: true, theoryLessons: 3, hasPracticalExercise: true, hasAssessment: true } },
        { name: 'Hybrid Detection', progress: 0, lastAccessed: 'Never', structure: { hasOverview: true, theoryLessons: 3, hasPracticalExercise: true, hasAssessment: true } },
      ];
      setModules(defaultModules);
      setAssignedModules([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshNotifications = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(apiUrl(`/api/student/notifications`),
        { headers: user?.token ? { 'Authorization': `Bearer ${user.token}` } : {} }
      );
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : []);
      }
      // also fetch count
      try {
        const c = await fetch(apiUrl('/api/student/notifications/count'), { headers: user?.token ? { 'Authorization': `Bearer ${user.token}` } : {} });
        if (c.ok) {
          const cj = await c.json();
          setUnreadCount(typeof cj?.count === 'number' ? cj.count : 0);
        }
      } catch {}
    } catch {}
  };

  // Fetch profile (joinDate, avatar) for header
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!user?.token) return;
        const res = await fetch(apiUrl('/api/student/profile'), {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        setProfile({ joinDate: data?.joinDate || '', avatar: data?.avatar || null });
        if (data?.name) setStudentName(String(data.name));
      } catch {}
    };
    fetchProfile();
  }, [user?.token]);

  const formatJoinDate = (jd) => {
    if (!jd) return '';
    try {
      const d = new Date(jd);
      if (isNaN(d.getTime())) return jd;
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return jd;
    }
  };

  const initialsFrom = (nameOrEmail) => {
    try {
      const s = (nameOrEmail || '').trim();
      if (!s) return '?';
      const parts = s.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      if (s.includes('@')) return s[0].toUpperCase();
      return s.slice(0, 2).toUpperCase();
    } catch {
      return '?';
    }
  };

  // Pull authoritative per-module summaries (lessons/quizzes/practical/assessment)
  const { summaries, refresh: refreshSummaries } = useModuleSummaries(user);

  // Refresh summaries whenever a module time flush occurs so dashboard reflects new time
  useEffect(()=>{
    const h = (e)=>{ if(e?.detail?.moduleSlug) { refreshSummaries(); } };
    window.addEventListener('moduleTimeUpdated', h);
    // Also refresh when a module quiz is passed (frontend dispatches 'moduleQuizPassed')
    const onQuiz = () => { refreshSummaries(); };
    window.addEventListener('moduleQuizPassed', onQuiz);
    return ()=> { window.removeEventListener('moduleTimeUpdated', h); window.removeEventListener('moduleQuizPassed', onQuiz); };
  }, [refreshSummaries]);

  useEffect(() => {
    fetchDashboardData(); // legacy endpoint (kept for assignments/notifications); summary hook handles learning progress
    // initial count fetch
    (async () => {
      if (!user?.token) return;
      try {
        const c = await fetch(apiUrl('/api/student/notifications/count'), { headers: { 'Authorization': `Bearer ${user.token}` } });
        if (c.ok) {
          const cj = await c.json();
          setUnreadCount(typeof cj?.count === 'number' ? cj.count : 0);
        }
      } catch {}
    })();
    // Auto-refresh when tab/window regains focus
    const handleFocus = () => {
      fetchDashboardData();
      refreshNotifications();
    };
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(() => {
      refreshNotifications();
    }, 30000);
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [user]);

  // Build module data from server summaries (authoritative) then merge any legacy dashboard module info
  const summaryDerivedModules = useMemo(()=>{
    const out = [];
    const nameMap = {
      'signature-based-detection':'Signature-Based Detection',
      'anomaly-based-detection':'Anomaly-Based Detection',
      'hybrid-detection':'Hybrid Detection'
    };
    Object.entries(summaries || {}).forEach(([slug, s])=>{
      const display = nameMap[slug] || s.display_name || s.module_name || slug;
      // Trust backend: overview is only counted when completed on server
      const overviewUnit = s.overview_completed ? 1 : 0;
      const lessonUnits = Math.min(s.lessons_completed || 0, s.total_lessons || 0);
      const quizUnits = Math.min(s.quizzes_passed || 0, s.total_quizzes || 0);
      const practicalUnit = s.practical_completed ? 1 : 0;
      const assessmentUnit = s.assessment_completed ? 1 : 0;
      // Prefer server-provided percent to keep Dashboard in sync with Learning Modules cards
      let comprehensiveProgress = typeof s.percent === 'number' ? s.percent : 0;
      if (comprehensiveProgress === 0) {
        // Fallback compute if backend didn't include percent
        const totalUnits = 1 + (s.total_lessons||0) + (s.total_quizzes||0) + 2;
        const completedUnits = overviewUnit + lessonUnits + quizUnits + practicalUnit + assessmentUnit;
        comprehensiveProgress = totalUnits>0 ? Math.round((completedUnits/totalUnits)*100) : 0;
        if (comprehensiveProgress===100 && !s.assessment_completed) comprehensiveProgress = 95;
      }
      out.push({
        name: display,
        slug,
        progress: comprehensiveProgress, // backward compat field (legacy code)
        comprehensiveProgress,
        lastAccessed: 'Today',
        structure: {
          hasOverview: true,
          theoryLessons: s.total_lessons || 0,
            hasPracticalExercise: !!(s.can_start_practical || s.practical_completed),
            hasAssessment: !!(s.can_start_assessment || s.assessment_completed)
        },
        meta: {
          lessons_completed: s.lessons_completed,
          total_lessons: s.total_lessons,
          quizzes_passed: s.quizzes_passed,
          total_quizzes: s.total_quizzes,
          overview_completed: s.overview_completed,
          practical_completed: s.practical_completed,
          assessment_completed: s.assessment_completed
        }
      });
    });
    return out;
  }, [summaries]);

  // Merge any legacy dashboard module entries (preserve lastAccessed if non-default)
  const enhancedModules = useMemo(()=>{
    if(summaryDerivedModules.length===0) return modules.map(m=>({ ...m, comprehensiveProgress: m.progress||0 }));
    const byName = Object.fromEntries(summaryDerivedModules.map(m=>[m.name.toLowerCase(), m]));
    modules.forEach(m=>{
      const key = m.name.toLowerCase();
      if(byName[key]){
        if(m.lastAccessed && m.lastAccessed !== 'Never') byName[key].lastAccessed = m.lastAccessed;
      } else {
        byName[key] = { ...m, comprehensiveProgress: m.progress||0 };
      }
    });
    return Object.values(byName);
  }, [summaryDerivedModules, modules]);

  // Helper: compute engagement score using available summary metrics (no historical event stream yet)
  // Components:
  //  - coverage: averageProgress
  //  - breadth: active modules / total modules
  //  - quiz mastery: total quizzes passed / total quizzes
  //  - time factor: clamp(totalTimeSpentSeconds / baselineSeconds, 0..1) where baseline=3600 (1 hour) for now
  const computeEngagement = ({ averageProgress, totalTimeSpent, quizzesPassed, totalQuizzes, totalModules }) => {
    if (!totalModules || totalModules === 0) return 0;
    const breadth = (() => {
      try {
        let active = 0;
        enhancedModules.forEach(m => { if ((m.comprehensiveProgress||0) > 0) active++; });
        return active / totalModules;
      } catch { return 0; }
    })();
    const quizMastery = totalQuizzes > 0 ? (quizzesPassed / totalQuizzes) : 0;
    const timeFactor = Math.min(1, (totalTimeSpent || 0) / 3600); // baseline 1 hour for moderate engagement
    const coverage = (averageProgress || 0) / 100;
    const score = (coverage + breadth + quizMastery + timeFactor) / 4;
    return Math.round(score * 100);
  };

  // Aggregate stats from enhancedModules (server authoritative) and derive engagement
  useEffect(()=>{
    if(enhancedModules.length===0) return;
    const completed = enhancedModules.filter(m=>m.comprehensiveProgress>=100).length;
    const avg = Math.round(enhancedModules.reduce((a,m)=>a+m.comprehensiveProgress,0)/enhancedModules.length);
    // Sum time + engagement from summaries
    let timeSpent = 0; let engageSum = 0; let engageCount = 0; let quizzesPassed=0; let totalQuizzes=0;
    Object.values(summaries||{}).forEach(s=>{
      // Support either time_spent_seconds or legacy time_spent key
      const ts = typeof s.time_spent_seconds === 'number' ? s.time_spent_seconds : (s.time_spent || 0);
      timeSpent += ts;
      if(typeof s.engagement_score==='number'){ engageSum += s.engagement_score; engageCount++; }
      quizzesPassed += s.quizzes_passed || 0;
      totalQuizzes += s.total_quizzes || 0;
    });
    // If backend provides an engagement_score we average it (engageCount > 0). Otherwise compute derived score.
    let engagementScore = engageCount>0 ? Math.round(engageSum/engageCount) : 0;
    if (engagementScore === 0) {
      engagementScore = computeEngagement({
        averageProgress: avg,
        totalTimeSpent: timeSpent,
        quizzesPassed,
        totalQuizzes,
        totalModules: enhancedModules.length
      });
    }
    setStats(prev=>({
      ...prev,
      totalModules: enhancedModules.length,
      completedModules: completed,
      averageProgress: avg,
      totalTimeSpent: timeSpent,
      engagementScore,
      quizzesPassed,
      totalQuizzes
    }));
  }, [enhancedModules, summaries]);

  // Enhanced assigned modules with progress data
  const enhancedAssignedModules = assignedModules.map(assignedModule => {
    // Find in legacy modules for lastLesson; find in enhancedModules for real comprehensive progress
    const legacyModule = modules.find(m => m.name === assignedModule.name);
    const realModule = enhancedModules.find(m => m.name === assignedModule.name);
    const comprehensiveProgress = realModule ? realModule.comprehensiveProgress : (legacyModule?.progress || assignedModule.progress || 0);
    let status = 'Not Started';
    if (comprehensiveProgress >= 100) status = 'Completed';
    else if (comprehensiveProgress > 0) status = 'In Progress';
    return {
      ...assignedModule,
      progress: comprehensiveProgress,
      status: assignedModule.status || status,
      lastLesson: legacyModule ? legacyModule.lastLesson : assignedModule.lastLesson || null
    };
  });

  // NOTE: This must live BEFORE any conditional early return so hook order stays stable.
  // Previously this was placed AFTER the `if (loading) return ...` block which caused the
  // first render (loading=true) to execute fewer hooks than subsequent renders (loading=false),
  // triggering the React "Rendered more hooks" error. Moving it here ensures it's always called.

  // IMPORTANT: All hooks must appear before any conditional early return. Moved quizMasteryData & componentsCompletionData here.
  const quizMasteryData = useMemo(()=>{
    const labels = [];
    const values = [];
    const abbrevMap = {
      'signature-based-detection': 'SBD',
      'anomaly-based-detection': 'ABD',
      'hybrid-detection': 'HD'
    };
    Object.entries(summaries||{}).forEach(([slug, s])=>{
      const display = s.display_name || s.module_name || slug;
      const abbr = abbrevMap[slug] || display;
      labels.push(abbr);
      const pct = (s.total_quizzes||0) > 0 ? Math.round(((s.quizzes_passed||0)/(s.total_quizzes||0))*100) : 0;
      values.push(pct);
    });
    if(labels.length===0){
      return {
        labels:['No Data'],
        datasets:[{ label:'Quiz Mastery %', data:[0], backgroundColor:'#1E5780', borderRadius:6 }]
      };
    }
    return {
      labels,
      datasets:[{ label:'Quiz Mastery %', data:values, backgroundColor:'#1E5780', borderRadius:6 }]
    };
  }, [summaries]);

  const componentsCompletionData = useMemo(()=>{
    const sList = Object.values(summaries||{});
    const totalModules = sList.length || 0;
    const overviewCompleted = sList.filter(s=>s.overview_completed).length;
    const lessonsCompleted = sList.reduce((a,s)=>a+(s.lessons_completed||0),0);
    const lessonsTotal = sList.reduce((a,s)=>a+(s.total_lessons||0),0);
    const quizzesPassed = sList.reduce((a,s)=>a+(s.quizzes_passed||0),0);
    const quizzesTotal = sList.reduce((a,s)=>a+(s.total_quizzes||0),0);
    const practicalAvailable = sList.filter(s=> (s.can_start_practical || s.practical_completed)).length;
    const practicalCompleted = sList.filter(s=> s.practical_completed).length;
    const assessmentAvailable = sList.filter(s=> (s.can_start_assessment || s.assessment_completed)).length;
    const assessmentCompleted = sList.filter(s=> s.assessment_completed).length;
    // NOTE: Previously practical & assessment used number of 'available' modules as the denominator.
    // This caused a completed practical/assessment to show as 100% when later modules were still locked
    // (e.g., 1 practical completed, 2 locked => available=1 so 1/1=100%).
    // Requirement: show proportion of total modules regardless of lock state so same scenario is 1/3=33%.
    // We keep overview/lessons/quizzes logic unchanged (they already use total modules / total items).
    const pct = (done,total)=> total>0 ? Math.round((done/total)*100) : 0;
    const labels = ['Overview','Lessons','Quizzes','Practical','Assessment'];
    const values = [
      pct(overviewCompleted,totalModules),
      pct(lessonsCompleted,lessonsTotal),
      pct(quizzesPassed,quizzesTotal),
      // Use totalModules as denominator so locked modules still count towards remaining progress.
      pct(practicalCompleted,totalModules),
      pct(assessmentCompleted,totalModules)
    ];
    return {
      labels,
      datasets:[{
        label:'Completion %',
        data: values,
        backgroundColor:'#206EA6',
        borderRadius:6
      }]
    };
  }, [summaries]);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-white">
        {/* Sidebar provided by ModuleLayout */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-8 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E5780] mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your dashboard...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Calculate module completion breakdown using comprehensive progress
  const comprehensiveCompleted = enhancedModules.filter(m => m.comprehensiveProgress >= 100).length;
  const comprehensiveInProgress = enhancedModules.filter(m => m.comprehensiveProgress > 0 && m.comprehensiveProgress < 100).length;
  const comprehensiveNotStarted = enhancedModules.filter(m => m.comprehensiveProgress === 0).length;

  const moduleCompletionData = {
    labels: ['Completed', 'In Progress', 'Not Started'],
    datasets: [
      {
        data: [comprehensiveCompleted, comprehensiveInProgress, comprehensiveNotStarted],
        backgroundColor: ['#22c55e', '#facc15', '#a3a3a3'],
        borderWidth: 1,
      },
    ],
  };


  // Update formatTime to expect seconds, not minutes
  function formatTime(totalSeconds) {
    totalSeconds = Math.round(totalSeconds || 0);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}h ${m}m ${s}s`;
  }

  // Calculate comprehensive stats
  const comprehensiveAverageProgress = stats.averageProgress || 0;
  const comprehensiveCompletedModules = stats.completedModules || 0;

    return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar provided by ModuleLayout */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-black mb-1">Welcome Back, {studentName}</h1>
              <p className="text-gray-600 text-base">Here's your learning progress</p>
              {profile?.joinDate && (
                <p className="text-sm text-gray-500 mt-1">Member since {formatJoinDate(profile.joinDate)}</p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <StudentNotificationsBell refreshIntervalMs={30000} appearance="light" />
            </div>
          </div>
          {(overdueCount > 0 || dueSoonCount > 0) && (
            <div className={`mb-6 rounded-lg border p-4 ${overdueCount > 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">
                    {overdueCount > 0 ? `${overdueCount} assignment${overdueCount>1?'s':''} overdue` : `${dueSoonCount} assignment${dueSoonCount>1?'s':''} due soon`}
                  </div>
                  <div className="text-sm opacity-80">Check My Assignments to stay on track.</div>
                </div>
                <Link to="/student/assignments" className="inline-flex items-center px-3 py-1.5 rounded-md bg-[#1E5780] text-white text-sm hover:bg-[#164666]">View Assignments</Link>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow border border-gray-100 flex flex-col items-center">
              <h3 className="text-lg font-medium text-gray-600 mb-1">Overall Progress</h3>
              <p className="text-4xl font-extrabold text-[#1E5780] mt-2">{enhancedModules.length > 0 ? Math.round((comprehensiveCompletedModules / enhancedModules.length) * 100) : 0}%</p>
              <p className="text-sm text-gray-400 mt-1">{comprehensiveCompletedModules} of {enhancedModules.length} modules completed</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow border border-gray-100 flex flex-col items-center">
              <h3 className="text-lg font-medium text-gray-600 mb-1">Average Progress</h3>
              <p className="text-4xl font-extrabold text-[#1E5780] mt-2">{comprehensiveAverageProgress}%</p>
              <p className="text-sm text-gray-400 mt-1">Across all components</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow border border-gray-100 flex flex-col items-center">
              <h3 className="text-lg font-medium text-gray-600 mb-1">Time Spent</h3>
              {/* stats.totalTimeSpent is now in seconds */}
              <p className="text-4xl font-extrabold text-[#1E5780] mt-2">{formatTime(stats.totalTimeSpent)}</p>
              <p className="text-sm text-gray-400 mt-1">Total learning time</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow border border-gray-100 flex flex-col items-center">
              <h3 className="text-lg font-medium text-gray-600 mb-1">Engagement</h3>
              <p className="text-4xl font-extrabold text-[#1E5780] mt-2">{stats.engagementScore || 0}%</p>
              <p className="text-sm text-gray-400 mt-1">Learning engagement score</p>
            </div>
          </div>

          {/* Section Divider */}
          <div className="mb-8">
            <hr className="border-t border-gray-300" />
          </div>

          {/* Dashboard Graphs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {/* Module Completion Pie Chart */}
            <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-shadow p-6 flex flex-col items-center border border-gray-100">
              <h3 className="text-lg font-semibold mb-4 text-[#1E5780]">Module Completion Progress</h3>
              <div className="w-full max-w-xs">
                <Pie data={moduleCompletionData} options={{ plugins: { legend: { position: 'bottom' } } }} />
              </div>
            </div>
            {/* Quiz Mastery Bar Chart */}
            <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-shadow p-6 flex flex-col items-center border border-gray-100">
              <h3 className="text-lg font-semibold mb-4 text-[#1E5780]">Quiz Mastery</h3>
              <div className="w-full max-w-xs">
                <Bar data={quizMasteryData} options={{
                  plugins: { legend: { display: false } },
                  scales: {
                    y: {
                      min: 0,
                      max: 100,
                      ticks: { stepSize: 20, autoSkip: false, callback: (v)=>`${v}` }
                    }
                  },
                }} />
                {/* Legend for abbreviations */}
                <div className="mt-3 text-xs text-gray-500">
                  <div className="flex flex-col gap-1 items-start">
                    <span><strong>SBD</strong> – Signature-Based Detection</span>
                    <span><strong>ABD</strong> – Anomaly-Based Detection</span>
                    <span><strong>HD</strong> – Hybrid Detection</span>
                  </div>
                </div>
              </div>
            </div>
            {/* Learning Components Completion */}
            <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-shadow p-6 flex flex-col items-center border border-gray-100">
              <h3 className="text-lg font-semibold mb-4 text-[#1E5780]">Learning Components Completion</h3>
              <div className="w-full max-w-xs">
                <Bar data={componentsCompletionData} options={{
                  plugins: { legend: { display: false } },
                  scales: {
                    y: {
                      min: 0,
                      max: 100,
                      ticks: { stepSize: 20, autoSkip: false, callback: (v)=>`${v}` }
                    }
                  },
                }} />
              </div>
            </div>
          </div>

          {/* Section Divider */}
          <div className="mb-8">
            <hr className="border-t border-gray-300" />
          </div>

          {/* Learning Progress & Assigned Modules */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-shadow border border-gray-100 overflow-hidden">
              <div className="p-6 border-b">
                <h2 className="text-xl font-bold text-[#1E5780]">Learning Progress</h2>
              </div>
              <div className="p-6">
                <div className="space-y-6">
                  {enhancedModules.map((module, index) => (
                    <div key={index} className="flex items-center justify-between group">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-[#1E5780] transition-colors">{module.name}</h3>
                        <p className="text-sm text-gray-400">Last accessed: {module.lastAccessed}</p>
                        {/* Show component breakdown if available */}
                        {module.structure && (
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                            {module.structure.hasOverview && (
                              <span className={`flex items-center gap-1 ${module.progress > 0 ? 'text-green-600' : ''}`}>
                                {module.progress > 0 ? '✓' : '○'} Overview
                              </span>
                            )}
                            <span className={`flex items-center gap-1 ${module.progress >= 30 ? 'text-green-600' : ''}`}>
                              {module.progress >= 30 ? '✓' : '○'} Theory
                            </span>
                            {module.structure.hasPracticalExercise && (
                              <span className={`flex items-center gap-1 ${module.progress >= 80 ? 'text-green-600' : ''}`}>
                                {module.progress >= 80 ? '✓' : '○'} Practice
                              </span>
                            )}
                            {module.structure.hasAssessment && (
                              <span className={`flex items-center gap-1 ${module.progress >= 100 ? 'text-green-600' : ''}`}>
                                {module.progress >= 100 ? '✓' : '○'} Assessment
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 w-full max-w-[240px]">
                        <div className="relative flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-[#1E5780] transition-all"
                            style={{ width: `${module.comprehensiveProgress}%` }}
                          />
                        </div>
                        <span className="text-base font-semibold text-gray-900 w-[6ch] text-right whitespace-nowrap shrink-0">
                          {module.comprehensiveProgress > 0 ? `${module.comprehensiveProgress}%` : 'Not Started'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <Link
                    to="/learning-modules"
                    className="text-[#1E5780] hover:text-[#164666] font-semibold transition-colors"
                  >
                    View all modules →
                  </Link>
                </div>
              </div>
            </div>

            {/* Assigned Modules */}
            <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-shadow border border-gray-100">
              <div className="p-6 border-b">
                <h2 className="text-xl font-bold text-[#1E5780]">Assigned Modules</h2>
                {enhancedAssignedModules.length>0 && (
                  <p className="text-gray-400 text-sm mt-1">
                    {enhancedAssignedModules.filter(m => m.status === 'In Progress').length} in progress, {enhancedAssignedModules.filter(m => m.status === 'Not Started').length} not started, {enhancedAssignedModules.filter(m => m.status === 'Completed').length} completed
                  </p>
                )}
              </div>
              <div className="p-6">
                {enhancedAssignedModules.length===0 ? (
                  <div className="text-center text-gray-400 py-12">
                    <p className="text-sm">No modules assigned yet. Your instructor can assign modules and they will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {enhancedAssignedModules.map((module, index) => (
                      <div key={index} className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          {/* Icon based on status */}
                          {module.status === 'Completed' && (
                            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          )}
                          {module.status === 'In Progress' && (
                            <svg className="w-6 h-6 text-yellow-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /></svg>
                          )}
                          {module.status === 'Not Started' && (
                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /></svg>
                          )}
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-[#1E5780] transition-colors">{module.name}</h3>
                              {module.instructorAssigned && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">Assigned by Instructor</span>
                              )}
                            </div>
                            <p className={`text-sm ${module.status === 'Overdue' ? 'text-red-600' : 'text-gray-400'}`}>
                              {module.dueDate
                                ? `${module.status === 'Overdue' ? 'Overdue:' : 'Due:'} ${formatDueDate(module.dueDate)}`
                                : (module.startDate ? `Starts: ${formatDueDate(module.startDate)}` : '—')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors ${
                            module.status === 'Completed' ? 'bg-green-100 text-green-800' :
                            module.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                            module.status === 'Overdue' ? 'bg-red-100 text-red-800' :
                            module.status === 'Assigned' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {module.status}
                          </span>
                          {/* Action button */}
                          {module.status === 'In Progress' && module.progress > 0 && (
                            <Link
                              to={getResumeUrl(module.name, module.lastLesson)}
                              className="px-3 py-1 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm font-semibold transition-colors shadow"
                            >
                              Resume
                            </Link>
                          )}
                          {module.status === 'Completed' && (
                            <Link to="/learning-modules" className="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-semibold transition-colors shadow">Review</Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;