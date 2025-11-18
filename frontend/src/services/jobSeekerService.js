import { ensureBase64DataUri } from '../utils/avatar';

// Avatar Upload API
const uploadAvatar = async (avatarData) => {
  try {
    const normalized = ensureBase64DataUri(avatarData);
    if (typeof normalized !== 'string' || normalized.trim() === '') {
      throw new Error('Invalid avatar data');
    }
    const response = await fetch(`${API_BASE_URL}/jobseeker/upload-avatar.php`, {
      method: 'POST',
      headers: createAuthHeader(),
      body: JSON.stringify({ avatar: normalized })
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to upload avatar');
    }
    return data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
/**
 * Job Seeker Service
 * API service layer for job seeker dashboard and features
 */

const API_BASE_URL = 'http://localhost/Job_Portal_Project/backend/api';

// Helper function to create authorization header
const createAuthHeader = () => {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

// Dashboard API
export const getDashboardStats = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/jobseeker/dashboard.php`, {
      method: 'GET',
      headers: createAuthHeader()
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch dashboard stats');
    }
    return data.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Applications API
export const getApplications = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/jobseeker/applications.php`, {
      method: 'GET',
      headers: createAuthHeader()
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch applications');
    }
    return data.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const withdrawApplication = async (applicationId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/jobseeker/applications.php`, {
      method: 'POST',
      headers: createAuthHeader(),
      body: JSON.stringify({ application_id: applicationId })
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to withdraw application');
    }
    return data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Saved Jobs API
export const getSavedJobs = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/jobseeker/saved-jobs.php`, {
      method: 'GET',
      headers: createAuthHeader()
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch saved jobs');
    }
    return data.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const saveJob = async (jobId, notes = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/jobseeker/saved-jobs.php`, {
      method: 'POST',
      headers: createAuthHeader(),
      body: JSON.stringify({ job_id: jobId, notes })
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to save job');
    }
    return data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const applyForJob = async (jobId, coverLetter = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/jobseeker/apply-job.php`, {
      method: 'POST',
      headers: createAuthHeader(),
      body: JSON.stringify({ job_id: jobId, cover_letter: coverLetter })
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to apply for job');
    }
    return data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const removeSavedJob = async (jobId, savedId = null) => {
  try {
    const payload = savedId ? { saved_id: savedId } : { job_id: jobId };
    const response = await fetch(`${API_BASE_URL}/jobseeker/saved-jobs.php`, {
      method: 'DELETE',
      headers: createAuthHeader(),
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to remove saved job');
    }
    return data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Settings API
export const getSettings = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/jobseeker/settings.php`, {
      method: 'GET',
      headers: createAuthHeader()
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch settings');
    }
    return data.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const updateSettings = async (settings) => {
  try {
    const response = await fetch(`${API_BASE_URL}/jobseeker/settings.php`, {
      method: 'PUT',
      headers: createAuthHeader(),
      body: JSON.stringify(settings)
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to update settings');
    }
    return data.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Change Password API
export const changePassword = async (passwordData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/jobseeker/change-password.php`, {
      method: 'POST',
      headers: createAuthHeader(),
      body: JSON.stringify(passwordData)
    });
    const data = await response.json();
    if (!data.success) {
      const detail = Array.isArray(data.errors) && data.errors.length
        ? data.errors.join(' ')
        : '';
      const message = [data.message, detail].filter(Boolean).join(' ');
      throw new Error(message || 'Failed to change password');
    }
    return data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Resume Upload
export const uploadResume = async (file) => {
  try {
    const formData = new FormData();
    formData.append('resume', file);

    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/jobseeker/upload-resume.php`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to upload resume');
    }
    window.dispatchEvent(new CustomEvent('jobSeekerResumeUpdated', { detail: data.resume_path || null }));
    return data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Resume Delete
export const deleteResume = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/jobseeker/delete-resume.php`, {
      method: 'DELETE',
      headers: createAuthHeader()
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to delete resume');
    }
    window.dispatchEvent(new CustomEvent('jobSeekerResumeUpdated', { detail: null }));
    return data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Profile API
export const getProfile = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/jobseeker/profile.php`, {
      method: 'GET',
      headers: createAuthHeader()
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch profile');
    }
    return data.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const updateProfile = async (profileData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/jobseeker/profile.php`, {
      method: 'PUT',
      headers: createAuthHeader(),
      body: JSON.stringify(profileData)
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to update profile');
    }
    return data;
  } catch (error) {
    throw error.response?.data || error;
  }
};


// ...existing code...



const jobSeekerService = {
  getDashboardStats,
  getApplications,
  withdrawApplication,
  getSavedJobs,
  saveJob,
  applyForJob,
  removeSavedJob,
  getSettings,
  updateSettings,
  changePassword,
  uploadResume,
  deleteResume,
  getProfile,
  updateProfile,
  uploadAvatar
};

export default jobSeekerService;

