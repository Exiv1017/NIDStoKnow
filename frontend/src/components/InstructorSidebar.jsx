import { useState, useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

const InstructorSidebar = () => {
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  // Collapsible groups to reduce vertical space
  const [openManageGroup, setOpenManageGroup] = useState(false);      // Modules + Assessment + Propose Module
  const navigate = useNavigate();
  const { logout, user } = useContext(AuthContext);
  const location = useLocation();

  const isActive = (path) => {
    try {
      const p = location.pathname || '';
      return p === path || p.startsWith(path + '/') || p === path.replace(/\/$/, '');
    } catch (e) {
      return false;
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/instructor-login');
  };

  return (
    <div className="fixed inset-y-0 left-0 w-64 bg-gradient-to-b from-[#0C2A40] to-[#206EA6] text-white flex flex-col">
      <div className="p-6">
        <Link to="/instructor-dashboard">
          <img src="/NIDStoKnowLogo.svg" alt="NIDSToKnow Logo" className="h-8 w-auto" />
        </Link>
      </div>
      
      <nav className="flex-1 px-4 py-4 overflow-y-auto">
        <ul className="space-y-2">
      <li>
      <Link
        to="/instructor-dashboard"
        className={`flex items-center p-3 rounded-lg hover:bg-white/10 transition-all duration-200 ${isActive('/instructor-dashboard') ? 'bg-white/10 text-white font-medium' : ''}`}
      >
              <img src="/dashboardicon.svg" alt="" className="w-6 h-6 mr-3" />
              <span className="font-medium">Dashboard</span>
          </Link>
          </li>
          {/* Group: Manage */}
          <li>
            <div className="relative">
              <button
                onClick={() => setOpenManageGroup(v => !v)}
                className={`flex items-center justify-between w-full p-3 rounded-lg hover:bg-white/10 transition-all duration-200 ${(isActive('/manage-modules') || isActive('/instructor/assessments') || isActive('/create-content')) ? 'bg-white/10 text-white font-medium' : ''}`}
                aria-expanded={openManageGroup}
                aria-controls="manage-submenu"
              >
                <span className="flex items-center">
                  {/* Folder/stack icon for Manage group */}
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-3">
                    <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="2" fill="none"/>
                  </svg>
                  <span className="font-medium">Manage</span>
                </span>
                <img
                  src="/dropdown.svg"
                  alt="Toggle dropdown"
                  className={`w-5 h-5 ml-2 transition-transform duration-200 ${openManageGroup ? 'rotate-180' : ''}`}
                />
              </button>
              {openManageGroup && (
                <div id="manage-submenu" className="w-full bg-[#0C2A40] rounded-lg overflow-hidden shadow-lg mt-1">
                  <Link
                    to="/manage-modules"
                    className={`flex items-center gap-2 p-3 hover:bg-white/10 transition-all duration-200 ${isActive('/manage-modules') ? 'bg-white/10 text-white font-medium' : ''}`}
                  >
                    <span className="text-sm">Modules</span>
                  </Link>
                  <Link
                    to="/instructor/assessments"
                    className={`flex items-center gap-2 p-3 hover:bg-white/10 transition-all duration-200 ${isActive('/instructor/assessments') ? 'bg-white/10 text-white font-medium' : ''}`}
                  >
                    <span className="text-sm">Assessment</span>
                  </Link>
                  <Link
                    to="/create-content"
                    className={`flex items-center gap-2 p-3 hover:bg-white/10 transition-all duration-200 ${isActive('/create-content') ? 'bg-white/10 text-white font-medium' : ''}`}
                  >
                    <span className="text-sm">Propose Module</span>
                  </Link>
                </div>
              )}
            </div>
          </li>
          {/* Single: Student Progress (moved out of analytics group) */}
          <li>
            <Link to="/student-progress" className="flex items-center p-3 rounded-lg hover:bg-white/10 transition-all duration-200">
              {/* Trend (line chart) icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="mr-2"><path d="M3 17l6-6 4 4 7-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 21H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              <span className="font-medium">Student Progress</span>
            </Link>
          </li>
          <li>
            <Link
              to="/instructor/lobby"
              className="flex items-center p-3 rounded-lg hover:bg-white/10 transition-all duration-200"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-3">
                <rect x="3" y="11" width="18" height="2" rx="1" fill="currentColor"/>
                <rect x="11" y="3" width="2" height="18" rx="1" fill="currentColor"/>
              </svg>
              <span className="font-medium">Simulation Lobby</span>
            </Link>
          </li>
          {/* Rooms link intentionally removed: Rooms shown via forced-redirects/guards instead */}
          <li>
            <Link
              to="/settings"
              className="flex items-center p-3 rounded-lg hover:bg-white/10 transition-all duration-200"
            >
              <img src="/settings.svg" alt="" className="w-6 h-6 mr-3" />
              <span className="font-medium">Account Settings</span>
            </Link>
          </li>
        </ul>
      </nav>

      <div className="p-4 mt-auto border-t border-white/10">
        <div className="relative">
          {isAccountOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 py-2 bg-[#0C2A40] rounded-lg shadow-lg">
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-3 py-2 text-sm hover:bg-white/10 transition-all duration-200"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Logout
              </button>
            </div>
          )}
          <button
            onClick={() => setIsAccountOpen(!isAccountOpen)}
            className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-white/10 transition-all duration-200"
          >
            <span className="flex items-center gap-2">
              {/* Avatar bubble: use user.avatar or user.avatarUrl; fallback to initials */}
              <span className="h-8 w-8 rounded-full overflow-hidden bg-white/20 flex items-center justify-center">
                {user?.avatar || user?.avatarUrl ? (
                  <img src={user.avatar || user.avatarUrl} alt="Avatar" className="h-full w-full object-cover" onError={(e)=>{ e.currentTarget.style.display='none'; }} />
                ) : (
                  <span className="text-sm font-semibold">{(user?.name || 'Dr. Smith').trim().split(/\s+/).map(s=>s[0]).join('').slice(0,2).toUpperCase()}</span>
                )}
              </span>
              <span className="font-medium">{user?.name || 'Dr. Smith'}</span>
            </span>
            <svg
              className={`w-5 h-5 transition-transform duration-200 ${isAccountOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstructorSidebar;