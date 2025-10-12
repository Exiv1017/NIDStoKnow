import { Link, useLocation } from 'react-router-dom';
import { useContext, useMemo } from 'react';
import AuthContext from '../context/AuthContext';

const Navigation = () => {
  const { isAuthenticated } = useContext(AuthContext);
  const location = useLocation();

  const path = location.pathname || '/';
  // Hide navigation entirely on Admin Login page
  if (path === '/admin-login') return null;
  // Pages that should always show the PUBLIC nav style (logo + Sign Up / Log In)
  const publicAuthPages = useMemo(() => ([
    '/', '/signup', '/student/signup', '/instructor/signup', '/login', '/instructor-login', '/admin-login'
  ]), []);
  const isPublicAuthPage = publicAuthPages.includes(path);

  // Hide navigation entirely on theoretical learning pages
  if (path.startsWith('/student/theoretical')) return null;

  // Only shift for sidebar when authenticated AND not on public auth pages
  const shiftForSidebar = isAuthenticated && !isPublicAuthPage;
  // We treat nav as "public" on auth pages even if auth state flickers true momentarily after logout
  const showPublicVariant = isPublicAuthPage || !isAuthenticated;
  
  return (
    <nav className={`flex items-center justify-between h-16 fixed top-0 right-0 z-50 w-full
        ${shiftForSidebar ? 'left-64' : 'left-0'}
        bg-[#E3E3E3] border-b transition-[left] duration-200`}
    >
      <div className="flex items-center h-full pl-4 sm:pl-6 lg:pl-8">
        {showPublicVariant && (
          <Link to="/" className="flex items-center group">
            <img src="/logo.svg" alt="NIDSToKnow Logo" className="h-8 w-auto transition-transform group-hover:scale-105" />
          </Link>
        )}
      </div>
      <div className="flex items-center h-full pr-4 sm:pr-6 lg:pr-8">
        {showPublicVariant && (
          <div className="flex items-center space-x-10 sm:space-x-12">
            <Link to="/signup" className="text-sm sm:text-base text-gray-700 hover:text-gray-900 font-medium">Sign Up</Link>
            <Link to="/login" className="text-sm sm:text-base text-gray-700 hover:text-gray-900 font-medium">Log In</Link>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;