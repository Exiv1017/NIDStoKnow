import { useState, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { FiClipboard } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

const Sidebar = () => {
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isSimulationOpen, setIsSimulationOpen] = useState(false);
  const navigate = useNavigate();
  const { logout, user } = useContext(AuthContext);
  const location = useLocation();

  const isActive = (path) => {
    try {
      const p = location.pathname || '';
      if (path === '/') return p === '/';
      return p === path || p.startsWith(path + '/') || p === path.replace(/\/$/, '');
    } catch (e) {
      return false;
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
  <div className="global-sidebar fixed top-0 left-0 w-64 h-screen bg-gradient-to-b from-[#0C2A40] to-[#206EA6] text-white flex flex-col z-50">
      <div className="p-6 flex justify-start">
        <Link to="/dashboard" className="ml-2">
          <img src="/NIDStoKnowLogo.svg" alt="NIDSToKnow Logo" className="h-10 w-auto" />
        </Link>
      </div>
      
      <nav className="flex-1 px-4">
        <ul className="space-y-3">
          <li>
            <Link
              to="/dashboard"
              className={`flex items-center p-3 rounded-lg hover:bg-white/10 transition-all duration-200 ${isActive('/dashboard') ? 'bg-white/10 text-white font-medium' : ''}`}
            >
              <img src="/dashboardicon.svg" alt="" className="w-6 h-6 mr-3" />
              <span className="font-medium">Dashboard</span>
            </Link>
          </li>
          <li>
            <Link
              to="/learning-modules"
              className={`flex items-center p-3 rounded-lg hover:bg-white/10 transition-all duration-200 ${isActive('/learning-modules') ? 'bg-white/10 text-white font-medium' : ''}`}
            >
              <img src="/module.svg" alt="" className="w-6 h-6 mr-3" />
              <span className="font-medium">Learning Modules</span>
            </Link>
          </li>
          <li>
            <Link
              to="/student/assignments"
              className={`flex items-center p-3 rounded-lg hover:bg-white/10 transition-all duration-200 ${isActive('/student/assignments') ? 'bg-white/10 text-white font-medium' : ''}`}
            >
              <FiClipboard className="w-6 h-6 mr-3" />
              <span className="font-medium">My Assignments</span>
            </Link>
          </li>
          <li>
            <div className="relative">
              <button
                onClick={() => setIsSimulationOpen(!isSimulationOpen)}
                className={`flex items-center justify-between w-full p-3 rounded-lg hover:bg-white/10 transition-all duration-200 ${isActive('/simulation') || isActive('/student/lobby') ? 'bg-white/10 text-white font-medium' : ''}`}
                aria-expanded={isSimulationOpen}
                aria-controls="simulation-submenu"
              >
                <span className="flex items-center">
                  <img src="/terminal.svg" alt="" className="w-6 h-6 mr-3" />
                  <span className="font-medium">Simulation Lab</span>
                </span>
                <img
                  src="/dropdown.svg"
                  alt="Toggle dropdown"
                  className={`w-5 h-5 ml-2 transition-transform duration-200 ${isSimulationOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {isSimulationOpen && (
                <div id="simulation-submenu" className="w-full bg-[#0C2A40] rounded-lg overflow-hidden shadow-lg mt-1">
                  <Link
                    to="/simulation/signature"
                    className={`flex items-center gap-2 p-3 hover:bg-white/10 transition-all duration-200 ${isActive('/simulation/signature') ? 'bg-white/10 text-white font-medium' : ''}`}
                  >
                    <span className="text-sm">Signature-Based</span>
                  </Link>
                  <Link
                    to="/simulation/anomaly"
                    className={`flex items-center gap-2 p-3 hover:bg-white/10 transition-all duration-200 ${isActive('/simulation/anomaly') ? 'bg-white/10 text-white font-medium' : ''}`}
                  >
                    <span className="text-sm">Anomaly-Based</span>
                  </Link>
                  <Link
                    to="/simulation/hybrid"
                    className={`flex items-center gap-2 p-3 hover:bg-white/10 transition-all duration-200 ${isActive('/simulation/hybrid') ? 'bg-white/10 text-white font-medium' : ''}`}
                  >
                    <span className="text-sm">Hybrid</span>
                  </Link>
                  <Link
                    to="/student/lobby"
                    className={`flex items-center gap-2 p-3 hover:bg-white/10 transition-all duration-200 ${isActive('/student/lobby') ? 'bg-white/10 text-white font-medium' : ''}`}
                  >
                    <span className="text-sm">Simulation Lobby</span>
                  </Link>
                </div>
              )}
            </div>
          </li>
          <li>
            <Link
              to="/account-settings"
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
          <button
            onClick={() => setIsAccountOpen(!isAccountOpen)}
            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/10 transition-all duration-200"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-full overflow-hidden bg-white/20 flex items-center justify-center text-sm shrink-0">
                {user?.avatar || user?.avatarUrl ? (
                  <img
                    src={user.avatar || user.avatarUrl}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <span className="font-semibold">
                    {(user?.name || 'S').trim().split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase()}
                  </span>
                )}
              </div>
              <span className="font-medium truncate">{user?.name || 'Student Account'}</span>
            </div>
            <img 
              src="/dropdown.svg" 
              alt="" 
              className={`w-5 h-5 ml-2 transition-transform duration-200 ${isAccountOpen ? 'rotate-180' : ''}`}
            />
          </button>
          
          {isAccountOpen && (
            <div className="absolute bottom-full left-0 w-full bg-[#0C2A40] rounded-lg overflow-hidden shadow-lg mb-1">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 p-3 hover:bg-white/10 transition-all duration-200 text-left"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-sm">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
};

export default Sidebar;