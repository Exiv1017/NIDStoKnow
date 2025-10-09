import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const SimulationDashboard = () => {
  const [activeTab, setActiveTab] = useState('active');

  const simulations = [
    {
      id: 1,
      title: 'Basic Port Scanning Detection',
      type: 'Signature-based',
      status: 'active',
      progress: 75,
      lastUpdated: '2024-03-15'
    },
    {
      id: 2,
      title: 'Traffic Anomaly Analysis',
      type: 'Anomaly-based',
      status: 'completed',
      progress: 100,
      lastUpdated: '2024-03-14'
    },
    {
      id: 3,
      title: 'Hybrid Attack Detection',
      type: 'Hybrid',
      status: 'pending',
      progress: 0,
      lastUpdated: '2024-03-13'
    }
  ];

  return (
    <div className="min-h-screen bg-[#E3E3E3] p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-[#1E5780]">Simulation Dashboard</h1>
            <Link 
              to="/simulation/configure-honeypot"
              className="px-6 py-2 bg-[#1E5780] text-white rounded-lg hover:bg-[#164666] transition-colors"
            >
              New Simulation
            </Link>
          </div>

          <div className="mb-6">
            <div className="flex space-x-4 border-b">
              <button
                onClick={() => setActiveTab('active')}
                className={`px-4 py-2 font-medium ${
                  activeTab === 'active'
                    ? 'text-[#1E5780] border-b-2 border-[#1E5780]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Active Simulations
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`px-4 py-2 font-medium ${
                  activeTab === 'completed'
                    ? 'text-[#1E5780] border-b-2 border-[#1E5780]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Completed
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-2 font-medium ${
                  activeTab === 'pending'
                    ? 'text-[#1E5780] border-b-2 border-[#1E5780]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Pending
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {simulations
              .filter(sim => sim.status === activeTab)
              .map(simulation => (
                <div key={simulation.id} className="bg-gray-50 rounded-lg p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">{simulation.title}</h3>
                    <span className={`px-2 py-1 rounded text-sm ${
                      simulation.status === 'active' ? 'bg-green-100 text-green-800' :
                      simulation.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {simulation.status}
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600">Type</p>
                      <p className="font-medium text-gray-800">{simulation.type}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600">Progress</p>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-[#1E5780] h-2.5 rounded-full" 
                          style={{ width: `${simulation.progress}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{simulation.progress}%</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600">Last Updated</p>
                      <p className="font-medium text-gray-800">{simulation.lastUpdated}</p>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <Link
                      to={`/simulation/results/${simulation.id}`}
                      className="px-4 py-2 text-[#1E5780] hover:bg-[#1E5780] hover:text-white rounded-lg transition-colors"
                    >
                      View Results
                    </Link>
                    {simulation.status === 'active' && (
                      <Link
                        to={`/simulation/configure-honeypot/${simulation.id}`}
                        className="px-4 py-2 bg-[#1E5780] text-white rounded-lg hover:bg-[#164666] transition-colors"
                      >
                        Continue
                      </Link>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationDashboard; 