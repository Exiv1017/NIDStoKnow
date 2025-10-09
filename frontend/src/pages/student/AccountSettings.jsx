import { useState, useRef, useContext, useEffect, useMemo } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import AuthContext from '../../context/AuthContext';

const AccountSettings = () => {
  const { user, setUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('profile');
  const [formData, setFormData] = useState({
    firstName: (user?.name || '').split(' ')[0] || '',
    lastName: (user?.name || '').split(' ').slice(1).join(' ') || '',
    email: user?.email || '',
    joinDate: '',
    avatarUrl: '',
    notifications: {
      email: true,
      browser: true,
      moduleUpdates: true,
      assessmentResults: true,
    },
    avatar: null, // file preview only (no upload storage yet)
  });
  const [originalFormData, setOriginalFormData] = useState(formData);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');
  const [notifMsg, setNotifMsg] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
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

  // Load profile (name/email/joinDate/avatarUrl) and settings from backend
  useEffect(() => {
    const fetchAll = async () => {
      try {
        if (!user?.token) return;
        // Profile
        const pr = await fetch('/api/student/profile', { headers: { Authorization: `Bearer ${user.token}` } });
        if (pr.ok) {
          const prof = await pr.json();
          const fullName = prof?.name || user?.name || '';
          const f = (fullName || '').split(' ')[0] || '';
          const l = (fullName || '').split(' ').slice(1).join(' ') || '';
          setFormData(prev => ({
            ...prev,
            firstName: f,
            lastName: l,
            email: prof?.email || prev.email,
            joinDate: prof?.joinDate || '',
            avatarUrl: prof?.avatar || '',
          }));
          setOriginalFormData(prev => ({
            ...prev,
            firstName: f,
            lastName: l,
            email: prof?.email || prev.email,
            joinDate: prof?.joinDate || '',
            avatarUrl: prof?.avatar || '',
          }));
          // Update AuthContext user so sidebar reflects avatar immediately
          if (typeof setUser === 'function') {
            setUser(u => ({ ...(u || {}), name: prof?.name ?? fullName, email: prof?.email ?? u?.email, avatar: prof?.avatar || '' }));
          }
        }
        // Settings
        const sr = await fetch('/api/student/settings', { headers: { Authorization: `Bearer ${user.token}` } });
        if (sr.ok) {
          const setj = await sr.json();
          const notif = (setj && setj.notifications) ? setj.notifications : {};
          setFormData(prev => ({ ...prev, notifications: { ...prev.notifications, ...notif } }));
          setOriginalFormData(prev => ({ ...prev, notifications: { ...prev.notifications, ...notif } }));
        }
      } catch {}
    };
    fetchAll();
  }, [user?.token]);

  // Reset avatar load error when URL changes
  useEffect(() => {
    setAvatarLoadError(false);
  }, [formData.avatarUrl]);

  const isProfileChanged = useMemo(() => {
    const fullNow = `${formData.firstName} ${formData.lastName}`.trim();
    const fullOrig = `${originalFormData.firstName || ''} ${originalFormData.lastName || ''}`.trim();
    return (
      fullNow !== fullOrig ||
      formData.email !== originalFormData.email ||
      (formData.joinDate || '') !== (originalFormData.joinDate || '') ||
      (formData.avatarUrl || '') !== (originalFormData.avatarUrl || '') ||
      Boolean(avatarPreview)
    );
  }, [formData, originalFormData, avatarPreview]);

  // Notification change detection
  const isNotifChanged = JSON.stringify(formData.notifications) !== JSON.stringify(originalFormData.notifications);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setProfileMsg('');
  };

  const handleNotificationChange = (setting) => {
    setFormData(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [setting]: !prev.notifications[setting]
      }
    }));
    setNotifMsg('');
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    // If a new avatar file was selected, upload it first
    let avatarUrl = formData.avatarUrl || '';
    if (formData.avatar instanceof File) {
      if (formData.avatar.size > 5 * 1024 * 1024) {
        setProfileError('Image is too large. Max size is 5 MB.');
        return;
      }
      try {
        const fd = new FormData();
        fd.append('file', formData.avatar);
        const up = await fetch('/api/student/profile/avatar', {
          method: 'POST',
          headers: { ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}) },
          body: fd,
        });
        const j = await up.json().catch(() => ({}));
        if (up.ok) {
          if (j && j.url) avatarUrl = j.url;
        } else {
          setProfileError(j?.detail || 'Failed to upload image. Max size is 5 MB.');
          return;
        }
      } catch {}
    }
    // Prepare data for backend (only relevant profile fields)
    const profileData = {
      name: `${formData.firstName} ${formData.lastName}`.trim(),
      email: formData.email,
      joinDate: formData.joinDate || '',
      avatar: avatarUrl || null,
    };
    try {
      const res = await fetch('/api/student/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}) },
        body: JSON.stringify(profileData)
      });
      if (res.ok) {
        const updated = await res.json();
        // Update current and original form states with the final avatar URL
        setFormData(prev => ({ ...prev, avatarUrl: updated?.avatar ?? avatarUrl }));
        setOriginalFormData({ ...formData, avatarUrl: updated?.avatar ?? avatarUrl, avatar: undefined });
        setProfileMsg('Profile updated!');
        setProfileError('');
        setAvatarPreview(null);
        if (setUser) {
          setUser(prev => ({ ...(prev || {}), name: updated?.name ?? prev?.name, email: updated?.email ?? prev?.email, avatar: updated?.avatar ?? avatarUrl ?? prev?.avatar }));
        }
      } else {
        setProfileMsg('');
        setProfileError('Failed to update profile.');
      }
    } catch (err) {
      setProfileMsg('');
      setProfileError('Error updating profile.');
    }
  };

  const handleProfileCancel = () => {
    setFormData({ ...originalFormData, avatar: null });
    setAvatarPreview(null);
    setProfileMsg('Changes reverted.');
  };

  const handleNotifSave = async () => {
    try {
      const res = await fetch('/api/student/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}) },
        body: JSON.stringify({ notifications: formData.notifications })
      });
      if (res.ok) {
        setOriginalFormData(prev => ({ ...prev, notifications: { ...formData.notifications } }));
        setNotifMsg('Notification preferences updated!');
      } else {
        setNotifMsg('Failed to update notification preferences.');
      }
    } catch (err) {
      setNotifMsg('Error updating notification preferences.');
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Client-side 5 MB check
      if (file.size > 5 * 1024 * 1024) {
        setProfileError('Image is too large. Max size is 5 MB.');
        setProfileMsg('');
        // Clear the file input so user can pick another file
        try { e.target.value = ''; } catch {}
        return;
      }
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
      const res = await fetch('/api/student/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_password: security.current, new_password: security.new, email: user?.email })
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
        setSecurity({
          current: '',
          new: '',
          confirm: '',
          showCurrent: false,
          showNew: false,
          showConfirm: false,
        });
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

  return (
    <div className="flex min-h-screen bg-[#E3E3E3]">
      {/* Sidebar provided by ModuleLayout */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 md:p-8">
          <div className="flex justify-between items-center mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-semibold text-black">Account Settings</h1>
          </div>

          <div className="bg-white rounded-xl shadow-sm">
            <div className="border-b">
              <div className="flex p-3 md:p-4 gap-2 md:gap-3">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`px-3 md:px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                    activeTab === 'profile'
                      ? 'bg-[#1E5780] text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  aria-label="Profile Tab"
                >
                  Profile
                </button>
                <button
                  onClick={() => setActiveTab('notifications')}
                  className={`px-3 md:px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                    activeTab === 'notifications'
                      ? 'bg-[#1E5780] text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  aria-label="Notifications Tab"
                >
                  Notifications
                </button>
                <button
                  onClick={() => setActiveTab('security')}
                  className={`px-3 md:px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                    activeTab === 'security'
                      ? 'bg-[#1E5780] text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  aria-label="Security Tab"
                >
                  Security
                </button>
              </div>
            </div>
            <div className="p-5 md:p-6">
              {activeTab === 'profile' && (
                <form className="space-y-6" onSubmit={handleProfileSave}>
                  <div className="flex items-center mb-4 md:mb-6 gap-4 md:gap-6">
                    <div className="relative h-24 w-24 rounded-full bg-[#1E5780] flex items-center justify-center text-white text-2xl overflow-hidden ring-2 ring-white shadow">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Avatar Preview" className="h-full w-full object-cover" />
                      ) : (formData.avatarUrl && !avatarLoadError) ? (
                        <img
                          src={formData.avatarUrl}
                          alt="Avatar"
                          className="h-full w-full object-cover"
                          onError={() => setAvatarLoadError(true)}
                        />
                      ) : (
                        <span>{user?.name ? user.name[0] : ''}</span>
                      )}
                      <button
                        type="button"
                        className="absolute bottom-1 right-1 bg-[#1E5780] text-white rounded-full p-2 border-2 border-white shadow-lg hover:bg-[#164666] focus:outline-none focus:ring-2 focus:ring-[#1E5780] transition-all duration-150"
                        onClick={() => fileInputRef.current.click()}
                        aria-label="Change avatar"
                        title="Change avatar"
                        style={{ transform: 'none' }}
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
                        aria-label="Upload avatar"
                      />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">{user?.name}</h2>
                      <p className="text-gray-600">{user?.email}</p>
                      {formData.joinDate && (
                        <p className="text-gray-500 text-sm">Member since {new Date(formData.joinDate).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                      <h3 className="text-lg font-medium mb-3">Personal Information</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="firstName">First Name</label>
                            <input
                              type="text"
                              name="firstName"
                              id="firstName"
                              value={formData.firstName}
                              onChange={handleInputChange}
                              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent text-[15px]"
                              aria-label="First Name"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="lastName">Last Name</label>
                            <input
                              type="text"
                              name="lastName"
                              id="lastName"
                              value={formData.lastName}
                              onChange={handleInputChange}
                              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent text-[15px]"
                              aria-label="Last Name"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">LSPU Email</label>
                          <input
                            type="email"
                            name="email"
                            id="email"
                            value={formData.email}
                            readOnly
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-100 text-gray-700 text-[15px]"
                            aria-label="Email"
                          />
                          <p className="text-[11px] text-gray-500 mt-1">Email is managed by your institution.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="joinDate">Join Date</label>
                            <input
                              type="date"
                              name="joinDate"
                              id="joinDate"
                              value={formData.joinDate || ''}
                              onChange={handleInputChange}
                              className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-100 text-gray-700 text-[15px]"
                              aria-label="Join Date"
                              readOnly
                              disabled
                            />
                            {originalFormData.joinDate && (
                              <p className="text-[11px] text-gray-500 mt-1">Join date is set when the account is created.</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="avatarUrl">Avatar URL</label>
                            <input
                              type="url"
                              name="avatarUrl"
                              id="avatarUrl"
                              placeholder="https://example.com/me.png"
                              value={formData.avatarUrl || ''}
                              onChange={handleInputChange}
                              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent text-[15px]"
                              aria-label="Avatar URL"
                            />
                            <p className="text-[11px] text-gray-500 mt-1">Tip: Upload a photo with the camera button, or paste a direct image URL.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Empty right column reserved for future settings */}
                  </div>
                  <div className="flex gap-3 items-center mt-8">
                    <button
                      type="submit"
                      className={`px-4 py-2 rounded-lg font-medium transition-colors bg-[#1E5780] text-white hover:bg-[#164666] focus:outline-none focus:ring-2 focus:ring-[#1E5780] ${!isProfileChanged ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={!isProfileChanged}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-lg font-medium transition-colors bg-gray-200 text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
                      onClick={handleProfileCancel}
                      disabled={!isProfileChanged}
                    >
                      Cancel
                    </button>
                    {profileMsg && <span className="ml-2 text-green-600 text-sm">{profileMsg}</span>}
                    {profileError && <span className="ml-2 text-red-600 text-sm">{profileError}</span>}
                </div>
                </form>
              )}
              {/* Notifications */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-gray-900 font-medium">Email Notifications</h3>
                      <p className="text-gray-600 text-sm">Receive notifications via email</p>
                    </div>
                    <button
                      onClick={() => handleNotificationChange('email')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        formData.notifications.email ? 'bg-[#1E5780]' : 'bg-gray-200'
                      }`}
                      aria-label="Toggle email notifications"
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.notifications.email ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-gray-900 font-medium">Browser Notifications</h3>
                      <p className="text-gray-600 text-sm">Receive notifications in your browser</p>
                    </div>
                    <button
                      onClick={() => handleNotificationChange('browser')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        formData.notifications.browser ? 'bg-[#1E5780]' : 'bg-gray-200'
                      }`}
                      aria-label="Toggle browser notifications"
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.notifications.browser ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex gap-3 mt-8">
                    <button
                      className={`px-4 py-2 rounded-lg font-medium transition-colors bg-[#1E5780] text-white hover:bg-[#164666] focus:outline-none focus:ring-2 focus:ring-[#1E5780] ${!isNotifChanged ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={handleNotifSave}
                      disabled={!isNotifChanged}
                    >
                      Save
                    </button>
                    {notifMsg && <span className="ml-4 text-green-600 font-medium">{notifMsg}</span>}
                  </div>
                </div>
              )}
              {activeTab === 'security' && (
                <form className="space-y-6" onSubmit={handlePasswordUpdate}>
                  <div>
                    <h3 className="text-lg font-medium mb-4">Change Password</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="current">Current Password</label>
                        <div className="relative">
                        <input
                            type={security.showCurrent ? 'text' : 'password'}
                            name="current"
                            id="current"
                            value={security.current}
                            onChange={handleSecurityInput}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent pr-10"
                            aria-label="Current Password"
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#1E5780] focus:outline-none"
                            onClick={() => handleShowPassword('showCurrent')}
                            tabIndex={-1}
                            aria-label={security.showCurrent ? 'Hide current password' : 'Show current password'}
                          >
                            {security.showCurrent ? (<FiEyeOff className="h-5 w-5" />) : (<FiEye className="h-5 w-5" />)}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="new">New Password</label>
                        <div className="relative">
                        <input
                            type={security.showNew ? 'text' : 'password'}
                            name="new"
                            id="new"
                            value={security.new}
                            onChange={handleSecurityInput}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent pr-10"
                            aria-label="New Password"
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#1E5780] focus:outline-none"
                            onClick={() => handleShowPassword('showNew')}
                            tabIndex={-1}
                            aria-label={security.showNew ? 'Hide new password' : 'Show new password'}
                          >
                            {security.showNew ? (<FiEyeOff className="h-5 w-5" />) : (<FiEye className="h-5 w-5" />)}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="confirm">Confirm New Password</label>
                        <div className="relative">
                        <input
                            type={security.showConfirm ? 'text' : 'password'}
                            name="confirm"
                            id="confirm"
                            value={security.confirm}
                            onChange={handleSecurityInput}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent pr-10"
                            aria-label="Confirm New Password"
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#1E5780] focus:outline-none"
                            onClick={() => handleShowPassword('showConfirm')}
                            tabIndex={-1}
                            aria-label={security.showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                          >
                            {security.showConfirm ? (<FiEyeOff className="h-5 w-5" />) : (<FiEye className="h-5 w-5" />)}
                          </button>
                        </div>
                      </div>
                      <button
                        type="submit"
                        className={`px-4 py-2 bg-[#1E5780] text-white rounded-lg hover:bg-[#164666] transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E5780] ${(!security.current || !security.new || !security.confirm || security.new !== security.confirm) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={!security.current || !security.new || !security.confirm || security.new !== security.confirm}
                      >
                        Update Password
                      </button>
                      {securityMsg && <span className="ml-4 text-green-600 font-medium">{securityMsg}</span>}
                      {securityError && <span className="ml-4 text-red-600 font-medium">{securityError}</span>}
                      </div>
                </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AccountSettings;