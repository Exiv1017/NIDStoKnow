import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const StudentSignUp = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const buildEmail = (first, last) => {
    const sanitize = (s) => (s || '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/\s+/g, '') // remove spaces (no dashes)
      .replace(/[^a-z0-9]/g, ''); // remove any remaining non-alphanumerics
    const f = sanitize(first);
    const l = sanitize(last);
    if (!f && !l) return '';
    const local = f && l ? `${f}.${l}` : (f || l);
    return `${local}@lspu.edu.ph`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const next = { ...formData, [name]: value };
    if (name === 'firstName' || name === 'lastName') {
      next.email = buildEmail(next.firstName, next.lastName);
    }
    setFormData(next);
  };

  const isStrongPassword = (password) => {
    // At least 8 chars, one uppercase, one lowercase, one number, one special char
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/.test(password);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!isStrongPassword(formData.password)) {
      setError('Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.');
      return;
    }
    setIsLoading(true);
    try {
    const response = await fetch('/api/student/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
      name: `${formData.firstName} ${formData.lastName}`.trim(),
      email: formData.email,
          password: formData.password
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        // Try to detect if the error is about duplicate email
        const errorMsg = (data.error || data.detail || JSON.stringify(data)).toLowerCase();
        if (
          response.status === 409 ||
          errorMsg.includes('already exists') ||
          errorMsg.includes('duplicate') ||
          errorMsg.includes('email in use') ||
          errorMsg.includes('email already') ||
          errorMsg.includes('unique constraint')
        ) {
          setError('This email is already in use. Please use a different email.');
        } else if (response.status === 400 && errorMsg.includes('weak')) {
          setError('Password is too weak. Please choose a stronger password.');
        } else if (response.status === 400 && errorMsg.includes('invalid')) {
          setError('Invalid input. Please check your details and try again.');
        } else {
          setError(data.error || data.detail || 'Signup failed');
          console.error('Signup backend error:', data);
        }
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Signup error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
  <div className="py-20 bg-[#E3E3E3] relative overflow-hidden">
      {/* Background image at the bottom, behind all content */}
      <div className="absolute inset-x-0 bottom-0 h-24 sm:h-36 md:h-48 pointer-events-none">
        <img src="/diagonal.svg" alt="" className="w-full h-full object-cover" />
      </div>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 lg:pt-20 pb-8 sm:pb-10 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-7 lg:col-span-8">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6">
              Begin Your
              <br className="hidden sm:block" />
              Cybersecurity Journey
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 mb-6 sm:mb-8 font-medium max-w-2xl">
              Join our community of aspiring cybersecurity professionals. Learn network intrusion detection through hands-on experience and real-world scenarios.
            </p>
          </div>

          <div className="md:col-span-5 lg:col-span-4 -mt-12">
            <div className="">
              <h2 className="text-2xl font-semibold text-[#1E5780] mb-2">Create Account</h2>
              <p className="text-xs text-gray-600 mb-3">Use your LSPU email. Format: <span className="font-medium">firstname.lastname@lspu.edu.ph</span></p>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="First name"
                    className="w-full px-3 py-2 bg-transparent border border-gray-500 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E5780] focus:border-[#1E5780]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Last name"
                    className="w-full px-3 py-2 bg-transparent border border-gray-500 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E5780] focus:border-[#1E5780]"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    LSPU Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    readOnly
                    placeholder="firstname.lastname@lspu.edu.ph"
                    className="w-full px-3 py-2 bg-gray-100 border border-gray-500 rounded-md text-gray-700"
                    required
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Auto-generated from your first and last name.</p>
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
                    placeholder="Create a strong password"
                    className="w-full px-3 py-2 bg-transparent border border-gray-500 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E5780] focus:border-[#1E5780]"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Retype your password"
                    className="w-full px-3 py-2 bg-transparent border border-gray-500 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E5780] focus:border-[#1E5780]"
                    required
                  />
                </div>
                {success && (
                  <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded mb-2">
                    Account created! Please check your email or contact admin if you do not receive a confirmation. Redirecting to login...
                  </div>
                )}
                {error && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-2">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-[#1E5780] text-white rounded-md hover:bg-[#1a4b6e] transition-colors duration-200 mt-4"
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
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

export default StudentSignUp;