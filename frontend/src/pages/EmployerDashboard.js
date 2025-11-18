import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import employerService from '../services/employerService';
import { DEFAULT_AVATAR, normalizeAvatar, resolveAvatarSrc, ensureBase64DataUri } from '../utils/avatar';
import { compressImageFile } from '../utils/image';

function JobForm({ onJobCreated }) {
  const [form, setForm] = useState({ title:'', department:'IT & Software', type:'full-time', level:'Mid Level', salary:'', location:'', description:'', requirements:'', benefits:'' });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  function onChange(e){ const {name,value} = e.target; setForm(f => ({...f,[name]:value})); }
  
  async function submit(e){ 
    e.preventDefault(); 
    if(!form.title.trim()){ 
      alert('Please enter a job title'); 
      return; 
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Parse salary range (e.g., "500-1000")
      const salaryParts = form.salary.split('-').map(s => parseFloat(s.trim()));
      const salary_min = salaryParts[0] || null;
      const salary_max = salaryParts[1] || salaryParts[0] || null;
      
      const jobData = {
        title: form.title,
        description: form.description,
        requirements: form.requirements,
        location: form.location,
        salary_min,
        salary_max,
        job_type: form.type,
        category: form.department,
        status: 'active'
      };
      
      const response = await employerService.createJob(jobData);
      
      if (response.success) {
        setSaved(true);
        // reset form
        setForm({ title:'', department:'IT & Software', type:'full-time', level:'Mid Level', salary:'', location:'', description:'', requirements:'', benefits:'' });
        setTimeout(() => {
          setSaved(false);
          // If API returned the new job object, pass it to parent so UI can insert it immediately
          if (onJobCreated) onJobCreated(response.data?.job || null);
        }, 2000);
      }
    } catch (err) {
      setError(err.error || 'Failed to create job');
      console.error('Create job error:', err);
    } finally {
      setLoading(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1">Job Title</label>
          <input name="title" value={form.title} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none" placeholder="e.g. Senior React Developer" required />
        </div>
        <div>
          <label className="block text-sm mb-1">Category</label>
          <select name="department" value={form.department} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none appearance-none">
            <option>IT & Software</option>
            <option>Engineering</option>
            <option>Design</option>
            <option>Marketing</option>
            <option>Finance</option>
            <option>Human Resources</option>
            <option>Other</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm mb-1">Job Description</label>
        <textarea name="description" value={form.description} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none" rows={5} required />
      </div>
      <div>
        <label className="block text-sm mb-1">Requirements</label>
        <textarea name="requirements" value={form.requirements} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none" rows={3} placeholder="e.g., React, Node.js, 3+ years experience" required />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input name="salary" value={form.salary} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none" placeholder="500-1000" />
        <input name="location" value={form.location} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none" placeholder="Phnom Penh" required />
        <select name="type" value={form.type} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none appearance-none">
          <option value="full-time">Full-time</option>
          <option value="part-time">Part-time</option>
          <option value="contract">Contract</option>
          <option value="internship">Internship</option>
        </select>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={loading} className="border border-blue-600 text-blue-600 duration-200 hover:scale-105 hover:shadow-md shadow-sm px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? 'Posting...' : 'Post Job'}
        </button>
        {saved && <div className="text-sm text-green-600">✓ Job posted successfully!</div>}
      </div>
    </form>
  );
}

export default function EmployerDashboard() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const userDropdownRef = useRef(null);
  
  // Dashboard data from API
  const [dashboardStats, setDashboardStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Analytics data
  const [analyticsData, setAnalyticsData] = useState(null);
  
  // Candidates data
  const [candidates, setCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesFilters, setCandidatesFilters] = useState({ skills: '', location: '' });
  
  // Settings data
  const [settings, setSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  
  // Change password data
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false
  });
  
  // Job view/edit modal
  const [selectedJob, setSelectedJob] = useState(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});

  // View Application modal state
  const [showViewApplicationModal, setShowViewApplicationModal] = useState(false);
  const [viewingApplication, setViewingApplication] = useState(null);

  // View Candidate Profile modal state
  const [showViewCandidateModal, setShowViewCandidateModal] = useState(false);
  const [viewingCandidate, setViewingCandidate] = useState(null);
  const [candidateLoading, setCandidateLoading] = useState(false);

  const companyProfile = {
    name: 'TechCorp Inc.',
    avatar: DEFAULT_AVATAR
  };

  // avatar persisted to localStorage
  const [avatar, setAvatar] = useState(() => {
    try {
      const saved = localStorage.getItem('employerAvatar');
      if (saved) {
        return normalizeAvatar(saved);
      }

      const userRaw = localStorage.getItem('user');
      if (userRaw) {
        const user = JSON.parse(userRaw);
        const normalizedUserAvatar = normalizeAvatar(user?.avatar);
        if (normalizedUserAvatar) {
          localStorage.setItem('employerAvatar', normalizedUserAvatar);
          return normalizedUserAvatar;
        }
      }
    } catch (e) {
      console.log('🏢 EmployerDashboard avatar error:', e);
    }
    return companyProfile.avatar;
  });
  const resolvedAvatar = resolveAvatarSrc(avatar);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  const [companyName, setCompanyName] = useState(() => {
    try {
      // Priority 1: Check auth user from login (this gets updated by EmployerProfile)
      const userRaw = localStorage.getItem('user');
      if (userRaw) {
        const user = JSON.parse(userRaw);
        if (user.full_name && user.full_name.trim()) return user.full_name;
      }
      // Priority 2: Fallback to employer profile
      const raw = localStorage.getItem('employerProfile');
      if (raw) {
        const p = JSON.parse(raw);
        if (p.name && p.name.trim()) return p.name;
      }
      // Priority 3: Default fallback
      return companyProfile.name;
    } catch (e) { return companyProfile.name; }
  });

  // persist avatar
  useEffect(() => {
    try {
      const normalizedAvatar = normalizeAvatar(avatar);
      if (normalizedAvatar) {
        localStorage.setItem('employerAvatar', normalizedAvatar);

        const userRaw = localStorage.getItem('user');
        if (userRaw) {
          const user = JSON.parse(userRaw);
          user.avatar = normalizedAvatar;
          localStorage.setItem('user', JSON.stringify(user));
        }

        window.dispatchEvent(new CustomEvent('employerAvatarChanged', { detail: normalizedAvatar }));
      } else {
        localStorage.removeItem('employerAvatar');
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
    window.addEventListener('employerAvatarChanged', onAvatarChange);
    return () => window.removeEventListener('employerAvatarChanged', onAvatarChange);
  }, [avatar]);

  useEffect(() => {
    function onProfileChange(e) {
      const p = (e && e.detail) || null;
      // Priority 1: Check from user localStorage (updated by EmployerProfile)
      try {
        const userRaw = localStorage.getItem('user');
        if (userRaw) {
          const user = JSON.parse(userRaw);
          if (user.full_name && user.full_name.trim()) {
            setCompanyName(user.full_name);
            return;
          }
        }
      } catch (err) {}
      
      // Priority 2: Use event detail if available
      if (p && p.name && p.name.trim()) {
        setCompanyName(p.name);
        return;
      }
      
      // Priority 3: Fallback to employerProfile localStorage
      try {
        const raw = localStorage.getItem('employerProfile');
        if (raw) {
          const profile = JSON.parse(raw);
          if (profile.name && profile.name.trim()) {
            setCompanyName(profile.name);
          }
        }
      } catch (err) {}
    }
    window.addEventListener('employerProfileChanged', onProfileChange);
    function onStorage(e) {
      if (e.key === 'employerProfile' || e.key === 'user') {
        try {
          const p = JSON.parse(e.newValue || '{}');
          if (p.name) setCompanyName(() => p.name);
          if (p.full_name) setCompanyName(() => p.full_name);
          if (p.avatar) setAvatar(normalizeAvatar(p.avatar));
        } catch (err) {}
      }
      if (e.key === 'employerAvatar') {
        try {
          setAvatar(normalizeAvatar(e.newValue));
        } catch (err) {}
      }
    }

    const onAvatarChange = (e) => {
      const newAvatar = (e && e.detail) || null;
      if (newAvatar) {
        setAvatar(normalizeAvatar(newAvatar));
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('employerAvatarChanged', onAvatarChange);

    return () => {
      window.removeEventListener('employerProfileChanged', onProfileChange);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('employerAvatarChanged', onAvatarChange);
    };
  }, []);

  // Load dashboard data based on active section
  useEffect(() => {
    if (activeSection === 'dashboard') {
      loadDashboardStats();
    } else if (activeSection === 'manage-jobs') {
      loadJobs();
    } else if (activeSection === 'applications') {
      loadApplications();
    } else if (activeSection === 'analytics') {
      loadAnalytics();
    } else if (activeSection === 'candidates') {
      loadCandidates();
    } else if (activeSection === 'settings') {
      loadSettings();
    }
  }, [activeSection]);
  
  const loadDashboardStats = async () => {
    setLoading(true);
    try {
      const response = await employerService.getDashboardStats();
      if (response.success) {
        setDashboardStats(response.data);

        const profile = response.data?.employer_profile;
        if (profile) {
          const derivedName = (profile.company_name || profile.full_name || '').trim();
          if (derivedName) {
            setCompanyName(derivedName);
            try {
              const userRaw = localStorage.getItem('user');
              if (userRaw) {
                const user = JSON.parse(userRaw);
                user.full_name = derivedName;
                localStorage.setItem('user', JSON.stringify(user));
              }
            } catch (err) {}
          }
        }
        
        // Update employer avatar if available
        if (response.data.employer_profile && response.data.employer_profile.avatar) {
          const avatarUrl = response.data.employer_profile.avatar;
          localStorage.setItem('employerAvatar', avatarUrl);
          console.log('✅ Employer avatar updated from dashboard:', avatarUrl);
          
          // Dispatch event to update navigation
          window.dispatchEvent(new CustomEvent('employerAvatarChanged', { detail: avatarUrl }));
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
      setToast({ type: 'error', message: 'Failed to load dashboard data' });
    } finally {
      setLoading(false);
    }
  };
  
  const loadJobs = async () => {
    setLoading(true);
    try {
      const response = await employerService.getJobs();
      if (response.success) {
        setJobs(response.data.jobs || []);
      }
    } catch (err) {
      console.error('Failed to load jobs:', err);
      setToast({ type: 'error', message: 'Failed to load jobs' });
    } finally {
      setLoading(false);
    }
  };
  
  const loadApplications = async () => {
    setLoading(true);
    try {
      const response = await employerService.getApplications();
      if (response.success) {
        setApplications(response.data.applications || []);
      }
    } catch (err) {
      console.error('Failed to load applications:', err);
      setToast({ type: 'error', message: 'Failed to load applications' });
    } finally {
      setLoading(false);
    }
  };
  
  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const response = await employerService.getAnalytics();
      if (response.success) {
        setAnalyticsData(response.data);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setToast({ type: 'error', message: 'Failed to load analytics' });
    } finally {
      setLoading(false);
    }
  };
  
  const loadCandidates = async () => {
    setCandidatesLoading(true);
    try {
      const response = await employerService.getCandidates(candidatesFilters);
      if (response.success) {
        setCandidates(response.data.candidates || []);
      }
    } catch (err) {
      console.error('Failed to load candidates:', err);
      setToast({ type: 'error', message: 'Failed to load candidates' });
    } finally {
      setCandidatesLoading(false);
    }
  };
  
  const loadSettings = async () => {
    setSettingsLoading(true);
    try {
      const response = await employerService.getSettings();
      if (response.success) {
        setSettings(response.data.settings);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
      setToast({ type: 'error', message: 'Failed to load settings' });
    } finally {
      setSettingsLoading(false);
    }
  };
  
  const handleSaveSettings = async (updatedSettings) => {
    setSettingsLoading(true);
    try {
      const response = await employerService.updateSettings(updatedSettings);
      if (response.success) {
        setToast({ type: 'success', message: 'Settings saved successfully!' });
        setSettings(updatedSettings);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      setToast({ type: 'error', message: 'Failed to save settings' });
    } finally {
      setSettingsLoading(false);
    }
  };
  
  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      setToast({ type: 'error', message: 'Please fill in all password fields' });
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setToast({ type: 'error', message: 'New passwords do not match' });
      return;
    }

    const passwordErrors = [];
    if (passwordForm.new_password.length < 8) {
      passwordErrors.push('at least 8 characters');
    }
    if (!/[A-Z]/.test(passwordForm.new_password)) {
      passwordErrors.push('one uppercase letter');
    }
    if (!/[a-z]/.test(passwordForm.new_password)) {
      passwordErrors.push('one lowercase letter');
    }
    if (!/[0-9]/.test(passwordForm.new_password)) {
      passwordErrors.push('one number');
    }
    if (!/[^A-Za-z0-9]/.test(passwordForm.new_password)) {
      passwordErrors.push('one special character');
    }
    if (passwordErrors.length) {
      setToast({ type: 'error', message: `Password needs ${passwordErrors.join(', ')}.` });
      return;
    }
    
    setPasswordLoading(true);
    try {
      const response = await employerService.changePassword(passwordForm);
      if (response.success) {
        setToast({ type: 'success', message: 'Password changed successfully!' });
        // Reset form
        setPasswordForm({
          current_password: '',
          new_password: '',
          confirm_password: ''
        });
      } else {
        setToast({ type: 'error', message: response.error || 'Failed to change password' });
      }
    } catch (err) {
      console.error('Failed to change password:', err);
      const message = err?.message || err?.response?.data?.error || 'Failed to change password';
      setToast({ type: 'error', message });
    } finally {
      setPasswordLoading(false);
    }
  };
  
  const handleJobCreated = (newJob = null) => {
    setToast({ type: 'success', message: 'Job posted successfully!' });
    loadDashboardStats(); // Refresh stats
    setActiveSection('manage-jobs'); // Switch to manage jobs view

    // If we received the new job object from API, insert it into jobs state for immediate display
    if (newJob) {
      setJobs(prev => [newJob, ...prev]);
    } else {
      // fallback: reload jobs from server
      loadJobs();
    }
  };
  
  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this job?')) return;
    
    try {
      const response = await employerService.deleteJob(jobId);
      if (response.success) {
        setToast({ type: 'success', message: 'Job deleted successfully' });
        loadJobs(); // Refresh job list
        loadDashboardStats(); // Refresh stats
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to delete job' });
    }
  };
  
  const handleUpdateApplicationStatus = async (appId, status) => {
    try {
      const response = await employerService.updateApplicationStatus(appId, status);
      if (response.success) {
        setToast({ type: 'success', message: `Application ${status}` });
        loadApplications(); // Refresh applications
        loadDashboardStats(); // Refresh stats
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to update application' });
    }
  };

  const handleViewCandidateProfile = async (userId) => {
    setCandidateLoading(true);
    setShowViewCandidateModal(true);
    setViewingCandidate(null);

    try {
      const response = await fetch(`http://localhost/Job_Portal_Project/backend/api/employer/view-candidate-profile.php?user_id=${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setViewingCandidate(data.data);
      } else {
        setToast({ type: 'error', message: 'Failed to load candidate profile' });
        setShowViewCandidateModal(false);
      }
    } catch (error) {
      console.error('Error loading candidate profile:', error);
      setToast({ type: 'error', message: 'Failed to load candidate profile' });
      setShowViewCandidateModal(false);
    } finally {
      setCandidateLoading(false);
    }
  };

  const handleDownloadResume = async (userId, candidateName) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`http://localhost/Job_Portal_Project/backend/api/employer/download-candidate-resume.php?user_id=${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to download resume');
      }
      
      // Get the blob data
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${candidateName}_Resume.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setToast({ type: 'success', message: 'Resume downloaded successfully!' });
    } catch (err) {
      console.error('Failed to download resume:', err);
      setToast({ type: 'error', message: 'Failed to download resume' });
    }
  };
  
  const handleViewJob = (job) => {
    setSelectedJob(job);
    setIsEditMode(false);
    setShowJobModal(true);
  };
  
  const handleEditJob = (job) => {
    setSelectedJob(job);
    setIsEditMode(true);
    setEditForm({
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      location: job.location,
      salary_min: job.salary_min || '',
      salary_max: job.salary_max || '',
      job_type: job.job_type,
      category: job.category,
      status: job.status
    });
    setShowJobModal(true);
  };
  
  const handleSaveEdit = async () => {
    try {
      const response = await employerService.updateJob(selectedJob.id, editForm);
      if (response.success) {
        setToast({ type: 'success', message: 'Job updated successfully!' });
        setShowJobModal(false);
        loadJobs(); // Refresh jobs list
        loadDashboardStats(); // Refresh stats
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to update job' });
    }
  };
  
  const handleCloseModal = () => {
    setShowJobModal(false);
    setSelectedJob(null);
    setIsEditMode(false);
    setEditForm({});
  };

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
      setToast({ type: 'error', message: 'Please select an image file' });
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
  const payload = ensureBase64DataUri(normalizedAvatar);
  const response = await employerService.uploadAvatar(payload);
      if (response?.success) {
        setToast({ type: 'success', message: 'Avatar updated successfully!' });
      }
    } catch (err) {
      console.error('Employer avatar upload failed:', err);
  setAvatar(previousAvatar);
      const msg = err?.message || err?.response?.error || 'Failed to upload avatar';
      setToast({ type: 'error', message: msg });
    } finally {
      setAvatarUploading(false);
      if (input) input.value = '';
    }
  }

  async function handleRemoveAvatar() {
    if (avatarUploading) return;
    const previousAvatar = avatar;
    const fallback = normalizeAvatar(companyProfile.avatar);
    try {
      setAvatarUploading(true);
      setAvatar(fallback);
      const payload = ensureBase64DataUri(fallback);
      const response = await employerService.uploadAvatar(payload);
      if (response?.success) {
        setToast({ type: 'info', message: 'Avatar removed.' });
      }
    } catch (err) {
      console.error('Employer avatar removal failed:', err);
      setAvatar(previousAvatar);
      const msg = err?.message || err?.response?.error || 'Failed to remove avatar';
      setToast({ type: 'error', message: msg });
    } finally {
      setAvatarUploading(false);
      setConfirmRemoveOpen(false);
    }
  }

  const sectionTitles = {
    dashboard: 'Dashboard Overview',
    'post-job': 'Post New Job',
    'manage-jobs': 'Manage Jobs',
    applications: 'Job Applications',
    candidates: 'Browse Candidates',
    settings: 'Account Settings',
    analytics: 'Analytics & Reports'
  };

  // refs for analytics charts
  const monthlyChartRef = useRef(null);
  const industryChartRef = useRef(null);

  useEffect(() => {
    if (activeSection !== 'analytics') return;
    const monthlyCtx = monthlyChartRef.current && monthlyChartRef.current.getContext('2d');
    const industryCtx = industryChartRef.current && industryChartRef.current.getContext('2d');
    let monthlyChart, industryChart;
    (async () => {
      try {
        const mod = await import('chart.js/auto');
        const Chart = mod && (mod.default || mod);
        if (monthlyCtx) {
          monthlyChart = new Chart(monthlyCtx, {
            type: 'bar',
            data: { labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], datasets:[{ label:'Job Postings', data:[12,9,15,20,10,8,18,22,14,26,30,35], backgroundColor:'rgba(59,130,246,0.6)'}] },
            options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
          });
        }
        if (industryCtx) {
          industryChart = new Chart(industryCtx, {
            type:'doughnut',
            data:{ labels:['Technology','Design','Marketing','Finance','Other'], datasets:[{ data:[50,12,18,10,10], backgroundColor:['#3b82f6','#10b981','#f59e0b','#ef4444','#9ca3af'] }] },
            options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'right'}} }
          });
        }
      } catch (e) {}
    })();
    return () => { try { if (monthlyChart) monthlyChart.destroy(); if (industryChart) industryChart.destroy(); } catch(e){} };
  }, [activeSection]);

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

  useEffect(() => {
    function onAvatarChanged(e) {
      const a = e && e.detail;
      if (a) setAvatar(normalizeAvatar(a));
    }
    function onStorage(e) {
      if (e.key === 'employerAvatar') {
        try { setAvatar(normalizeAvatar(e.newValue || DEFAULT_AVATAR)); } catch (err) {}
      }
    }
    window.addEventListener('employerAvatarChanged', onAvatarChanged);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('employerAvatarChanged', onAvatarChanged); window.removeEventListener('storage', onStorage); };
  }, []);

  function showSection(section) {
    setActiveSection(section);
    setUserDropdownOpen(false);
  }

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
      
      <div className="min-h-screen bg-gray-50 text-gray-800">
        <nav className="bg-white border-b border-gray-300 sticky top-0 z-50 shadow-lg">
        <div className="max-w-8xl mx-auto px-4 py-3 flex items-center justify-between h-20">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              <img src="/Job Portal-logo-transparent.png" alt="JobPortal" className="h-24 w-auto object-contain" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative" ref={userDropdownRef}>
              <button onClick={() => setUserDropdownOpen(v => !v)} className="flex items-center gap-2 px-3 py-1 rounded duration-200 hover:scale-105" aria-haspopup="true" aria-expanded={userDropdownOpen} title="Company menu">
                {avatar ? (
                  <img
                    src={resolvedAvatar}
                    alt={`${companyName} avatar`}
                    className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_AVATAR;
                      setAvatar(DEFAULT_AVATAR);
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 border-2 border-gray-200 rounded-full duration-200 hover:scale-105 flex items-center justify-center font-semibold">TC</div>
                )}
                <span className="text-sm font-medium">{companyName}</span>
                {/* <i className={`fas fa-chevron-down text-xs transition-transform duration-200 ${userDropdownOpen ? 'rotate-180' : ''}`}></i> */}
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded shadow border z-30">
                  <Link to="/employer/profile" className="flex items-center px-4 py-2 hover:bg-gray-100">
                    <i className="fas fa-building mr-3 text-blue-600"></i>
                    Company Profile
                  </Link>
                  <Link to="/" className="flex items-center px-4 py-2 hover:bg-gray-100">
                    <i className="fas fa-home mr-3 text-green-600"></i>
                    Home
                  </Link>
                  <div className="border-t"></div>
                  <button onClick={logout} className="w-full text-left flex items-center px-4 py-2 hover:bg-red-50 text-red-600">
                    <i className="fas fa-sign-out-alt mr-3"></i>
                    Logout
                  </button>
                </div>
              )}
            </div>

            {/* theme toggle removed per request */}
          </div>
        </div>
      </nav>

      <div className="flex">
        <aside className="w-64 bg-white border-r border-gray-300 shadow-md p-4 mr-6 sticky top-20 z-30 overflow-auto" style={{ maxHeight: 'calc(100vh - 5rem)' }}>
          <div className="sidebar-profile mb-6 flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden mb-2 relative">
              <img
                src={resolvedAvatar}
                alt="company"
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
              <div className="font-medium text-gray-900 dark:text-white">{companyName}</div>
              <div className="text-xs text-gray-500">Employer Dashboard</div>
              <div className="mt-2 text-sm">
                <input ref={fileInputRef} onChange={handleFileSelected} type="file" accept="image/*" className="hidden" />
                <button
                  onClick={triggerFileSelect}
                  className={`text-xs mr-2 ${avatarUploading ? 'text-gray-400 cursor-not-allowed' : 'text-blue-500 hover:underline'}`}
                  disabled={avatarUploading}
                >
                  {avatarUploading ? 'Uploading...' : 'Upload'}
                </button>
                <button
                  onClick={() => setConfirmRemoveOpen(true)}
                  className={`text-xs ${avatarUploading ? 'text-gray-400 cursor-not-allowed' : 'text-red-500 hover:underline'}`}
                  disabled={avatarUploading}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
                
          <ul className="space-y-2">
            <li>
              <button onClick={() => showSection('dashboard')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='dashboard' ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-700' : 'hover:bg-gray-100 hover:shadow-lg duration-200 scale-105'}`}>
                <i className="fas fa-tachometer-alt"></i>
                <span>Dashboard</span>
              </button>
            </li>
            <li>
              <button onClick={() => showSection('post-job')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='post-job' ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-700' : 'hover:bg-gray-100 hover:shadow-lg duration-200 scale-105'}`}>
                <i className="fas fa-plus"></i>
                <span>Post New Job</span>
              </button>
            </li>
            <li>
              <button onClick={() => showSection('manage-jobs')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='manage-jobs' ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-700' : 'hover:bg-gray-100 hover:shadow-lg duration-200 scale-105'}`}>
                <i className="fas fa-list"></i>
                <span>Manage Jobs</span>
              </button>
            </li>
            <li>
              <button onClick={() => showSection('applications')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='applications' ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-700' : 'hover:bg-gray-100 hover:shadow-lg duration-200 scale-105'}`}>
                <i className="fas fa-users"></i>
                <span>View Applications</span>
              </button>
            </li>
            <li>
              <button onClick={() => showSection('candidates')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='candidates' ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-700' : 'hover:bg-gray-100 hover:shadow-lg duration-200 scale-105'}`}>
                <i className="fas fa-search"></i>
                <span>Browse Candidates</span>
              </button>
            </li>
            <li>
              <button onClick={() => showSection('settings')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='settings' ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-700' : 'hover:bg-gray-100 hover:shadow-lg duration-200 scale-105'}`}>
                <i className="fas fa-cog"></i>
                <span>Settings</span>
              </button>
            </li>
            <li>
              <button onClick={() => showSection('analytics')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='analytics' ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-700' : 'hover:bg-gray-100 hover:shadow-lg duration-200 scale-105'}`}>
                <i className="fas fa-chart-bar"></i>
                <span>Analytics</span>
              </button>
            </li>
          </ul>
        </aside>

        <main className="flex-1 p-6">
          <h2 className="text-2xl font-semibold mb-4">{sectionTitles[activeSection]}</h2>
          {activeSection === 'dashboard' && (
            <div>
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-4">Loading dashboard...</p>
                </div>
              ) : dashboardStats ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <div className="border border-gray-300 shadow-lg p-4 rounded text-center">
                      <div className="text-2xl font-bold">{dashboardStats.stats?.active_jobs || 0}</div>
                      <div className="text-sm text-gray-500">Active Jobs</div>
                    </div>
                    <div className="border border-gray-300 shadow-lg p-4 rounded text-center">
                      <div className="text-2xl font-bold">{dashboardStats.stats?.total_applications || 0}</div>
                      <div className="text-sm text-gray-500">Total Applications</div>
                    </div>
                    <div className="border border-gray-300 shadow-lg p-4 rounded text-center">
                      <div className="text-2xl font-bold">{dashboardStats.stats?.total_views || 0}</div>
                      <div className="text-sm text-gray-500">Job Views</div>
                    </div>
                    <div className="border border-gray-300 shadow-lg p-4 rounded text-center">
                      <div className="text-2xl font-bold">{dashboardStats.stats?.hired || 0}</div>
                      <div className="text-sm text-gray-500">Hired</div>
                    </div>
                  </div>

                  <div className="border border-gray-300 rounded p-4 shadow mb-6">
                    <h3 className="font-semibold mb-3">Recent Jobs</h3>
                    {dashboardStats.recent_jobs && dashboardStats.recent_jobs.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="py-2">Company</th>
                              <th className="py-2">Job Title</th>
                              <th className="py-2">Type</th>
                              <th className="py-2">Applications</th>
                              <th className="py-2">Views</th>
                              <th className="py-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dashboardStats.recent_jobs.map(job => (
                              <tr key={job.id} className="border-t">
                                <td className="py-2 font-medium">{job.company_name || job.company || 'Company'}</td>
                                <td className="py-2">{job.title}</td>
                                <td className="py-2 capitalize">{job.job_type?.replace('-', ' ')}</td>
                                <td className="py-2">{job.applications_count || 0}</td>
                                <td className="py-2">{job.views || 0}</td>
                                <td className="py-2">
                                  <span className={`text-xs px-2 py-1 rounded ${job.status === 'active' ? 'text-green-700' : 'text-gray-700'}`}>
                                    {job.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No jobs posted yet</p>
                    )}
                  </div>

                  <div className="border border-gray-300 rounded p-4 shadow">
                    <h3 className="font-semibold mb-3">Recent Applications</h3>
                    {dashboardStats.recent_applications && dashboardStats.recent_applications.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="py-2">Applicant</th>
                              <th className="py-2">Job</th>
                              <th className="py-2">Applied</th>
                              <th className="py-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dashboardStats.recent_applications.map(app => (
                              <tr key={app.id} className="border-t">
                                <td className="py-2">{app.applicant_name}</td>
                                <td className="py-2">{app.job_title}</td>
                                <td className="py-2">{new Date(app.applied_at).toLocaleDateString()}</td>
                                <td className="py-2">
                                  <span className={`text-xs px-2 py-1 rounded ${
                                    app.status === 'pending' ? 'text-yellow-700' :
                                    app.status === 'accepted' ? 'text-green-700' :
                                    app.status === 'rejected' ? 'text-red-700' :
                                    'text-gray-700'
                                  }`}>
                                    {app.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No applications yet</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">No dashboard data available</p>
                </div>
              )}
            </div>
          )}

          {activeSection === 'analytics' && (
            <div>
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-4">Loading analytics...</p>
                </div>
              ) : analyticsData ? (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <div className="border border-gray-300 rounded p-4 shadow-lg">
                      <h4 className="text-sm text-gray-500 mb-1">Top Performing Job</h4>
                      <p className="text-2xl font-bold">
                        {analyticsData.top_jobs && analyticsData.top_jobs.length > 0 
                          ? analyticsData.top_jobs[0].title 
                          : 'N/A'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {analyticsData.top_jobs && analyticsData.top_jobs.length > 0 
                          ? `${analyticsData.top_jobs[0].applications_count} applications` 
                          : ''}
                      </p>
                    </div>
                    <div className="border border-gray-300 rounded p-4 shadow-lg">
                      <h4 className="text-sm text-gray-500 mb-1">Avg Time to Hire</h4>
                      <p className="text-2xl font-bold">{analyticsData.avg_time_to_hire_days || 0} days</p>
                      <p className="text-sm text-gray-600">From apply to accepted</p>
                    </div>
                    <div className="border border-gray-300 rounded p-4 shadow-lg">
                      <h4 className="text-sm text-gray-500 mb-1">Total Applications</h4>
                      <p className="text-2xl font-bold">
                        {analyticsData.applications_by_status?.reduce((sum, s) => sum + parseInt(s.count), 0) || 0}
                      </p>
                      <p className="text-sm text-gray-600">Across all jobs</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <div className="border border-gray-300 rounded p-4 shadow-lg">
                      <h3 className="font-semibold mb-3">Jobs by Category</h3>
                      {analyticsData.jobs_by_category && analyticsData.jobs_by_category.length > 0 ? (
                        <div className="space-y-2">
                          {analyticsData.jobs_by_category.map((cat, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <span className="text-sm">{cat.category}</span>
                              <div className="flex items-center gap-2">
                                <div className="w-32 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full" 
                                    style={{width: `${(cat.count / analyticsData.jobs_by_category[0].count) * 100}%`}}
                                  />
                                </div>
                                <span className="text-sm font-medium w-8 text-right">{cat.count}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No data available</p>
                      )}
                    </div>
                    
                    <div className="border border-gray-300 rounded p-4 shadow-lg">
                      <h3 className="font-semibold mb-3">Jobs by Type</h3>
                      {analyticsData.jobs_by_type && analyticsData.jobs_by_type.length > 0 ? (
                        <div className="space-y-2">
                          {analyticsData.jobs_by_type.map((type, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <span className="text-sm capitalize">{type.job_type?.replace('-', ' ')}</span>
                              <div className="flex items-center gap-2">
                                <div className="w-32 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-green-600 h-2 rounded-full" 
                                    style={{width: `${(type.count / analyticsData.jobs_by_type[0].count) * 100}%`}}
                                  />
                                </div>
                                <span className="text-sm font-medium w-8 text-right">{type.count}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No data available</p>
                      )}
                    </div>
                  </div>

                  <div className="border border-gray-300 rounded p-4 shadow-lg mb-6">
                    <h3 className="font-semibold mb-3">Application Status Breakdown</h3>
                    {analyticsData.applications_by_status && analyticsData.applications_by_status.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {analyticsData.applications_by_status.map((status, index) => (
                          <div key={index} className="text-center p-4 bg-gray-50 rounded">
                            <p className="text-2xl font-bold">{status.count}</p>
                            <p className="text-sm text-gray-600 capitalize">{status.status}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No applications yet</p>
                    )}
                  </div>

                  <div className="border border-gray-300 rounded p-4 shadow-lg">
                    <h3 className="font-semibold mb-3">Top Performing Jobs</h3>
                    {analyticsData.top_jobs && analyticsData.top_jobs.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="py-2">Job Title</th>
                              <th className="py-2">Category</th>
                              <th className="py-2">Applications</th>
                              <th className="py-2">Views</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analyticsData.top_jobs.map(job => (
                              <tr key={job.id} className="border-t">
                                <td className="py-2 font-medium">{job.title}</td>
                                <td className="py-2">{job.category}</td>
                                <td className="py-2">{job.applications_count}</td>
                                <td className="py-2">{job.views}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No jobs yet</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">No analytics data available</p>
                </div>
              )}
            </div>
          )}

          
          {activeSection === 'post-job' && (
            <div>
              <div className="border border-gray-300 rounded p-4 shadow-lg">
                <h3 className="font-semibold mb-3">Job Details</h3>
                
                <JobForm onJobCreated={handleJobCreated} />
              </div>
            </div>
          )}

          {activeSection === 'manage-jobs' && (
            <div>
              <div className="border border-gray-300 rounded p-4 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Your Job Postings</h3>
                  <button onClick={() => setActiveSection('post-job')} className="border border-blue-600 text-blue-600 duration-200 hover:scale-105 px-3 py-1 rounded">Post New Job</button>
                </div>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : jobs.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-gray-500">
                          <th className="py-2">Company</th>
                          <th className="py-2">Job Title</th>
                          <th className="py-2">Category</th>
                          <th className="py-2">Type</th>
                          <th className="py-2">Posted</th>
                          <th className="py-2">Applications</th>
                          <th className="py-2">Views</th>
                          <th className="py-2">Status</th>
                          <th className="py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobs.map(job => (
                          <tr key={job.id} className="border-t">
                            <td className="py-2 font-medium">{job.company_name || job.company || 'Company'}</td>
                            <td className="py-2 font-medium">{job.title}</td>
                            <td className="py-2">{job.category}</td>
                            <td className="py-2 capitalize">{job.job_type?.replace('-', ' ')}</td>
                            <td className="py-2">{new Date(job.created_at).toLocaleDateString()}</td>
                            <td className="py-2">{job.applications_count || 0}</td>
                            <td className="py-2">{job.views || 0}</td>
                            <td className="py-2">
                              <span className={`text-xs px-2 py-1 rounded ${job.status === 'active' ? 'text-green-700' : 'text-gray-700'}`}>
                                {job.status}
                              </span>
                            </td>
                            <td className="py-2">
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleViewJob(job)} 
                                  title='View Details' 
                                  className="px-2 py-1 rounded text-blue-600 duration-200 hover:scale-105"
                                >
                                  <i className="fas fa-eye"></i>
                                </button>
                                <button 
                                  onClick={() => handleEditJob(job)} 
                                  title='Edit Job' 
                                  className="px-2 py-1 rounded text-green-600 duration-200 hover:scale-105"
                                >
                                  <i className="fas fa-edit"></i>
                                </button>
                                <button 
                                  onClick={() => handleDeleteJob(job.id)} 
                                  title='Delete Job' 
                                  className="px-2 py-1 rounded text-red-600 duration-200 hover:scale-105"
                                >
                                  <i className="fas fa-trash"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No jobs posted yet</p>
                    <button onClick={() => setActiveSection('post-job')} className="mt-3 border border-blue-600 text-blue-600 px-4 py-2 rounded">
                      Post Your First Job
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === 'applications' && (
            <div>
              <div className="border border-gray-300 rounded p-4 shadow-lg">
                <h3 className="font-semibold mb-3">Job Applications</h3>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : applications.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-gray-500">
                          <th className="py-2">Applicant</th>
                          <th className="py-2">Job</th>
                          <th className="py-2">Applied</th>
                          <th className="py-2">Status</th>
                          <th className="py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {applications.map(app => (
                          <tr key={app.id} className="border-t">
                            <td className="py-2">
                              <div>
                                <div className="font-medium">{app.applicant_name}</div>
                                <div className="text-xs text-gray-500">{app.applicant_email}</div>
                              </div>
                            </td>
                            <td className="py-2">{app.job_title}</td>
                            <td className="py-2">{new Date(app.applied_at).toLocaleDateString()}</td>
                            <td className="py-2">
                              <span className={`text-xs px-2 py-1 rounded ${
                                app.status === 'pending' ? ' text-yellow-700' :
                                app.status === 'reviewed' ? 'text-blue-700' :
                                app.status === 'accepted' ? 'text-green-700' :
                                'text-red-700'
                              }`}>
                                {app.status}
                              </span>
                            </td>
                            <td className="py-2">
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => {
                                    setViewingApplication(app);
                                    setShowViewApplicationModal(true);
                                  }}
                                  className="text-xs px-2 py-1 rounded text-blue-600 duration-200 hover:scale-105"
                                  title="View Details"
                                >
                                  <i className="fas fa-eye mr-1"></i>
                                </button>
                                {app.status === 'pending' && (
                                  <>
                                    <button 
                                      onClick={() => handleUpdateApplicationStatus(app.id, 'reviewed')}
                                      className="text-xs px-2 py-1 text-blue-700 rounded border border-blue-600 text-blue-600 duration-200 hover:scale-105"
                                    >
                                      Review
                                    </button>
                                    <button 
                                      onClick={() => handleUpdateApplicationStatus(app.id, 'accepted')}
                                      className="text-xs px-2 py-1 rounded border border-green-600 text-green-600 duration-200 hover:scale-105"
                                    >
                                      Accept
                                    </button>
                                    <button 
                                      onClick={() => handleUpdateApplicationStatus(app.id, 'rejected')}
                                      className="text-xs px-2 py-1 rounded border border-red-600 text-red-600 duration-200 hover:scale-105"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No applications yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === 'candidates' && (
            <div>
              <div className="border border-gray-300 rounded p-4 shadow-lg mb-4">
                <h3 className="font-semibold mb-3">Search Filters</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input 
                    className="border border-gray-300 outline-none rounded p-2" 
                    placeholder="Skills (e.g. React)" 
                    value={candidatesFilters.skills}
                    onChange={(e) => setCandidatesFilters({...candidatesFilters, skills: e.target.value})}
                  />
                  <input 
                    className="border border-gray-300 outline-none rounded p-2" 
                    placeholder="Location" 
                    value={candidatesFilters.location}
                    onChange={(e) => setCandidatesFilters({...candidatesFilters, location: e.target.value})}
                  />
                  <button 
                    onClick={loadCandidates}
                    className="border border-blue-600 text-blue-600 shadow-sm duration-200 hover:scale-105 hover:shadow-md px-3 py-1 rounded"
                  >
                    Search Candidates
                  </button>
                </div>
              </div>

              <div className="border border-gray-300 rounded p-4 shadow-lg">
                <h3 className="font-semibold mb-3">Candidate Results</h3>
                {candidatesLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : candidates.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    {candidates.map(candidate => (
                      <div key={candidate.id} className="p-4 border rounded hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-3">
                          {candidate.avatar ? (
                            <img 
                              src={candidate.avatar.startsWith('data:') 
                                ? candidate.avatar 
                                : `http://localhost/Job_Portal_Project/backend/${candidate.avatar}`
                              }
                              alt={candidate.full_name}
                              className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.style.display = 'none';
                                const fallback = document.createElement('div');
                                fallback.className = 'w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-blue-400 text-white flex items-center justify-center font-semibold uppercase';
                                fallback.textContent = candidate.full_name?.substring(0, 2) || 'UN';
                                e.target.parentElement.insertBefore(fallback, e.target);
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-blue-400 text-white flex items-center justify-center font-semibold uppercase">
                              {candidate.full_name?.substring(0, 2) || 'UN'}
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{candidate.full_name || 'Unknown'}</div>
                            <div className="text-sm text-gray-500">{candidate.email}</div>
                          </div>
                        </div>
                        <div className="mb-3">
                          <div className="text-sm font-semibold mb-1">Contact</div>
                          <div className="text-sm text-gray-600">{candidate.phone || 'N/A'}</div>
                        </div>
                        <div className="mb-3">
                          <div className="text-sm font-semibold mb-1">Applications</div>
                          <div className="text-sm text-gray-600">
                            Total: {candidate.total_applications || 0} | Accepted: {candidate.accepted_applications || 0}
                          </div>
                          {candidate.applications_to_my_jobs && candidate.applications_to_my_jobs.length > 0 && (
                            <div className="mt-2">
                              <div className="text-xs text-gray-500">Applied to your jobs:</div>
                              {candidate.applications_to_my_jobs.map(app => (
                                <div key={app.id} className="text-xs text-gray-600 mt-1">
                                  • {app.job_title} - <span className={`${
                                    app.status === 'pending' ? 'text-yellow-600' :
                                    app.status === 'accepted' ? 'text-green-600' : 'text-gray-600'
                                  }`}>{app.status}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => {
                              handleViewCandidateProfile(candidate.id);
                            }}
                            className="flex text-xs px-3 py-2 border border-blue-300 text-blue-700 rounded duration-200 hover:scale-105 justify-center transition-shadow-md hover:shadow-lg"
                          >
                            <i className="fas fa-user mr-1"></i>View Profile
                          </button>
                          {candidate.resume_path && (
                            <button
                              onClick={() => handleDownloadResume(candidate.id, candidate.full_name)}
                              className="flex text-center text-xs px-3 py-2 border border-green-300 text-green-700 rounded duration-200 hover:scale-105 transition-shadow-md hover:shadow-lg"
                            >
                              <i className="fas fa-download mr-1"></i>Download Resume
                            </button>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-sm text-gray-500 mt-3">
                          <div>Joined: {new Date(candidate.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <i className="fas fa-users text-4xl mb-4 text-gray-300"></i>
                    <p className="text-lg font-medium mb-2">No candidates yet</p>
                    <p className="text-sm">Candidates will appear here after they apply to your job postings.</p>
                    <p className="text-sm mt-2">Make sure you have active job postings to attract candidates!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === 'settings' && (
            <div>
              {settingsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-4">Loading settings...</p>
                </div>
              ) : settings ? (
                <>
                  <div className="border border-gray-300 rounded p-4 shadow-lg mb-4">
                    <h3 className="font-semibold mb-3">Notification Preferences</h3>
                    <div className="flex flex-col gap-3">
                      <label className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={settings.email_notifications || false}
                          onChange={(e) => setSettings({...settings, email_notifications: e.target.checked})}
                        /> 
                        <span>Email notifications for new applications</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={settings.sms_notifications || false}
                          onChange={(e) => setSettings({...settings, sms_notifications: e.target.checked})}
                        /> 
                        <span>SMS notifications for urgent updates</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={settings.notify_new_applications || false}
                          onChange={(e) => setSettings({...settings, notify_new_applications: e.target.checked})}
                        /> 
                        <span>Notify on new applications</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={settings.notify_profile_views || false}
                          onChange={(e) => setSettings({...settings, notify_profile_views: e.target.checked})}
                        /> 
                        <span>Notify on profile views</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={settings.auto_response || false}
                          onChange={(e) => setSettings({...settings, auto_response: e.target.checked})}
                        /> 
                        <span>Auto-response to applications</span>
                      </label>
                    </div>
                    <div className="mt-4">
                      <button 
                        onClick={() => handleSaveSettings(settings)}
                        className="border border-blue-600 text-blue-600 px-4 py-2 rounded duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                      >
                        Save Notification Settings
                      </button>
                    </div>
                  </div>

                  <div className="border border-gray-300 rounded p-4 shadow-lg mb-4">
                    <h3 className="font-semibold mb-3">Job Posting Settings</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Application Deadline (days)</label>
                        <input 
                          type="number" 
                          className="border border-gray-300 outline-none p-2 rounded w-full"
                          value={settings.application_deadline_days || 30}
                          onChange={(e) => setSettings({...settings, application_deadline_days: parseInt(e.target.value)})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Max Applications Per Job</label>
                        <input 
                          type="number" 
                          className="border border-gray-300 outline-none p-2 rounded w-full"
                          value={settings.max_applications_per_job || 100}
                          onChange={(e) => setSettings({...settings, max_applications_per_job: parseInt(e.target.value)})}
                        />
                      </div>
                      <label className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={settings.company_visible || false}
                          onChange={(e) => setSettings({...settings, company_visible: e.target.checked})}
                        /> 
                        <span>Make company profile publicly visible</span>
                      </label>
                    </div>
                    <div className="mt-4">
                      <button 
                        onClick={() => handleSaveSettings(settings)}
                        className="border border-blue-600 text-blue-600 px-4 py-2 rounded duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                      >
                        Save Job Settings
                      </button>
                    </div>
                  </div>

                  <div className="border border-gray-300 rounded p-4 shadow-lg mb-4">
                    <h3 className="font-semibold mb-3">Change Password</h3>
                    <form onSubmit={handleChangePassword} className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Current Password</label>
                        <div className="relative">
                          <input 
                            type={showPassword.current ? "text" : "password"}
                            className="border border-gray-300 outline-none p-2 rounded w-full pr-10"
                            value={passwordForm.current_password}
                            onChange={(e) => setPasswordForm({...passwordForm, current_password: e.target.value})}
                            placeholder="Enter current password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword({...showPassword, current: !showPassword.current})}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {showPassword.current ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">New Password</label>
                        <div className="relative">
                          <input 
                            type={showPassword.new ? "text" : "password"}
                            className="border border-gray-300 outline-none p-2 rounded w-full pr-10"
                            value={passwordForm.new_password}
                            onChange={(e) => setPasswordForm({...passwordForm, new_password: e.target.value})}
                            placeholder="Enter new password (8+ chars, upper/lowercase, number, symbol)"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword({...showPassword, new: !showPassword.new})}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {showPassword.new ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Confirm New Password</label>
                        <div className="relative">
                          <input 
                            type={showPassword.confirm ? "text" : "password"}
                            className="border border-gray-300 outline-none p-2 rounded w-full pr-10"
                            value={passwordForm.confirm_password}
                            onChange={(e) => setPasswordForm({...passwordForm, confirm_password: e.target.value})}
                            placeholder="Re-enter new password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword({...showPassword, confirm: !showPassword.confirm})}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {showPassword.confirm ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="mt-4">
                        <button 
                          type="submit"
                          disabled={passwordLoading}
                          className="border border-blue-600 bg-blue-600 text-white px-4 py-2 rounded duration-200 hover:scale-105 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {passwordLoading ? 'Changing Password...' : 'Change Password'}
                        </button>
                        <p className="mt-2 text-xs text-gray-500">Password must be at least 8 characters and include uppercase, lowercase, number, and special character.</p>
                      </div>
                    </form>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">No settings available</p>
                </div>
              )}
            </div>
          )}

        </main>
      </div>
      
      {/* Job View/Edit Modal */}
      {showJobModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {isEditMode ? 'Edit Job' : 'Job Details'}
              </h2>
              <button 
                onClick={handleCloseModal}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="p-6">
              {isEditMode ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Job Title</label>
                    <input 
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                      className="w-full border border-gray-300 rounded p-2 outline-none"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Category</label>
                      <select 
                        value={editForm.category}
                        onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                        className="w-full border border-gray-300 rounded p-2 outline-none appearance-none"
                      >
                        <option value="IT & Software">IT & Software</option>
                        <option value="Engineering">Engineering</option>
                        <option value="Design">Design</option>
                        <option value="Marketing">Marketing</option>
                        <option value="Finance">Finance</option>
                        <option value="Human Resources">Human Resources</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Job Type</label>
                      <select 
                        value={editForm.job_type}
                        onChange={(e) => setEditForm({...editForm, job_type: e.target.value})}
                        className="w-full border border-gray-300 rounded p-2 outline-none appearance-none"
                      >
                        <option value="full-time">Full-time</option>
                        <option value="part-time">Part-time</option>
                        <option value="contract">Contract</option>
                        <option value="internship">Internship</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Location</label>
                    <input 
                      type="text"
                      value={editForm.location}
                      onChange={(e) => setEditForm({...editForm, location: e.target.value})}
                      className="w-full border border-gray-300 rounded p-2 outline-none"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Salary Min ($)</label>
                      <input 
                        type="number"
                        value={editForm.salary_min}
                        onChange={(e) => setEditForm({...editForm, salary_min: e.target.value})}
                        className="w-full border border-gray-300 rounded p-2 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Salary Max ($)</label>
                      <input 
                        type="number"
                        value={editForm.salary_max}
                        onChange={(e) => setEditForm({...editForm, salary_max: e.target.value})}
                        className="w-full border border-gray-300 rounded p-2 outline-none"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea 
                      value={editForm.description}
                      onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                      rows={5}
                      className="w-full border border-gray-300 rounded p-2 outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Requirements</label>
                    <textarea 
                      value={editForm.requirements}
                      onChange={(e) => setEditForm({...editForm, requirements: e.target.value})}
                      rows={3}
                      className="w-full border border-gray-300 rounded p-2 outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Status</label>
                    <select 
                      value={editForm.status}
                      onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                      className="w-full border border-gray-300 rounded p-2 outline-none appearance-none"
                    >
                      <option value="active">Active</option>
                      <option value="closed">Closed</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>
                  
                  <div className="flex gap-3 pt-4 w-3/4 mx-auto">
                    <button 
                      onClick={handleSaveEdit}
                      className="flex-1 border border-blue-500 text-blue-500 px-4 py-2 rounded duration-200 hover:scale-105"
                    >
                      Save Changes
                    </button>
                    <button 
                      onClick={handleCloseModal}
                      className="flex-1 border border-red-500 px-4 py-2 rounded text-red-600 duration-200 hover:scale-105"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Company Logo & Job Title Section */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded-full overflow-hidden">
                      {selectedJob.company_logo ? (
                        <img 
                          src={selectedJob.company_logo.startsWith('data:') 
                            ? selectedJob.company_logo 
                            : `http://localhost/Job_Portal_Project/backend/${selectedJob.company_logo}`
                          }
                          alt="Company Logo"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = '/Job Portal-logo-transparent.png';
                          }}
                        />
                      ) : (
                        <i className="fas fa-building text-2xl text-gray-400"></i>
                      )}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold mb-1">{selectedJob.title}</h3>
                      <p className="text-gray-600">{selectedJob.company_name}</p>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="text-blue-700 px-3 py-1 rounded-full text-sm">
                        {selectedJob.category}
                      </span>
                      <span className="text-green-700 px-3 py-1 rounded-full text-sm capitalize">
                        {selectedJob.job_type?.replace('-', ' ')}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        selectedJob.status === 'active' ? 'text-green-700' : 'text-gray-700'
                      }`}>
                        {selectedJob.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 py-4 border-y">
                    <div>
                      <p className="text-sm text-gray-500">Location</p>
                      <p className="font-medium">{selectedJob.location}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Salary Range</p>
                      <p className="font-medium">
                        {selectedJob.salary_min && selectedJob.salary_max 
                          ? `$${selectedJob.salary_min} - $${selectedJob.salary_max}`
                          : 'Negotiable'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Applications</p>
                      <p className="font-medium">{selectedJob.applications_count || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Views</p>
                      <p className="font-medium">{selectedJob.views || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Posted Date</p>
                      <p className="font-medium">{new Date(selectedJob.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Last Updated</p>
                      <p className="font-medium">{new Date(selectedJob.updated_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Description</h4>
                    <p className="text-gray-700 whitespace-pre-line">{selectedJob.description}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Requirements</h4>
                    <p className="text-gray-700 whitespace-pre-line">{selectedJob.requirements}</p>
                  </div>
                  
                  <div className="flex gap-3 pt-4 w-3/12 mx-auto">
                    {/* <button 
                      onClick={() => {
                        setIsEditMode(true);
                        setEditForm({
                          title: selectedJob.title,
                          description: selectedJob.description,
                          requirements: selectedJob.requirements,
                          location: selectedJob.location,
                          salary_min: selectedJob.salary_min || '',
                          salary_max: selectedJob.salary_max || '',
                          job_type: selectedJob.job_type,
                          category: selectedJob.category,
                          status: selectedJob.status
                        });
                      }}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                      <i className="fas fa-edit mr-2"></i>
                      Edit Job
                    </button> */}
                    <button 
                      onClick={handleCloseModal}
                      className="flex-1 border border-red-500 px-4 py-2 rounded duration-200 hover:scale-105 text-red-600"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Application Modal */}
      {showViewApplicationModal && viewingApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold">Application Details</h2>
              <button
                onClick={() => {
                  setShowViewApplicationModal(false);
                  setViewingApplication(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Job Information */}
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold mb-3 text-gray-700">Job Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">Job Title</label>
                    <p className="font-medium">{viewingApplication.job_title}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Status</label>
                    <p>
                      <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                        viewingApplication.status === 'pending' ? 'font-semibold text-yellow-700' :
                        viewingApplication.status === 'reviewed' ? 'font-semibold text-blue-700' :
                        viewingApplication.status === 'accepted' ? 'font-semibold text-green-700' :
                        'font-semibold text-red-700'
                      }`}>
                        {viewingApplication.status}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Applicant Information */}
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold mb-3 text-gray-700">Applicant Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">Name</label>
                    <p className="font-medium">{viewingApplication.applicant_name}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Email</label>
                    <p className="font-medium text-blue-600">{viewingApplication.applicant_email}</p>
                  </div>
                  {viewingApplication.applicant_phone && (
                    <div>
                      <label className="text-sm text-gray-500">Phone</label>
                      <p className="font-medium">{viewingApplication.applicant_phone}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm text-gray-500">Applied Date</label>
                    <p className="font-medium">{new Date(viewingApplication.applied_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Cover Letter */}
              {viewingApplication.cover_letter && (
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-700">Cover Letter</h3>
                  <div className="bg-gray-50 p-4 rounded">
                    <p className="text-gray-700 whitespace-pre-wrap">{viewingApplication.cover_letter}</p>
                  </div>
                </div>
              )}

              {/* Resume */}
              {/* {viewingApplication.resume_path && (
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-700">Resume</h3>
                  <a
                    href={`http://localhost/Job_Portal_Project/backend/api/download-resume.php?application_id=${viewingApplication.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    <i className="fas fa-download mr-2"></i>
                    Download Resume
                  </a>
                </div>
              )} */}

              {/* Action Buttons */}
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold mb-3 text-gray-700">Update Status</h3>
                <div className="flex gap-3">
                  {viewingApplication.status !== 'reviewed' && (
                    <button
                      onClick={() => {
                        handleUpdateApplicationStatus(viewingApplication.id, 'reviewed');
                        setViewingApplication({...viewingApplication, status: 'reviewed'});
                      }}
                      className="px-4 py-2 border border-blue-700 text-blue-700 rounded transition shadow-sm duration-200 hover:shadow-lg hover:scale-105"
                    >
                      Mark as Reviewed
                    </button>
                  )}
                  {viewingApplication.status !== 'accepted' && (
                    <button
                      onClick={() => {
                        handleUpdateApplicationStatus(viewingApplication.id, 'accepted');
                        setViewingApplication({...viewingApplication, status: 'accepted'});
                      }}
                      className="px-4 py-2 border border-green-700 text-green-700 rounded transition shadow-sm duration-200 hover:shadow-lg hover:scale-105"
                    >
                      Accept
                    </button>
                  )}
                  {viewingApplication.status !== 'rejected' && (
                    <button
                      onClick={() => {
                        handleUpdateApplicationStatus(viewingApplication.id, 'rejected');
                        setViewingApplication({...viewingApplication, status: 'rejected'});
                      }}
                      className="px-4 py-2 border border-red-700 text-red-700 rounded transition shadow-sm duration-200 hover:shadow-lg hover:scale-105"
                    >
                      Reject
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="border-t px-6 py-4 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowViewApplicationModal(false);
                  setViewingApplication(null);
                }}
                className="px-6 py-2 border border-red-600 text-red-700 rounded shadow-sm duration-200 hover:shadow-lg hover:scale-105"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Candidate Profile Modal */}
      {showViewCandidateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold">Candidate Profile</h2>
              <button
                onClick={() => {
                  setShowViewCandidateModal(false);
                  setViewingCandidate(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              {candidateLoading ? (
                <div className="text-center py-8">
                  <i className="fas fa-spinner fa-spin text-3xl text-blue-500"></i>
                  <p className="mt-2 text-gray-600">Loading profile...</p>
                </div>
              ) : viewingCandidate ? (
                <>
                  {/* Basic Information */}
                  <div className="border-b pb-4">
                    <h3 className="text-lg font-semibold mb-3 text-gray-700">Basic Information</h3>
                    <div className="flex items-center gap-4 mb-4">
                      {viewingCandidate.user?.avatar ? (
                        <img 
                          src={viewingCandidate.user.avatar.startsWith('data:') 
                            ? viewingCandidate.user.avatar 
                            : `http://localhost/Job_Portal_Project/backend/${viewingCandidate.user.avatar}`
                          } 
                          alt={viewingCandidate.user.full_name}
                          className="w-20 h-20 rounded-full object-cover border-2 border-gray-300"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = '/Job Portal-logo-transparent.png';
                          }}
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                          <i className="fas fa-user text-3xl text-gray-400"></i>
                        </div>
                      )}
                      <div>
                        <h4 className="text-xl font-bold">{viewingCandidate.user?.full_name}</h4>
                        <p className="text-gray-600">@{viewingCandidate.user?.username}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-500">Email</label>
                        <p className="font-medium text-blue-600">{viewingCandidate.user?.email}</p>
                      </div>
                      {viewingCandidate.user?.phone && (
                        <div>
                          <label className="text-sm text-gray-500">Phone</label>
                          <p className="font-medium">{viewingCandidate.user.phone}</p>
                        </div>
                      )}
                      <div>
                        <label className="text-sm text-gray-500">Status</label>
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          viewingCandidate.user?.status === 'active' ? 'font-bold text-green-700' : 'font-bold text-gray-700'
                        }`}>
                          {viewingCandidate.user?.status}
                        </span>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Joined Date</label>
                        <p className="font-medium">{new Date(viewingCandidate.user?.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Professional Information */}
                  {viewingCandidate.profile && (
                    <>
                      <div className="border-b pb-4">
                        <h3 className="text-lg font-semibold mb-3 text-gray-700">Professional Information</h3>
                        <div className="space-y-3">
                          {viewingCandidate.profile.title && (
                            <div>
                              <label className="text-sm text-gray-500">Title</label>
                              <p className="font-medium">{viewingCandidate.profile.title}</p>
                            </div>
                          )}
                          {viewingCandidate.profile.bio && (
                            <div>
                              <label className="text-sm text-gray-500">Bio</label>
                              <p className="text-gray-700">{viewingCandidate.profile.bio}</p>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-4">
                            {viewingCandidate.profile.experience_years !== null && (
                              <div>
                                <label className="text-sm text-gray-500">Experience</label>
                                <p className="font-medium">{viewingCandidate.profile.experience_years} years</p>
                              </div>
                            )}
                            {viewingCandidate.profile.availability && (
                              <div>
                                <label className="text-sm text-gray-500">Availability</label>
                                <p className="font-medium capitalize">{viewingCandidate.profile.availability}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {viewingCandidate.profile.skills && viewingCandidate.profile.skills.length > 0 && (
                        <div className="border-b pb-4">
                          <h3 className="text-lg font-semibold mb-3 text-gray-700">Skills</h3>
                          <div className="flex flex-wrap gap-2">
                            {viewingCandidate.profile.skills.map((skill, index) => (
                              <span key={index} className="px-3 py-1 text-blue-700 rounded-full text-sm">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {viewingCandidate.profile.preferred_locations && viewingCandidate.profile.preferred_locations.length > 0 && (
                        <div className="border-b pb-4">
                          <h3 className="text-lg font-semibold mb-3 text-gray-700">Preferred Locations</h3>
                          <div className="flex flex-wrap gap-2">
                            {viewingCandidate.profile.preferred_locations.map((location, index) => (
                              <span key={index} className="px-3 py-1 text-gray-700 rounded text-sm">
                                <i className="fas fa-map-marker-alt mr-1"></i>{location}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {(viewingCandidate.profile.portfolio_url || viewingCandidate.profile.linkedin_url || viewingCandidate.profile.github_url) && (
                        <div className="border-b pb-4">
                          <h3 className="text-lg font-semibold mb-3 text-gray-700">Links</h3>
                          <div className="space-y-2">
                            {viewingCandidate.profile.portfolio_url && (
                              <a href={viewingCandidate.profile.portfolio_url} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:underline">
                                <i className="fas fa-globe mr-2"></i>Portfolio
                              </a>
                            )}
                            {viewingCandidate.profile.linkedin_url && (
                              <a href={viewingCandidate.profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:underline">
                                <i className="fab fa-linkedin mr-2"></i>LinkedIn
                              </a>
                            )}
                            {viewingCandidate.profile.github_url && (
                              <a href={viewingCandidate.profile.github_url} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:underline">
                                <i className="fab fa-github mr-2"></i>GitHub
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Resume Download */}
                  {/* {viewingCandidate.user?.resume_path && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-gray-700">Resume</h3>
                      <a
                        href={`http://localhost/Job_Portal_Project/backend/api/employer/download-candidate-resume.php?user_id=${viewingCandidate.user.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        <i className="fas fa-download mr-2"></i>
                        Download Resume
                      </a>
                    </div>
                  )} */}
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No profile data available
                </div>
              )}
            </div>

            <div className="border-t px-6 py-4 bg-gray-50 flex justify-end">
              <button
                onClick={() => {
                  setShowViewCandidateModal(false);
                  setViewingCandidate(null);
                }}
                className="px-6 py-2 border border-red-600 text-red-600 rounded duration-200 hover:shadow-lg hover:scale-105 shadow-sm transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmRemoveOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded p-6 shadow-lg w-96">
            <h4 className="font-semibold mb-3">Confirm remove avatar</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Are you sure you want to remove your company avatar? You can upload a new one at any time.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmRemoveOpen(false)} className="px-3 py-2 rounded border">Cancel</button>
              <button
                onClick={handleRemoveAvatar}
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
    </>
  );
}
