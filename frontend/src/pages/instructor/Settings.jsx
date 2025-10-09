import { useState, useContext, useEffect, useMemo, useRef } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import InstructorSidebar from '../../components/InstructorSidebar';
import AuthContext from '../../context/AuthContext';

const Settings = () => {
  const { user, setUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('profile');
  const [formData, setFormData] = useState({
    firstName: (user?.name || '').split(' ')[0] || '',
    lastName: (user?.name || '').split(' ').slice(1).join(' ') || '',
    email: user?.email || '',
    joinDate: '',
    avatarUrl: user?.avatar || '',
    notifications: {
      email: user?.notifications?.email ?? true,
      browser: user?.notifications?.browser ?? true,
    },
  });
  const [originalFormData, setOriginalFormData] = useState(formData);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');
  const [notifMsg, setNotifMsg] = useState('');
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const fileInputRef = useRef(null);

  // Reset avatar error when URL changes so a newly uploaded relative URL displays
  useEffect(() => {
    setAvatarLoadError(false);
  }, [formData.avatarUrl]);
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

  // Build Authorization header if token is present
  const authHeader = useMemo(() => (
    user?.token ? { Authorization: `Bearer ${user.token}` } : {}
  ), [user?.token]);

  // Load profile and settings
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [pRes, sRes] = await Promise.all([
          fetch('/api/instructor/profile', { headers: { 'Content-Type': 'application/json', ...authHeader } }),
          fetch('/api/instructor/settings', { headers: { 'Content-Type': 'application/json', ...authHeader } }),
        ]);

        if (!cancelled && pRes.ok) {
          const p = await pRes.json();
          const first = (p?.name || '').split(' ')[0] || '';
          const last = (p?.name || '').split(' ').slice(1).join(' ') || '';
          setFormData(prev => ({
            ...prev,
            firstName: first,
            lastName: last,
            email: p?.email || prev.email,
            joinDate: p?.joinDate || '',
            avatarUrl: p?.avatar || '',
          }));
          setOriginalFormData(prev => ({
            ...prev,
            firstName: first,
            lastName: last,
            email: p?.email || prev.email,
            joinDate: p?.joinDate || '',
            avatarUrl: p?.avatar || '',
          }));
          if (setUser) setUser(u => ({ ...(u || {}), name: p?.name, email: p?.email, avatar: p?.avatar }));
        }

        if (!cancelled && sRes.ok) {
          const s = await sRes.json();
          if (s && s.notifications) {
            setFormData(prev => ({ ...prev, notifications: { ...prev.notifications, ...s.notifications } }));
            setOriginalFormData(prev => ({ ...prev, notifications: { ...prev.notifications, ...s.notifications } }));
          }
        }
      } catch {
        // ignore network errors
      }
    };
    load();
    return () => { cancelled = true; };
  }, [authHeader, setUser]);

  const isProfileChanged = useMemo(() => {
    const now = {
      name: `${formData.firstName} ${formData.lastName}`.trim(),
      avatarUrl: formData.avatarUrl || '',
    };
    const orig = {
      name: `${originalFormData.firstName} ${originalFormData.lastName}`.trim(),
      avatarUrl: originalFormData.avatarUrl || '',
    };
    return JSON.stringify(now) !== JSON.stringify(orig);
  }, [formData.firstName, formData.lastName, formData.avatarUrl, originalFormData.firstName, originalFormData.lastName, originalFormData.avatarUrl]);

  const isNotifChanged = useMemo(() => (
    JSON.stringify(formData.notifications) !== JSON.stringify(originalFormData.notifications)
  ), [formData.notifications, originalFormData.notifications]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setProfileMsg('');
  };

  const handleAvatarUrlInput = (e) => {
    setFormData(prev => ({ ...prev, avatarUrl: e.target.value }));
    setAvatarLoadError(false);
  };

  const handleAvatarFileChange = (e) => {
    const f = e.target.files[0];
    if (f) {
      // Client-side 5 MB check
      if (f.size > 5 * 1024 * 1024) {
        setProfileError('Image is too large. Max size is 5 MB.');
        setProfileMsg('');
        try { e.target.value = ''; } catch {}
        return;
      }
      setAvatarFile(f);
      setAvatarLoadError(false);
      // Show a local preview by using a blob URL in avatarUrl temporarily
      const url = URL.createObjectURL(f);
      setFormData(prev => ({ ...prev, avatarUrl: url }));
    }
  };

  const handleNotificationChange = (key) => {
    setFormData(prev => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: !prev.notifications[key] }
    }));
    setNotifMsg('');
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
  let avatarUrl = formData.avatarUrl || '';
    // If a new file was chosen, upload it first
    if (avatarFile instanceof File) {
      if (avatarFile.size > 5 * 1024 * 1024) {
        setProfileError('Image is too large. Max size is 5 MB.');
        return;
      }
      try {
        const fd = new FormData();
        fd.append('file', avatarFile);
        const up = await fetch('/api/instructor/profile/avatar', {
          method: 'POST',
          headers: { ...authHeader },
          body: fd,
        });
        const uj = await up.json().catch(() => ({}));
        if (up.ok && uj.url) {
          avatarUrl = uj.url;
        } else {
          setProfileError(uj?.detail || 'Failed to upload image. Max size is 5 MB.');
          return;
        }
      } catch {}
    }
    const payload = {
      name: `${formData.firstName} ${formData.lastName}`.trim(),
      avatar: (avatarUrl || '').trim() || null,
    };
    try {
      const res = await fetch('/api/instructor/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setOriginalFormData(prev => ({ ...prev, firstName: formData.firstName, lastName: formData.lastName, avatarUrl: avatarUrl }));
        setProfileMsg('Profile updated!');
        setProfileError('');
        if (setUser) setUser(prev => ({ ...(prev || {}), name: payload.name, avatar: payload.avatar }));
      } else {
        setProfileMsg('');
        setProfileError(data.detail || data.message || 'Failed to update profile.');
      }
    } catch {
      setProfileMsg('');
      setProfileError('Error updating profile.');
    }
  };

  const handleProfileCancel = () => {
    setFormData({ ...originalFormData });
    setAvatarLoadError(false);
    setProfileMsg('Changes reverted.');
  };

  const handleNotifSave = async () => {
    try {
      const res = await fetch('/api/instructor/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ notifications: formData.notifications }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setOriginalFormData(prev => ({ ...prev, notifications: { ...formData.notifications } }));
        setNotifMsg(data.message || 'Notification preferences updated!');
      } else {
        setNotifMsg(data.detail || data.message || 'Failed to update notification preferences.');
      }
    } catch {
      setNotifMsg('Error updating notification preferences.');
    }
  };

  const handleSecurityInput = (e) => {
    const { name, value } = e.target;
    setSecurity(prev => ({ ...prev, [name]: value }));
    setSecurityMsg('');
    setSecurityError('');
  };

  const handleShowPassword = (field) => setSecurity(prev => ({ ...prev, [field]: !prev[field] }));

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
      const res = await fetch('/api/instructor/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ old_password: security.current, new_password: security.new, email: user?.email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === 'success') {
        setSecurityMsg('Password updated!');
        setSecurityError('');
        setSecurity({ current: '', new: '', confirm: '', showCurrent: false, showNew: false, showConfirm: false });
        if (setUser) setUser(null);
      } else {
        setSecurityError(data.detail || data.message || 'Failed to update password.');
      }
    } catch {
      setSecurityError('Error updating password.');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <InstructorSidebar />
      <main className="ml-64 overflow-y-auto">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-semibold text-black">Account Settings</h1>
          </div>

          <div className="bg-white rounded-lg shadow-sm">
            <div className="border-b">
              <div className="flex p-4 gap-4">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${activeTab === 'profile' ? 'bg-[#1E5780] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  aria-label="Profile Tab"
                >
                  Profile
                </button>
                <button
                  onClick={() => setActiveTab('notifications')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${activeTab === 'notifications' ? 'bg-[#1E5780] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  aria-label="Notifications Tab"
                >
                  Notifications
                </button>
                <button
                  onClick={() => setActiveTab('security')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${activeTab === 'security' ? 'bg-[#1E5780] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  aria-label="Security Tab"
                >
                  Security
                </button>
              </div>
            </div>

            <div className="p-6">
              {activeTab === 'profile' && (
                <form className="space-y-6" onSubmit={handleProfileSave}>
                  <div className="flex items-center mb-6 gap-6">
                    <div className="relative h-24 w-24 rounded-full bg-[#1E5780] flex items-center justify-center text-white text-2xl overflow-hidden ring-2 ring-white shadow">
                      {formData.avatarUrl && !avatarLoadError ? (
                        <img src={formData.avatarUrl} alt="Avatar" className="h-full w-full object-cover" onError={() => setAvatarLoadError(true)} />
                      ) : (
                        <span>{(`${formData.firstName} ${formData.lastName}`.trim() || 'I').charAt(0)}</span>
                      )}
                      <button type="button" className="absolute bottom-1 right-1 bg-[#1E5780] text-white rounded-full p-2 border-2 border-white shadow-lg hover:bg-[#164666] focus:outline-none focus:ring-2 focus:ring-[#1E5780] transition-all duration-150" onClick={() => fileInputRef.current?.click()} title="Change avatar" aria-label="Change avatar" style={{ transform: 'none' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-4.553a1.5 1.5 0 00-2.121-2.121L13 7.879M7 17h.01M12 17h.01M17 17h.01M12 7v6m0 0l-2-2m2 2l2-2" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
                      </button>
                      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleAvatarFileChange} />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">{`${formData.firstName} ${formData.lastName}`.trim() || user?.name}</h2>
                      <p className="text-gray-600">{formData.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                      <h3 className="text-lg font-medium mb-3">Personal Information</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="firstName">First Name</label>
                            <input type="text" name="firstName" id="firstName" value={formData.firstName} onChange={handleInputChange} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent text-[15px]" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="lastName">Last Name</label>
                            <input type="text" name="lastName" id="lastName" value={formData.lastName} onChange={handleInputChange} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent text-[15px]" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="joinDate">Join Date</label>
                          <input type="date" name="joinDate" id="joinDate" value={formData.joinDate || ''} readOnly disabled className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-100 text-gray-700 text-[15px]" />
                          <p className="text-[11px] text-gray-500 mt-1">Join date is set automatically and cannot be changed.</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="avatarUrl">Avatar URL</label>
                          <input type="url" name="avatarUrl" id="avatarUrl" placeholder="https://example.com/your-avatar.png" value={formData.avatarUrl} onChange={handleAvatarUrlInput} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent text-[15px]" />
                          <p className="text-[11px] text-gray-500 mt-1">Upload a file or paste an image URL. We’ll store a local copy for reliability.</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">LSPU Email</label>
                          <input type="email" name="email" id="email" value={formData.email} readOnly className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-100 text-gray-700 text-[15px]" />
                          <p className="text-[11px] text-gray-500 mt-1">Email is managed by your institution.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 items-center mt-6">
                    <button type="submit" className={`px-6 py-2 bg-[#1E5780] text-white rounded-lg font-semibold hover:bg-[#164666] transition-colors ${!isProfileChanged ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!isProfileChanged}>Save Changes</button>
                    <button type="button" className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors" onClick={handleProfileCancel} disabled={!isProfileChanged}>Cancel</button>
                    {profileMsg && <span className="text-green-600 text-sm ml-2">{profileMsg}</span>}
                    {profileError && <span className="text-red-600 text-sm ml-2">{profileError}</span>}
                  </div>
                </form>
              )}

              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-gray-900 font-medium">Email Notifications</h3>
                      <p className="text-gray-600 text-sm">Receive notifications via email</p>
                    </div>
                    <button onClick={() => handleNotificationChange('email')} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.notifications.email ? 'bg-[#1E5780]' : 'bg-gray-200'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.notifications.email ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-gray-900 font-medium">Browser Notifications</h3>
                      <p className="text-gray-600 text-sm">Show desktop notifications</p>
                    </div>
                    <button onClick={() => handleNotificationChange('browser')} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.notifications.browser ? 'bg-[#1E5780]' : 'bg-gray-200'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.notifications.browser ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <div className="flex gap-4 mt-6">
                    <button type="button" className="px-6 py-2 bg-[#1E5780] text-white rounded-lg font-semibold hover:bg-[#164666] transition-colors" onClick={handleNotifSave} disabled={!isNotifChanged}>Save Changes</button>
                    <button type="button" className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors" onClick={() => setFormData(prev => ({ ...prev, notifications: { ...originalFormData.notifications } }))} disabled={!isNotifChanged}>Cancel</button>
                    {notifMsg && <span className="text-green-600 font-medium ml-4">{notifMsg}</span>}
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <form className="space-y-6" onSubmit={handlePasswordUpdate}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                    <div className="relative">
                      <input type={security.showCurrent ? 'text' : 'password'} name="current" value={security.current} onChange={handleSecurityInput} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent pr-10" />
                      <button type="button" className="absolute right-2 top-2 text-gray-500 hover:text-[#1E5780]" onClick={() => handleShowPassword('showCurrent')} tabIndex={-1} aria-label={security.showCurrent ? 'Hide current password' : 'Show current password'}>
                        {security.showCurrent ? (<FiEyeOff className="h-5 w-5" />) : (<FiEye className="h-5 w-5" />)}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                    <div className="relative">
                      <input type={security.showNew ? 'text' : 'password'} name="new" value={security.new} onChange={handleSecurityInput} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent pr-10" />
                      <button type="button" className="absolute right-2 top-2 text-gray-500 hover:text-[#1E5780]" onClick={() => handleShowPassword('showNew')} tabIndex={-1} aria-label={security.showNew ? 'Hide new password' : 'Show new password'}>
                        {security.showNew ? (<FiEyeOff className="h-5 w-5" />) : (<FiEye className="h-5 w-5" />)}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                    <div className="relative">
                      <input type={security.showConfirm ? 'text' : 'password'} name="confirm" value={security.confirm} onChange={handleSecurityInput} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1E5780] focus:border-transparent pr-10" />
                      <button type="button" className="absolute right-2 top-2 text-gray-500 hover:text-[#1E5780]" onClick={() => handleShowPassword('showConfirm')} tabIndex={-1} aria-label={security.showConfirm ? 'Hide confirm password' : 'Show confirm password'}>
                        {security.showConfirm ? (<FiEyeOff className="h-5 w-5" />) : (<FiEye className="h-5 w-5" />)}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-6">
                    <button type="submit" className={`px-6 py-2 bg-[#1E5780] text-white rounded-lg font-semibold hover:bg-[#164666] transition-colors ${(!security.current || !security.new || !security.confirm || security.new !== security.confirm) ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!security.current || !security.new || !security.confirm || security.new !== security.confirm}>Update Password</button>
                    <button type="button" className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors" onClick={() => setSecurity({ current: '', new: '', confirm: '', showCurrent: false, showNew: false, showConfirm: false })}>Cancel</button>
                    {securityMsg && <span className="text-green-600 font-medium ml-4">{securityMsg}</span>}
                    {securityError && <span className="text-red-600 font-medium ml-4">{securityError}</span>}
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

export default Settings;