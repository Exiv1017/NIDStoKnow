import React, { useContext } from 'react';
import Sidebar from '../../components/Sidebar';
import AuthContext from '../../context/AuthContext';

const StudentProfile = () => {
  const { user } = useContext(AuthContext);
  return (
    <div className="flex">
  {/* Sidebar provided by ModuleLayout */}
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-6">Student Profile</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Personal Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <p className="mt-1 text-gray-900">{user?.name || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <p className="mt-1 text-gray-900">{user?.email || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <input type="password" value={user ? '********' : ''} disabled className="mt-1 text-gray-900 bg-gray-100 rounded px-2 py-1 w-48" />
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-4">Course Progress</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Completed Modules</label>
                  <p className="mt-1 text-gray-900">5/10</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Current Grade</label>
                  <p className="mt-1 text-gray-900">A-</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentProfile;