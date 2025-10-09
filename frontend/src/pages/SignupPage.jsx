import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const SignupPage = () => {
  const [userType, setUserType] = useState('');
  const navigate = useNavigate();

  const handleNext = () => {
    if (userType === 'student') {
      navigate('/student/signup');
    } else if (userType === 'instructor') {
      navigate('/instructor/signup');
    }
  };

  return (
    <div className="min-h-screen bg-[#E3E3E3] relative overflow-hidden">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 lg:pt-36 pb-8 sm:pb-10 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-7 lg:col-span-8">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6">
              Join NIDSToKnow
              <br className="hidden sm:block" />
              Today
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 mb-6 sm:mb-8 font-medium max-w-2xl">
              Start your journey in network intrusion detection. Create an account to access comprehensive learning materials and hands-on exercises.
            </p>
          </div>

          <div className="md:col-span-5 lg:col-span-4">
            <div className="">
              <h2 className="text-xl sm:text-2xl font-semibold text-[#1E5780] mb-2">Choose User Type</h2>
              <p className="text-xs text-gray-600 mb-4">Use your LSPU account. Your email must follow firstname.lastname@lspu.edu.ph on the next step.</p>
              <div className="flex space-x-8">
                <label className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="userType"
                    value="student"
                    checked={userType === 'student'}
                    onChange={(e) => setUserType(e.target.value)}
                    className="h-4 w-4 text-[#1E5780]"
                  />
                  <span className="text-sm sm:text-base text-gray-700">Student</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="userType"
                    value="instructor"
                    checked={userType === 'instructor'}
                    onChange={(e) => setUserType(e.target.value)}
                    className="h-4 w-4 text-[#1E5780]"
                  />
                  <span className="text-sm sm:text-base text-gray-700">Instructor</span>
                </label>
              </div>
              <button
                onClick={handleNext}
                className={`mt-6 w-full px-4 py-2 rounded-md text-sm sm:text-base text-white font-medium transition-colors duration-200 ${
                  userType ? 'bg-[#1E5780] hover:bg-[#1a4b6e]' : 'bg-gray-400 cursor-not-allowed'
                }`}
                disabled={!userType}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>

      <div className="absolute inset-x-0 bottom-0 h-24 sm:h-36 md:h-48 pointer-events-none">
        <img src="/diagonal.svg" alt="" className="w-full h-full object-cover" />
      </div>
    </div>
  );
};

export default SignupPage; 