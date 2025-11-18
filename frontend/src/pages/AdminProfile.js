import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import adminService from '../services/adminService';
import { DEFAULT_AVATAR, normalizeAvatar, resolveAvatarSrc } from '../utils/avatar';

export default function AdminProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeJobs: 0,
    totalCompanies: 0,
    databaseSize: '0 MB'
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    phone: '+1 (555) 123-4567',
    timezone: 'GMT+7',
    language: 'en',
    adminRole: 'super-admin',
    sessionTimeout: 30,
    maxLoginAttempts: 5,
    maintenanceMode: 'off',
    backupFrequency: 'daily',
    notificationEmail: '',
    alertLevel: 'medium',
    logRetention: 90,
    reportFrequency: 'weekly'
  });

  // Load profile and settings from database on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load profile
        const profileResponse = await adminService.getAdminProfile();
        if (profileResponse.success && profileResponse.data && profileResponse.data.profile) {
          const profile = profileResponse.data.profile;
          // Split full_name into firstName and lastName
          const nameParts = (profile.full_name || 'Admin User').split(' ');
          const firstName = nameParts[0] || 'Admin';
          const lastName = nameParts.slice(1).join(' ') || 'User';
          
          setForm(prev => ({
            ...prev,
            firstName,
            lastName,
            email: profile.email || '',
            username: profile.username || '',
            phone: profile.phone || '+1 (555) 123-4567',
            notificationEmail: profile.email || ''
          }));
          
          // Load avatar from database if available
          if (profile.avatar) {
            const normalized = normalizeAvatar(profile.avatar);
            setAvatar(normalized);
          } else {
            // Try localStorage fallback
            try {
              const savedAvatar = localStorage.getItem('adminAvatar');
              if (savedAvatar) {
                const normalizedSaved = normalizeAvatar(savedAvatar);
                setAvatar(normalizedSaved);
              } else {
                setAvatar(DEFAULT_AVATAR);
              }
            } catch (e) {
              setAvatar(DEFAULT_AVATAR);
            }
          }
        }
        
        // Load user settings
        const settingsResponse = await adminService.getUserSettings();
        if (settingsResponse.success && settingsResponse.data && settingsResponse.data.settings) {
          const settings = settingsResponse.data.settings;
          setForm(prev => ({
            ...prev,
            timezone: settings.timezone || 'GMT+7',
            language: settings.language || 'en',
            sessionTimeout: settings.session_timeout || 30,
            maxLoginAttempts: settings.max_login_attempts || 5,
            backupFrequency: settings.backup_frequency || 'daily',
            notificationEmail: settings.notification_email || prev.email,
            alertLevel: settings.alert_level || 'medium',
            logRetention: settings.log_retention || 90,
            reportFrequency: settings.report_frequency || 'weekly'
          }));
        }
        
        // Load system stats
        const statsResponse = await adminService.getDashboardStats();
        if (statsResponse.success && statsResponse.data) {
          const data = statsResponse.data;
          setStats({
            totalUsers: data.users?.total || 0,
            activeJobs: data.jobs?.active || 0,
            totalCompanies: data.users?.employers || 0,
            databaseSize: '2.4 GB' // Mock for now, can calculate later
          });
        }
      } catch (error) {
        console.error('Failed to load data:', error);
        setToast({ type: 'error', message: 'Failed to load profile data' });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const adminDropdownRef = useRef(null);
  // avatar - will be loaded from database, localStorage as fallback
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR);
  const resolvedAvatar = resolveAvatarSrc(avatar);

  
  // Logout handler
  const handleLogout = () => {
    const confirmed = window.confirm('Are you sure you want to logout?');
    if (!confirmed) return;
    
    try {
      localStorage.removeItem('authUser');
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.setItem('showLogoutToast', 'true');
      window.dispatchEvent(new CustomEvent('authChanged', { detail: null }));
    } catch (e) {}
    
    // Redirect immediately
    navigate('/');
  };

  useEffect(() => {
    try {
      const normalized = normalizeAvatar(avatar);
      if (normalized) {
        localStorage.setItem('adminAvatar', normalized);
        const userRaw = localStorage.getItem('user');
        if (userRaw) {
          const user = JSON.parse(userRaw);
          user.avatar = normalized;
          localStorage.setItem('user', JSON.stringify(user));
        }
        window.dispatchEvent(new CustomEvent('adminAvatarChanged', { detail: normalized }));
      } else {
        localStorage.removeItem('adminAvatar');
      }
    } catch (err) {}
  }, [avatar]);

  useEffect(() => {
    const onAdminAvatarChanged = (event) => {
      const nextAvatar = event?.detail;
      if (!nextAvatar) return;
      const normalized = normalizeAvatar(nextAvatar);
      setAvatar((prev) => (prev === normalized ? prev : normalized));
    };
    window.addEventListener('adminAvatarChanged', onAdminAvatarChanged);
    return () => window.removeEventListener('adminAvatarChanged', onAdminAvatarChanged);
  }, []);

  // keep form in sync if profile changes elsewhere (other tab or AdminDashboard)
  useEffect(() => {
    function onProfileChanged(e) {
      const d = e && e.detail ? e.detail : null;
      if (d) {
        setForm(f => ({ ...f, firstName: d.firstName || f.firstName, lastName: d.lastName || f.lastName, email: d.email || f.email }));
      }
    }

    function onStorage(e) {
      if (!e) return;
      if (e.key === 'adminProfile') {
        try {
          const parsed = e.newValue ? JSON.parse(e.newValue) : null;
          if (parsed) setForm(f => ({ ...f, firstName: parsed.firstName || f.firstName, lastName: parsed.lastName || f.lastName, email: parsed.email || f.email }));
        } catch (err) {}
      }
    }

    window.addEventListener('adminProfileChanged', onProfileChanged);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('adminProfileChanged', onProfileChanged); window.removeEventListener('storage', onStorage); };
  }, []);

  function onChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  }

  function onPasswordChange(e) {
    const { name, value } = e.target;
    setPasswordForm((f) => ({ ...f, [name]: value }));
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setToast({ type: 'error', message: 'Please fill in all password fields' });
      return;
    }
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setToast({ type: 'error', message: 'New password and confirmation do not match' });
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      setToast({ type: 'error', message: 'Password must be at least 6 characters' });
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await adminService.changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword,
        passwordForm.confirmPassword
      );
      
      if (response.success) {
        setToast({ type: 'success', message: 'Password changed successfully!' });
        // Clear password fields
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        setToast({ type: 'error', message: response.error || 'Failed to change password' });
      }
    } catch (error) {
      console.error('Password change error:', error);
      setToast({ type: 'error', message: error.error || 'Current password is incorrect' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    
    try {
      // 1. Update profile (name, email, phone, avatar)
      const full_name = `${form.firstName.trim()} ${form.lastName.trim()}`;
      
      const profileData = {
        full_name,
        email: form.email,
        username: form.username,
        phone: form.phone,
        avatar: avatar // Include avatar to save to database
      };
      
      const profileResponse = await adminService.updateAdminProfile(profileData);
      
      // 2. Update user settings (preferences)
      const settingsData = {
        timezone: form.timezone,
        language: form.language,
        session_timeout: form.sessionTimeout,
        max_login_attempts: form.maxLoginAttempts,
        backup_frequency: form.backupFrequency,
        notification_email: form.notificationEmail,
        alert_level: form.alertLevel,
        log_retention: form.logRetention,
        report_frequency: form.reportFrequency
      };
      
      const settingsResponse = await adminService.updateUserSettings(settingsData);
      
      if (profileResponse.success && settingsResponse.success) {
        setToast({ type: 'success', message: 'Profile and settings updated successfully!' });
        
        // Update localStorage for navbar sync
        try {
          const payload = { firstName: form.firstName, lastName: form.lastName, email: form.email };
          localStorage.setItem('adminProfile', JSON.stringify(payload));
          window.dispatchEvent(new CustomEvent('adminProfileChanged', { detail: payload }));
        } catch (e) {}
      } else {
        setToast({ type: 'error', message: 'Some updates failed. Please try again.' });
      }
    } catch (error) {
      console.error('Profile update error:', error);
      setToast({ type: 'error', message: error.response?.data?.error || 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  }

  // close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    function handleDocClick(e) {
      if (!adminDropdownOpen) return;
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(e.target)) {
        setAdminDropdownOpen(false);
      }
    }

    function handleKey(e) {
      if (e.key === 'Escape') setAdminDropdownOpen(false);
    }

    document.addEventListener('mousedown', handleDocClick);
    document.addEventListener('touchstart', handleDocClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDocClick);
      document.removeEventListener('touchstart', handleDocClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [adminDropdownOpen]);

  return (
    <>
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={2000}
          onClose={() => setToast(null)}
        />
      )}
      
      {loading && !form.email ? (
        // Initial loading screen
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-spinner fa-spin text-6xl text-blue-600 mb-4"></i>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      ) : (
      <div className="min-h-screen bg-gray-100 text-gray-900 ">
        <nav className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-8xl mx-auto px-4 py-3 flex items-center justify-between h-20">
          <Link to="/" className="flex items-center gap-3">
            <img src="/Job Portal-logo-transparent.png" alt="Job Portal" className="h-24 w-auto" />
          </Link>

          <div className="flex items-center gap-3">
            <div className="relative" ref={adminDropdownRef}>
              <button onClick={() => setAdminDropdownOpen(d => !d)} className="flex items-center gap-2 px-3 py-1 rounded duration-200 hover:scale-105" aria-haspopup="true" aria-expanded={adminDropdownOpen} title="Admin menu">
                {resolvedAvatar ? (
                  <img src={resolvedAvatar} alt="Admin avatar" className="w-10 h-10 rounded-full object-cover border-2 border-gray-200" />
                ) : (
                  <div className="w-10 h-10 border-2 border-gray-200 rounded-full duration-200 hover:scale-105 flex items-center justify-center font-semibold">AU</div>
                )}
                <span className="text-sm font-medium">{form.firstName} {form.lastName}</span>
                {/* <i className={`fas fa-chevron-down text-xs transition-transform duration-200 ${adminDropdownOpen ? 'rotate-180' : ''}`}></i> */}
              </button>
              {adminDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded shadow z-30 border">
                  <Link to="/admin" className="flex items-center px-4 py-2 hover:bg-gray-100">
                    <i className="fas fa-tachometer-alt mr-3 text-blue-600"></i>
                    Dashboard
                  </Link>
                  <Link to="/" className="flex items-center px-4 py-2 hover:bg-gray-100">
                    <i className="fas fa-home mr-3 text-green-600"></i>
                    Home
                  </Link>
                  <div className="border-t border-gray-100"></div>
                  <button onClick={handleLogout} className="w-full text-left flex items-center px-4 py-2 hover:bg-red-50 text-red-600">
                    <i className="fas fa-sign-out-alt mr-3"></i>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

  <main className="max-w-6xl mx-auto p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <header className="text-center">
            <label
              className="mx-auto relative w-24 h-24 rounded-full bg-white border border-gray-200 flex items-center justify-center text-3xl text-gray-600 mb-3 shadow-sm overflow-hidden"
            >
              {resolvedAvatar ? <img src={resolvedAvatar} alt="Admin avatar" className="w-full h-full object-cover rounded-full" /> : <i className="fas fa-user-shield"></i>}
            </label>
            <h2 className="text-2xl font-semibold">{form.firstName} {form.lastName}</h2>
            <p className="text-sm text-gray-500">System Administrator</p>
            <div className="mt-2 text-sm text-green-600 flex items-center justify-center gap-2"><i className="fas fa-circle"></i><span>Online</span></div>
          </header>

          <section className="bg-white p-6 rounded shadow-lg border border-gray-300">
            <h3 className="text-lg font-semibold mb-4"><i className="fas fa-user mr-2"></i>Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-gray-700">First Name</label>
                <input name="firstName" value={form.firstName} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-700">Last Name</label>
                <input name="lastName" value={form.lastName} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-700">Email Address</label>
                <input name="email" value={form.email} onChange={onChange} type="email" className="border border-gray-300 p-2 rounded w-full outline-none" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-700">Phone Number</label>
                <input name="phone" value={form.phone} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none" />
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded shadow-lg border border-gray-300">
            <h3 className="text-lg font-semibold mb-4"><i className="fas fa-shield-alt mr-2"></i>Security Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-gray-700">Current Password</label>
                <div className="relative">
                  <input 
                    name="currentPassword" 
                    type={showCurrentPassword ? 'text' : 'password'} 
                    value={passwordForm.currentPassword}
                    placeholder="Enter current password" 
                    onChange={onPasswordChange} 
                    className="border border-gray-300 p-2 rounded w-full outline-none pr-12" 
                  />
                  <button type="button" onClick={() => setShowCurrentPassword(s => !s)} aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'} className="absolute right-2 top-1/2 transform -translate-y-1/2 px-2 py-1">
                    <i className={showCurrentPassword ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-700">New Password</label>
                <div className="relative">
                  <input 
                    name="newPassword" 
                    type={showNewPassword ? 'text' : 'password'} 
                    value={passwordForm.newPassword}
                    placeholder="Enter new password (min 6 chars)" 
                    onChange={onPasswordChange} 
                    className="border border-gray-300 p-2 rounded w-full outline-none pr-12" 
                  />
                  <button type="button" onClick={() => setShowNewPassword(s => !s)} aria-label={showNewPassword ? 'Hide new password' : 'Show new password'} className="absolute right-2 top-1/2 transform -translate-y-1/2 px-2 py-1">
                    <i className={showNewPassword ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-700">Confirm Password</label>
                <div className="relative">
                  <input 
                    name="confirmPassword" 
                    type={showConfirmPassword ? 'text' : 'password'} 
                    value={passwordForm.confirmPassword}
                    placeholder="Confirm new password" 
                    onChange={onPasswordChange} 
                    className="border border-gray-300 p-2 rounded w-full outline-none pr-12" 
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(s => !s)} aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} className="absolute right-2 top-1/2 transform -translate-y-1/2 px-2 py-1 ">
                    <i className={showConfirmPassword ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
                  </button>
                </div>
              </div>
              <div className="flex items-end">
                <button 
                  type="button" 
                  onClick={handlePasswordChange}
                  disabled={loading}
                  className="px-4 py-2 border border-blue-600 text-blue-600 rounded shadow-sm duration-200 hover:scale-105 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Changing...
                    </>
                  ) : (
                    <>
                      Change Password
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded shadow-lg border border-gray-300">
            <h3 className="text-lg font-semibold mb-4"><i className="fas fa-cogs mr-2"></i>System Preferences</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-gray-700">Timezone</label>
                <select name="timezone" value={form.timezone} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none appearance-none">
                  <option value="UTC">UTC (GMT+0)</option>
                  <option value="EST">Eastern Time (GMT-5)</option>
                  <option value="PST">Pacific Time (GMT-8)</option>
                  <option value="GMT+7">Cambodia Time (GMT+7)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-700">Language</label>
                <select name="language" value={form.language} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none appearance-none">
                  <option value="en">English</option>
                  <option value="km">ភាសាខ្មែរ</option>
                  <option value="zh">中文</option>
                </select>
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded shadow-lg border border-gray-300">
            <h3 className="text-lg font-semibold mb-4"><i className="fas fa-user-cog mr-2"></i>Admin Permissions & Roles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-gray-700">Admin Role</label>
                <select name="adminRole" value={form.adminRole} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none appearance-none">
                  <option value="super-admin">Super Administrator</option>
                  <option value="admin">Administrator</option>
                  <option value="moderator">Moderator</option>
                  <option value="support">Support Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">System Permissions</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm"><input type="checkbox" defaultChecked className="mr-2"/> User Management</label>
                  <label className="text-sm"><input type="checkbox" defaultChecked className="mr-2"/> Job Management</label>
                  <label className="text-sm"><input type="checkbox" defaultChecked className="mr-2"/> Company Management</label>
                  <label className="text-sm"><input type="checkbox" defaultChecked className="mr-2"/> System Settings</label>
                  <label className="text-sm"><input type="checkbox" defaultChecked className="mr-2"/> Analytics Access</label>
                  <label className="text-sm"><input type="checkbox" defaultChecked className="mr-2"/> Database Backup</label>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded shadow-lg border border-gray-300">
            <h3 className="text-lg font-semibold mb-4"><i className="fas fa-server mr-2"></i>System Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-gray-700">Session Timeout (minutes)</label>
                <input name="sessionTimeout" type="number" value={form.sessionTimeout} onChange={onChange} min={5} max={480} className="border border-gray-300 p-2 rounded w-full outline-none appearance-none" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-700">Max Login Attempts</label>
                <input name="maxLoginAttempts" type="number" value={form.maxLoginAttempts} onChange={onChange} min={3} max={10} className="border border-gray-300 p-2 rounded w-full outline-none appearance-none" />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm mb-1 text-gray-700">Maintenance Mode</label>
              <select name="maintenanceMode" value={form.maintenanceMode} onChange={onChange} className="border border-gray-300 p-2 rounded w-48 outline-none appearance-none">
                <option value="off">Disabled</option>
                <option value="on">Enabled</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>
            <div className="mt-4">
              <label className="block text-sm mb-1 text-gray-700">Backup Frequency</label>
              <select name="backupFrequency" value={form.backupFrequency} onChange={onChange} className="border border-gray-300 p-2 rounded w-48 outline-none appearance-none">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="manual">Manual Only</option>
              </select>
            </div>
          </section>

          <section className="bg-white p-6 rounded shadow-lg border border-gray-300">
            <h3 className="text-lg font-semibold mb-4"><i className="fas fa-bell mr-2"></i>Notification Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-gray-700">Notification Email</label>
                <input name="notificationEmail" value={form.notificationEmail} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none appearance-none" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-700">Alert Level</label>
                <select name="alertLevel" value={form.alertLevel} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none appearance-none">
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="critical">Critical Only</option>
                </select>
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded shadow-lg border border-gray-300">
            <h3 className="text-lg font-semibold mb-4"><i className="fas fa-chart-line mr-2"></i>System Monitoring</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded shadow-sm border border-gray-200">
                <div className="text-2xl font-bold text-blue-600">{stats.totalUsers.toLocaleString()}</div>
                <div className="text-sm text-gray-500">Total Users</div>
              </div>
              <div className="p-4 bg-gray-50 rounded shadow-sm border border-gray-200">
                <div className="text-2xl font-bold text-green-600">{stats.activeJobs.toLocaleString()}</div>
                <div className="text-sm text-gray-500">Active Jobs</div>
              </div>
              <div className="p-4 bg-gray-50 rounded shadow-sm border border-gray-200">
                <div className="text-2xl font-bold text-purple-600">{stats.totalCompanies.toLocaleString()}</div>
                <div className="text-sm text-gray-500">Companies</div>
              </div>
              <div className="p-4 bg-gray-50 rounded shadow-sm border border-gray-200">
                <div className="text-2xl font-bold text-orange-600">{stats.databaseSize}</div>
                <div className="text-sm text-gray-500">Database Size</div>
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded shadow-lg border border-gray-300 text-center">
            <i className="fas fa-plug text-6xl text-gray-300 mb-4"></i>
            <h3 className="text-lg font-semibold mb-2"><i className="fas fa-plug mr-2"></i>API & Integration Settings</h3>
            <p className="text-gray-500">Coming Soon</p>
          </section>

          <div className="text-right">
            <button 
              type="submit" 
              disabled={loading}
              className="px-6 py-2 border border-red-600 text-red-600 rounded shadow-lg hover:shadow-xl duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
      )}
    </>
  );
}
