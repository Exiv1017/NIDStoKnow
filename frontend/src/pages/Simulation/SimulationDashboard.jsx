import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// This page has been removed — redirect users to the Simulation Lobby.
const SimulationDashboard = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/student/lobby', { replace: true });
  }, [navigate]);
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Simulation Dashboard removed</h2>
        <p className="text-gray-600 mt-2">Redirecting to Simulation Lobby…</p>
      </div>
    </div>
  );
};

export default SimulationDashboard;