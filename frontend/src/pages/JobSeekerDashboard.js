import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { showToast } from '../components/Toaster';
import jobSeekerService from '../services/jobSeekerService';
import { DEFAULT_AVATAR, normalizeAvatar, resolveAvatarSrc } from '../utils/avatar';
import { compressImageFile } from '../utils/image';

export default function JobSeekerDashboard() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef(null);

  // Dashboard data state
  const [dashboardData, setDashboardData] = useState(null);
  const [applications, setApplications] = useState([]);
  const [savedJobs, setSavedJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Resume upload state
  const [resumeFile, setResumeFile] = useState(null);
  const [resumePath, setResumePath] = useState('');
  const [uploading, setUploading] = useState(false);
  const resumeInputRef = useRef(null);

  const defaultProfile = { name: 'MEN703', avatar: DEFAULT_AVATAR };
  const defaultAvatarRef = useRef(defaultProfile.avatar);

  const [avatar, setAvatar] = useState(() => {
    try {
      const saved = localStorage.getItem('seekerAvatar');
      if (saved) {
        return normalizeAvatar(saved);
      }

      const userRaw = localStorage.getItem('user');
      if (userRaw) {
        const user = JSON.parse(userRaw);
        const normalizedUserAvatar = normalizeAvatar(user?.avatar);
        if (normalizedUserAvatar) {
          localStorage.setItem('seekerAvatar', normalizedUserAvatar);
          return normalizedUserAvatar;
        }
      }
    } catch (e) {
      console.log('🖼️ JobSeekerDashboard avatar error:', e);
    }
    return DEFAULT_AVATAR;
  });
  const resolvedAvatar = resolveAvatarSrc(avatar);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [displayName, setDisplayName] = useState(() => {
    try {
      // Priority 1: Check auth user from login (this gets updated by SeekerProfilePage)
      const userRaw = localStorage.getItem('user');
      if (userRaw) {
        const user = JSON.parse(userRaw);
        if (user.full_name && user.full_name.trim()) return user.full_name;
      }
      // Priority 2: Fallback to seeker profile
      const raw = localStorage.getItem('seekerProfile');
      if (raw) {
        const p = JSON.parse(raw);
        if (p.name && p.name.trim()) return p.name;
      }
      // Priority 3: Default fallback
      return defaultProfile.name;
    } catch (e) { return defaultProfile.name; }
  });

  // Persist avatar and update localStorage.user
  useEffect(() => {
    try {
      const normalizedAvatar = normalizeAvatar(avatar);
      if (normalizedAvatar) {
        localStorage.setItem('seekerAvatar', normalizedAvatar);

        const userRaw = localStorage.getItem('user');
        if (userRaw) {
          const user = JSON.parse(userRaw);
          user.avatar = normalizedAvatar;
          localStorage.setItem('user', JSON.stringify(user));
        }

        window.dispatchEvent(new CustomEvent('seekerAvatarChanged', { detail: normalizedAvatar }));
      } else {
        localStorage.removeItem('seekerAvatar');
      }
    } catch (e) {}
  }, [avatar]);
  
  // Listen for avatar changes from profile page
  useEffect(() => {
    const onAvatarChange = (e) => {
      const newAvatar = (e && e.detail) || null;
      if (newAvatar) {
        const normalized = normalizeAvatar(newAvatar);
        if (normalized !== avatar) {
          setAvatar(normalized);
        }
      }
    };
    window.addEventListener('seekerAvatarChanged', onAvatarChange);
    return () => window.removeEventListener('seekerAvatarChanged', onAvatarChange);
  }, [avatar]);

  useEffect(() => {
    function onProfileChange(e) {
      const p = (e && e.detail) || null;
      // Priority 1: Check from user localStorage (updated by SeekerProfilePage)
      try {
        const userRaw = localStorage.getItem('user');
        if (userRaw) {
          const user = JSON.parse(userRaw);
          if (user.full_name && user.full_name.trim()) {
            setDisplayName(user.full_name);
            return;
          }
        }
      } catch (err) {}
      
      // Priority 2: Use event detail if available
      if (p && p.name && p.name.trim()) {
        setDisplayName(p.name);
        return;
      }
      
      // Priority 3: Fallback to seekerProfile localStorage
      try {
        const raw = localStorage.getItem('seekerProfile');
        if (raw) {
          const profile = JSON.parse(raw);
          if (profile.name && profile.name.trim()) {
            setDisplayName(profile.name);
          }
        }
      } catch (err) {}
    }
    function onStorage(e) {
      if (e.key === 'seekerProfile') {
        try { const p = JSON.parse(e.newValue || '{}'); if (p.name) setDisplayName(() => p.name); } catch (err) {}
      }
      if (e.key === 'seekerAvatar') {
        try {
          setAvatar(normalizeAvatar(e.newValue || defaultAvatarRef.current));
        } catch (err) {}
      }
      if (e.key === 'user') {
        // Force reload from updated localStorage user data
        try {
          const user = JSON.parse(e.newValue || '{}');
          if (user.full_name && user.full_name.trim()) {
            setDisplayName(user.full_name);
          }
        } catch (err) {}
      }
    }
    function onUserDataRefresh() {
      // Force reload display name from localStorage
      try {
        const userRaw = localStorage.getItem('user');
        if (userRaw) {
          const user = JSON.parse(userRaw);
          if (user.full_name && user.full_name.trim()) {
            setDisplayName(user.full_name);
          }
        }
      } catch (err) {}
    }
    
    window.addEventListener('seekerProfileChanged', onProfileChange);
    window.addEventListener('userDataRefresh', onUserDataRefresh);
    window.addEventListener('storage', onStorage);
    return () => { 
      window.removeEventListener('seekerProfileChanged', onProfileChange); 
      window.removeEventListener('userDataRefresh', onUserDataRefresh);
      window.removeEventListener('storage', onStorage); 
    };
  }, []);

  useEffect(() => {
    function handleDocClick(e) {
      if (!userDropdownOpen) return;
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
    }
    function handleKey(e) {
      if (e.key === 'Escape') setUserDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleDocClick);
    document.addEventListener('touchstart', handleDocClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDocClick);
      document.removeEventListener('touchstart', handleDocClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [userDropdownOpen]);

  // file input for avatar upload in sidebar (match Employer style)
  const fileInputRef = useRef(null);
  function triggerFileSelect() {
    if (avatarUploading) return;
    if (fileInputRef.current) fileInputRef.current.click();
  }
  async function handleFileSelected(e) {
    const input = e.target;
    if (avatarUploading) {
      if (input) input.value = '';
      return;
    }
    const file = input?.files && input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      if (input) input.value = '';
      return;
    }

    const previousAvatar = avatar;
    try {
      setAvatarUploading(true);
      const optimizedDataUrl = await compressImageFile(file, {
        maxWidth: 600,
        maxHeight: 600,
        maxSizeMB: 0.7,
        quality: 0.8
      });
      const normalizedAvatar = normalizeAvatar(optimizedDataUrl);
      setAvatar(normalizedAvatar);
      await jobSeekerService.uploadAvatar(normalizedAvatar);
      showToast('Avatar updated successfully!', 'success');
    } catch (err) {
      console.error('Avatar upload failed:', err);
      setAvatar(previousAvatar);
      const msg = err?.message || err?.response?.error || 'Failed to upload avatar';
      showToast(msg, 'error');
    } finally {
      setAvatarUploading(false);
      if (input) input.value = '';
    }
  }
  // state for confirm remove modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  async function confirmRemoveAvatar() {
    if (avatarUploading) return;
    const previousAvatar = avatar;
    try {
      setAvatarUploading(true);
      setAvatar(DEFAULT_AVATAR);
      await jobSeekerService.uploadAvatar(DEFAULT_AVATAR);
      showToast('Avatar removed', 'info');
    } catch (err) {
      console.error('Avatar removal failed:', err);
      setAvatar(previousAvatar);
      const msg = err?.message || err?.response?.error || 'Failed to remove avatar';
      showToast(msg, 'error');
    } finally {
      setAvatarUploading(false);
      setConfirmOpen(false);
    }
  }

  const sectionTitles = {
    dashboard: 'Welcome back',
    profile: 'My Profile',
    jobs: 'Browse Jobs',
    applications: 'My Applications',
    saved: 'Saved Jobs',
    resume: 'My Resume',
    settings: 'Settings'
  };

  const handleResumeFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        showToast('Please upload PDF, DOC, or DOCX file only', 'error');
        return;
      }
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        showToast('File size must be less than 5MB', 'error');
        return;
      }
      setResumeFile(file);
    }
  };

  const handleResumeUpload = async () => {
    if (!resumeFile) {
      showToast('Please select a file first', 'error');
      return;
    }

    try {
      setUploading(true);
      const response = await jobSeekerService.uploadResume(resumeFile);
      setResumePath(response.resume_path);
      showToast('Resume uploaded successfully!', 'success');
      setResumeFile(null);
      if (resumeInputRef.current) {
        resumeInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading resume:', error);
      showToast(error.message || 'Failed to upload resume', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleResumeDelete = async () => {
    if (!resumePath) {
      showToast('No resume to delete', 'error');
      return;
    }

    if (!window.confirm('Are you sure you want to delete your resume? This action cannot be undone.')) {
      return;
    }

    try {
      setUploading(true);
      await jobSeekerService.deleteResume();
      setResumePath('');
      showToast('Resume deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting resume:', error);
      showToast(error.message || 'Failed to delete resume', 'error');
    } finally {
      setUploading(false);
    }
  };

  function showSection(section) { setActiveSection(section); setUserDropdownOpen(false); }
  
  // Load data based on active section
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        if (activeSection === 'dashboard') {
          const data = await jobSeekerService.getDashboardStats();
          setDashboardData(data);
          // Update display name from dashboard data if available
          if (data.user && data.user.full_name && data.user.full_name.trim()) {
            setDisplayName(data.user.full_name);
          }
          // Load resume path from user data
          if (data.user && data.user.resume_path) {
            setResumePath(data.user.resume_path);
          }
          // Update seeker avatar if available
          if (data.user && data.user.avatar) {
            const avatarUrl = data.user.avatar;
            localStorage.setItem('seekerAvatar', avatarUrl);
            setAvatar(avatarUrl);
            console.log('✅ Seeker avatar updated from dashboard:', avatarUrl);
            
            // Dispatch event to update navigation
            window.dispatchEvent(new CustomEvent('seekerAvatarChanged', { detail: avatarUrl }));
          }
        } else if (activeSection === 'applications') {
          const data = await jobSeekerService.getApplications();
          setApplications(data);
        } else if (activeSection === 'saved') {
          // Load both saved jobs and applications for status check
          const [savedData, appsData] = await Promise.all([
            jobSeekerService.getSavedJobs(),
            jobSeekerService.getApplications()
          ]);
          setSavedJobs(savedData);
          setApplications(appsData);
        } else if (activeSection === 'resume') {
          // Load resume path from dashboard data if available
          if (dashboardData?.user?.resume_path) {
            setResumePath(dashboardData.user.resume_path);
          } else {
            // Otherwise fetch from API
            const data = await jobSeekerService.getDashboardStats();
            if (data.user && data.user.resume_path) {
              setResumePath(data.user.resume_path);
            }
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
        showToast(error.message || 'Failed to load data', 'error');
      } finally {
        setLoading(false);
      }
    }

    if (activeSection !== 'settings') {
      loadData();
    }
  }, [activeSection]);
  
  function logout() {
    const confirmed = window.confirm('Are you sure you want to logout?');
    if (!confirmed) return;
    
    try {
      localStorage.removeItem('authUser');
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.setItem('showLogoutToast', 'true');
      window.dispatchEvent(new CustomEvent('authChanged', { detail: null }));
    } catch (e) {}
    
    navigate('/');
  }

  const progressChartRef = useRef(null);
  useEffect(() => {
    if (activeSection !== 'dashboard' || !dashboardData) return;
    let chart;
    (async () => {
      try {
        const mod = await import('chart.js/auto');
        const Chart = mod && (mod.default || mod);
        const ctx = progressChartRef.current && progressChartRef.current.getContext('2d');
        if (!ctx) return;
        
        // Use real data if available, otherwise use defaults
        const progressData = dashboardData.progress || [];
        const labels = progressData.length > 0 
          ? progressData.map(p => p.month_short) 
          : ['May','Jun','Jul','Aug','Sep','Oct'];
        const applicationsData = progressData.length > 0 
          ? progressData.map(p => p.applications) 
          : [3,6,4,8,5,7];
        const interviewsData = progressData.length > 0 
          ? progressData.map(p => p.interviews) 
          : [0,1,1,2,2,3];
        
        chart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              { label: 'Applications Submitted', data: applicationsData, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.12)', tension: 0.3, fill: true },
              { label: 'Interviews', data: interviewsData, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)', tension: 0.3, fill: true }
            ]
          },
          options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}}, scales:{y:{beginAtZero:true}} }
        });
      } catch (e) {
        // ignore
      }
    })();
    return () => { try { if (chart) chart.destroy(); } catch(e) {} };
  }, [activeSection, dashboardData]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100">
      <nav className="bg-white border-b border-gray-300 sticky top-0 bg-white z-50 shadow-lg">
        <div className="max-w-8xl mx-auto px-4 py-3 flex items-center  justify-between h-20">
          <div className="flex items-center gap-3">
            <img src="/Job Portal-logo-transparent.png" alt="JobPortal" className="h-20 w-auto object-contain" />
          </div>

          <div className="flex items-center gap-4">
            <div className="relative" ref={userDropdownRef}>
              <button onClick={() => setUserDropdownOpen(v => !v)} className="flex items-center gap-2 px-3 py-1 rounded" aria-haspopup="true" aria-expanded={userDropdownOpen} title="User menu">
                {avatar ? (
                  <img
                    src={resolvedAvatar}
                    alt={`${displayName} avatar`}
                    className="w-10 h-10 rounded-full object-cover border border-gray-300"
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_AVATAR;
                      setAvatar(DEFAULT_AVATAR);
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 border border-gray-300 rounded-full duration-200 hover:scale-105 flex items-center justify-center font-semibold">{(displayName||'U').slice(0,2).toUpperCase()}</div>
                )}
                <span className="text-sm">{displayName}</span>
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded shadow border z-30">
                  <Link to="/seeker/profile" className="block px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
                    <i className="fas fa-user text-blue-500"></i>
                    <span>Profile</span>
                  </Link>
                  <Link to="/" className="block px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
                    <i className="fas fa-home text-gray-600"></i>
                    <span>Home</span>
                  </Link>
                  <div className="border-t" />
                  <button onClick={logout} className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
                    <i className="fas fa-sign-out-alt text-red-500"></i>
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
  <aside className="w-64 bg-white border-r border-gray-300 shadow-md p-4 mr-6 sticky top-20 z-30 self-start overflow-auto" style={{ maxHeight: 'calc(100vh - 5rem)' }}>
          <div className="sidebar-profile mb-6 flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden mb-2 relative">
              <img
                src={resolvedAvatar}
                alt="user"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_AVATAR;
                  setAvatar(DEFAULT_AVATAR);
                }}
              />
              {avatarUploading && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                  <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
                </div>
              )}
            </div>
            <div className="text-center">
              <Link to="/seeker/profile" className="font-medium text-gray-900 dark:text-white hover:underline">{displayName}</Link>
              <div className="text-xs text-gray-500">Job Seeker Dashboard</div>
              <div className="mt-2 text-sm">
                <input ref={fileInputRef} onChange={handleFileSelected} type="file" accept="image/*" className="hidden" />
                <button 
                  onClick={triggerFileSelect} 
                  className={`text-xs mr-2 ${avatarUploading ? 'text-gray-400 cursor-not-allowed' : 'text-blue-500 hover:underline'}`}
                  disabled={avatarUploading}
                >
                  {avatarUploading ? 'Uploading...' : 'Upload'}
                </button>
                {avatar ? (
                  <button 
                    onClick={() => setConfirmOpen(true)} 
                    className={`text-xs ${avatarUploading ? 'text-gray-400 cursor-not-allowed' : 'text-red-500 hover:underline'}`}
                    disabled={avatarUploading}
                  >
                    Remove
                  </button>
                ) : (
                  <button onClick={() => setAvatar(defaultAvatarRef.current)} className="text-xs text-blue-500 hover:underline">Restore</button>
                )}
              </div>
            </div>
          </div>

          <ul className="space-y-2">
            <li>
              <button onClick={() => showSection('dashboard')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='dashboard' ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-700' : 'hover:bg-gray-100 hover:shadow-lg duration-200 scale-105'}`}>
                <i className="fas fa-tachometer-alt" />
                <span>Dashboard</span>
              </button>
            </li>
            {/* My Profile removed per request */}
            {/* Browse Jobs removed - functionality available on Home page */}
            <li>
              <button onClick={() => showSection('applications')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='applications' ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-700' : 'hover:bg-gray-100 hover:shadow-lg duration-200 scale-105'}`}>
                <i className="fas fa-paper-plane" />
                <span>My Applications</span>
              </button>
            </li>
            <li>
              <button onClick={() => showSection('saved')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='saved' ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-700' : 'hover:bg-gray-100 hover:shadow-lg duration-200 scale-105'}`}>
                <i className="fas fa-heart" />
                <span>Saved Jobs</span>
              </button>
            </li>
            <li>
              <button onClick={() => showSection('resume')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='resume' ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-700' : 'hover:bg-gray-100 hover:shadow-lg duration-200 scale-105'}`}>
                <i className="fas fa-file-alt" />
                <span>My Resume</span>
              </button>
            </li>
            <li>
              <button onClick={() => showSection('settings')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='settings' ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-700' : 'hover:bg-gray-100 hover:shadow-lg duration-200 scale-105'}`}>
                <i className="fas fa-cog" />
                <span>Settings</span>
              </button>
            </li>
          </ul>
        </aside>

        <main className="flex-1 p-6">
          <h2 className="text-2xl font-semibold mb-4">{sectionTitles[activeSection]} {activeSection==='dashboard' ? `, ${displayName}!` : ''}</h2>

          {activeSection === 'dashboard' && (
            <div>
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : dashboardData ? (
              <>
              <div className="mb-6">
                <p className="text-gray-600">Track your job search progress and discover new opportunities</p>
                <div className="text-sm text-gray-500 mt-2">Last login: <span>{dashboardData.user?.updated_at || 'N/A'}</span></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div className="border border-gray-300 shadow-lg p-4 rounded text-center">
                  <div className="text-2xl font-bold">{dashboardData.stats?.applications_sent || 0}</div>
                  <div className="text-sm text-gray-500">Applications Sent</div>
                </div>
                <div className="border border-gray-300 shadow-lg p-4 rounded text-center">
                  <div className="text-2xl font-bold">{dashboardData.stats?.saved_jobs || 0}</div>
                  <div className="text-sm text-gray-500">Saved Jobs</div>
                </div>
                <div className="border border-gray-300 shadow-lg p-4 rounded text-center">
                  <div className="text-2xl font-bold">{dashboardData.stats?.profile_views || 0}</div>
                  <div className="text-sm text-gray-500">Profile Views</div>
                </div>
                <div className="border border-gray-300 shadow-lg p-4 rounded text-center">
                  <div className="text-2xl font-bold">{dashboardData.stats?.interviews || 0}</div>
                  <div className="text-sm text-gray-500">Interviews</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="card border border-gray-300 rounded p-4 shadow-lg">
                  <h3 className="mb-3 font-semibold">Application Progress</h3>
                  <div style={{position:'relative', height:300}}>
                    <canvas ref={progressChartRef} />
                  </div>
                </div>
              </div>

              <div className="card border border-gray-300 rounded p-4 shadow-lg mt-6">
                <div className="section-header flex items-center justify-between">
                  <h3>Recent Applications</h3>
                  <button onClick={() => showSection('applications')} className="btn btn-secondary border border-blue-600 text-blue-600 duration-200 hover:scale-105 hover:shadow-lg shadow-md px-4 py-2 rounded">View All</button>
                </div>
                <div className="mt-4 space-y-4">
                  {dashboardData.recent_applications && dashboardData.recent_applications.length > 0 ? (
                    dashboardData.recent_applications.map(app => (
                      <div key={app.id} className="application-item flex items-center justify-between border-t pt-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 flex items-center justify-center">
                            <img 
                              src={app.company_logo
                                ? app.company_logo.startsWith('data:image')
                                  ? app.company_logo
                                  : `http://localhost/Job_Portal_Project/backend/${app.company_logo}`
                                : '/Job Portal-logo-transparent.png'}
                              alt="Company Logo" 
                              className="h-12 w-12 object-cover rounded-full border border-gray-300"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = '/Job Portal-logo-transparent.png';
                              }}
                            />
                          </div>
                          <div>
                            <h4 className="font-semibold">{app.title}</h4>
                            <p className="text-sm text-gray-500">{app.company_name}</p>
                            <p className="text-xs text-gray-400">Applied {new Date(app.applied_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-bold ${
                            app.status === 'pending' ? 'text-yellow-700' : 
                            app.status === 'reviewing' || app.status === 'reviewed' ? 'text-gray-700' : 
                            app.status === 'accepted' || app.status === 'hired' ? 'text-green-700' : 
                            'text-red-600'
                          }`}>{app.status.charAt(0).toUpperCase() + app.status.slice(1)}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No applications yet. Start applying to jobs!</p>
                  )}
                </div>
              </div>
              </>
              ) : (
                <p className="text-center text-gray-500 py-8">Failed to load dashboard data</p>
              )}
            </div>
          )}

          {/* Profile section removed per user request */}

          {/* My Profile section removed */}

          {activeSection === 'applications' && (
            <div>
              <div className="mb-4">
                <p className="text-sm text-gray-500">Track your application statuses and history</p>
              </div>
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : applications.length > 0 ? (
                <div className="space-y-4">
                  {applications.map(app => (
                    (() => { console.log('APPLICATION_DEBUG', app); return null; })(),
                    <div key={app.id} className="border border-gray-300 shadow-lg duration-200 hover:scale-10 hover:shadow-xl p-4 rounded flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-16 h-16 flex items-center justify-center flex-shrink-0">
                          <img 
                            src={app.company_logo
                              ? app.company_logo.startsWith('data:image')
                                ? app.company_logo
                                : `http://localhost/Job_Portal_Project/backend/${app.company_logo}`
                              : '/Job Portal-logo-transparent.png'}
                            alt="Company Logo" 
                            className="h-16 w-16 object-cover rounded-full border border-gray-300"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = '/Job Portal-logo-transparent.png';
                            }}
                          />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold">{app.title}</h4>
                          <p className="text-sm text-gray-500">{app.company_name} • Applied {new Date(app.applied_at).toLocaleDateString()}</p>
                          <p className="text-xs text-gray-400 mt-2">{app.cover_letter ? app.cover_letter.substring(0, 100) + '...' : 'No cover letter provided'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-bold ${
                          app.status === 'pending' ? 'text-yellow-700' : 
                          app.status === 'reviewing' || app.status === 'reviewed' ? 'text-gray-700' : 
                          app.status === 'accepted' || app.status === 'hired' ? 'text-green-700' : 
                          'text-red-600'
                        }`}>{app.status.charAt(0).toUpperCase() + app.status.slice(1)}</div>
                        <div className="mt-3 flex gap-2 justify-end">
                          {app.status === 'pending' && (
                            <button 
                              onClick={async () => {
                                if (window.confirm('Are you sure you want to withdraw this application?')) {
                                  try {
                                    await jobSeekerService.withdrawApplication(app.id);
                                    showToast('Application withdrawn successfully', 'success');
                                    // Reload applications
                                    const data = await jobSeekerService.getApplications();
                                    setApplications(data);
                                  } catch (error) {
                                    showToast(error.message || 'Failed to withdraw application', 'error');
                                  }
                                }
                              }}
                              className="px-3 py-1 border border-red-600 text-red-600 shadow-sm duration-200 hover:scale-105 hover:shadow-lg rounded text-sm"
                            >
                              Withdraw
                            </button>
                          )}
                          <Link 
                            to={`/jobs/${app.job_id}`}
                            className="px-3 py-1 border border-blue-600 text-blue-600 shadow-sm duration-200 hover:scale-105 hover:shadow-lg rounded text-sm"
                          >
                            View Details
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No applications yet. Start applying to jobs!</p>
              )}
            </div>
          )}

          {activeSection === 'saved' && (
            <div>
              <div className="mb-4">
                <p className="text-sm text-gray-500">Jobs you bookmarked for later</p>
              </div>
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : savedJobs.length > 0 ? (
                <div className="space-y-4">
                  {savedJobs.map(job => {
                    // Check if already applied
                    const hasApplied = applications.some(app => app.job_id === job.job_id);
                    
                    return (
                    <div key={job.saved_id} className="border border-gray-300 shadow-lg duration-200 hover:scale-10 hover:shadow-xl p-4 rounded flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-16 h-16 flex items-center justify-center flex-shrink-0">
                          <img 
                            src={job.company_logo
                              ? job.company_logo.startsWith('data:image')
                                ? job.company_logo
                                : `http://localhost/Job_Portal_Project/backend/${job.company_logo}`
                              : '/Job Portal-logo-transparent.png'}
                            alt="Company Logo" 
                            className="h-16 w-16 object-cover rounded-full border border-gray-300"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = '/Job Portal-logo-transparent.png';
                            }}
                          />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold">{job.title}</h4>
                          <p className="text-sm text-gray-500">{job.company_name} • {job.location}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            ${job.salary_min} - ${job.salary_max} • {job.job_type}
                          </p>
                          {job.notes && <p className="text-xs text-gray-500 mt-2 italic">Note: {job.notes}</p>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {hasApplied ? (
                          <button 
                            disabled
                            className="px-3 py-1 border border-green-600 text-green-600 shadow-sm rounded text-sm cursor-not-allowed opacity-60"
                          >
                            Applied
                          </button>
                        ) : (
                          <button 
                            onClick={async () => {
                              if (!window.confirm('Are you sure you want to apply for this job?')) {
                                return;
                              }
                              try {
                                await jobSeekerService.applyForJob(job.job_id);
                                showToast('Application submitted successfully!', 'success');
                                // Reload applications to show the new application
                                const data = await jobSeekerService.getApplications();
                                setApplications(data);
                              } catch (error) {
                                if (error.message && error.message.includes('already applied')) {
                                  showToast('You have already applied for this job', 'info');
                                  // Reload applications to update state
                                  const data = await jobSeekerService.getApplications();
                                  setApplications(data);
                                } else {
                                  showToast(error.message || 'Failed to submit application', 'error');
                                }
                              }
                            }} 
                            className="px-3 py-1 border border-blue-600 text-blue-600 shadow-sm duration-200 hover:scale-105 hover:shadow-lg rounded text-sm"
                          >
                            Apply
                          </button>
                        )}
                        <button 
                          onClick={async () => {
                            try {
                              await jobSeekerService.removeSavedJob(job.job_id, job.saved_id);
                              showToast('Job removed from saved list', 'success');
                              // Reload saved jobs
                              const data = await jobSeekerService.getSavedJobs();
                              setSavedJobs(data);
                            } catch (error) {
                              showToast(error.message || 'Failed to remove saved job', 'error');
                            }
                          }}
                          className="px-3 py-1 border border-red-600 text-red-600 shadow-sm duration-200 hover:scale-105 hover:shadow-lg rounded text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No saved jobs yet. Browse jobs and save your favorites!</p>
              )}
            </div>
          )}

          {activeSection === 'resume' && (
            <div>
              <div className="mb-6">
                <p className="text-sm text-gray-500">Upload your resume to apply for jobs. Employers will be able to download your resume when you apply.</p>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-300">
                <h3 className="text-lg font-semibold mb-4">
                  <i className="fas fa-file-upload mr-2 text-blue-600"></i>
                  Upload Resume
                </h3>

                {resumePath && (
                  <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <i className="fas fa-check-circle text-green-600 mr-2"></i>
                        <span className="text-sm font-medium text-green-800">Current Resume</span>
                      </div>
                      <div className="flex gap-2">
                        <a 
                          href={`http://localhost/Job_Portal_Project/backend/${resumePath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 border border-green-600 text-green-600 text-sm rounded duration-200 hover:shadow-lg shadow-md hover:scale-105 flex items-center justify-center"
                        >
                          <i className="fas fa-download mr-1"></i>
                          View/Download
                        </a>
                        <button
                          onClick={handleResumeDelete}
                          disabled={uploading}
                          className="px-3 py-1 border border-red-600 text-red-600 text-sm rounded duration-200 hover:shadow-lg shadow-md hover:scale-105 flex items-center justify-center"
                        >
                          <i className="fas fa-trash-alt mr-1"></i>
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">{resumePath.split('/').pop()}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Resume File (PDF, DOC, DOCX - Max 5MB)
                    </label>
                    <input
                      ref={resumeInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleResumeFileSelect}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                  </div>

                  {resumeFile && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-sm text-blue-800">
                        <i className="fas fa-file-alt mr-2"></i>
                        Selected: <strong>{resumeFile.name}</strong> ({(resumeFile.size / 1024).toFixed(2)} KB)
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleResumeUpload}
                    disabled={!resumeFile || uploading}
                    className="px-6 py-3 border border-blue-600 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed text-blue-600 hover:bg-blue-50 shadow-md hover:shadow-lg flex items-center justify-center shadow-sm duration-200 hover:scale-105"
                  >
                    {uploading ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-cloud-upload-alt mr-2"></i>
                        Upload Resume
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-yellow-800 mb-2">
                    <i className="fas fa-info-circle mr-2"></i>
                    Important Notes:
                  </h4>
                  <ul className="text-xs text-yellow-700 space-y-1 list-disc list-inside">
                    <li>Your resume will be automatically attached when you apply for jobs</li>
                    <li>Employers can view and download your resume</li>
                    <li>Upload a new resume to replace the current one</li>
                    <li>Supported formats: PDF, DOC, DOCX</li>
                    <li>Maximum file size: 5MB</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'settings' && (
            <SettingsPanel />
          )}

          {/* Browse Jobs section removed — use Home page to browse jobs */}
        </main>
      </div>
      {confirmOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded p-6 shadow-lg w-96">
            <h4 className="font-semibold mb-3">Confirm remove avatar</h4>
            <p className="text-sm text-gray-600 mb-4">Are you sure you want to remove your avatar? This action can be undone by uploading a new one.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmOpen(false)} className="px-3 py-2 rounded border">Cancel</button>
              <button 
                onClick={confirmRemoveAvatar} 
                className={`px-3 py-2 rounded ${avatarUploading ? 'bg-red-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'} text-white`}
                disabled={avatarUploading}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsPanel() {
  const [settings, setSettings] = useState({ emailNotifications: true, profileVisible: true, dailySummary: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Load settings from API on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await jobSeekerService.getSettings();
        setSettings(data);
        setLoadError(null);
      } catch (error) {
        console.error('Error loading settings:', error);
        setLoadError(error.message || 'Failed to load settings');
        // Don't show toast on initial load, just show error message
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  async function saveSettings() {
    setSaving(true);
    try {
      const updated = await jobSeekerService.updateSettings(settings);
      setSettings(updated);
      showToast('Settings saved successfully', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast(error.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  function toggle(k) { setSettings(s => ({ ...s, [k]: !s[k] })); }
  
  function reset() { 
    setSettings({ emailNotifications: true, profileVisible: true, dailySummary: false }); 
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{loadError}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        
        <p className="text-sm text-gray-500">Manage your account preferences</p>
      </div>

      <div className="border border-gray-300 shadow-lg p-4 rounded space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 transform transition-transform duration-200 scale-100 checked:scale-110" checked={!!settings.emailNotifications} onChange={() => toggle('emailNotifications')} />
            <div>
              <div className="font-medium transition-colors duration-200">Email Notifications</div>
              <div className="text-sm text-gray-500 transition-opacity duration-200" style={{ opacity: settings.emailNotifications ? 1 : 0.6 }}>Receive notifications about new job matches</div>
            </div>
          </div>
        </div>

        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 transform transition-transform duration-200 scale-100 checked:scale-110" checked={!!settings.profileVisible} onChange={() => toggle('profileVisible')} />
            <div>
              <div className="font-medium transition-colors duration-200">Profile Visibility</div>
              <div className="text-sm text-gray-500 transition-opacity duration-200" style={{ opacity: settings.profileVisible ? 1 : 0.6 }}>Make my profile visible to employers</div>
            </div>
          </div>
        </div>

        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 transform transition-transform duration-200 scale-100 checked:scale-110" checked={!!settings.dailySummary} onChange={() => toggle('dailySummary')} />
            <div>
              <div className="font-medium transition-colors duration-200">Daily Summary Email</div>
              <div className="text-sm text-gray-500 transition-opacity duration-200" style={{ opacity: settings.dailySummary ? 1 : 0.6 }}>Receive a short summary of new matches each day</div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-2">
          <button 
            onClick={saveSettings} 
            disabled={saving}
            className="px-4 py-2 border border-blue-600 text-blue-600 duration-200 shadow-sm hover:scale-105 hover:shadow-lg rounded disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button onClick={reset} className="px-4 py-2 border border-red-600 text-red-600 duration-200 shadow-sm hover:scale-105 hover:shadow-lg rounded">Reset</button>
        </div>
      </div>
      
      {/* Change Password */}
      <div className="border border-gray-300 shadow-lg p-4 rounded mt-6">
        <h4 className="font-semibold mb-3">Change Password</h4>
        <ChangePasswordForm />
      </div>
    </div>
  );
}

function ChangePasswordForm() {
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (!current) { 
        showToast('Please enter current password', 'error'); 
        setLoading(false); 
        return; 
      }
      const passwordErrors = [];
      if (newPass.length < 8) {
        passwordErrors.push('Password must be at least 8 characters long.');
      }
      if (!/[A-Z]/.test(newPass)) {
        passwordErrors.push('Include at least one uppercase letter.');
      }
      if (!/[a-z]/.test(newPass)) {
        passwordErrors.push('Include at least one lowercase letter.');
      }
      if (!/[0-9]/.test(newPass)) {
        passwordErrors.push('Include at least one number.');
      }
      if (!/[^A-Za-z0-9]/.test(newPass)) {
        passwordErrors.push('Include at least one special character.');
      }
      if (passwordErrors.length) {
        showToast(passwordErrors.join(' '), 'error');
        setLoading(false);
        return;
      }
      if (newPass !== confirmPass) { 
        showToast('New password and confirmation do not match', 'error'); 
        setLoading(false); 
        return; 
      }
      
      // Call API to change password
      await jobSeekerService.changePassword({
        currentPassword: current,
        newPassword: newPass,
        confirmPassword: confirmPass
      });
      
      setCurrent(''); 
      setNewPass(''); 
      setConfirmPass('');
      showToast('Password changed successfully', 'success');
    } catch (err) {
      const serverMessage = err?.message || 'Failed to change password';
      showToast(serverMessage, 'error');
    } finally { 
      setLoading(false); 
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">Current Password</label>
          <input type={show ? 'text' : 'password'} value={current} onChange={e => setCurrent(e.target.value)} className="border border-gray-300 p-2 rounded w-full outline-none" />
        </div>
        <div>
          <label className="block text-sm mb-1">New Password</label>
          <input type={show ? 'text' : 'password'} value={newPass} onChange={e => setNewPass(e.target.value)} className="border border-gray-300 p-2 rounded w-full outline-none" />
        </div>
      </div>
      <div>
        <label className="block text-sm mb-1">Confirm New Password</label>
        <input type={show ? 'text' : 'password'} value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className="border border-gray-300 p-2 rounded w-full outline-none" />
      </div>
      <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={show} onChange={() => setShow(s => !s)} /> Show passwords</label>
        <button 
          type="submit" 
          disabled={loading} 
          className="px-4 py-2 border border-blue-600 text-blue-600 duration-200 shadow-sm hover:scale-105 hover:shadow-lg rounded disabled:opacity-50"
        >
          {loading ? 'Changing...' : 'Change Password'}
        </button>
      </div>
      <p className="text-xs text-gray-500">Password must be at least 8 characters and include uppercase, lowercase, number, and special character.</p>
    </form>
  );
}

// SeekerProfileEditor removed per user request
