import React from 'react';
import Sidebar from './Sidebar';
import { useNavigate } from 'react-router-dom';

const ModuleLayout = ({ title, children, moduleId, onComplete }) => {
  const navigate = useNavigate();

  const handleComplete = () => {
    if (onComplete) {
      onComplete();
    }
    navigate('/student/learning-modules');
  };

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      {/* Let child pages own their layout and width like instructor pages */}
      <main className="flex-1 overflow-y-auto bg-white ml-64">
        {children}
      </main>
    </div>
  );
};

export default ModuleLayout; 