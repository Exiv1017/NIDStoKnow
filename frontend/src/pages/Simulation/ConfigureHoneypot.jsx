import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';

const ConfigureHoneypot = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    simulationName: '',
    detectionType: 'signature',
    attackType: 'port-scan',
    duration: 30,
    logLevel: 'info',
    notifications: true,
    honeypotType: 'ssh',
    port: 2224,
    maxConnections: 10,
    captureCommands: true,
    capturePasswords: true,
    captureDownloads: true
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [availablePorts, setAvailablePorts] = useState([2224, 2225]);

  useEffect(() => {
    // Check Cowrie service status
    const checkCowrieStatus = async () => {
      try {
        const response = await fetch('/api/cowrie/status');
        const data = await response.json();
        if (!data.running) {
          setError('Cowrie service is not running. Please start the service first.');
        }
      } catch (err) {
        setError('Failed to connect to Cowrie service.');
      }
    };
    checkCowrieStatus();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Configure Cowrie
      const configResponse = await fetch('/api/cowrie/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          // Convert duration to seconds
          duration: formData.duration * 60,
          // Convert port to number
          port: parseInt(formData.port, 10)
        }),
      });

      const configData = await configResponse.json();

      if (!configResponse.ok) {
        throw new Error(configData.detail || 'Failed to configure honeypot');
      }

      // Start simulation
      const startResponse = await fetch('/api/simulation/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const startData = await startResponse.json();

      if (!startResponse.ok) {
        throw new Error(startData.detail || 'Failed to start simulation');
      }

      navigate('/simulation/dashboard');
    } catch (err) {
      setError(err.message);
      // Log the error for debugging
      console.error('Configuration error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#E3E3E3]">
  {/* Sidebar provided by ModuleLayout */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm p-8">
              <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-[#1E5780]">Configure Honeypot Simulation</h1>
                <div className="text-sm text-gray-500">
                  Cowrie Status: <span className="text-green-500">Running</span>
                </div>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Simulation Name
                    </label>
                    <input
                      type="text"
                      name="simulationName"
                      value={formData.simulationName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent"
                      placeholder="Enter a name for your simulation"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Detection Type
                    </label>
                    <select
                      name="detectionType"
                      value={formData.detectionType}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent"
                    >
                      <option value="signature">Signature-based</option>
                      <option value="anomaly">Anomaly-based</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Attack Type
                    </label>
                    <select
                      name="attackType"
                      value={formData.attackType}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent"
                    >
                      <option value="port-scan">Port Scanning</option>
                      <option value="brute-force">Brute Force</option>
                      <option value="sql-injection">SQL Injection</option>
                      <option value="buffer-overflow">Buffer Overflow</option>
                      <option value="command-injection">Command Injection</option>
                      <option value="file-upload">File Upload</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Honeypot Type
                    </label>
                    <select
                      name="honeypotType"
                      value={formData.honeypotType}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent"
                    >
                      <option value="ssh">SSH</option>
                      <option value="telnet">Telnet</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Port
                    </label>
                    <select
                      name="port"
                      value={formData.port}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent"
                    >
                      {availablePorts.map(port => (
                        <option key={port} value={port}>{port}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Simulation Duration (minutes)
                    </label>
                    <input
                      type="number"
                      name="duration"
                      value={formData.duration}
                      onChange={handleInputChange}
                      min="1"
                      max="120"
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Log Level
                    </label>
                    <select
                      name="logLevel"
                      value={formData.logLevel}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent"
                    >
                      <option value="debug">Debug</option>
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="error">Error</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Connections
                    </label>
                    <input
                      type="number"
                      name="maxConnections"
                      value={formData.maxConnections}
                      onChange={handleInputChange}
                      min="1"
                      max="100"
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Capture Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="captureCommands"
                        checked={formData.captureCommands}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-[#1E5780] focus:ring-[#1E5780] border-gray-300 rounded"
                      />
                      <label className="ml-2 block text-sm text-gray-700">
                        Capture Commands
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="capturePasswords"
                        checked={formData.capturePasswords}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-[#1E5780] focus:ring-[#1E5780] border-gray-300 rounded"
                      />
                      <label className="ml-2 block text-sm text-gray-700">
                        Capture Passwords
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="captureDownloads"
                        checked={formData.captureDownloads}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-[#1E5780] focus:ring-[#1E5780] border-gray-300 rounded"
                      />
                      <label className="ml-2 block text-sm text-gray-700">
                        Capture Downloads
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="notifications"
                    checked={formData.notifications}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-[#1E5780] focus:ring-[#1E5780] border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-700">
                    Enable real-time notifications
                  </label>
                </div>

                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => navigate('/simulation/dashboard')}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-[#1E5780] text-white rounded-lg hover:bg-[#164666] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Starting...' : 'Start Simulation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ConfigureHoneypot; 