import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import jobSeekerService from '../services/jobSeekerService';
import { showToast } from './Toaster';

const FeaturedJobsClean = () => {
  const navigate = useNavigate();
  const [appliedJobs, setAppliedJobs] = useState(new Set());
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [applyingJobId, setApplyingJobId] = useState(null);
  const [savedJobs, setSavedJobs] = useState(new Set());

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

  // Social icons template (same for all jobs)
  const socialIcons = [
    { name: "Facebook", icon: "fab fa-facebook-f", color: "text-blue-600" },
    { name: "Twitter", icon: "fab fa-twitter", color: "text-blue-400" },
    { name: "LinkedIn", icon: "fab fa-linkedin-in", color: "text-blue-700" },
    { name: "Instagram", icon: "fab fa-instagram", color: "text-pink-500" }
  ];

  useEffect(() => {
    fetchJobs();
    if (isJobSeeker) {
      loadAppliedJobs();
      loadSavedJobs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Normalize logo source from various possible fields
  const getLogoSrc = (job) => {
    // The API returns 'logo' field from public.php which already contains the avatar
    const candidate = job.logo || job.company_logo || job.avatar || job.employer_avatar || job.company_avatar || job.companyLogo || null;
    if (!candidate) return '/Job Portal-logo-transparent.png';
    if (typeof candidate !== 'string') return '/Job Portal-logo-transparent.png';
    const trimmed = candidate.trim();
    if (!trimmed) return '/Job Portal-logo-transparent.png';
    // If already a data URI or absolute URL, use as-is
    if (trimmed.startsWith('data:')) return trimmed;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    // Otherwise it's a relative path, add backend URL
    const p = trimmed.replace(/^\/+/, '');
    return `http://localhost/Job_Portal_Project/backend/${p}`;
  };

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/jobs/public.php?limit=6');
      
      if (response.data.success) {
        // Add social icons to each job
        const jobsWithSocial = response.data.data.jobs.map(job => ({
          ...job,
          socialIcons: socialIcons
        }));
        setJobs(jobsWithSocial);
      } else {
        setError('Failed to load jobs');
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
      setError('Failed to load jobs. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const loadAppliedJobs = async () => {
    try {
      const applications = await jobSeekerService.getApplications();
      const appliedJobIds = new Set(applications.map(app => app.job_id));
      setAppliedJobs(appliedJobIds);
    } catch (error) {
      console.error('Error loading applied jobs:', error);
    }
  };

  const loadSavedJobs = async () => {
    try {
      const saved = await jobSeekerService.getSavedJobs();
      const savedJobIds = new Set(saved.map(job => job.job_id));
      setSavedJobs(savedJobIds);
    } catch (error) {
      console.error('Error loading saved jobs:', error);
    }
  };

  const handleApply = async (jobId) => {
    if (!isJobSeeker) {
      showToast('Please login as a job seeker to apply', 'error');
      navigate('/login');
      return;
    }

    // Show confirmation dialog
    const confirmApply = window.confirm('Are you sure you want to apply for this job?');
    if (!confirmApply) {
      return;
    }

    try {
      setApplyingJobId(jobId);
      await jobSeekerService.applyForJob(jobId);
      setAppliedJobs(prev => new Set([...prev, jobId]));
      showToast('Application submitted successfully!', 'success');
    } catch (error) {
      if (error.message && error.message.includes('already applied')) {
        showToast('You have already applied for this job', 'info');
        setAppliedJobs(prev => new Set([...prev, jobId]));
      } else {
        showToast(error.message || 'Failed to submit application', 'error');
      }
    } finally {
      setApplyingJobId(null);
    }
  };

  const handleSave = async (jobId) => {
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
      await jobSeekerService.saveJob(jobId);
      setSavedJobs(prev => new Set([...prev, jobId]));
      showToast('Job saved successfully!', 'success');
    } catch (error) {
      if (error.message && error.message.includes('already saved')) {
        setSavedJobs(prev => new Set([...prev, jobId]));
        showToast('Job already saved', 'info');
      } else {
        showToast(error.message || 'Failed to save job', 'error');
      }
    }
  };

  return (
  <section id="jobs" className="bg-white dark:bg-gray-800 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Featured Jobs
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Discover handpicked opportunities from top companies that are actively hiring talented professionals.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
            <p className="text-gray-600 dark:text-gray-300">Loading jobs...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <i className="fas fa-exclamation-triangle text-4xl text-red-600 mb-4"></i>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Jobs Grid */}
        {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-6 hover:shadow-lg transition duration-200"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-20 h-20 flex items-center justify-center">
                    <img
                      src={getLogoSrc(job)}
                      alt="Company Logo"
                      className="h-20 w-20 object-cover rounded-full border border-gray-300"
                      onError={(e) => { e.target.onerror = null; e.target.src = '/Job Portal-logo-transparent.png'; }}
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                      {job.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">{job.company}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleSave(job.id)}
                  disabled={savedJobs.has(job.id)}
                  className={`transition duration-200 disabled:cursor-not-allowed ${
                    savedJobs.has(job.id)
                      ? 'text-red-500'
                      : 'text-gray-400 hover:text-red-500'
                  }`}
                  aria-label={savedJobs.has(job.id) ? 'Job saved' : 'Save job'}
                >
                  <i className={`${savedJobs.has(job.id) ? 'fas' : 'far'} fa-heart text-lg`}></i>
                </button>
              </div>

              {/* Job Details */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-gray-600 dark:text-gray-300 text-sm">
                  <i className="fas fa-map-marker-alt mr-2"></i>
                  {job.location}
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-300 text-sm">
                  <i className="fas fa-clock mr-2"></i>
                  {job.type}
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-300 text-sm">
                  <i className="fas fa-dollar-sign mr-2"></i>
                  {job.salary}
                </div>
                <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm">
                  <i className="fas fa-calendar mr-2"></i>
                  Posted {job.posted}
                </div>
              </div>

              {/* Description */}
              <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">
                {job.description}
              </p>

              {/* Skills */}
              <div className="flex flex-wrap gap-2 mb-4">
                {job.skills.map((skill, index) => (
                  <span
                    key={index}
                    className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>

              {/* Social Media Icons */}
              {job.socialIcons && (
                <div className="flex items-center space-x-3 mb-4">
                  <span className="text-gray-500 text-sm font-medium">Follow us:</span>
                  {job.socialIcons.map((social, index) => {
                    // Map social name to a real placeholder URL for accessibility
                    const urlMap = {
                      Facebook: 'https://www.facebook.com',
                      Twitter: 'https://www.twitter.com',
                      LinkedIn: 'https://www.linkedin.com',
                      Instagram: 'https://www.instagram.com'
                    };
                    const href = urlMap[social.name] || '#';
                    return (
                      <a
                        key={index}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${social.color} hover:opacity-75 transition duration-200`}
                        aria-label={social.name}
                      >
                        <i className={`${social.icon} text-lg`}></i>
                      </a>
                    );
                  })}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-2">
                <button
                  onClick={() => handleApply(job.id)}
                  disabled={appliedJobs.has(job.id) || applyingJobId === job.id}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition duration-200 ${
                    appliedJobs.has(job.id)
                      ? 'bg-green-100 border border-green-200 text-green-800 cursor-not-allowed shadow-sm'
                      : 'border border-blue-300 text-blue-500 shadow-md hover:shadow-lg duration-200 hover:scale-105'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {applyingJobId === job.id ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-1"></i>
                      Applying...
                    </>
                  ) : appliedJobs.has(job.id) ? (
                    <>
                      <i className="fas fa-check mr-1"></i>
                      Applied
                    </>
                  ) : (
                    'Apply Now'
                  )}
                </button>
                <Link
                  to={`/jobs/${job.id}`}
                  className="px-4 py-2 border border-none text-green-800 rounded-lg hover:bg-gray-50 transition duration-200 flex items-center justify-center"
                  aria-label={`View details for ${job.title}`}
                >
                  <i className="fas fa-eye"></i>
                </Link>
              </div>
            </div>
          ))}
        </div>
        )}

  {/* View All Jobs Button */}
        {!loading && !error && (
        <div className="text-center">
          <Link
            to="/jobs"
            className="inline-flex items-center border border-blue-300 text-blue-500 font-medium py-3 px-6 rounded-lg transition duration-200 shadow-md hover:shadow-lg hover:scale-105"
          >
            View All Jobs
          </Link>
        </div>
        )}
      </div>
    </section>
  );
};

export default FeaturedJobsClean;