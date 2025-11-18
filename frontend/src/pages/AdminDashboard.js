import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import adminService from '../services/adminService';
import { DEFAULT_AVATAR, normalizeAvatar, resolveAvatarSrc, ensureBase64DataUri, isDefaultAvatar } from '../utils/avatar';
import { compressImageFile } from '../utils/image';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const adminDropdownRef = useRef(null);
  
  // Dashboard data states
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Jobs data
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [jobsFilter, setJobsFilter] = useState({ status: '', search: '' });
  
  // Users data
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersFilter, setUsersFilter] = useState({ role: '', status: '', search: '' });
  
  // Applications data
  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationsPage, setApplicationsPage] = useState(1);
  const [applicationsTotal, setApplicationsTotal] = useState(0);
  const [applicationsFilter, setApplicationsFilter] = useState({ status: '', search: '' });
  const [applicationsStatusOptions, setApplicationsStatusOptions] = useState([
    { value: '', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'reviewing', label: 'Reviewing' },
    { value: 'shortlisted', label: 'Shortlisted' },
    { value: 'reviewed', label: 'Reviewed' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'hired', label: 'Hired' }
  ]);
  
  // Analytics data
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState(30);
  
  // Messages data
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesPage, setMessagesPage] = useState(1);
  const [messagesTotal, setMessagesTotal] = useState(0);
  const [messagesFilter, setMessagesFilter] = useState({ type: 'all', status: '', search: '' });
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [viewingMessage, setViewingMessage] = useState(null);

  // Settings state
  const [settings, setSettings] = useState([]);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Add Job modal state
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [newJob, setNewJob] = useState({
    employer_id: '',
    title: '',
    description: '',
    requirements: '',
    location: '',
    salary_min: '',
    salary_max: '',
    job_type: 'full-time',
    category: '',
    status: 'active'
  });
  const [employers, setEmployers] = useState([]);

  // Edit Job modal state
  const [showEditJobModal, setShowEditJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState(null);

  // View Application modal state
  const [showViewApplicationModal, setShowViewApplicationModal] = useState(false);
  const [viewingApplication, setViewingApplication] = useState(null);

  // View Profile modal state
  const [showViewProfileModal, setShowViewProfileModal] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // load persisted adminProfile (name etc.) if present
  const [profile, setProfile] = useState(() => {
    try {
      const raw = localStorage.getItem('adminProfile');
      return raw ? JSON.parse(raw) : { firstName: 'Admin', lastName: 'User' };
    } catch (e) { return { firstName: 'Admin', lastName: 'User' }; }
  });

  // allow hiding/restoring the avatar in the UI (persisted to localStorage)
  const [avatar, setAvatar] = useState(() => {
    try {
      const savedAvatar = localStorage.getItem('adminAvatar');
      if (savedAvatar && savedAvatar !== 'null') {
        return normalizeAvatar(savedAvatar);
      }

      const userRaw = localStorage.getItem('user');
      if (userRaw) {
        const user = JSON.parse(userRaw);
        if (user && user.avatar && user.avatar !== 'null') {
          const normalizedUserAvatar = normalizeAvatar(user.avatar);
          localStorage.setItem('adminAvatar', normalizedUserAvatar);
          return normalizedUserAvatar;
        }
      }

      return DEFAULT_AVATAR;
    } catch (e) {
      return DEFAULT_AVATAR;
    }
  });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const resolvedAvatar = resolveAvatarSrc(avatar);
  const isDefaultAdminAvatar = isDefaultAvatar(avatar);

  // keep avatar preference in localStorage so it survives reloads
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
        window.dispatchEvent(new CustomEvent('adminAvatarChanged', { detail: null }));
      }
    } catch (e) {
      // ignore storage errors
    }
  }, [avatar]);

  // listen for profile/avatar changes made elsewhere
  useEffect(() => {
    function onProfileChanged(e) {
      const d = e && e.detail ? e.detail : null;
      if (d) setProfile(d);
    }

    function onAvatarChanged(e) {
      if (!e) return;
      const detail = e.detail;
      if (detail === undefined) return;
      const normalized = detail ? normalizeAvatar(detail) : DEFAULT_AVATAR;
      setAvatar(prev => (prev === normalized ? prev : normalized));
    }
    
    // Handle user data refresh (after login)
    function onUserDataRefresh() {
      try {
        const userRaw = localStorage.getItem('user');
        const savedAvatar = localStorage.getItem('adminAvatar');
        
        if (savedAvatar && savedAvatar !== 'null') {
          setAvatar(prev => {
            const normalized = normalizeAvatar(savedAvatar);
            return prev === normalized ? prev : normalized;
          });
        } else if (userRaw) {
          const user = JSON.parse(userRaw);
          if (user && user.avatar && user.avatar !== 'null') {
            const normalized = normalizeAvatar(user.avatar);
            setAvatar(prev => (prev === normalized ? prev : normalized));
            localStorage.setItem('adminAvatar', normalized);
          }
        }
      } catch (error) {
        console.error('Error refreshing user data:', error);
      }
    }

    function onStorage(e) {
      // storage events fire in other windows; handle both keys
      if (!e) return;
      if (e.key === 'adminProfile') {
        try { setProfile(e.newValue ? JSON.parse(e.newValue) : { firstName: 'Admin', lastName: 'User' }); } catch (err) {}
      }
      if (e.key === 'adminAvatar') {
        const normalized = e.newValue ? normalizeAvatar(e.newValue) : DEFAULT_AVATAR;
        setAvatar(prev => (prev === normalized ? prev : normalized));
      }
    }

    window.addEventListener('adminProfileChanged', onProfileChanged);
    window.addEventListener('adminAvatarChanged', onAvatarChanged);
    window.addEventListener('userDataRefresh', onUserDataRefresh);
    window.addEventListener('storage', onStorage);
    return () => { 
      window.removeEventListener('adminProfileChanged', onProfileChanged); 
      window.removeEventListener('adminAvatarChanged', onAvatarChanged); 
      window.removeEventListener('userDataRefresh', onUserDataRefresh);
      window.removeEventListener('storage', onStorage); 
    };
  }, []);

  // file input ref for uploading avatar
  const fileInputRef = useRef(null);

  function triggerFileSelect() {
    if (avatarUploading) return;
    if (fileInputRef.current) fileInputRef.current.click();
  }

  async function persistAvatar(avatarData) {
    const payload = ensureBase64DataUri(avatarData);
    if (!payload || typeof payload !== 'string') {
      throw new Error('Invalid avatar data');
    }
    const response = await adminService.uploadAvatar(payload);
    if (!response?.success) {
      const message = response?.message || response?.error || 'Failed to upload avatar';
      throw new Error(message);
    }
    const responseAvatar = response?.data?.avatar_url || payload;
    return normalizeAvatar(responseAvatar);
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
      const compressed = await compressImageFile(file, {
        maxWidth: 600,
        maxHeight: 600,
        maxSizeMB: 0.7,
        quality: 0.8
      });
      const normalizedAvatar = normalizeAvatar(compressed);
      setAvatar(normalizedAvatar);
      const persistedAvatar = await persistAvatar(normalizedAvatar);
      setAvatar(persistedAvatar);
      setToast({ type: 'success', message: 'Avatar updated successfully!' });
    } catch (err) {
      console.error('Admin avatar upload failed:', err);
      setAvatar(previousAvatar);
      const message = err?.message || err?.response?.error || 'Failed to upload avatar';
      setToast({ type: 'error', message });
    } finally {
      setAvatarUploading(false);
      if (input) input.value = '';
    }
  }

  async function confirmRemoveAvatar() {
    if (avatarUploading || isDefaultAdminAvatar) {
      setConfirmRemoveOpen(false);
      return;
    }
    const previousAvatar = avatar;
    try {
      setAvatarUploading(true);
      const fallback = normalizeAvatar(DEFAULT_AVATAR);
      setAvatar(fallback);
      const persistedAvatar = await persistAvatar(fallback);
      setAvatar(persistedAvatar);
      setToast({ type: 'info', message: 'Avatar removed' });
    } catch (err) {
      console.error('Admin avatar removal failed:', err);
      setAvatar(previousAvatar);
      const message = err?.message || err?.response?.error || 'Failed to remove avatar';
      setToast({ type: 'error', message });
    } finally {
      setAvatarUploading(false);
      setConfirmRemoveOpen(false);
    }
  }

  const sectionTitles = {
    dashboard: 'Dashboard Overview',
    jobs: 'Manage Jobs',
    jobseekers: 'Job Seekers Management',
    employers: 'Employers Management',
    applications: 'Job Applications',
    analytics: 'Analytics & Reports',
    messages: 'Messages & Notifications',
    settings: 'System Settings'
  };

  const showSection = (sec) => {
    setActiveSection(sec);
  };
  
  // Load dashboard statistics when dashboard section is active
  useEffect(() => {
    if (activeSection === 'dashboard') {
      loadDashboardStats();
    } else if (activeSection === 'jobs') {
      loadJobs();
    } else if (activeSection === 'jobseekers') {
      loadUsers('job_seeker');
    } else if (activeSection === 'employers') {
      loadUsers('employer');
    } else if (activeSection === 'applications') {
      loadApplications();
    } else if (activeSection === 'analytics') {
      loadAnalytics();
    } else if (activeSection === 'messages') {
      loadMessages();
    } else if (activeSection === 'settings') {
      loadSettings();
    }
  }, [activeSection, jobsPage, jobsFilter, usersPage, usersFilter, applicationsPage, applicationsFilter, messagesPage, messagesFilter, analyticsRange]);

  const handleMessagesFilterChange = (key, value) => {
    setMessagesPage(1);
    setMessagesFilter(prev => ({ ...prev, [key]: value }));
  };

  const handleMessagesSearch = (value) => {
    setMessagesPage(1);
    setMessagesFilter(prev => ({ ...prev, search: value }));
  };

  const handleMarkMessageAsRead = async (messageId) => {
    try {
      const target = messages.find(msg => msg.id === messageId);
      await adminService.markMessageAsRead(messageId);
      setMessages(prev => {
        const updated = prev.map(msg => msg.id === messageId ? { ...msg, status: 'read', read_at: new Date().toISOString() } : msg);
        if (messagesFilter.status === 'unread') {
          return updated.filter(msg => msg.id !== messageId);
        }
        return updated;
      });
      if (messagesFilter.status === 'unread') {
        setMessagesTotal(total => Math.max(0, total - 1));
      }
      if (target?.status === 'unread') {
        setUnreadCount(count => Math.max(0, count - 1));
      }
    } catch (err) {
      console.error('Mark message error:', err);
      setToast({ message: err.error || 'Failed to mark message as read', type: 'error' });
    }
  };

  const handleDeleteMessage = async (messageId) => {
    const confirmed = window.confirm('Delete this message?');
    if (!confirmed) return;
    try {
      const target = messages.find(msg => msg.id === messageId);
      await adminService.deleteMessage(messageId);
      setToast({ message: 'Message deleted', type: 'success' });
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      setMessagesTotal(total => Math.max(0, total - 1));
      if (target?.status === 'unread') {
        setUnreadCount(count => Math.max(0, count - 1));
      }
      if (viewingMessage && viewingMessage.id === messageId) {
        setShowMessageModal(false);
        setViewingMessage(null);
      }
    } catch (err) {
      console.error('Delete message error:', err);
      setToast({ message: err.error || 'Failed to delete message', type: 'error' });
    }
  };

  const handleOpenMessage = async (message) => {
    setViewingMessage(message);
    setShowMessageModal(true);
    if (message.status === 'unread') {
      await handleMarkMessageAsRead(message.id);
      setViewingMessage(prev => prev ? { ...prev, status: 'read', read_at: new Date().toISOString() } : prev);
    }
  };
  
  const loadDashboardStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminService.getDashboardStats();
      if (response.success) {
        setDashboardStats(response.data);
        
        // Update admin avatar if available
        if (response.data.admin_profile && response.data.admin_profile.avatar) {
          const avatarValue = normalizeAvatar(response.data.admin_profile.avatar);
          setAvatar(prev => (prev === avatarValue ? prev : avatarValue));
        }
      } else {
        setError(response.error || 'Failed to load dashboard statistics');
        setToast({ message: 'Failed to load dashboard data', type: 'error' });
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError(err.error || 'Network error occurred');
      setToast({ message: 'Failed to connect to server', type: 'error' });
    } finally {
      setLoading(false);
    }
  };
  
  const loadJobs = async () => {
    setJobsLoading(true);
    try {
      const response = await adminService.getJobs({
        page: jobsPage,
        limit: 10,
        ...jobsFilter
      });
      if (response.success) {
        setJobs(response.data.jobs);
        setJobsTotal(response.data.pagination.total);
      } else {
        setToast({ message: 'Failed to load jobs', type: 'error' });
      }
    } catch (err) {
      console.error('Jobs load error:', err);
      setToast({ message: 'Failed to load jobs', type: 'error' });
    } finally {
      setJobsLoading(false);
    }
  };
  
  const loadUsers = async (role = null) => {
    setUsersLoading(true);
    try {
      const filters = { ...usersFilter };
      if (role) {
        filters.role = role;
      }
      const response = await adminService.getUsers({
        page: usersPage,
        limit: 10,
        ...filters
      });
      if (response.success) {
        setUsers(response.data.users);
        setUsersTotal(response.data.pagination.total);
      } else {
        setToast({ message: 'Failed to load users', type: 'error' });
      }
    } catch (err) {
      console.error('Users load error:', err);
      setToast({ message: 'Failed to load users', type: 'error' });
    } finally {
      setUsersLoading(false);
    }
  };
  
  const loadApplications = async () => {
    setApplicationsLoading(true);
    try {
      const response = await adminService.getApplications({
        page: applicationsPage,
        limit: 10,
        ...applicationsFilter
      });
      if (response.success) {
        setApplications(response.data.applications);
        setApplicationsTotal(response.data.pagination.total);
      } else {
        setToast({ message: 'Failed to load applications', type: 'error' });
      }
    } catch (err) {
      console.error('Applications load error:', err);
      setToast({ message: 'Failed to load applications', type: 'error' });
    } finally {
      setApplicationsLoading(false);
    }
  };
  
  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const response = await adminService.getAnalytics({ range: analyticsRange });
      if (response.success) {
        const data = response.data || {};

        const overallStats = {
          total_jobs: Number(data.jobs_summary?.total_jobs) || 0,
          active_jobs: Number(data.jobs_summary?.active) || 0,
          total_seekers: Number(data.user_summary?.job_seekers) || 0,
          total_employers: Number(data.user_summary?.employers) || 0,
          total_applications: Number(data.applications_summary?.total_applications) || 0,
          pending_applications: Number(data.applications_summary?.pending) || 0,
          accepted_applications: Number(data.applications_summary?.accepted) || 0
        };

        const jobsByDepartmentSource = Array.isArray(data.top_job_categories) && data.top_job_categories.length
          ? data.top_job_categories
          : Array.isArray(data.job_type_distribution)
            ? data.job_type_distribution
            : [];

        const jobsByDepartment = jobsByDepartmentSource.map(item => ({
          department: item.department || item.category || item.job_type || 'Other',
          count: Number(item.job_count ?? item.count) || 0
        }));

        const applicationsByStatus = Array.isArray(data.application_status_chart)
          ? data.application_status_chart.map(item => ({
              status: item.status || 'unknown',
              count: Number(item.count) || 0
            }))
          : [];

        setAnalytics({
          overall_stats: overallStats,
          jobs_by_department: jobsByDepartment,
          applications_by_status: applicationsByStatus,
          job_type_distribution: Array.isArray(data.job_type_distribution) ? data.job_type_distribution : [],
          top_employers: Array.isArray(data.top_employers) ? data.top_employers : [],
          most_applied_jobs: Array.isArray(data.most_applied_jobs) ? data.most_applied_jobs : [],
          raw: data
        });
      } else {
        setToast({ message: 'Failed to load analytics', type: 'error' });
      }
    } catch (err) {
      console.error('Analytics load error:', err);
      setToast({ message: 'Failed to load analytics', type: 'error' });
    } finally {
      setAnalyticsLoading(false);
    }
  };
  
  const loadMessages = async () => {
    setMessagesLoading(true);
    try {
      const response = await adminService.getMessages({
        page: messagesPage,
        limit: 10,
        ...messagesFilter
      });
      if (response.success) {
        setMessages(response.data.messages);
        setMessagesTotal(response.data.pagination.total);
        setUnreadCount(response.data.unread_count || 0);
      } // else do nothing (hide alert)
    } catch (err) {
      console.error('Messages load error:', err);
      // do nothing (hide alert)
    } finally {
      setMessagesLoading(false);
    }
  };
  
  const loadSettings = async () => {
    setSettingsLoading(true);
    try {
      const response = await adminService.getSettings();
      if (response.success) {
        setSettings(response.data.settings || []);
      } // else do nothing (hide alert)
    } catch (err) {
      console.error('Settings load error:', err);
      // do nothing (hide alert)
    } finally {
      setSettingsLoading(false);
    }
  };

  const refreshUnreadCount = useCallback(async () => {
    try {
      const response = await adminService.getMessages({ page: 1, limit: 1 });
      if (response.success) {
        setUnreadCount(response.data.unread_count || 0);
      }
    } catch (err) {
      console.error('Unread count error:', err);
    }
  }, []);

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [refreshUnreadCount]);

  const loadEmployers = async () => {
    try {
      const response = await adminService.getUsers({
        role: 'employer',
        page: 1,
        limit: 100
      });
      if (response.success) {
        setEmployers(response.data.users || []);
      }
    } catch (err) {
      console.error('Employers load error:', err);
    }
  };

  const handleCreateJob = async (e) => {
    e.preventDefault();
    
    if (!newJob.employer_id || !newJob.title) {
      setToast({ message: 'Employer and Title are required', type: 'error' });
      return;
    }

    try {
      const jobData = {
        ...newJob,
        salary_min: newJob.salary_min ? parseFloat(newJob.salary_min) : null,
        salary_max: newJob.salary_max ? parseFloat(newJob.salary_max) : null
      };

      const response = await adminService.createJob(jobData);
      if (response.success) {
        setToast({ message: 'Job created successfully!', type: 'success' });
        setShowAddJobModal(false);
        setNewJob({
          employer_id: '',
          title: '',
          description: '',
          requirements: '',
          location: '',
          salary_min: '',
          salary_max: '',
          job_type: 'full-time',
          category: '',
          status: 'active'
        });
        loadJobs();
      } else {
        setToast({ message: response.error || 'Failed to create job', type: 'error' });
      }
    } catch (err) {
      console.error('Create job error:', err);
      setToast({ message: err.error || 'Failed to create job', type: 'error' });
    }
  };

  const handleEditJob = (job) => {
    setEditingJob({
      id: job.id,
      employer_id: job.employer_id,
      title: job.title,
      description: job.description || '',
      requirements: job.requirements || '',
      location: job.location || '',
      salary_min: job.salary_min || '',
      salary_max: job.salary_max || '',
      job_type: job.job_type || 'full-time',
      category: job.category || '',
      status: job.status || 'active'
    });
    setShowEditJobModal(true);
  };

  const handleUpdateJob = async (e) => {
    e.preventDefault();
    
    if (!editingJob.title) {
      setToast({ message: 'Title is required', type: 'error' });
      return;
    }

    try {
      const jobData = {
        title: editingJob.title,
        description: editingJob.description,
        requirements: editingJob.requirements,
        location: editingJob.location,
        salary_min: editingJob.salary_min ? parseFloat(editingJob.salary_min) : null,
        salary_max: editingJob.salary_max ? parseFloat(editingJob.salary_max) : null,
        job_type: editingJob.job_type,
        category: editingJob.category,
        status: editingJob.status
      };

      const response = await adminService.updateJob(editingJob.id, jobData);
      if (response.success) {
        setToast({ message: 'Job updated successfully!', type: 'success' });
        setShowEditJobModal(false);
        setEditingJob(null);
        loadJobs();
      } else {
        setToast({ message: response.error || 'Failed to update job', type: 'error' });
      }
    } catch (err) {
      console.error('Update job error:', err);
      setToast({ message: err.error || 'Failed to update job', type: 'error' });
    }
  };
  
  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this job?')) return;
    try {
      const response = await adminService.deleteJob(jobId);
      if (response.success) {
        setToast({ message: 'Job deleted successfully', type: 'success' });
        loadJobs();
      } else {
        setToast({ message: response.error || 'Failed to delete job', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Failed to delete job', type: 'error' });
    }
  };
  
  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      const response = await adminService.deleteUser(userId);
      if (response.success) {
        setToast({ message: 'User deleted successfully', type: 'success' });
        if (activeSection === 'jobseekers') {
          loadUsers('job_seeker');
        } else if (activeSection === 'employers') {
          loadUsers('employer');
        }
      } else {
        setToast({ message: response.error || 'Failed to delete user', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Failed to delete user', type: 'error' });
    }
  };
  
  const handleUpdateApplicationStatus = async (appId, newStatus) => {
    try {
      const response = await adminService.updateApplication(appId, { status: newStatus });
      if (response.success) {
        setToast({ message: 'Application status updated', type: 'success' });
        loadApplications();
      } else {
        setToast({ message: response.error || 'Failed to update application', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Failed to update application', type: 'error' });
    }
  };

  const handleViewProfile = async (userId, userRole) => {
    setProfileLoading(true);
    setShowViewProfileModal(true);
    setViewingProfile(null);

    try {
      let profileData;
      
      if (userRole === 'job_seeker') {
        // Fetch job seeker profile
        const response = await fetch(`http://localhost/Job_Portal_Project/backend/api/admin/view-jobseeker-profile.php?user_id=${userId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        const data = await response.json();
        
        if (data.success) {
          profileData = {
            ...data.data.user,
            profile: data.data.profile,
            role: 'job_seeker'
          };
        }
      } else if (userRole === 'employer') {
        // Fetch employer profile
        const response = await fetch(`http://localhost/Job_Portal_Project/backend/api/admin/view-employer-profile.php?user_id=${userId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        const data = await response.json();
        
        if (data.success) {
          profileData = {
            ...data.data.user,
            company_profile: data.data.company_profile,
            role: 'employer'
          };
        }
      }

      setViewingProfile(profileData);
    } catch (error) {
      console.error('Error loading profile:', error);
      setToast({ message: 'Failed to load profile', type: 'error' });
      setShowViewProfileModal(false);
    } finally {
      setProfileLoading(false);
    }
  };

  async function handleDownloadApplicationResume(application) {
    if (!application?.resume_path) {
      setToast({ type: 'error', message: 'No resume available for download' });
      return;
    }

    const parts = application.resume_path.split(/[\\\/]/);
    const filename = parts[parts.length - 1];
    if (!filename) {
      setToast({ type: 'error', message: 'Invalid resume path' });
      return;
    }

    try {
      await adminService.downloadResume(filename);
      setToast({ type: 'success', message: 'Resume download started' });
    } catch (err) {
      console.error('Admin resume download failed:', err);
      const message = err?.message || err?.response?.error || 'Failed to download resume';
      setToast({ type: 'error', message });
    }
  }

  const logout = () => {
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

  // refs for analytics charts
  const monthlyChartRef = useRef(null);
  const industryChartRef = useRef(null);

  useEffect(() => {
    // only initialize charts when analytics section is active
    if (activeSection !== 'analytics') return;

    // lazy import Chart.js (already installed) via static import
    // create sample data for Monthly Job Postings (bar) and Industry Distribution (doughnut)
    const monthlyCtx = monthlyChartRef.current && monthlyChartRef.current.getContext('2d');
    const industryCtx = industryChartRef.current && industryChartRef.current.getContext('2d');

    let monthlyChart, industryChart;
    // dynamic import Chart.js so it's loaded only when needed and works reliably in CRA
    (async () => {
      try {
        const mod = await import('chart.js/auto');
        const Chart = mod && (mod.default || mod);
        // console.log('Chart module loaded', !!Chart, !!monthlyCtx, !!industryCtx);

        if (monthlyCtx) {
          monthlyChart = new Chart(monthlyCtx, {
          type: 'bar',
          data: {
            labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
            datasets: [{
              label: 'Job Postings',
              data: [65, 59, 80, 81, 56, 55, 70, 75, 60, 82, 90, 100],
              backgroundColor: 'rgba(59,130,246,0.6)'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              y: { beginAtZero: true }
            }
          }
        });
        }

        if (industryCtx) {
          industryChart = new Chart(industryCtx, {
          type: 'doughnut',
          data: {
            labels: ['Technology','Design','Marketing','Finance','Other'],
            datasets: [{
              data: [45, 15, 20, 10, 10],
              backgroundColor: ['#3b82f6','#10b981','#f59e0b','#ef4444','#9ca3af']
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'right' }
            }
          }
        });
        }
      } catch (e) {
        // console.warn('Chart.js dynamic import failed', e);
      }
    })();

    return () => {
      try {
        if (monthlyChart) monthlyChart.destroy();
        if (industryChart) industryChart.destroy();
      } catch (e) {}
    };
  }, [activeSection]);

  // close admin dropdown on outside click or Escape
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
      
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100">
        <nav className="bg-white border-b border-gray-300 shadow-lg sticky top-0 z-50">
        <div className="max-w-8xl mx-auto px-4 py-3 flex items-center justify-between h-20">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              <img src="/Job Portal-logo-transparent.png" alt="JobPortal" className="h-24 w-auto object-contain" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative" ref={adminDropdownRef}>
              <button onClick={() => setAdminDropdownOpen((d) => !d)} className="flex items-center gap-2 px-3 py-1 rounded duration-200 hover:scale-105" aria-haspopup="true" aria-expanded={adminDropdownOpen} title="Admin menu">
                {resolvedAvatar ? (
                  <img
                    src={resolvedAvatar}
                    alt="Admin avatar"
                    className="w-10 h-10 rounded-full object-cover border-2 duration-200 hover:scale-105"
                    onError={e => {
                      e.target.onerror = null;
                      e.target.src = resolveAvatarSrc(DEFAULT_AVATAR);
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 border-2 border-gray-200 rounded-full duration-200 hover:scale-105 flex items-center justify-center font-semibold">AU</div>
                )}
                <span className="text-sm font-medium">{profile.firstName} {profile.lastName}</span>
                {/* <i className={`fas fa-chevron-down text-xs transition-transform duration-200 ${adminDropdownOpen ? 'rotate-180' : ''}`}></i> */}
              </button>

              {adminDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded shadow border z-30">
                  <Link to="/admin/profile" className="flex items-center px-4 py-2 hover:bg-gray-100">
                    <i className="fas fa-user mr-3 text-blue-600"></i>
                    Profile Settings
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

            {/* theme toggle removed as requested */}
          </div>
        </div>
      </nav>

      <div className="flex">
          <aside className="w-64 bg-white border-r border-gray-300 shadow-md p-4 mr-6 sticky top-20 z-10 overflow-auto" style={{ maxHeight: 'calc(100vh - 5rem)' }}>
            {/* Profile block at top of sidebar */}
            <div className="sidebar-profile mb-6 flex flex-col items-center">
              <div className="relative w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden mb-2">
                {resolvedAvatar ? (
                  <img
                    src={resolvedAvatar}
                    alt="Admin avatar"
                    className="w-full h-full object-cover"
                    onError={e => {
                      e.target.onerror = null;
                      e.target.src = resolveAvatarSrc(DEFAULT_AVATAR);
                    }}
                  />
                ) : (
                  <i className="fas fa-user text-2xl"></i>
                )}
                {avatarUploading && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                    <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
                  </div>
                )}
              </div>
              <div className="text-center">
                <div className="font-medium text-gray-900 dark:text-white">{profile.firstName} {profile.lastName}</div>
                <div className="text-xs text-gray-500">Administrator</div>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <input ref={fileInputRef} onChange={handleFileSelected} type="file" accept="image/*" className="hidden" disabled={avatarUploading} />
                  <button
                    onClick={triggerFileSelect}
                    disabled={avatarUploading}
                    className={`text-xs ${avatarUploading ? 'text-gray-400 cursor-not-allowed' : 'text-blue-500 hover:underline'}`}
                  >
                    {avatarUploading ? 'Uploading...' : 'Upload photo'}
                  </button>
                  <button
                    onClick={() => setConfirmRemoveOpen(true)}
                    disabled={avatarUploading || isDefaultAdminAvatar}
                    className={`text-xs ${avatarUploading || isDefaultAdminAvatar ? 'text-gray-400 cursor-not-allowed' : 'text-red-500 hover:underline'}`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>

            <ul className="space-y-2">
              {/* <li>
                <Link to="/admin/profile" className={`w-full flex items-center gap-3 p-2 rounded hover:bg-gray-100 hover:shadow-lg duration-200 scale-105`}>
                  <i className="fas fa-user-circle"></i>
                  <span>Profile</span>
                </Link>
              </li> */}
              <li>
                <button onClick={() => showSection('dashboard')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='dashboard' ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-700' : 'hover:bg-gray-100 hover:shadow-lg duration-200 scale-105'}`}>
                  <i className="fas fa-tachometer-alt"></i>
                  <span>Dashboard</span>
                </button>
              </li>
              <li>
                <button onClick={() => showSection('jobs')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='jobs' ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-700' : 'hover:bg-gray-100 hover:shadow-lg duration-200 scale-105'}`}>
                  <i className="fas fa-briefcase"></i>
                  <span>Manage Jobs</span>
                </button>
              </li>
              <li>
                <button onClick={() => showSection('jobseekers')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='jobseekers' ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-700' : 'hover:bg-gray-100 hover:shadow-lg duration-200 scale-105'}`}>
                  <i className="fas fa-users"></i>
                  <span>Job Seekers</span>
                </button>
              </li>
              <li>
                <button onClick={() => showSection('employers')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='employers' ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-700' : 'hover:bg-gray-100 hover:shadow-lg duration-200 scale-105'}`}>
                  <i className="fas fa-building"></i>
                  <span>Employers</span>
                </button>
              </li>
              <li>
                <button onClick={() => showSection('applications')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='applications' ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-700' : 'hover:bg-gray-100 hover:shadow-lg duration-200 scale-105'}`}>
                  <i className="fas fa-file-alt"></i>
                  <span>Applications</span>
                </button>
              </li>
              <li>
                <button onClick={() => showSection('analytics')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='analytics' ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-700' : 'hover:bg-gray-100 hover:shadow-lg duration-200 scale-105'}`}>
                  <i className="fas fa-chart-bar"></i>
                  <span>Analytics</span>
                </button>
              </li>
              <li>
                <button onClick={() => showSection('messages')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='messages' ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-700' : 'hover:bg-gray-100 hover:shadow-lg duration-200 scale-105'}`}>
                  <i className="fas fa-envelope"></i>
                  <span>Messages</span>
                  {unreadCount > 0 && (
                    <span className="ml-auto inline-flex min-w-[1.5rem] justify-center rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              </li>
              <li>
                <button onClick={() => showSection('settings')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='settings' ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-700' : 'hover:bg-gray-100 hover:shadow-lg duration-200 scale-105'}`}>
                  <i className="fas fa-cog"></i>
                  <span>Settings</span>
                </button>
              </li>
            </ul>
          </aside>

        <main className="flex-1 p-6">
          {/* Shared section header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold">{sectionTitles[activeSection]}</h2>
            </div>
          </div>

          {/* Dashboard overview */}
          {activeSection === 'dashboard' && (
            <div>
              {loading && (
                <div className="text-center py-8">
                  <i className="fas fa-spinner fa-spin text-3xl text-blue-500"></i>
                  <p className="mt-2 text-gray-600">Loading dashboard data...</p>
                </div>
              )}
              
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                  <i className="fas fa-exclamation-triangle mr-2"></i>
                  {error}
                </div>
              )}
              
              {!loading && dashboardStats && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <div className="border border-gray-300 shadow-lg p-4 rounded bg-gradient-to-br from-blue-50 to-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-500">Total Jobs</div>
                          <div className="text-2xl font-bold text-blue-600">
                            {dashboardStats.jobs?.total || 0}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Active: {dashboardStats.jobs?.active || 0}
                          </div>
                        </div>
                        <i className="fas fa-briefcase text-3xl text-blue-400"></i>
                      </div>
                    </div>
                    
                    <div className="border border-gray-300 shadow-lg p-4 rounded bg-gradient-to-br from-green-50 to-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-500">Job Seekers</div>
                          <div className="text-2xl font-bold text-green-600">
                            {dashboardStats.users?.job_seekers || 0}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Active: {dashboardStats.users?.active || 0}
                          </div>
                        </div>
                        <i className="fas fa-users text-3xl text-green-400"></i>
                      </div>
                    </div>
                    
                    <div className="border border-gray-300 shadow-lg p-4 rounded bg-gradient-to-br from-purple-50 to-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-500">Employers</div>
                          <div className="text-2xl font-bold text-purple-600">
                            {dashboardStats.users?.employers || 0}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Total Users: {dashboardStats.users?.total || 0}
                          </div>
                        </div>
                        <i className="fas fa-building text-3xl text-purple-400"></i>
                      </div>
                    </div>
                    
                    <div className="border border-gray-300 shadow-lg p-4 rounded bg-gradient-to-br from-orange-50 to-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-500">Applications</div>
                          <div className="text-2xl font-bold text-orange-600">
                            {dashboardStats.applications?.total || 0}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Pending: {dashboardStats.applications?.pending || 0}
                          </div>
                        </div>
                        <i className="fas fa-file-alt text-3xl text-orange-400"></i>
                      </div>
                    </div>
                  </div>
                  
                  {/* Recent Jobs from API */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                    <div className="col-span-2 p-4 border border-gray-300 shadow-lg rounded">
                      <h3 className="font-semibold text-lg text-bold mb-4">Recent Job Postings</h3>
                      <div className="overflow-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="text-sm text-gray-500">
                              <th className="py-2">Job Title</th>
                              <th className="py-2">Company</th>
                              <th className="py-2">Status</th>
                              <th className="py-2">Posted</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dashboardStats.recent_jobs && dashboardStats.recent_jobs.length > 0 ? (
                              dashboardStats.recent_jobs.map((job) => (
                                <tr key={job.id} className="border-t">
                                  <td className="py-3">{job.title}</td>
                                  <td>{job.employer_name || 'N/A'}</td>
                                  <td>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                      job.status === 'active' ? ' text-green-700' :
                                      job.status === 'inactive' ? ' text-gray-700' :
                                      ' text-red-700'
                                    }`}>
                                      {job.status}
                                    </span>
                                  </td>
                                  <td className="text-sm text-gray-500">
                                    {new Date(job.created_at).toLocaleDateString()}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="4" className="py-4 text-center text-gray-500">
                                  No recent jobs
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="border border-gray-300 p-6 rounded shadow-lg">
                      <h3 className="font-semibold text-2xl mb-4">Quick Actions</h3>
                      <div className="flex flex-col gap-3">
                        <button 
                          onClick={() => setActiveSection('jobs')}
                          className="py-2 px-3 rounded bg-blue-50 shadow-md border border-blue-200 text-blue-700 duration-200 transform hover:scale-105">
                          <i className="fas fa-briefcase mr-2"></i> Manage Jobs
                        </button>
                        <button 
                          onClick={() => setActiveSection('jobseekers')}
                          className="py-2 px-3 rounded bg-blue-50 shadow-md border border-blue-200 text-blue-700 duration-200 transform hover:scale-105">
                          <i className="fas fa-users mr-2"></i> View Job Seekers
                        </button>
                        <button 
                          onClick={() => setActiveSection('analytics')}
                          className="py-2 px-3 rounded bg-blue-50 shadow-md border border-blue-200 text-blue-700 duration-200 transform hover:scale-105">
                          <i className="fas fa-chart-line mr-2"></i> View Analytics
                        </button>
                        <button 
                          onClick={() => setActiveSection('messages')}
                          className="py-2 px-3 rounded bg-blue-50 shadow-md border border-blue-200 text-blue-700 duration-200 transform hover:scale-105">
                          <i className="fas fa-envelope mr-2"></i> Messages
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Jobs Management */}
          {activeSection === 'jobs' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={() => {
                    setShowAddJobModal(true);
                    loadEmployers();
                  }}
                  className="border border-blue-500 text-blue-500 px-4 py-2 rounded shadow-lg duration-200 hover:scale-105"
                >
                  <i className="fas fa-plus mr-2"></i>Add New Job
                </button>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <input 
                  type="text" 
                  placeholder="Search jobs..." 
                  className="border p-2 rounded flex-1 border-gray-500 focus:outline-none"
                  value={jobsFilter.search}
                  onChange={(e) => {
                    setJobsFilter({ ...jobsFilter, search: e.target.value });
                    setJobsPage(1);
                  }}
                />
                <select 
                  className="border border-gray-500 appearance-none outline-none p-2 rounded w-40"
                  value={jobsFilter.status}
                  onChange={(e) => {
                    setJobsFilter({ ...jobsFilter, status: e.target.value });
                    setJobsPage(1);
                  }}
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              {jobsLoading ? (
                <div className="text-center py-8">
                  <i className="fas fa-spinner fa-spin text-3xl text-blue-500"></i>
                  <p className="mt-2 text-gray-600">Loading jobs...</p>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded shadow overflow-auto border border-gray-300 shadow-lg">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-sm font-bold text-gray-500 border-b">
                          <th className="py-3">Job Title</th>
                          <th className="py-3">Company</th>
                          <th className="py-3">Department</th>
                          <th className="py-3">Type</th>
                          <th className="py-3">Views</th>
                          <th className="py-3">Applications</th>
                          <th className="py-3">Status</th>
                          <th className="py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobs.length > 0 ? (
                          jobs.map((job) => (
                            <tr key={job.id} className="border-t hover:bg-gray-50">
                              <td className="py-3 font-medium">{job.title}</td>
                              <td className="py-3 text-sm text-gray-600">{job.employer_name || 'N/A'}</td>
                              <td className="py-3 text-sm">{job.category || 'N/A'}</td>
                              <td className="py-3 text-sm">
                                <span className="px-2 py-1 text-blue-700 rounded text-xs">
                                  {job.job_type || 'N/A'}
                                </span>
                              </td>
                              <td className="py-3 text-sm">{job.views || 0}</td>
                              <td className="py-3 text-sm">{job.applications_count || 0}</td>
                              <td className="py-3">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  job.status === 'active' ? ' text-green-700' :
                                  job.status === 'inactive' ? ' text-gray-700' :
                                  'text-red-700'
                                }`}>
                                  {job.status}
                                </span>
                              </td>
                              <td className="py-3">
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => handleEditJob(job)}
                                    className="p-2 text-blue-500 duration-200 hover:scale-105 rounded"
                                    title="Edit">
                                    <i className="fas fa-edit"></i>
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteJob(job.id)}
                                    className="p-2 text-red-500 duration-200 hover:scale-105 rounded"
                                    title="Delete">
                                    <i className="fas fa-trash-alt"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="8" className="py-8 text-center text-gray-500">
                              No jobs found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Pagination */}
                  {jobsTotal > 10 && (
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        Showing {((jobsPage - 1) * 10) + 1} to {Math.min(jobsPage * 10, jobsTotal)} of {jobsTotal} jobs
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setJobsPage(p => Math.max(1, p - 1))}
                          disabled={jobsPage === 1}
                          className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">
                          Previous
                        </button>
                        <span className="px-3 py-1">Page {jobsPage} of {Math.ceil(jobsTotal / 10)}</span>
                        <button 
                          onClick={() => setJobsPage(p => p + 1)}
                          disabled={jobsPage >= Math.ceil(jobsTotal / 10)}
                          className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Job Seekers Management */}
          {activeSection === 'jobseekers' && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <input 
                  type="text" 
                  placeholder="Search job seekers..." 
                  className="border p-2 rounded flex-1 border-gray-500 focus:outline-none"
                  value={usersFilter.search}
                  onChange={(e) => {
                    setUsersFilter({ ...usersFilter, search: e.target.value });
                    setUsersPage(1);
                  }}
                />
                <select 
                  className="border border-gray-500 appearance-none outline-none p-2 rounded w-40"
                  value={usersFilter.status}
                  onChange={(e) => {
                    setUsersFilter({ ...usersFilter, status: e.target.value });
                    setUsersPage(1);
                  }}
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {usersLoading ? (
                <div className="text-center py-8">
                  <i className="fas fa-spinner fa-spin text-3xl text-blue-500"></i>
                  <p className="mt-2 text-gray-600">Loading job seekers...</p>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded shadow overflow-auto border border-gray-300 shadow-lg">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-sm font-bold text-gray-500 border-b">
                          <th className="py-3">Name</th>
                          <th className="py-3">Email</th>
                          <th className="py-3">Username</th>
                          <th className="py-3">Status</th>
                          <th className="py-3">Joined</th>
                          <th className="py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.length > 0 ? (
                          users.map((user) => (
                            <tr key={user.id} className="border-t hover:bg-gray-50">
                              <td className="py-3 font-medium">{user.full_name}</td>
                              <td className="py-3 text-sm text-gray-600">{user.email}</td>
                              <td className="py-3 text-sm">{user.username}</td>
                              <td className="py-3">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  user.status === 'active' ? 'text-green-700' : 'text-gray-700'
                                }`}>
                                  {user.status}
                                </span>
                              </td>
                              <td className="py-3 text-sm text-gray-600">
                                {new Date(user.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-3">
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => handleViewProfile(user.id, 'job_seeker')}
                                    className="p-2 text-blue-600 duration-200 hover:scale-105 rounded"
                                    title="View Profile">
                                    <i className="fas fa-eye"></i>
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="p-2 text-red-500 duration-200 hover:scale-105 rounded"
                                    title="Delete">
                                    <i className="fas fa-trash-alt"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="6" className="py-8 text-center text-gray-500">
                              No job seekers found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {usersTotal > 10 && (
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        Showing {((usersPage - 1) * 10) + 1} to {Math.min(usersPage * 10, usersTotal)} of {usersTotal} job seekers
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                          disabled={usersPage === 1}
                          className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">
                          Previous
                        </button>
                        <span className="px-3 py-1">Page {usersPage}</span>
                        <button 
                          onClick={() => setUsersPage(p => p + 1)}
                          disabled={usersPage >= Math.ceil(usersTotal / 10)}
                          className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Employers Management - using same component but different filter */}
          {activeSection === 'employers' && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <input 
                  type="text" 
                  placeholder="Search employers..." 
                  className="border p-2 rounded flex-1 border-gray-500 focus:outline-none"
                  value={usersFilter.search}
                  onChange={(e) => {
                    setUsersFilter({ ...usersFilter, search: e.target.value });
                    setUsersPage(1);
                  }}
                />
                <select 
                  className="border border-gray-500 appearance-none outline-none p-2 rounded w-40"
                  value={usersFilter.status}
                  onChange={(e) => {
                    setUsersFilter({ ...usersFilter, status: e.target.value });
                    setUsersPage(1);
                  }}
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {usersLoading ? (
                <div className="text-center py-8">
                  <i className="fas fa-spinner fa-spin text-3xl text-blue-500"></i>
                  <p className="mt-2 text-gray-600">Loading employers...</p>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded shadow overflow-auto border border-gray-300 shadow-lg">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-sm font-bold text-gray-500 border-b">
                          <th className="py-3">Company Name</th>
                          <th className="py-3">Email</th>
                          <th className="py-3">Username</th>
                          <th className="py-3">Status</th>
                          <th className="py-3">Joined</th>
                          <th className="py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.length > 0 ? (
                          users.map((user) => (
                            <tr key={user.id} className="border-t hover:bg-gray-50">
                              <td className="py-3 font-medium">{user.full_name}</td>
                              <td className="py-3 text-sm text-gray-600">{user.email}</td>
                              <td className="py-3 text-sm">{user.username}</td>
                              <td className="py-3">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  user.status === 'active' ? 'text-green-700' : 'text-gray-700'
                                }`}>
                                  {user.status}
                                </span>
                              </td>
                              <td className="py-3 text-sm text-gray-600">
                                {new Date(user.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-3">
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => handleViewProfile(user.id, 'employer')}
                                    className="p-2 text-blue-600 duration-200 hover:scale-105 rounded"
                                    title="View Profile">
                                    <i className="fas fa-eye"></i>
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="p-2 text-red-500 duration-200 hover:scale-105 rounded"
                                    title="Delete">
                                    <i className="fas fa-trash-alt"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="6" className="py-8 text-center text-gray-500">
                              No employers found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {usersTotal > 10 && (
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        Showing {((usersPage - 1) * 10) + 1} to {Math.min(usersPage * 10, usersTotal)} of {usersTotal} employers
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                          disabled={usersPage === 1}
                          className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">
                          Previous
                        </button>
                        <span className="px-3 py-1">Page {usersPage}</span>
                        <button 
                          onClick={() => setUsersPage(p => p + 1)}
                          disabled={usersPage >= Math.ceil(usersTotal / 10)}
                          className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Applications Placeholder - for now */}
          {activeSection === 'applications' && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <input 
                  type="text" 
                  placeholder="Search applications..." 
                  className="border p-2 rounded flex-1 border-gray-500 focus:outline-none"
                  value={applicationsFilter.search}
                  onChange={(e) => {
                    setApplicationsFilter({ ...applicationsFilter, search: e.target.value });
                    setApplicationsPage(1);
                  }}
                />
                <select 
                  className="border border-gray-500 appearance-none outline-none p-2 rounded w-40"
                  value={applicationsFilter.status}
                  onChange={(e) => {
                    setApplicationsFilter({ ...applicationsFilter, status: e.target.value });
                    setApplicationsPage(1);
                  }}
                >
                  {applicationsStatusOptions.map(option => (
                    <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              {applicationsLoading ? (
                <div className="text-center py-8">
                  <i className="fas fa-spinner fa-spin text-3xl text-blue-500"></i>
                  <p className="mt-2 text-gray-600">Loading applications...</p>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded shadow overflow-auto border border-gray-300 shadow-lg">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-sm font-bold text-gray-500 border-b">
                          <th className="py-3">Job Title</th>
                          <th className="py-3">Applicant</th>
                          <th className="py-3">Company</th>
                          <th className="py-3">Status</th>
                          <th className="py-3">Applied Date</th>
                          <th className="py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {applications.length > 0 ? (
                          applications.map((app) => (
                            <tr key={app.id} className="border-t hover:bg-gray-50">
                              <td className="py-3 font-medium">{app.job_title}</td>
                              <td className="py-3 text-sm text-gray-600">{app.seeker_name}</td>
                              <td className="py-3 text-sm">{app.employer_name || 'N/A'}</td>
                              <td className="py-3">
                                <select 
                                  value={app.status}
                                  onChange={(e) => handleUpdateApplicationStatus(app.id, e.target.value)}
                                  className={`px-2 py-1 rounded text-xs font-medium border outline-none ${
                                    app.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200 outline-none' :
                                    app.status === 'reviewing' ? 'bg-blue-50 text-blue-700 border-blue-200 outline-none' :
                                    app.status === 'shortlisted' ? 'bg-purple-50 text-purple-700 border-purple-200 outline-none' :
                                    app.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200 outline-none' :
                                    app.status === 'reviewed' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 outline-none' :
                                    app.status === 'accepted' ? 'bg-green-50 text-green-700 border-green-200 outline-none' :
                                    app.status === 'hired' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 outline-none' :
                                    'bg-gray-50 text-gray-700 border-gray-200 outline-none'
                                  }`}>
                                  {applicationsStatusOptions.filter(option => option.value).map(option => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-3 text-sm text-gray-600">
                                {new Date(app.applied_at).toLocaleDateString()}
                              </td>
                              <td className="py-3">
                                <button 
                                  onClick={() => {
                                    setViewingApplication(app);
                                    setShowViewApplicationModal(true);
                                  }}
                                  className="p-2 text-blue-500 duration-200 hover:scale-105 rounded"
                                  title="View Details">
                                  <i className="fas fa-eye"></i>
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="6" className="py-8 text-center text-gray-500">
                              No applications found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {applicationsTotal > 10 && (
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        Showing {((applicationsPage - 1) * 10) + 1} to {Math.min(applicationsPage * 10, applicationsTotal)} of {applicationsTotal} applications
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setApplicationsPage(p => Math.max(1, p - 1))}
                          disabled={applicationsPage === 1}
                          className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">
                          Previous
                        </button>
                        <span className="px-3 py-1">Page {applicationsPage}</span>
                        <button 
                          onClick={() => setApplicationsPage(p => p + 1)}
                          disabled={applicationsPage >= Math.ceil(applicationsTotal / 10)}
                          className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Keep existing analytics, messages and settings sections */}
          {activeSection === 'analytics' && (
            <div>
              <div className="border border-gray-300 p-4 rounded shadow-lg mb-6">
                <h3 className="font-semibold text-lg mb-4">Select Date Range</h3>
                <select 
                  className="border border-gray-500 p-2 rounded w-full md:w-64 outline-none appearance-none"
                  value={analyticsRange}
                  onChange={(e) => setAnalyticsRange(parseInt(e.target.value))}>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="60">Last 60 days</option>
                  <option value="90">Last 90 days</option>
                </select>
              </div>
              
              {analyticsLoading ? (
                <div className="text-center py-8">
                  <i className="fas fa-spinner fa-spin text-3xl text-blue-500"></i>
                  <p className="mt-2 text-gray-600">Loading analytics...</p>
                </div>
              ) : analytics ? (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="border border-gray-300 shadow-lg p-4 rounded bg-gradient-to-br from-blue-50 to-white">
                      <h4 className="text-sm text-gray-500 mb-2">Total Jobs</h4>
                      <p className="text-2xl font-bold text-blue-600">{analytics.overall_stats?.total_jobs || 0}</p>
                      <p className="text-xs text-gray-500 mt-1">Active: {analytics.overall_stats?.active_jobs || 0}</p>
                    </div>
                    <div className="border border-gray-300 shadow-lg p-4 rounded bg-gradient-to-br from-green-50 to-white">
                      <h4 className="text-sm text-gray-500 mb-2">Total Seekers</h4>
                      <p className="text-2xl font-bold text-green-600">{analytics.overall_stats?.total_seekers || 0}</p>
                    </div>
                    <div className="border border-gray-300 shadow-lg p-4 rounded bg-gradient-to-br from-purple-50 to-white">
                      <h4 className="text-sm text-gray-500 mb-2">Total Applications</h4>
                      <p className="text-2xl font-bold text-purple-600">{analytics.overall_stats?.total_applications || 0}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border border-gray-300 p-4 rounded shadow-lg">
                      <h3 className="font-semibold text-lg mb-4">Jobs by Department</h3>
                      {analytics.jobs_by_department && analytics.jobs_by_department.length > 0 ? (
                        <ul className="space-y-2">
                          {analytics.jobs_by_department.map((dept, idx) => (
                            <li key={idx} className="flex justify-between items-center py-2 border-b">
                              <span>{dept.department}</span>
                              <span className="font-bold text-blue-600">{dept.count}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-500">No data available</p>
                      )}
                    </div>
                    
                    <div className="border border-gray-300 p-4 rounded shadow-lg">
                      <h3 className="font-semibold text-lg mb-4">Applications by Status</h3>
                      {analytics.applications_by_status && analytics.applications_by_status.length > 0 ? (
                        <ul className="space-y-2">
                          {analytics.applications_by_status.map((stat, idx) => (
                            <li key={idx} className="flex justify-between items-center py-2 border-b">
                              <span className="capitalize">{stat.status}</span>
                              <span className="font-bold text-purple-600">{stat.count}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-500">No data available</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No analytics data available
                </div>
              )}
            </div>
          )}

          {/* Messages Section */}
          {activeSection === 'messages' && (
            <div className="border border-gray-300 p-6 rounded shadow-lg">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-semibold">Inbox</h3>
                  <p className="text-sm text-gray-500">{unreadCount > 0 ? `${unreadCount} unread ${unreadCount === 1 ? 'message' : 'messages'}` : 'All caught up!'}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <select
                    className="border border-gray-300 rounded px-3 py-2 text-sm outline-none appearance-none"
                    value={messagesFilter.type}
                    onChange={(e) => handleMessagesFilterChange('type', e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="inbox">Inbox</option>
                    <option value="sent">Sent</option>
                  </select>
                  <select
                    className="border border-gray-300 rounded px-3 py-2 text-sm outline-none appearance-none"
                    value={messagesFilter.status}
                    onChange={(e) => handleMessagesFilterChange('status', e.target.value)}
                  >
                    <option value="">All Status</option>
                    <option value="unread">Unread</option>
                    <option value="read">Read</option>
                  </select>
                  <input
                    type="text"
                    className="border border-gray-300 rounded px-3 py-2 text-sm outline-none appearance-none"
                    value={messagesFilter.search || ''}
                    onChange={(e) => handleMessagesSearch(e.target.value)}
                    placeholder="Search subject or sender"
                  />
                </div>
              </div>

              {messagesLoading ? (
                <div className="py-12 text-center text-gray-500">
                  <i className="fas fa-spinner fa-spin text-2xl mb-2 text-blue-500"></i>
                  <p>Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  <i className="fas fa-inbox text-4xl mb-2"></i>
                  <p>No messages found</p>
                </div>
              ) : (
                <div className="relative overflow-x-auto">
                  <table className="w-full table-fixed border border-gray-200 rounded">
                    <thead className="bg-gray-50 text-left text-sm text-gray-600">
                      <tr>
                        <th className="px-4 py-3 w-2/5">Subject</th>
                        <th className="px-4 py-3 w-1/5">From</th>
                        <th className="px-4 py-3 w-24">Status</th>
                        <th className="px-4 py-3 w-1/5">Received</th>
                        <th className="px-4 py-3 w-40 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-gray-700">
                      {messages.map((msg) => {
                        const createdAt = msg.created_at ? new Date(msg.created_at) : null;
                        return (
                          <tr
                            key={msg.id}
                            className={`border-t border-gray-200 cursor-pointer transition hover:bg-blue-50/60 ${msg.status === 'unread' ? 'bg-blue-50/40' : ''}`}
                            onClick={() => handleOpenMessage(msg)}
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis" title={msg.subject}>{msg.subject}</div>
                              <div className="text-xs text-gray-500 mt-1 overflow-hidden text-ellipsis whitespace-nowrap">{msg.message}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium">{msg.sender_name || 'System'}</div>
                              <div className="text-xs text-gray-500">{msg.sender_email || 'noreply@jobportal.com'}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${msg.status === 'unread' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                {msg.status === 'unread' ? 'Unread' : 'Read'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {createdAt ? createdAt.toLocaleString() : '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex flex-wrap md:flex-nowrap justify-end gap-2">
                                {msg.status === 'unread' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMarkMessageAsRead(msg.id);
                                    }}
                                    className="inline-flex items-center gap-1 rounded border border-blue-500 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 whitespace-nowrap"
                                  >
                                    <i className="fas fa-check"></i>
                                    Mark Read
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteMessage(msg.id);
                                  }}
                                  className="inline-flex items-center gap-1 rounded border border-red-500 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 whitespace-nowrap"
                                >
                                  <i className="fas fa-trash"></i>
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {messagesTotal > 10 && (
                <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm text-gray-600">
                  <div>
                    Showing {((messagesPage - 1) * 10) + 1} to {Math.min(messagesPage * 10, messagesTotal)} of {messagesTotal} messages
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMessagesPage((p) => Math.max(1, p - 1))}
                      disabled={messagesPage === 1}
                      className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1">Page {messagesPage}</span>
                    <button
                      onClick={() => setMessagesPage((p) => p + 1)}
                      disabled={messagesPage >= Math.ceil(messagesTotal / 10)}
                      className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Settings Section */}
          {activeSection === 'settings' && (
            <div className="border border-gray-300 p-8 rounded shadow-lg text-center">
              <i className="fas fa-cog text-6xl text-gray-300 mb-4"></i>
              <h2 className="text-2xl font-bold text-gray-700 mb-2">System Settings</h2>
              <p className="text-gray-500 mb-4">Coming Soon</p>
              <p className="text-sm text-gray-400">Settings configuration panel is under development</p>
            </div>
          )}



        </main>
      </div>
    </div>

    {confirmRemoveOpen && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
          <h3 className="text-lg font-semibold mb-2">Remove avatar?</h3>
          <p className="text-sm text-gray-600 mb-4">This will revert to the default admin avatar.</p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmRemoveOpen(false)}
              className="px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmRemoveAvatar}
              disabled={avatarUploading}
              className={`px-3 py-2 rounded border ${avatarUploading ? 'border-gray-300 text-gray-400 cursor-not-allowed' : 'border-red-600 bg-red-600 text-white hover:bg-red-700'}`}
            >
              {avatarUploading ? 'Removing...' : 'Remove'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Add Job Modal */}
    {showAddJobModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
            <h2 className="text-2xl font-bold">Add New Job</h2>
            <button
              onClick={() => setShowAddJobModal(false)}
              className="text-gray-500 text-2xl"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <form onSubmit={handleCreateJob} className="p-6">
            <div className="space-y-4">
              {/* Employer Selection */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Employer <span className="text-red-500">*</span>
                </label>
                <select
                  value={newJob.employer_id}
                  onChange={(e) => setNewJob({ ...newJob, employer_id: e.target.value })}
                  className="w-full border border-gray-300 p-2 rounded outline-none appearance-none"
                  required
                >
                  <option value="">Select Employer</option>
                  {employers.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Job Title */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Job Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newJob.title}
                  onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                  className="w-full border border-gray-300 p-2 rounded focus:outline-none"
                  placeholder="e.g. Senior Web Developer"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold mb-1">Description</label>
                <textarea
                  value={newJob.description}
                  onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                  className="w-full border border-gray-300 p-2 rounded focus:outline-none"
                  rows="4"
                  placeholder="Job description..."
                ></textarea>
              </div>

              {/* Requirements */}
              <div>
                <label className="block text-sm font-semibold mb-1">Requirements</label>
                <textarea
                  value={newJob.requirements}
                  onChange={(e) => setNewJob({ ...newJob, requirements: e.target.value })}
                  className="w-full border border-gray-300 p-2 rounded focus:outline-none"
                  rows="3"
                  placeholder="Job requirements..."
                ></textarea>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-semibold mb-1">Location</label>
                <input
                  type="text"
                  value={newJob.location}
                  onChange={(e) => setNewJob({ ...newJob, location: e.target.value })}
                  className="w-full border border-gray-300 p-2 rounded focus:outline-none"
                  placeholder="e.g. Phnom Penh, Cambodia"
                />
              </div>

              {/* Salary Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Min Salary ($)</label>
                  <input
                    type="number"
                    value={newJob.salary_min}
                    onChange={(e) => setNewJob({ ...newJob, salary_min: e.target.value })}
                    className="w-full border border-gray-300 p-2 rounded focus:outline-none"
                    placeholder="500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Max Salary ($)</label>
                  <input
                    type="number"
                    value={newJob.salary_max}
                    onChange={(e) => setNewJob({ ...newJob, salary_max: e.target.value })}
                    className="w-full border border-gray-300 p-2 rounded focus:outline-none"
                    placeholder="2000"
                  />
                </div>
              </div>

              {/* Job Type and Category */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Job Type</label>
                  <select
                    value={newJob.job_type}
                    onChange={(e) => setNewJob({ ...newJob, job_type: e.target.value })}
                    className="w-full border border-gray-300 p-2 rounded outline-none appearance-none"
                  >
                    <option value="full-time">Full Time</option>
                    <option value="part-time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="freelance">Freelance</option>
                    <option value="internship">Internship</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Category</label>
                  <input
                    type="text"
                    value={newJob.category}
                    onChange={(e) => setNewJob({ ...newJob, category: e.target.value })}
                    className="w-full border border-gray-300 p-2 rounded focus:outline-none"
                    placeholder="e.g. IT, Marketing"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-semibold mb-1">Status</label>
                <select
                  value={newJob.status}
                  onChange={(e) => setNewJob({ ...newJob, status: e.target.value })}
                  className="w-full border border-gray-300 p-2 rounded focus:outline-none appearance-none"
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="inactive">Inactive</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button
                type="button"
                onClick={() => setShowAddJobModal(false)}
                className="px-6 py-2 border border-red-500 text-red-500 rounded shadow-sm duration-200 hover:scale-105 hover:shadow-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 border border-blue-500 text-blue-500 rounded duration-200 hover:scale-105 hover:shadow-lg shadow-sm"
              >
              Create Job
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* Edit Job Modal */}
    {showEditJobModal && editingJob && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
            <h2 className="text-2xl font-bold">Edit Job</h2>
            <button
              onClick={() => {
                setShowEditJobModal(false);
                setEditingJob(null);
              }}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <form onSubmit={handleUpdateJob} className="p-6">
            <div className="space-y-4">
              {/* Job Title */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Job Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingJob.title}
                  onChange={(e) => setEditingJob({ ...editingJob, title: e.target.value })}
                  className="w-full border border-gray-300 p-2 rounded focus:outline-none"
                  placeholder="e.g. Senior Web Developer"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold mb-1">Description</label>
                <textarea
                  value={editingJob.description}
                  onChange={(e) => setEditingJob({ ...editingJob, description: e.target.value })}
                  className="w-full border border-gray-300 p-2 rounded focus:outline-none"
                  rows="4"
                  placeholder="Job description..."
                ></textarea>
              </div>

              {/* Requirements */}
              <div>
                <label className="block text-sm font-semibold mb-1">Requirements</label>
                <textarea
                  value={editingJob.requirements}
                  onChange={(e) => setEditingJob({ ...editingJob, requirements: e.target.value })}
                  className="w-full border border-gray-300 p-2 rounded focus:outline-none"
                  rows="3"
                  placeholder="Job requirements..."
                ></textarea>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-semibold mb-1">Location</label>
                <input
                  type="text"
                  value={editingJob.location}
                  onChange={(e) => setEditingJob({ ...editingJob, location: e.target.value })}
                  className="w-full border border-gray-300 p-2 rounded focus:outline-none"
                  placeholder="e.g. Phnom Penh, Cambodia"
                />
              </div>

              {/* Salary Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Min Salary ($)</label>
                  <input
                    type="number"
                    value={editingJob.salary_min}
                    onChange={(e) => setEditingJob({ ...editingJob, salary_min: e.target.value })}
                    className="w-full border border-gray-300 p-2 rounded focus:outline-none "
                    placeholder="500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Max Salary ($)</label>
                  <input
                    type="number"
                    value={editingJob.salary_max}
                    onChange={(e) => setEditingJob({ ...editingJob, salary_max: e.target.value })}
                    className="w-full border border-gray-300 p-2 rounded focus:outline-none "
                    placeholder="2000"
                  />
                </div>
              </div>

              {/* Job Type and Category */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Job Type</label>
                  <select
                    value={editingJob.job_type}
                    onChange={(e) => setEditingJob({ ...editingJob, job_type: e.target.value })}
                    className="w-full border border-gray-300 p-2 rounded focus:outline-none appreance-none"
                  >
                    <option value="full-time">Full Time</option>
                    <option value="part-time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="freelance">Freelance</option>
                    <option value="internship">Internship</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Category</label>
                  <input
                    type="text"
                    value={editingJob.category}
                    onChange={(e) => setEditingJob({ ...editingJob, category: e.target.value })}
                    className="w-full border border-gray-300 p-2 rounded focus:outline-none"
                    placeholder="e.g. IT, Marketing"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-semibold mb-1">Status</label>
                <select
                  value={editingJob.status}
                  onChange={(e) => setEditingJob({ ...editingJob, status: e.target.value })}
                  className="w-full border border-gray-300 p-2 rounded focus:outline-none appearance-none"
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="inactive">Inactive</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  setShowEditJobModal(false);
                  setEditingJob(null);
                }}
                className="px-6 py-2 border border-red-500 rounded text-red-500 shadow-sm duration-200 hover:scale-105 hover:shadow-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 border border-blue-500 rounded text-blue-500 shadow-sm duration-200 hover:scale-105 hover:shadow-lg"
              >
              Update Job
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* View Application Details Modal */}
    {showViewApplicationModal && viewingApplication && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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

          <div className="p-6 space-y-6">
            {/* Job Information */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-700">Job Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Job Title</label>
                  <p className="font-medium">{viewingApplication.job_title}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Company</label>
                  <p className="font-medium">{viewingApplication.employer_name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Location</label>
                  <p className="font-medium">{viewingApplication.job_location || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Job Type</label>
                  <p className="font-medium capitalize">{viewingApplication.job_type || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Applicant Information */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-700">Applicant Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Name</label>
                  <p className="font-medium">{viewingApplication.seeker_name}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Email</label>
                  <p className="font-medium text-blue-600">{viewingApplication.seeker_email}</p>
                </div>
                {viewingApplication.seeker_phone && (
                  <div>
                    <label className="text-sm text-gray-500">Phone</label>
                    <p className="font-medium">{viewingApplication.seeker_phone}</p>
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

            {/* Application Status */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-700">Application Status</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Current Status</label>
                  <p>
                    <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                      viewingApplication.status === 'pending' ? ' text-yellow-700' :
                      viewingApplication.status === 'reviewing' ? ' text-blue-700' :
                      viewingApplication.status === 'shortlisted' ? 'text-purple-700' :
                      viewingApplication.status === 'rejected' ? 'text-red-700' :
                      'text-green-700'

                    }`}>
                      {viewingApplication.status || 'Pending'}
                    </span>
                  </p>
                </div>
                {viewingApplication.reviewed_at && (
                  <div>
                    <label className="text-sm text-gray-500">Reviewed At</label>
                    <p className="font-medium">{new Date(viewingApplication.reviewed_at).toLocaleString()}</p>
                  </div>
                )}
              </div>
              {viewingApplication.notes && (
                <div className="mt-3">
                  <label className="text-sm text-gray-500">Notes</label>
                  <p className="text-gray-700 mt-1">{viewingApplication.notes}</p>
                </div>
              )}
            </div>

            {/* Resume */}
            {viewingApplication.resume_path && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-700">Resume</h3>
                <button
                  type="button"
                  onClick={() => handleDownloadApplicationResume(viewingApplication)}
                  className="inline-flex items-center px-4 py-2 border border-blue-500 text-blue-500 rounded duration-200 shadow-sm hover:scale-105 hover:shadow-lg"
                >
                  <i className="fas fa-download mr-2"></i>
                  Download Resume
                </button>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="border-t px-6 py-4 bg-gray-50 flex justify-end gap-3">
            <button
              onClick={() => {
                setShowViewApplicationModal(false);
                setViewingApplication(null);
              }}
              className="px-6 py-2 border border-red-500 text-red-500 shadow-sm duration-200 hover:scale-105 hover:shadow-lg rounded"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}

    {/* View Profile Modal */}
    {showViewProfileModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
            <h2 className="text-2xl font-bold">
              {viewingProfile?.role === 'job_seeker' ? 'Job Seeker Profile' : 'Employer Profile'}
            </h2>
            <button
              onClick={() => {
                setShowViewProfileModal(false);
                setViewingProfile(null);
              }}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto">
            {profileLoading ? (
              <div className="text-center py-8">
                <i className="fas fa-spinner fa-spin text-3xl text-blue-500"></i>
                <p className="mt-2 text-gray-600">Loading profile...</p>
              </div>
            ) : viewingProfile ? (
              <>
                {/* Basic Information */}
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-700">Basic Information</h3>
                  <div className="flex items-center gap-4 mb-4">
                    {viewingProfile.avatar ? (
                      <img 
                        src={viewingProfile.avatar.startsWith('data:') 
                          ? viewingProfile.avatar 
                          : `http://localhost/Job_Portal_Project/backend/${viewingProfile.avatar}`
                        } 
                        alt={viewingProfile.full_name}
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
                      <h4 className="text-xl font-bold">{viewingProfile.full_name}</h4>
                      <p className="text-gray-600">@{viewingProfile.username}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">Email</label>
                      <p className="font-medium text-blue-600">{viewingProfile.email}</p>
                    </div>
                    {viewingProfile.phone && (
                      <div>
                        <label className="text-sm text-gray-500">Phone</label>
                        <p className="font-medium">{viewingProfile.phone}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-sm text-gray-500">Role</label>
                      <p className="font-medium capitalize">{viewingProfile.role?.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Status</label>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        viewingProfile.status === 'active' ? 'text-green-700' : 'text-gray-700'
                      }`}>
                        {viewingProfile.status}
                      </span>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Joined Date</label>
                      <p className="font-medium">{new Date(viewingProfile.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {/* Job Seeker Specific Profile */}
                {viewingProfile.role === 'job_seeker' && viewingProfile.profile && (
                  <>
                    <div className="border-b pb-4">
                      <h3 className="text-lg font-semibold mb-3 text-gray-700">Professional Information</h3>
                      <div className="space-y-3">
                        {viewingProfile.profile.title && (
                          <div>
                            <label className="text-sm text-gray-500">Title</label>
                            <p className="font-medium">{viewingProfile.profile.title}</p>
                          </div>
                        )}
                        {viewingProfile.profile.bio && (
                          <div>
                            <label className="text-sm text-gray-500">Bio</label>
                            <p className="text-gray-700">{viewingProfile.profile.bio}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          {viewingProfile.profile.experience_years !== null && (
                            <div>
                              <label className="text-sm text-gray-500">Experience</label>
                              <p className="font-medium">{viewingProfile.profile.experience_years} years</p>
                            </div>
                          )}
                          {viewingProfile.profile.availability && (
                            <div>
                              <label className="text-sm text-gray-500">Availability</label>
                              <p className="font-medium capitalize">{viewingProfile.profile.availability}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {viewingProfile.profile.skills && viewingProfile.profile.skills.length > 0 && (
                      <div className="border-b pb-4">
                        <h3 className="text-lg font-semibold mb-3 text-gray-700">Skills</h3>
                        <div className="flex flex-wrap gap-2">
                          {viewingProfile.profile.skills.map((skill, index) => (
                            <span key={index} className="px-3 py-1 text-blue-700 rounded-full text-sm">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {viewingProfile.profile.preferred_locations && viewingProfile.profile.preferred_locations.length > 0 && (
                      <div className="border-b pb-4">
                        <h3 className="text-lg font-semibold mb-3 text-gray-700">Preferred Locations</h3>
                        <div className="flex flex-wrap gap-2">
                          {viewingProfile.profile.preferred_locations.map((location, index) => (
                            <span key={index} className="px-3 py-1 text-gray-700 rounded text-sm">
                              <i className="fas fa-map-marker-alt mr-1"></i>{location}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {(viewingProfile.profile.portfolio_url || viewingProfile.profile.linkedin_url || viewingProfile.profile.github_url) && (
                      <div className="border-b pb-4">
                        <h3 className="text-lg font-semibold mb-3 text-gray-700">Links</h3>
                        <div className="space-y-2">
                          {viewingProfile.profile.portfolio_url && (
                            <a href={viewingProfile.profile.portfolio_url} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:underline">
                              <i className="fas fa-globe mr-2"></i>Portfolio
                            </a>
                          )}
                          {viewingProfile.profile.linkedin_url && (
                            <a href={viewingProfile.profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:underline">
                              <i className="fab fa-linkedin mr-2"></i>LinkedIn
                            </a>
                          )}
                          {viewingProfile.profile.github_url && (
                            <a href={viewingProfile.profile.github_url} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:underline">
                              <i className="fab fa-github mr-2"></i>GitHub
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Employer Specific Profile */}
                {viewingProfile.role === 'employer' && viewingProfile.company_profile && (
                  <>
                    <div className="border-b pb-4">
                      <h3 className="text-lg font-semibold mb-3 text-gray-700">Company Information</h3>
                      <div className="space-y-3">
                        {viewingProfile.company_profile.company_name && (
                          <div>
                            <label className="text-sm text-gray-500">Company Name</label>
                            <p className="font-medium">{viewingProfile.company_profile.company_name}</p>
                          </div>
                        )}
                        {viewingProfile.company_profile.description && (
                          <div>
                            <label className="text-sm text-gray-500">Description</label>
                            <p className="text-gray-700">{viewingProfile.company_profile.description}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          {viewingProfile.company_profile.industry && (
                            <div>
                              <label className="text-sm text-gray-500">Industry</label>
                              <p className="font-medium">{viewingProfile.company_profile.industry}</p>
                            </div>
                          )}
                          {viewingProfile.company_profile.company_size && (
                            <div>
                              <label className="text-sm text-gray-500">Company Size</label>
                              <p className="font-medium">{viewingProfile.company_profile.company_size}</p>
                            </div>
                          )}
                          {viewingProfile.company_profile.location && (
                            <div>
                              <label className="text-sm text-gray-500">Location</label>
                              <p className="font-medium">{viewingProfile.company_profile.location}</p>
                            </div>
                          )}
                          {viewingProfile.company_profile.founded_year && (
                            <div>
                              <label className="text-sm text-gray-500">Founded Year</label>
                              <p className="font-medium">{viewingProfile.company_profile.founded_year}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {viewingProfile.company_profile.website && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-700">Website</h3>
                        <a href={viewingProfile.company_profile.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          <i className="fas fa-external-link-alt mr-2"></i>{viewingProfile.company_profile.website}
                        </a>
                      </div>
                    )}
                  </>
                )}
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
                setShowViewProfileModal(false);
                setViewingProfile(null);
              }}
              className="px-6 py-2 border border-red-600 text-red-600 rounded duration-200 hover:scale-105 hover:shadow-lg shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}

    {showMessageModal && viewingMessage && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <h3 className="text-xl font-semibold">{viewingMessage.subject}</h3>
              <p className="text-sm text-gray-500">
                {viewingMessage.sender_name || 'System'}
                {viewingMessage.sender_email ? ` • ${viewingMessage.sender_email}` : ''}
              </p>
            </div>
            <button
              onClick={() => {
                setShowMessageModal(false);
                setViewingMessage(null);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <i className="fas fa-times text-lg"></i>
            </button>
          </div>
          <div className="px-6 py-4 space-y-3">
            <div className="text-sm text-gray-600">
              Received: {viewingMessage.created_at ? new Date(viewingMessage.created_at).toLocaleString() : '—'}
            </div>
            <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded p-4">
              {viewingMessage.message}
            </pre>
          </div>
          <div className="flex justify-end gap-3 border-t px-6 py-4">
            <button
              onClick={() => {
                setShowMessageModal(false);
                setViewingMessage(null);
              }}
              className="px-4 py-2 rounded border border-gray-300 text-sm hover:bg-gray-50"
            >
              Close
            </button>
            <button
              onClick={() => {
                setShowMessageModal(false);
                if (viewingMessage.id) {
                  handleDeleteMessage(viewingMessage.id);
                }
              }}
              className="px-4 py-2 rounded border border-red-500 text-sm text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
