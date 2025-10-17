import StudentAssignments from './pages/student/Assignments';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, createContext, useEffect, useRef } from 'react';
// Note: Legacy raw markdown imports removed. Theory content now loads via registry-driven TheoryModulePage.

// Core page components (kept minimal here; other imports may exist elsewhere)
import LandingPage from './pages/LandingPage';
import SignupPage from './pages/SignupPage';
import StudentSignUp from './pages/student/StudentSignUp';
import Login from './pages/Login';
import InstructorLogin from './pages/instructor/InstructorLogin';
import InstructorSignUp from './pages/instructor/InstructorSignUp';
import UserManagement from './pages/admin/UserManagement';
import AdminSettings from './pages/admin/AdminSettings';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminModuleRequests from './pages/admin/AdminModuleRequests';
import AdminLobbies from './pages/admin/AdminLobbies';
import StudentDashboard from './pages/student/StudentDashboard';
import LearningModules from './pages/student/LearningModules';
import AccountSettings from './pages/student/AccountSettings';
import SimulationLobby from './pages/student/SimulationLobby';
import SimulationDashboard from './pages/Simulation/SimulationDashboard';
import ConfigureHoneypot from './pages/Simulation/ConfigureHoneypot';
import SignatureBased from './pages/Simulation/SignatureBased';
import AnomalyBased from './pages/Simulation/AnomalyBased';
import Hybrid from './pages/Simulation/Hybrid';
import InstructorDashboard from './pages/instructor/InstructorDashboard';
import ManageModules from './pages/instructor/ManageModules';
import InstructorAssessments from './pages/instructor/InstructorAssessments';
import StudentProgress from './pages/instructor/StudentProgress';
import CreateContent from './pages/instructor/CreateContent';
import Settings from './pages/instructor/Settings';
import InstructorLobby from './pages/instructor/InstructorLobby';
import InstructorSimulation from './pages/instructor/InstructorSimulation';
import SignatureBasedOverview from './pages/student/theoretical/SignatureBasedOverview';
import AnomalyOverviewPage from './pages/student/theoretical/AnomalyOverviewPage';
import HybridOverviewPage from './pages/student/theoretical/HybridOverviewPage';
import TheoryModulePage from './pages/student/theoretical/TheoryModulePage';
import StandaloneModuleQuizPage from './pages/student/theoretical/StandaloneModuleQuizPage';
import SignaturePractical from './pages/student/theoretical/practical/SignaturePractical';
import AnomalyPractical from './pages/student/theoretical/practical/AnomalyPractical';
import HybridPractical from './pages/student/theoretical/practical/HybridPractical';
import SignatureAssessment from './pages/student/theoretical/assessment/SignatureAssessment';
import AnomalyAssessment from './pages/student/theoretical/assessment/AnomalyAssessment';
import HybridAssessment from './pages/student/theoretical/assessment/HybridAssessment';
import AttackSimulation from './pages/student/AttackSimulation';
import DefendSimulation from './pages/student/DefendSimulation';
import ObserverSimulation from './pages/student/ObserverSimulation';
import ModuleLayout from './components/ModuleLayout';
import AuthContext, { AuthProvider } from './context/AuthContext';
import Navigation from './components/Navigation';
import React from 'react';

// --- small storage helpers used across the app ---
const getStorageKey = (key, role) => `${role}_${key}`;

const loadAuthState = () => {
  // Check student session first
  try {
    const studentAuth = localStorage.getItem('student_isAuthenticated');
    if (studentAuth === 'true') {
      const userJson = localStorage.getItem('student_user');
      return { isAuthenticated: true, user: userJson ? JSON.parse(userJson) : null };
    }
    const instructorAuth = localStorage.getItem('instructor_isAuthenticated');
    if (instructorAuth === 'true') {
      const userJson = localStorage.getItem('instructor_user');
      return { isAuthenticated: true, user: userJson ? JSON.parse(userJson) : null };
    }
  } catch (err) {
    // If parsing fails, return a safe default
    console.warn('loadAuthState parse error', err);
  }
  return { isAuthenticated: false, user: null };
};

// Default modules definition (lightweight placeholders; Theory content is registry-driven)
const getDefaultModules = () => {
  return [
    {
      id: 1,
      title: 'Signature-Based Detection',
      description: 'Understand signature-based detection methods and limitations.',
      progress: 0,
      sections: [
        { name: 'Overview', completed: false, locked: false },
        { name: 'Theory', completed: false, locked: true },
        { name: 'Practical Exercise', completed: false, locked: true },
        { name: 'Assessment', completed: false, locked: true }
      ],
      theoryModules: [
        {
          moduleNumber: 1,
          lessons: [
            { title: 'What is a NIDS?', content: '' },
            { title: 'Types of IDS / NIDS Approaches', content: '' }
          ],
          assessment: { title: 'Module 1 Quiz', content: '', questions: [], completed: false }
        }
      ],
      difficulty: 'Intermediate',
      estimatedTime: '2 hours',
      lastAccessed: 'Never'
    },
    {
      id: 2,
      title: 'Anomaly-Based Detection',
      description: 'Understand anomaly detection and ML-based approaches.',
      progress: 0,
      sections: [
        { name: 'Overview', completed: false, locked: false },
        { name: 'Theory', completed: false, locked: true },
        { name: 'Practical Exercise', completed: false, locked: true },
        { name: 'Assessment', completed: false, locked: true }
      ],
      theoryModules: [
        {
          moduleNumber: 1,
          lessons: [
            { title: 'Introduction to Anomaly-Based Detection', content: '' },
            { title: 'Detection Process', content: '' },
            { title: 'Machine Learning Applications', content: '' }
          ],
          assessment: { title: 'Anomaly Assessment', content: 'Test your knowledge of anomaly detection.', questions: [], completed: false }
        }
      ],
      difficulty: 'Intermediate',
      estimatedTime: '3 hours',
      lastAccessed: 'Never'
    },
    {
      id: 3,
      title: 'Hybrid Detection',
      description: 'Combine signature and anomaly approaches for robust detection.',
      progress: 0,
      sections: [
        { name: 'Overview', completed: false, locked: false },
        { name: 'Theory', completed: false, locked: true },
        { name: 'Practical Exercise', completed: false, locked: true },
        { name: 'Assessment', completed: false, locked: true }
      ],
      theoryModules: [
        {
          moduleNumber: 1,
          lessons: [
            { title: 'Introduction to Hybrid Detection', content: '' },
            { title: 'Architecture & Process', content: '' },
            { title: 'Benefits & Challenges', content: '' }
          ],
          assessment: { title: 'Hybrid Assessment', content: 'Test your knowledge of hybrid detection.', questions: [], completed: false }
        }
      ],
      difficulty: 'Advanced',
      estimatedTime: '4 hours',
      lastAccessed: 'Never'
    }
  ];
};

// Render Navigation only on landing, signup, and login pages; hide everywhere else
function ConditionalNavigation() {
  const location = useLocation();
  const showOnRoutes = [
    '/',
    '/signup',
    '/student/signup',
    '/instructor/signup',
    '/login',
    '/instructor-login',
    '/admin-login',
  ];
  const shouldShow = showOnRoutes.includes(location.pathname);
  return shouldShow ? <Navigation /> : null;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [modules, setModules] = useState([]);

  // Load modules from localStorage when user changes
  useEffect(() => {
    if (user?.id) {
      const modulesKey = getStorageKey('modules', user.role);
      
      // Force clear ALL module-related localStorage data
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('modules') || key.includes('completed-lessons') || key.includes('last-lesson'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Force refresh modules for comprehensive content - remove this after testing
      const forceRefresh = true; // Set to false after you see the new content
      
      // Always load fresh modules to ensure we get the new structure
      const newModules = getDefaultModules();
      setModules(newModules);
      // Save the new comprehensive modules
      localStorage.setItem(modulesKey, JSON.stringify(newModules));
    }
  }, [user?.id]);

  // Store modules to user-specific localStorage when modules change
  useEffect(() => {
    if (user?.id && modules.length > 0) {
      const modulesKey = getStorageKey('modules', user.role);
      localStorage.setItem(modulesKey, JSON.stringify(modules));
    }
  }, [user?.id, modules]);

  // Bootstrap profile (avatar/name) after auth; fetch if missing avatar so sidebar shows image without visiting Settings
  useEffect(() => {
    const fetchProfileIfNeeded = async () => {
      if (!isAuthenticated || !user?.token || !user?.role) return;
      // Only fetch if we don't already have an avatar (prevents redundant calls)
      if (user?.avatar) return;
      try {
        const route = user.role === 'student' ? '/api/student/profile' : (user.role === 'instructor' ? '/api/instructor/profile' : null);
        if (!route) return;
        const res = await fetch(route, { headers: { Authorization: `Bearer ${user.token}` } });
        if (res.ok) {
          const prof = await res.json();
          setUser(prev => ({
            ...(prev || {}),
            name: prof?.name ?? prev?.name,
            email: prof?.email ?? prev?.email,
            avatar: prof?.avatar ?? prev?.avatar,
            joinDate: prof?.joinDate ?? prev?.joinDate,
          }));
        }
      } catch {
        // ignore network errors silently
      }
    };
    fetchProfileIfNeeded();
  }, [isAuthenticated, user?.role, user?.token, user?.avatar, setUser]);

  // Listen for localStorage changes from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e) => {
      // Only respond to changes in student/instructor auth keys
      if (e.key && (e.key.startsWith('student_') || e.key.startsWith('instructor_'))) {
        // Check if there's a valid session for either student or instructor
        const authState = loadAuthState();
        
        // Only update if the auth state actually changed
        if (authState.isAuthenticated !== isAuthenticated || 
            JSON.stringify(authState.user) !== JSON.stringify(user)) {
          setIsAuthenticated(authState.isAuthenticated);
          setUser(authState.user);
        }
      }
    };

    // Add the event listener
    window.addEventListener('storage', handleStorageChange);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isAuthenticated, user]); // Dependencies to check against current state

  const login = (userData) => {
    // Set joinDate if not present (first login)
    let updatedUser = { ...userData };
    if (!updatedUser.joinDate) {
      const now = new Date();
      // Format as YYYY-MM-DD
      const formatted = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      updatedUser.joinDate = formatted;
    }
    setIsAuthenticated(true);
    setUser(updatedUser);
    // Persist auth state so other tabs and reloads can pick it up
    try {
      if (updatedUser?.role) {
        localStorage.setItem(getStorageKey('isAuthenticated', updatedUser.role), 'true');
        localStorage.setItem(getStorageKey('user', updatedUser.role), JSON.stringify(updatedUser));
      }
    } catch (err) {
      console.warn('login: failed to persist auth state', err);
    }
  };

  const logout = () => {
    if (user && user.role) {
      // Remove only the current user's auth data and modules
      const authKey = getStorageKey('isAuthenticated', user.role);
      const userKey = getStorageKey('user', user.role);
      const modulesKey = getStorageKey('modules', user.role);
      
      localStorage.removeItem(authKey);
      localStorage.removeItem(userKey);
      localStorage.removeItem(modulesKey);
    }
    
    setIsAuthenticated(false);
    setUser(null);
    // Reset modules to empty state
    setModules([]);
  };

  // Persist user updates (e.g., avatar) to localStorage so UI like sidebars reflects changes
  useEffect(() => {
    if (user && user.role) {
      try {
        localStorage.setItem(getStorageKey('user', user.role), JSON.stringify(user));
      } catch (err) {
        console.warn('persist user failed', err);
      }
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      user, 
      setUser,
      login, 
      logout 
    }}>
    <Router>
      <ConditionalNavigation />
      <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/student/signup" element={<StudentSignUp />} />
            <Route path="/instructor/signup" element={<InstructorSignUp />} />
            <Route path="/login" element={<Login />} />
            <Route path="/instructor-login" element={<InstructorLogin />} />
            <Route path="/admin-login" element={<AdminLogin />} />

            {/* Admin routes (protected) */}
            <Route
              path="/admin-dashboard"
              element={
                isAuthenticated && user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/admin-login" />
              }
            />
            <Route
              path="/admin/users"
              element={
                isAuthenticated && user?.role === 'admin' ? <UserManagement /> : <Navigate to="/admin-login" />
              }
            />
            <Route
              path="/admin/settings"
              element={
                isAuthenticated && user?.role === 'admin' ? <AdminSettings /> : <Navigate to="/admin-login" />
              }
            />
            <Route
              path="/admin/module-requests"
              element={
                isAuthenticated && user?.role === 'admin' ? <AdminModuleRequests /> : <Navigate to="/admin-login" />
              }
            />
            <Route
              path="/admin/lobbies"
              element={
                isAuthenticated && user?.role === 'admin' ? <AdminLobbies /> : <Navigate to="/admin-login" />
              }
            />
            <Route
              path="/dashboard"
              element={
                isAuthenticated && user?.role === 'student' ? (
                  <ModuleLayout title="Dashboard"><StudentDashboard /></ModuleLayout>
                ) : <Navigate to="/login" />
              }
            />
            <Route
              path="/learning-modules"
              element={
                isAuthenticated && user?.role === 'student' ? (
                  <ModuleLayout title="Learning Modules"><LearningModules modules={modules} setModules={setModules} /></ModuleLayout>
                ) : <Navigate to="/login" />
              }
            />
            <Route
              path="/account-settings"
              element={
                isAuthenticated && user?.role === 'student' ? (
                  <ModuleLayout title="Account Settings"><AccountSettings /></ModuleLayout>
                ) : <Navigate to="/login" />
              }
            />
            <Route
              path="/student/assignments"
              element={
                isAuthenticated && user?.role === 'student' ? (
                  <ModuleLayout title="My Assignments"><StudentAssignments /></ModuleLayout>
                ) : <Navigate to="/login" />
              }
            />
            <Route
              path="/learning-modules/:moduleName/:lessonName"
              element={
                isAuthenticated && user?.role === 'student' ? (
                  <ModuleLayout title="Lesson"><LearningModules modules={modules} setModules={setModules} /></ModuleLayout>
                ) : <Navigate to="/login" />
              }
            />
            <Route
              path="/student/lobby"
              element={
                isAuthenticated && user?.role === 'student' ? (
                  <ModuleLayout title="Simulation Lobby"><SimulationLobby /></ModuleLayout>
                ) : <Navigate to="/login" />
              }
            />

            {/* Simulation Lab routes */}
            <Route
              path="/simulation/dashboard"
              element={
                isAuthenticated ? (
                  <ModuleLayout title="Simulation Dashboard"><SimulationDashboard /></ModuleLayout>
                ) : <Navigate to="/login" />
              }
            />
            <Route
              path="/simulation/configure-honeypot"
              element={
                isAuthenticated ? (
                  <ModuleLayout title="Configure Honeypot"><ConfigureHoneypot /></ModuleLayout>
                ) : <Navigate to="/login" />
              }
            />
            <Route
              path="/simulation/signature"
              element={
                isAuthenticated ? (
                  <ModuleLayout title="Signature Simulation"><SignatureBased /></ModuleLayout>
                ) : <Navigate to="/login" />
              }
            />
            <Route
              path="/simulation/anomaly"
              element={
                isAuthenticated ? (
                  <ModuleLayout title="Anomaly Simulation"><AnomalyBased /></ModuleLayout>
                ) : <Navigate to="/login" />
              }
            />
            <Route
              path="/simulation/hybrid"
              element={
                isAuthenticated ? (
                  <ModuleLayout title="Hybrid Simulation"><Hybrid /></ModuleLayout>
                ) : <Navigate to="/login" />
              }
            />

            {/* Protected instructor routes */}
            <Route
              path="/instructor-dashboard"
              element={
                isAuthenticated && user?.role === 'instructor' ? <InstructorDashboard /> : <Navigate to="/instructor-login" />
              }
            />
            {/* Merged Assignments + Submissions => InstructorAssessments */}
            <Route
              path="/manage-modules"
              element={
                isAuthenticated && user?.role === 'instructor' ? <ManageModules /> : <Navigate to="/instructor-login" />
              }
            />
            <Route
              path="/instructor/assessments"
              element={
                isAuthenticated && user?.role === 'instructor' ? <InstructorAssessments /> : <Navigate to="/instructor-login" />
              }
            />
            <Route
              path="/student-progress"
              element={
                isAuthenticated && user?.role === 'instructor' ? <StudentProgress /> : <Navigate to="/instructor-login" />
              }
            />
            <Route
              path="/create-content"
              element={
                isAuthenticated && user?.role === 'instructor' ? <CreateContent /> : <Navigate to="/instructor-login" />
              }
            />
            <Route
              path="/settings"
              element={
                isAuthenticated && user?.role === 'instructor' ? <Settings /> : <Navigate to="/instructor-login" />
              }
            />
            <Route
              path="/instructor/lobby"
              element={
                isAuthenticated && user?.role === 'instructor' ? <InstructorLobby /> : <Navigate to="/instructor-login" />
              }
            />
            <Route
              path="/instructor/simulation"
              element={
                isAuthenticated && user?.role === 'instructor' ? <InstructorSimulation /> : <Navigate to="/instructor-login" />
              }
            />

            {/* Theoretical pages */}
            <Route path="/student/theoretical/signature-based-detection/overview" element={isAuthenticated && user?.role==='student' ? <SignatureBasedOverview /> : <Navigate to="/login" />} />
            <Route path="/student/theoretical/anomaly-based-detection/overview" element={isAuthenticated && user?.role==='student' ? <AnomalyOverviewPage /> : <Navigate to="/login" />} />
            <Route path="/student/theoretical/hybrid-detection/overview" element={isAuthenticated && user?.role==='student' ? <HybridOverviewPage /> : <Navigate to="/login" />} />
            <Route path="/student/theoretical/:moduleSlug/quiz/:quizIndex" element={isAuthenticated && user?.role==='student' ? <TheoryModulePage modules={modules} /> : <Navigate to="/login" />} />
            <Route path="/student/theoretical/:moduleSlug/quiz" element={isAuthenticated && user?.role==='student' ? <StandaloneModuleQuizPage /> : <Navigate to="/login" />} />
            <Route path="/student/theoretical/:moduleSlug/theory" element={isAuthenticated && user?.role==='student' ? <TheoryModulePage modules={modules} /> : <Navigate to="/login" />} />
            {/* Per-detection practical pages */}
            <Route path="/student/theoretical/signature-based-detection/practical" element={<ModuleLayout title="Practical Exercise"><SignaturePractical modules={modules} setModules={setModules} /></ModuleLayout>} />
            <Route path="/student/theoretical/anomaly-based-detection/practical" element={<ModuleLayout title="Practical Exercise"><AnomalyPractical modules={modules} setModules={setModules} /></ModuleLayout>} />
            <Route path="/student/theoretical/hybrid-detection/practical" element={<ModuleLayout title="Practical Exercise"><HybridPractical modules={modules} setModules={setModules} /></ModuleLayout>} />

            {/* Per-detection assessment pages */}
            <Route path="/student/theoretical/signature-based-detection/assessment" element={<ModuleLayout title="Assessment"><SignatureAssessment modules={modules} setModules={setModules} /></ModuleLayout>} />
            <Route path="/student/theoretical/anomaly-based-detection/assessment" element={<ModuleLayout title="Assessment"><AnomalyAssessment modules={modules} setModules={setModules} /></ModuleLayout>} />
            <Route path="/student/theoretical/hybrid-detection/assessment" element={<ModuleLayout title="Assessment"><HybridAssessment modules={modules} setModules={setModules} /></ModuleLayout>} />

            {/* Simulation routes */}
            <Route 
              path="/simulation/attack" 
              element={
                isAuthenticated && user?.role === 'student' ? <AttackSimulation /> : <Navigate to="/login" />
              } 
            />
            <Route 
              path="/simulation/defend" 
              element={
                isAuthenticated && user?.role === 'student' ? <DefendSimulation /> : <Navigate to="/login" />
              } 
            />
            <Route 
              path="/simulation/observe" 
              element={
                isAuthenticated && user?.role === 'student' ? <ObserverSimulation /> : <Navigate to="/login" />
              } 
            />

            {/* Protected admin routes (consolidated above) */}

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
    </AuthContext.Provider>
  );
}

export default App;