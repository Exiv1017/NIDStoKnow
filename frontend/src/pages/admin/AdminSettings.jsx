import { useState, useRef, useContext, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';

const AdminSettings = () => {
  const { user, setUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('profile');
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || 'Administrator',
    avatar: null,
    systemSettings: user?.systemSettings || {
      enableUserRegistration: true,
      autoApproveInstructors: false,
      maintenanceMode: false,
      backupFrequency: 'daily',
    }
  });
  const [originalFormData, setOriginalFormData] = useState(formData);
  const [profileMsg, setProfileMsg] = useState('');
  const [systemMsg, setSystemMsg] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [security, setSecurity] = useState({
    current: '',
    new: '',
    confirm: '',
    showCurrent: false,
    showNew: false,
    showConfirm: false,
  });
  const [securityMsg, setSecurityMsg] = useState('');
  const [securityError, setSecurityError] = useState('');
  const fileInputRef = useRef();
  const [systemSettings, setSystemSettings] = useState(formData.systemSettings);
  const [notifSettings, setNotifSettings] = useState({ email: true, browser: true, systemAlerts: true });
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    // When user data is available, update the form
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || prev.name,
        email: user.email || prev.email
      }));
      setOriginalFormData(prev => ({
        ...prev,
        name: user.name || prev.name,
        email: user.email || prev.email
      }));
    }
  }, [user]);

  useEffect(() => {
    // Fetch persisted system settings
    fetch('/api/admin/system-settings')
      .then(res => res.json())
      .then(data => setSystemSettings(data));
              <li>
                <Link
                  to="/admin/lobbies"
                  className="flex items-center p-3 rounded-lg hover:bg-white/10 font-medium"
                >
                  <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5V4H2v16h5m10 0v-4H7v4m10 0H7" />
                  </svg>
                  Active Lobbies
                </Link>
              </li>
    // Fetch notification preferences
    if (user?.id) {
      fetch(`/api/admin/notifications/${user.id}`)
        .then(res => res.json())
        .then(data => setNotifSettings(data));
      // Fetch audit logs
      setAuditLoading(true);
      fetch(`/api/admin/audit-logs/${user.id}`)
        .then(res => res.json())
        .then(data => setAuditLogs(data))
        .finally(() => setAuditLoading(false));
    }
  }, [user]);

  // Profile change detection
  const isProfileChanged = JSON.stringify({ ...formData, systemSettings: undefined, avatar: undefined }) !== 
                          JSON.stringify({ ...originalFormData, systemSettings: undefined, avatar: undefined }) || 
                          avatarPreview;

  // System settings change detection
  const isSystemChanged = JSON.stringify(formData.systemSettings) !== JSON.stringify(originalFormData.systemSettings);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setProfileMsg('');
  };

  const handleSystemSettingChange = (setting) => {
    setFormData(prev => ({
      ...prev,
      systemSettings: {
        ...prev.systemSettings,
        [setting]: !prev.systemSettings[setting]
      }
    }));
    setSystemMsg('');
  };

  const handleSelectChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      systemSettings: {
        ...prev.systemSettings,
        [name]: value
      }
    }));
    setSystemMsg('');
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    const profileData = {
      id: user?.id,
      name: formData.name,
      email: formData.email,
      role: formData.role
    };
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      });
      let data;
      try {
        data = await res.json();
      } catch (err) {
        data = {};
      }
      if (res.ok && data.status === 'success') {
        setOriginalFormData({ ...formData, avatar: undefined });
        setProfileMsg('Profile updated!');
        setAvatarPreview(null);
        if (setUser) {
          setUser(prev => ({ ...prev, ...profileData }));
        }
      } else if (!res.ok && data.detail) {
        setProfileMsg(data.detail);
      } else {
        setProfileMsg(data.message || 'Failed to update profile.');
      }
    } catch (err) {
      setProfileMsg('Error updating profile.');
    }
  };

  const handleProfileCancel = () => {
    setFormData({ ...originalFormData, avatar: null });
    setAvatarPreview(null);
    setProfileMsg('Changes reverted.');
  };

  const handleSystemSave = async () => {
    try {
      const res = await fetch('/api/admin/system-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(systemSettings)
      });
      let data;
      try {
        data = await res.json();
      } catch (err) {
        data = {};
      }
      if (res.ok && data.status === 'success') {
        setSystemMsg('System settings updated!');
      } else if (!res.ok && data.detail) {
        setSystemMsg(data.detail);
      } else {
        setSystemMsg(data.message || 'Failed to update system settings.');
      }
    } catch (err) {
      setSystemMsg('Error updating system settings.');
    }
  };

  const handleNotifSave = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/admin/notifications/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifSettings)
      });
      let data;
      try {
        data = await res.json();
      } catch (err) {
        data = {};
      }
      if (res.ok && data.status === 'success') {
        setNotifMsg('Notification preferences updated!');
      } else if (!res.ok && data.detail) {
        setNotifMsg(data.detail);
      } else {
        setNotifMsg(data.message || 'Failed to update notification preferences.');
      }
    } catch (err) {
      setNotifMsg('Error updating notification preferences.');
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (!security.current || !security.new || !security.confirm) {
      setSecurityError('Please fill in all fields.');
      return;
    }
    if (security.new !== security.confirm) {
      setSecurityError('New passwords do not match.');
      return;
    }
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, current_password: security.current, new_password: security.new })
      });
      let data;
      try {
        data = await res.json();
      } catch (err) {
        data = {};
      }
      if (res.ok && data.status === 'success') {
        setSecurityMsg('Password updated!');
        setSecurityError('');
        setSecurity({ current: '', new: '', confirm: '', showCurrent: false, showNew: false, showConfirm: false });
        if (setUser) {
          setUser(null);
        }
      } else if (!res.ok && data.detail) {
        setSecurityError(data.detail);
        setSecurityMsg('');
      } else {
        setSecurityError(data.message || 'Failed to update password.');
        setSecurityMsg('');
      }
    } catch (err) {
      setSecurityError('Error updating password.');
      setSecurityMsg('');
    }
  };

  const handleSystemCancel = () => {
    setFormData(prev => ({ ...prev, systemSettings: { ...originalFormData.systemSettings } }));
    setSystemMsg('Changes reverted.');
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({ ...prev, avatar: file }));
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSecurityInput = (e) => {
    const { name, value } = e.target;
    setSecurity(prev => ({ ...prev, [name]: value }));
    setSecurityMsg('');
    setSecurityError('');
  };

  const handleShowPassword = (field) => {
    setSecurity(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="flex min-h-screen bg-[#E3E3E3]">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 w-64 h-screen bg-gradient-to-b from-[#0C2A40] to-[#206EA6] text-white flex flex-col z-50">
        <div className="p-6 flex items-center justify-start pr-4">
          <Link to="/admin-dashboard" className="ml-2">
            <img src="/NIDStoKnowLogo.svg" alt="NIDSToKnow Logo" className="h-10 w-auto" />
          </Link>
        </div>
        <nav className="flex-1 px-4">
          <ul className="space-y-3">
            <li>
              <Link
                to="/admin-dashboard"
                className="flex items-center p-3 rounded-lg hover:bg-white/10 font-medium"
              >
                <img src="/dashboardicon.svg" alt="" className="w-6 h-6 mr-3" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                to="/admin/users"
                className="flex items-center p-3 rounded-lg hover:bg-white/10 font-medium"
              >
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                User Management
              </Link>
            </li>
            <li>
              <Link
                to="/admin/module-requests"
                className="flex items-center p-3 rounded-lg hover:bg-white/10 font-medium"
              >
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0120 9.414V19a2 2 0 01-2 2z" />
                </svg>
                Module Requests
              </Link>
            </li>
            <li>
              <Link
                to="/admin/lobbies"
                className="flex items-center p-3 rounded-lg hover:bg-white/10 font-medium"
              >
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5V4H2v16h5m10 0v-4H7v4m10 0H7" />
                </svg>
                Active Lobbies
              </Link>
            </li>
            <li>
              <Link
                to="/admin/settings"
                className="flex items-center p-3 rounded-lg bg-white/10 font-medium text-white"
              >
                <img src="/settings.svg" alt="" className="w-6 h-6 mr-3" />
                Settings
              </Link>
            </li>
          </ul>
        </nav>
        <div className="p-4 mt-auto border-t border-white/10">
          <button
            className="w-full flex items-center gap-2 p-3 rounded-lg hover:bg-white/10 transition-all duration-200 text-left text-red-300 font-semibold"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm">Logout</span>
          </button>
        </div>
      </aside>
      
  {/* Main Content */}
  <main className="flex-1 ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black mb-1">Admin Settings</h1>
          <p className="text-gray-600 text-base">Manage your admin account and system settings</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm">
          <div className="border-b">
            <div className="flex p-4 gap-4">
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                  activeTab === 'profile'
                    ? 'bg-[#1E5780] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                aria-label="Profile Tab"
              >
                Profile
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                  activeTab === 'security'
                    ? 'bg-[#1E5780] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                aria-label="Security Tab"
              >
                Security
              </button>
              <button
                onClick={() => setActiveTab('system')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                  activeTab === 'system'
                    ? 'bg-[#1E5780] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                aria-label="System Settings Tab"
              >
                System Settings
              </button>
            </div>
          </div>
          <div className="p-6">
            {activeTab === 'profile' && (
              <form className="space-y-6" onSubmit={handleProfileSave}>
                <div className="flex items-center mb-6 gap-6">
                  <div className="relative h-20 w-20 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl overflow-hidden">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar Preview" className="h-full w-full object-cover" />
                    ) : (
                      <span>{formData.name[0]}</span>
                    )}
                    <button
                      type="button"
                      className="absolute bottom-0 right-0 bg-[#1E5780] text-white rounded-full p-2 border-2 border-white shadow-lg hover:bg-[#164666] focus:outline-none focus:ring-2 focus:ring-[#1E5780] transition-all duration-150"
                      onClick={() => fileInputRef.current.click()}
                      aria-label="Change avatar"
                      title="Change avatar"
                      style={{ transform: 'translate(25%, 25%)' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-4.553a1.5 1.5 0 00-2.121-2.121L13 7.879M7 17h.01M12 17h.01M17 17h.01M12 7v6m0 0l-2-2m2 2l2-2" />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
                      </svg>
                    </button>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleAvatarChange}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <input
                    type="text"
                    name="role"
                    value={formData.role}
                    disabled
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-gray-50 cursor-not-allowed"
                  />
                  <p className="text-sm text-gray-500 mt-1">The role cannot be changed</p>
                </div>
                
                {profileMsg && (
                  <div className={`p-3 rounded-lg ${
                    profileMsg.includes('reverted') ? 'bg-blue-50 text-blue-800' : 'bg-green-50 text-green-800'
                  }`}>
                    {profileMsg}
                  </div>
                )}
                
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleProfileCancel}
                    disabled={!isProfileChanged}
                    className={`px-4 py-2 rounded-lg border border-gray-300 text-gray-700 ${
                      isProfileChanged ? 'hover:bg-gray-100' : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!isProfileChanged}
                    className={`px-4 py-2 rounded-lg bg-[#1E5780] text-white ${
                      isProfileChanged ? 'hover:bg-[#164666]' : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            )}
            
            {activeTab === 'security' && (
              <form className="space-y-6" onSubmit={handlePasswordUpdate}>
                <h3 className="text-lg font-semibold mb-4">Change Password</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={security.showCurrent ? 'text' : 'password'}
                        name="current"
                        value={security.current}
                        onChange={handleSecurityInput}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        onClick={() => handleShowPassword('showCurrent')}
                      >
                        {security.showCurrent ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={security.showNew ? 'text' : 'password'}
                        name="new"
                        value={security.new}
                        onChange={handleSecurityInput}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        onClick={() => handleShowPassword('showNew')}
                      >
                        {security.showNew ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={security.showConfirm ? 'text' : 'password'}
                        name="confirm"
                        value={security.confirm}
                        onChange={handleSecurityInput}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        onClick={() => handleShowPassword('showConfirm')}
                      >
                        {security.showConfirm ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                
                {securityError && (
                  <div className="p-3 bg-red-50 text-red-800 rounded-lg">
                    {securityError}
                  </div>
                )}
                
                {securityMsg && (
                  <div className="p-3 bg-green-50 text-green-800 rounded-lg">
                    {securityMsg}
                  </div>
                )}
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#1E5780] text-white hover:bg-[#164666]"
                  >
                    Update Password
                  </button>
                </div>
              </form>
            )}
            
            {activeTab === 'system' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold mb-4">System Settings</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium">User Registration</h4>
                      <p className="text-sm text-gray-600">Allow new users to create accounts</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={formData.systemSettings.enableUserRegistration}
                        onChange={() => handleSystemSettingChange('enableUserRegistration')}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1E5780]"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium">Auto-approve Instructors</h4>
                      <p className="text-sm text-gray-600">Automatically approve new instructor registrations</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={formData.systemSettings.autoApproveInstructors}
                        onChange={() => handleSystemSettingChange('autoApproveInstructors')}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1E5780]"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium">Maintenance Mode</h4>
                      <p className="text-sm text-gray-600">Put the site in maintenance mode (only admins can access)</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={formData.systemSettings.maintenanceMode}
                        onChange={() => handleSystemSettingChange('maintenanceMode')}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1E5780]"></div>
                    </label>
                  </div>
                  
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="mb-2">
                      <h4 className="font-medium">Database Backup Frequency</h4>
                      <p className="text-sm text-gray-600">How often the database should be backed up</p>
                    </div>
                    <select
                      name="backupFrequency"
                      value={formData.systemSettings.backupFrequency}
                      onChange={handleSelectChange}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent"
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>
                
                {systemMsg && (
                  <div className={`p-3 rounded-lg ${
                    systemMsg.includes('reverted') ? 'bg-blue-50 text-blue-800' : 'bg-green-50 text-green-800'
                  }`}>
                    {systemMsg}
                  </div>
                )}
                
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleSystemCancel}
                    disabled={!isSystemChanged}
                    className={`px-4 py-2 rounded-lg border border-gray-300 text-gray-700 ${
                      isSystemChanged ? 'hover:bg-gray-100' : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSystemSave}
                    disabled={!isSystemChanged}
                    className={`px-4 py-2 rounded-lg bg-[#1E5780] text-white ${
                      isSystemChanged ? 'hover:bg-[#164666]' : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    Save Changes
                  </button>
                </div>
                <h3 className="text-lg font-semibold mt-8 mb-2">Recent Admin Actions</h3>
                {auditLoading ? (
                  <div>Loading logs...</div>
                ) : (
                  <ul className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto text-sm">
                    {auditLogs.length === 0 ? (
                      <li className="text-gray-400">No recent actions.</li>
                    ) : (
                      auditLogs.map(log => (
                        <li key={log.id} className="mb-2">
                          <span className="text-gray-700">{log.action}</span>
                          <span className="ml-2 text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminSettings;