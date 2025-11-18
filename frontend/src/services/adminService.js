import api from './api';
import { ensureBase64DataUri } from '../utils/avatar';
import axios from 'axios';

// API Base URL
const API_URL = api.defaults.baseURL;

// Get auth token from localStorage
const getAuthToken = () => {
  try {
    return localStorage.getItem('authToken') || localStorage.getItem('token');
  } catch (e) {
    return null;
  }
};

// Create axios instance with auth header
const createAuthHeader = () => {
  const token = getAuthToken();
  return token ? { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  } : { 'Content-Type': 'application/json' };
};

// Admin Dashboard Statistics
export const getDashboardStats = async () => {
  try {
    const response = await api.get('/admin/dashboard.php', {
      headers: createAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Dashboard error:', error);
    throw error.response?.data || { success: false, error: error.message };
  }
};

// Jobs Management
export const getJobs = async (params = {}) => {
  try {
    const { page = 1, limit = 10, status, job_type, employer_id, search } = params;
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(status && { status }),
      ...(job_type && { job_type }),
      ...(employer_id && { employer_id: employer_id.toString() }),
      ...(search && { search })
    });
    
    const response = await api.get(`/admin/jobs.php?${queryParams}`, {
      headers: createAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Get jobs error:', error);
    throw error.response?.data || { success: false, error: error.message };
  }
};

export const createJob = async (jobData) => {
  try {
    const response = await api.post('/admin/jobs.php', jobData, {
      headers: createAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Create job error:', error);
    throw error.response?.data || { success: false, error: error.message };
  }
};

export const updateJob = async (jobId, jobData) => {
  try {
    const response = await api.put('/admin/jobs.php', 
      { id: jobId, ...jobData }, 
      { headers: createAuthHeader() }
    );
    return response.data;
  } catch (error) {
    console.error('Update job error:', error);
    throw error.response?.data || { success: false, error: error.message };
  }
};

export const deleteJob = async (jobId) => {
  try {
    const response = await api.delete(`/admin/jobs.php?id=${jobId}`, {
      headers: createAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Delete job error:', error);
    throw error.response?.data || { success: false, error: error.message };
  }
};

// Users Management
export const getUsers = async (params = {}) => {
  try {
    const { page = 1, limit = 10, role, status, search } = params;
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(role && { role }),
      ...(status && { status }),
      ...(search && { search })
    });
    
    const response = await api.get(`/admin/users.php?${queryParams}`, {
      headers: createAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Get users error:', error);
    throw error.response?.data || { success: false, error: error.message };
  }
};

export const updateUser = async (userId, userData) => {
  try {
    const response = await api.put('/admin/users.php', 
      { id: userId, ...userData }, 
      { headers: createAuthHeader() }
    );
    return response.data;
  } catch (error) {
    console.error('Update user error:', error);
    throw error.response?.data || { success: false, error: error.message };
  }
};

export const deleteUser = async (userId) => {
  try {
    const response = await api.delete(`/admin/users.php?id=${userId}`, {
      headers: createAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Delete user error:', error);
    throw error.response?.data || { success: false, error: error.message };
  }
};

// Applications Management
export const getApplications = async (params = {}) => {
  try {
    const { page = 1, limit = 10, status, job_id, seeker_id, search } = params;
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(status && { status }),
      ...(job_id && { job_id: job_id.toString() }),
      ...(seeker_id && { seeker_id: seeker_id.toString() }),
      ...(search && { search })
    });
    
    const response = await api.get(`/admin/applications.php?${queryParams}`, {
      headers: createAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Get applications error:', error);
    throw error.response?.data || { success: false, error: error.message };
  }
};

export const updateApplication = async (applicationId, applicationData) => {
  try {
    const response = await api.put('/admin/applications.php', 
      { id: applicationId, ...applicationData }, 
      { headers: createAuthHeader() }
    );
    return response.data;
  } catch (error) {
    console.error('Update application error:', error);
    throw error.response?.data || { success: false, error: error.message };
  }
};

export const deleteApplication = async (applicationId) => {
  try {
    const response = await api.delete(`/admin/applications.php?id=${applicationId}`, {
      headers: createAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Delete application error:', error);
    throw error.response?.data || { success: false, error: error.message };
  }
};

// Analytics
export const getAnalytics = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams();
    if (params.range) {
      queryParams.set('range', params.range.toString());
    }

    const query = queryParams.toString();
    const url = query ? `/admin/analytics.php?${query}` : '/admin/analytics.php';

    const response = await api.get(url, {
      headers: createAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Analytics error:', error);
    throw error.response?.data || { success: false, error: error.message };
  }
};

// Messages
export const getMessages = async (params = {}) => {
  try {
    const { page = 1, limit = 10, type = 'all', status, search } = params;
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      type,
      ...(status && { status }),
      ...(search && { search })
    });
    
    const response = await axios.get(`${API_URL}/admin/messages.php?${queryParams}`, {
      headers: createAuthHeader()
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, error: error.message };
  }
};

export const sendMessage = async (messageData) => {
  try {
    const response = await axios.post(`${API_URL}/admin/messages.php`, messageData, {
      headers: createAuthHeader()
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, error: error.message };
  }
};

export const markMessageAsRead = async (messageId) => {
  try {
    const response = await axios.put(`${API_URL}/admin/messages.php`, 
      { id: messageId }, 
      { headers: createAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, error: error.message };
  }
};

export const deleteMessage = async (messageId) => {
  try {
    const response = await axios.delete(`${API_URL}/admin/messages.php`, {
      headers: createAuthHeader(),
      data: { id: messageId }
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, error: error.message };
  }
};

// Settings
export const getSettings = async () => {
  try {
    const response = await axios.get(`${API_URL}/admin/settings.php`, {
      headers: createAuthHeader()
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, error: error.message };
  }
};

export const updateSettings = async (settings) => {
  try {
    const response = await axios.put(`${API_URL}/admin/settings.php`, 
      { settings }, 
      { headers: createAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { success: false, error: error.message };
  }
};

// Notifications
export const sendNotification = async (type, data) => {
  try {
    const response = await api.post('/notifications.php', {
      type,
      ...data
    }, {
      headers: createAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Notification error:', error);
    throw error.response?.data || { success: false, error: error.message };
  }
};

// File Upload
export const uploadResume = async (file, applicationId = null) => {
  try {
    const formData = new FormData();
    formData.append('resume', file);
    if (applicationId) {
      formData.append('application_id', applicationId);
    }
    
    const token = getAuthToken();
    const response = await api.post('/upload.php', formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Upload error:', error);
    throw error.response?.data || { success: false, error: error.message };
  }
};

export const getResumes = async (applicationId = null) => {
  try {
    const url = applicationId ? `/upload.php?application_id=${applicationId}` : '/upload.php';
    const response = await api.get(url, {
      headers: createAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Get resumes error:', error);
    throw error.response?.data || { success: false, error: error.message };
  }
};

export const deleteResume = async (filename) => {
  try {
    const response = await api.delete(`/upload.php?filename=${filename}`, {
      headers: createAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Delete resume error:', error);
    throw error.response?.data || { success: false, error: error.message };
  }
};

export const downloadResume = (filename) => {
  const token = getAuthToken();
  const url = `${api.defaults.baseURL}/download.php?file=${filename}`;
  
  // Create temporary link to download
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  link.style.display = 'none';
  
  // Add authorization header via fetch
  return fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => {
    if (!response.ok) {
      return response.json().then(err => {
        const message = err?.error || err?.message || 'Failed to download resume';
        throw new Error(message);
      }).catch(() => {
        throw new Error('Failed to download resume');
      });
    }
    return response.blob();
  })
  .then(blob => {
    const blobUrl = window.URL.createObjectURL(blob);
    link.href = blobUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  })
  .catch(error => {
    console.error('Download error:', error);
    throw error;
  });
};

// Admin Profile Management
export const getAdminProfile = async () => {
  try {
    const response = await api.get('/admin/profile.php', {
      headers: createAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Get profile error:', error);
    throw error.response?.data || { success: false, error: error.message };
  }
};

export const updateAdminProfile = async (profileData) => {
  try {
    const response = await api.put('/admin/profile.php', profileData, {
      headers: createAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Update profile error:', error);
    throw error.response?.data || { success: false, error: error.message };
  }
};

export const getUserSettings = async () => {
  try {
    const response = await api.get('/admin/user-settings.php', {
      headers: createAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Get user settings error:', error);
    throw error.response?.data || { success: false, error: error.message };
  }
};

export const updateUserSettings = async (settings) => {
  try {
    const response = await api.put('/admin/user-settings.php', settings, {
      headers: createAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Update user settings error:', error);
    throw error.response?.data || { success: false, error: error.message };
  }
};

export const uploadAvatar = async (base64Image) => {
  try {
    const normalized = ensureBase64DataUri(base64Image);
    if (typeof normalized !== 'string' || normalized.trim() === '') {
      throw new Error('Invalid avatar data');
    }
    const response = await api.post('/admin/upload-avatar.php', {
      avatar: normalized
    }, {
      headers: createAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Upload avatar error:', error);
    throw error.response?.data || { success: false, error: error.message };
  }
};

export const changePassword = async (currentPassword, newPassword, confirmPassword) => {
  try {
    const response = await api.put('/admin/change-password.php', {
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword
    }, {
      headers: createAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error('Change password error:', error);
    throw error.response?.data || { success: false, error: error.message };
  }
};

export default {
  getDashboardStats,
  getJobs,
  createJob,
  updateJob,
  deleteJob,
  getUsers,
  updateUser,
  deleteUser,
  getApplications,
  updateApplication,
  deleteApplication,
  getAnalytics,
  sendNotification,
  uploadResume,
  getResumes,
  deleteResume,
  downloadResume,
  getMessages,
  sendMessage,
  markMessageAsRead,
  deleteMessage,
  getSettings,
  updateSettings,
  getAdminProfile,
  updateAdminProfile,
  getUserSettings,
  updateUserSettings,
  uploadAvatar,
  changePassword
};
