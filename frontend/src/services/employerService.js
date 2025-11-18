import api from './api';
import { ensureBase64DataUri } from '../utils/avatar';

// Helper to create auth header with JWT token
const createAuthHeader = () => {
  const token = localStorage.getItem('authToken') || localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const employerService = {
  // Get dashboard statistics
  getDashboardStats: async () => {
    try {
      const response = await api.get('/employer/dashboard.php', {
        headers: createAuthHeader()
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get all jobs for the employer
  getJobs: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.type) params.append('type', filters.type);
      if (filters.page) params.append('page', filters.page);
      if (filters.limit) params.append('limit', filters.limit);

      const queryString = params.toString();
      const url = `/employer/jobs.php${queryString ? `?${queryString}` : ''}`;
      
      const response = await api.get(url, {
        headers: createAuthHeader()
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Create a new job posting
  createJob: async (jobData) => {
    try {
      const response = await api.post('/employer/jobs.php', jobData, {
        headers: createAuthHeader()
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Update an existing job
  updateJob: async (id, jobData) => {
    try {
      const response = await api.put('/employer/jobs.php', 
        { id, ...jobData },
        {
          headers: createAuthHeader()
        }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Delete a job posting
  deleteJob: async (id) => {
    try {
      const response = await api.delete('/employer/jobs.php', {
        headers: createAuthHeader(),
        data: { id }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get applications for employer's jobs
  getApplications: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.job_id) params.append('job_id', filters.job_id);
      if (filters.status) params.append('status', filters.status);
      if (filters.page) params.append('page', filters.page);
      if (filters.limit) params.append('limit', filters.limit);

      const queryString = params.toString();
      const url = `/employer/applications.php${queryString ? `?${queryString}` : ''}`;
      
      const response = await api.get(url, {
        headers: createAuthHeader()
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Update application status
  updateApplicationStatus: async (id, status, notes = '') => {
    try {
      const response = await api.put('/employer/applications.php',
        { id, status, notes },
        {
          headers: createAuthHeader()
        }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get analytics data
  getAnalytics: async () => {
    try {
      const response = await api.get('/employer/analytics.php', {
        headers: createAuthHeader()
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get candidates (job seekers)
  getCandidates: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.skills) params.append('skills', filters.skills);
      if (filters.location) params.append('location', filters.location);
      if (filters.page) params.append('page', filters.page);
      if (filters.limit) params.append('limit', filters.limit);

      const queryString = params.toString();
      const url = `/employer/candidates.php${queryString ? `?${queryString}` : ''}`;
      
      const response = await api.get(url, {
        headers: createAuthHeader()
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get employer settings
  getSettings: async () => {
    try {
      const response = await api.get('/employer/settings.php', {
        headers: createAuthHeader()
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Update employer settings
  updateSettings: async (settingsData) => {
    try {
      const response = await api.put('/employer/settings.php',
        settingsData,
        {
          headers: createAuthHeader()
        }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Change password
  changePassword: async (passwordData) => {
    try {
      const response = await api.post('/employer/change-password.php',
        passwordData,
        {
          headers: createAuthHeader()
        }
      );
      const data = response.data;
      if (!data.success) {
        const detail = Array.isArray(data.errors) && data.errors.length
          ? data.errors.join(' ')
          : '';
        const message = [data.error || data.message, detail].filter(Boolean).join(' ');
        throw new Error(message || 'Failed to change password');
      }
      return data;
    } catch (error) {
      const apiError = error?.response?.data;
      if (apiError) {
        const detail = Array.isArray(apiError.errors) && apiError.errors.length
          ? apiError.errors.join(' ')
          : '';
        const message = [apiError.error || apiError.message, detail].filter(Boolean).join(' ');
        throw new Error(message || 'Failed to change password');
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to change password');
    }
  },
  
  // Get employer profile
  getProfile: async () => {
    try {
      const response = await api.get('/employer/profile.php', {
        headers: createAuthHeader()
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Update employer profile
  updateProfile: async (profileData) => {
    try {
      const response = await api.put('/employer/profile.php',
        profileData,
        {
          headers: createAuthHeader()
        }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Upload avatar
  uploadAvatar: async (avatarData) => {
    try {
      const normalized = ensureBase64DataUri(avatarData);
      if (typeof normalized !== 'string' || normalized.trim() === '') {
        throw new Error('Invalid avatar data');
      }
      const response = await api.post('/employer/upload-avatar.php',
        { avatar: normalized },
        {
          headers: createAuthHeader()
        }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};

export default employerService;
