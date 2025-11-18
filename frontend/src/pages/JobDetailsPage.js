import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { showToast } from '../components/Toaster';
import jobSeekerService from '../services/jobSeekerService';
import api from '../services/api';

export default function JobDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  
  // Check if user is logged in and is a job seeker
  const getUserFromStorage = () => {
    try {
      const userData = localStorage.getItem('user');
      if (!userData || userData === 'undefined' || userData === 'null') {
        return {};
      }
      return JSON.parse(userData);
    } catch (error) {
      console.error('Error parsing user data from localStorage:', error);
      return {};
    }
  };

  const user = getUserFromStorage();
  const isJobSeeker = user.role === 'job_seeker';
  const [checkingResume, setCheckingResume] = useState(isJobSeeker);
  const [hasResume, setHasResume] = useState(false);
  const [resumeCheckFailed, setResumeCheckFailed] = useState(false);

  const loadResumeStatus = useCallback(async () => {
    if (!isJobSeeker) {
      setCheckingResume(false);
      setHasResume(false);
      setResumeCheckFailed(false);
      return;
    }

    setCheckingResume(true);
    setResumeCheckFailed(false);

    try {
      const profileData = await jobSeekerService.getProfile();
      const fromProfile = profileData?.profile?.resume_path;
      const fromUser = profileData?.user?.resume_path;
      const resumePath = typeof fromProfile === 'string' && fromProfile.trim() !== ''
        ? fromProfile
        : typeof fromUser === 'string' ? fromUser : '';
      setHasResume(resumePath.trim() !== '');
    } catch (error) {
      console.error('Error checking resume status:', error);
      setHasResume(false);
      setResumeCheckFailed(true);
    } finally {
      setCheckingResume(false);
    }
  }, [isJobSeeker]);

  // Normalize logo source from various possible fields
  const getLogoSrc = (job) => {
    // The API returns 'company_logo' field which contains the employer's avatar
    const candidate = job.company_logo || job.logo || job.avatar || job.employer_avatar || job.company_avatar || job.companyLogo || null;
    if (!candidate) return '/Job Portal-logo-transparent.png';
    if (typeof candidate !== 'string') return '/Job Portal-logo-transparent.png';
    const trimmed = candidate.trim();
    if (!trimmed || trimmed === 'null') return '/Job Portal-logo-transparent.png';
    // If already a data URI or absolute URL, use as-is
    if (trimmed.startsWith('data:')) return trimmed;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    // Otherwise it's a relative path, add backend URL
    const p = trimmed.replace(/^\/+/, '');
    return `http://localhost/Job_Portal_Project/backend/${p}`;
  };

  useEffect(() => {
    fetchJobDetails();
    if (isJobSeeker) {
      checkApplicationStatus();
      checkSavedStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!isJobSeeker) {
      setHasResume(false);
      setCheckingResume(false);
      setResumeCheckFailed(false);
      return;
    }
    loadResumeStatus();
  }, [isJobSeeker, loadResumeStatus]);

  useEffect(() => {
    if (!isJobSeeker) {
      return;
    }

    const handleResumeUpdate = () => {
      loadResumeStatus();
    };

    window.addEventListener('jobSeekerResumeUpdated', handleResumeUpdate);
    window.addEventListener('userDataRefresh', handleResumeUpdate);

    return () => {
      window.removeEventListener('jobSeekerResumeUpdated', handleResumeUpdate);
      window.removeEventListener('userDataRefresh', handleResumeUpdate);
    };
  }, [isJobSeeker, loadResumeStatus]);

  const fetchJobDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/jobs/details.php?id=${id}`);
      if (response.data.success) {
        setJob(response.data.data);
      } else {
        showToast('Job not found', 'error');
      }
    } catch (error) {
      console.error('Error fetching job:', error);
      showToast('Failed to load job details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkApplicationStatus = async () => {
    try {
      const applications = await jobSeekerService.getApplications();
      const hasAppliedToThisJob = applications.some(app => app.job_id === parseInt(id));
      setHasApplied(hasAppliedToThisJob);
    } catch (error) {
      console.error('Error checking application status:', error);
    }
  };

  const checkSavedStatus = async () => {
    try {
      const savedJobs = await jobSeekerService.getSavedJobs();
      const hasSavedThisJob = savedJobs.some(job => job.job_id === parseInt(id));
      setHasSaved(hasSavedThisJob);
    } catch (error) {
      console.error('Error checking saved status:', error);
    }
  };

  const handleSaveJob = async () => {
    if (!isJobSeeker) {
      showToast('Please login as a job seeker to save jobs', 'error');
      navigate('/login');
      return;
    }

    // Show confirmation dialog
    const confirmSave = window.confirm('Do you want to save this job for later?');
    if (!confirmSave) {
      return;
    }

    try {
      setSaving(true);
      await jobSeekerService.saveJob(parseInt(id));
      setHasSaved(true);
      showToast('Job saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving job:', error);
      if (error.message && error.message.includes('already saved')) {
        setHasSaved(true);
        showToast('Job already saved', 'info');
      } else {
        showToast(error.message || 'Failed to save job', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleApply = async () => {
    if (!isJobSeeker) {
      showToast('Please login as a job seeker to apply', 'error');
      navigate('/login');
      return;
    }

    if (checkingResume) {
      showToast('Please wait while we verify your resume status', 'info');
      return;
    }

    if (!resumeCheckFailed && !hasResume) {
      showToast('Please upload your resume before applying for this job', 'error');
      const goToProfile = window.confirm('You need to upload your resume before applying. Go to your profile now?');
      if (goToProfile) {
        navigate('/job-seeker/profile');
      }
      return;
    }
    
    // Show confirmation dialog
    const confirmApply = window.confirm('Are you sure you want to apply for this job?');
    if (!confirmApply) {
      return;
    }

    try {
      setApplying(true);
      const response = await jobSeekerService.applyForJob(parseInt(id));
      setHasApplied(true);
      showToast(response.message || 'Application submitted successfully!', 'success');
      // Optionally redirect to dashboard after successful application
      setTimeout(() => {
        navigate('/job-seeker/dashboard');
      }, 2000);
    } catch (error) {
      console.error('Error applying for job:', error);
      if (error.message && error.message.includes('already applied')) {
        setHasApplied(true);
        showToast('You have already applied for this job', 'info');
      } else {
        showToast(error.message || 'Failed to submit application', 'error');
      }
    } finally {
      setApplying(false);
    }
  };

  const missingResume = isJobSeeker && !resumeCheckFailed && !checkingResume && !hasResume;
  const disableApply = !isJobSeeker || applying || hasApplied || checkingResume || missingResume;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">Job not found</h2>
          <p className="mb-6">The requested job does not exist or may have been removed.</p>
          <div className="flex justify-center gap-4">
            <Link to="/jobs" className="px-4 py-2 text-white rounded">Back to Jobs</Link>
            <button onClick={() => navigate(-1)} className="px-4 py-2 border rounded">Go back</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top header removed — logo/title are shown inside the job card */}

        <div className="job-detail-container grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="job-main lg:col-span-2 bg-white rounded-lg p-6 border border-gray-300 bgray-50 shadow-md">
            <div className="job-header flex flex-col items-center gap-4 mb-4 text-center">
              <div className="company-logo w-24 h-24 flex items-center justify-center bg-gray-100 rounded-full overflow-hidden">
                <img 
                  src={getLogoSrc(job)}
                  alt={job.company_name || 'Company Logo'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/Job Portal-logo-transparent.png';
                  }}
                />
              </div>
              <div className="job-info">
                <h2 id="job-title" className="text-2xl font-semibold text-gray-900">{job.title}</h2>
                <p className="company-name text-gray-600 mt-1" id="company-name">{job.company_name || 'Company'}</p>
                <div className="job-meta flex flex-wrap justify-center gap-4 mt-2 text-sm text-gray-600">
                  <div className="meta-item flex items-center"><i className="fas fa-map-marker-alt mr-2"></i><span id="job-location">{job.location}</span></div>
                  <div className="meta-item flex items-center"><i className="fas fa-clock mr-2"></i><span id="job-type">{job.job_type}</span></div>
                  <div className="meta-item flex items-center "><i className="fas fa-calendar-alt mr-2"></i><span id="job-posted">Posted {new Date(job.created_at).toLocaleDateString()}</span></div>
                </div>
              </div>
            </div>

            <div className="job-tags mb-4" id="job-tags">
              <span className="job-tag inline-block bg-blue-50 border border-blue-100 text-blue-800 px-2 py-1 rounded mr-2 mb-2 text-sm">{job.category}</span>
              <span className="job-tag inline-block bg-blue-50 border border-blue-100 text-blue-800 px-2 py-1 rounded mr-2 mb-2 text-sm">{job.job_type}</span>
            </div>

            <div className="content-section mb-6">
              <h3 className="text-lg font-semibold mb-2"><i className="fas fa-info-circle mr-2"></i>Job Description</h3>
              <p id="job-description" className="text-gray-700 dark:text-gray-200 whitespace-pre-line">{job.description}</p>
            </div>

            <div className="content-section mb-6">
              <h3 className="text-lg font-semibold mb-2"><i className="fas fa-list-check mr-2"></i>Requirements</h3>
              <div className="text-gray-700 dark:text-gray-200 whitespace-pre-line" id="job-requirements">
                {job.requirements || 'No specific requirements listed'}
              </div>
            </div>

            <div className="content-section mb-6">
              <h3 className="text-lg font-semibold mb-2"><i className="fas fa-dollar-sign mr-2"></i>Salary Range</h3>
              <p className="text-gray-700">${job.salary_min} - ${job.salary_max}</p>
            </div>
          </div>

          <aside className="job-sidebar space-y-6">
            <div className="sidebar-card bg-gray-50 shadow-md rounded-lg p-5 border border-gray-300">
              <h4 className="font-bold text-lg mb-2">Apply Now</h4>
              <div className="salary-amount text-lg font-semibold mb-2" id="job-salary">${job.salary_min} - ${job.salary_max}</div>
              <p className="deadline-info text-sm mb-4">Status: <span id="job-status" className="font-medium">{job.status}</span></p>
                <div className="flex flex-col items-center gap-3">
                  <button 
                    onClick={handleApply}
                    disabled={disableApply}
                    className={`w-3/4 px-6 py-2 border shadow-sm duration-200 hover:shadow-lg rounded disabled:opacity-50 disabled:cursor-not-allowed ${
                      hasApplied 
                        ? 'border-green-600 bg-green-50 text-green-700' 
                        : 'border-green-600 text-green-600'
                    }`}
                  >
                    {applying ? (
                      <><i className="fas fa-spinner fa-spin mr-2"></i>Applying...</>
                    ) : hasApplied ? (
                      <><i className="fas fa-check-circle mr-2"></i>Applied</>
                    ) : (
                      'Apply for this Job'
                    )}
                  </button>
                  <button 
                    onClick={handleSaveJob}
                    disabled={!isJobSeeker || saving || hasSaved}
                    className={`w-3/4 px-6 py-2 border shadow-sm duration-200 hover:shadow-lg rounded disabled:opacity-50 disabled:cursor-not-allowed ${
                      hasSaved 
                        ? 'border-orange-600 bg-orange-50 text-orange-700' 
                        : 'border-orange-600 text-orange-600'
                    }`}
                  >
                    {saving ? (
                      <><i className="fas fa-spinner fa-spin mr-2"></i>Saving...</>
                    ) : hasSaved ? (
                      <><i className="fas fa-bookmark-solid mr-2"></i>Saved</>
                    ) : (
                      'Save Job'
                    )}
                  </button>
                  {!isJobSeeker && (
                    <p className="text-xs text-gray-500 text-center">Login as job seeker to apply or save</p>
                  )}
                  {isJobSeeker && checkingResume && (
                    <p className="text-xs text-gray-500 text-center">Checking resume status...</p>
                  )}
                  {isJobSeeker && missingResume && (
                    <p className="text-xs text-red-600 text-center">Upload your resume in your profile before applying.</p>
                  )}
                  {isJobSeeker && !checkingResume && resumeCheckFailed && (
                    <p className="text-xs text-yellow-600 text-center">Unable to verify your resume status. Applying may fail if no resume is uploaded.</p>
                  )}
                </div>
            </div>

            <div className="sidebar-card bg-gray-50 rounded-lg p-5 border border-gray-300 shadow-md">
              <h4 className="font-semibold mb-4 text-start text-lg font-bold">About Company</h4>
              <div className="company-info flex flex-col items-center">
                <div className="company-logo-large w-24 h-24 flex items-center justify-center rounded-full mb-0 overflow-hidden bg-gray-100">
                  <img 
                    src={getLogoSrc(job)}
                    alt={job.company_name || 'Company Logo'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/Job Portal-logo-transparent.png';
                    }}
                  />
                </div>
                <h5 id="company-name-detail" className="company-name text-blue-600 text-center font-semibold mb-3">{job.company_name || 'Company'}</h5>
                <div className="company-details w-full text-sm text-gray-700 dark:text-gray-200">
                  <div className="flex justify-start">
                    <span className="font-medium">Category:</span>
                    <span id="company-industry" className="text-left">{job.category}</span>
                  </div>
                  <div className="flex justify-start">
                    <span className="font-medium">Type:</span>
                    <span id="company-type" className="text-left">{job.job_type}</span>
                  </div>
                  <div className="flex justify-start">
                    <span className="font-medium">Location:</span>
                    <span id="company-location" className="text-left">{job.location}</span>
                  </div>
                </div>
                {/* Back to Jobs button moved below main job content */}
              </div>
            </div>

            <div className="sidebar-card rounded-lg p-5 border border-gray-300 shadow-md bg-gray-50">
              <h4 className="font-semibold mb-2 text-lg font-bold">Job Statistics</h4>
              <div className="job-stats text-sm text-gray-700 dark:text-gray-200">
                <p><strong>Applications:</strong> <span id="application-count">{job.applications || 0} candidates</span></p>
                <p><strong>Views:</strong> <span id="view-count">{job.views || 0} views</span></p>
                <p><strong>Category:</strong> <span id="job-category">{job.category || 'General'}</span></p>
              </div>
            </div>

            {/* Back to Jobs button directly under the Apply card */}
            <div className="mt-4 flex justify-center">
              <Link to="/jobs" className="inline-block border border-blue-600 text-blue-600 shadow-md hover:shadow-lg duration-200 py-2 px-4 rounded">Back to Jobs</Link>
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}
