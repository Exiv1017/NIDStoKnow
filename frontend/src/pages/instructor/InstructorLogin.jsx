import { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';

const InstructorLogin = () => {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/instructor/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

  const data = await response.json();

      if (response.ok) {
        const userWithToken = { ...(data.user || {}), token: data.access_token };
        login(userWithToken);
        navigate('/instructor-dashboard');
      } else {
        if ((data.error || data.detail) === "Email not found") {
          setError("This email is not registered. Please sign up first.");
        } else if ((data.error || data.detail) === "Incorrect password") {
          setError("Incorrect password. Please try again.");
        } else if ((data.error || data.detail) === "Instructor account not approved yet.") {
          setError("Your account is pending admin approval.");
        } else {
          setError(data.detail || data.error || 'Invalid email or password');
        }
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E3E3E3] relative overflow-hidden">
      {/* Background image at the bottom, behind all content */}
      <div className="absolute inset-x-0 bottom-0 h-24 sm:h-36 md:h-48 pointer-events-none">
        <img src="/diagonal.svg" alt="" className="w-full h-full object-cover" />
      </div>
  <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 lg:pt-36 pb-8 sm:pb-10 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-7 lg:col-span-8">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6">
              Welcome Back,
              <br className="hidden sm:block" />
              Instructor
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 mb-6 sm:mb-8 font-medium max-w-2xl">
              Access your instructor dashboard to manage courses, track student progress, and create engaging learning materials for your students.
            </p>
          </div>

          <div className="md:col-span-5 lg:col-span-4">
            <div className="">
              <h2 className="text-2xl font-semibold text-[#1E5780] mb-2">Instructor Login</h2>
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="your.name@lspu.edu.ph"
                    className="w-full px-3 py-2 bg-transparent border border-gray-500 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E5780] focus:border-[#1E5780]"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    className="w-full px-3 py-2 bg-transparent border border-gray-500 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E5780] focus:border-[#1E5780]"
                    required
                  />
                </div>
                <div className="flex justify-end">
                  <Link to="/forgot-password" className="text-sm text-[#1E5780] hover:text-[#1a4b6e]">
                    Forgot Password?
                  </Link>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full px-4 py-2 bg-[#1E5780] text-white rounded-md hover:bg-[#1a4b6e] transition-colors duration-200 mt-4 ${
                    isLoading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isLoading ? 'Logging in...' : 'Log In'}
                </button>
              </form>
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">
                  Are you a student?{' '}
                  <Link to="/login" className="text-[#1E5780] hover:text-[#1a4b6e] font-medium">
                    Login here
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default InstructorLogin;