import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import jobSeekerService from '../services/jobSeekerService';
import { showToast } from '../components/Toaster';
import NavigationClean from '../components/NavigationClean';

const JOB_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'full-time', label: 'Full Time' },
  { value: 'part-time', label: 'Part Time' },
  { value: 'remote', label: 'Remote' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' }
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'technology', label: 'Technology' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'finance', label: 'Finance' },
  { value: 'healthcare', label: 'Healthcare' }
];

const normalizeJobTypeParam = (value) => {
  if (!value) return '';
  return value.trim().toLowerCase().replace(/[_\s]+/g, '-');
};

const normalizeCategoryParam = (value) => {
  if (!value) return '';
  return value.trim().toLowerCase();
};

export default function JobsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');
  const [jobType, setJobType] = useState(() => normalizeJobTypeParam(searchParams.get('jobType')));
  const [category, setCategory] = useState(() => normalizeCategoryParam(searchParams.get('category')));
  const [salary, setSalary] = useState('');
  const [posted, setPosted] = useState('');
  const [sortBy, setSortBy] = useState('date');
  
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    current_page: 1,
    total_pages: 1,
    total_jobs: 0
  });
  const [applyingJobId, setApplyingJobId] = useState(null);
  const [appliedJobs, setAppliedJobs] = useState(new Set());

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

  // Social icons template
  const socialIcons = useMemo(() => ([
    { name: 'Facebook', icon: 'fab fa-facebook-f', color: 'text-blue-600' },
    { name: 'Twitter', icon: 'fab fa-twitter', color: 'text-blue-400' },
    { name: 'LinkedIn', icon: 'fab fa-linkedin-in', color: 'text-blue-700' },
    { name: 'Instagram', icon: 'fab fa-instagram', color: 'text-pink-500' }
  ]), []);

  const handleApplyJob = async (jobId) => {
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
        setAppliedJobs(prev => new Set([...prev, jobId]));
        showToast('You have already applied for this job', 'info');
      } else {
        showToast(error.message || 'Failed to submit application', 'error');
      }
    } finally {
      setApplyingJobId(null);
    }
  };

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

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      
      // Build query params
      const params = new URLSearchParams();
      params.append('limit', '50'); // Show more jobs on this page
      if (keyword) params.append('keyword', keyword);
      if (location) params.append('location', location);
      if (jobType) params.append('jobType', normalizeJobTypeParam(jobType));
      if (category) params.append('category', normalizeCategoryParam(category));
      
      const response = await api.get(`/jobs/public.php?${params.toString()}`);
      
      if (response.data.success) {
        let fetchedJobs = response.data.data.jobs.map(job => ({
          ...job,
          socialIcons: socialIcons,
          tags: job.skills || []
        }));
        
        // Apply posted date filter (client-side)
        if (posted) {
          const daysAgo = parseInt(posted);
          fetchedJobs = fetchedJobs.filter(job => {
            if (job.posted === 'Today') return daysAgo >= 1;
            const match = job.posted.match(/(\d+) day/);
            if (match) {
              return parseInt(match[1]) <= daysAgo;
            }
            return false;
          });
        }
        
        // Apply salary filter (client-side)
        if (salary) {
          const [min, max] = salary.split('-').map(s => parseInt(s));
          fetchedJobs = fetchedJobs.filter(job => {
            const salaryMatch = job.salary.match(/\$(\d+)/);
            if (salaryMatch) {
              const jobSalary = parseInt(salaryMatch[1]);
              return jobSalary >= min && (!max || jobSalary <= max);
            }
            return true;
          });
        }
        
        // Apply sorting
        if (sortBy === 'salary') {
          fetchedJobs.sort((a, b) => {
            const getSalary = (s) => {
              const match = s.match(/\$(\d+)/);
              return match ? parseInt(match[1]) : 0;
            };
            return getSalary(b.salary) - getSalary(a.salary);
          });
        }
        
        setJobs(fetchedJobs);
        setPagination(response.data.data.pagination);
      } else {
        setError('Failed to load jobs');
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
      setError('Failed to load jobs. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [keyword, location, jobType, category, posted, salary, sortBy, socialIcons]);

  const loadAppliedJobs = useCallback(async () => {
    try {
      const applications = await jobSeekerService.getApplications();
      const appliedJobIds = new Set(applications.map(app => app.job_id));
      setAppliedJobs(appliedJobIds);
    } catch (error) {
      console.error('Error loading applied jobs:', error);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (isJobSeeker) {
      loadAppliedJobs();
    }
  }, [isJobSeeker, loadAppliedJobs]);

  const filtered = useMemo(() => jobs, [jobs]);

  return (
    <>
      <NavigationClean />
      <section id="jobs" className="bg-white dark:bg-gray-800 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">Featured Jobs</h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">Discover handpicked opportunities from top companies that are actively hiring talented professionals.</p>
            <div className="mt-4">
              <Link to="/" className="text-blue-600 hover:underline">Back to Home</Link>
            </div>
          </div>

          <div className="search-box mb-6">
            <div className="search-form flex flex-col sm:flex-row gap-3 items-stretch">
              <div className="search-input flex items-center border border-gray-500 rounded-md px-3 py-2 flex-1">
                <i className="fas fa-search mr-3 text-gray-500"></i>
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-full bg-transparent outline-none"
                  placeholder="Job title, company, keywords..."
                />
              </div>

              <div className="search-input flex items-center border border-gray-500 rounded-md px-3 py-2 flex-1">
                <i className="fas fa-map-marker-alt mr-3 text-gray-400"></i>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-transparent outline-none"
                  placeholder="City, state, country..."
                />
              </div>

              <button
                className="search-btn border border-blue-600 text-blue-600 px-4 py-2 rounded-md transition duration-200 shadow-sm hover:shadow-lg flex items-center justify-center space-x-2 hover:scale-105"
                onClick={() => fetchJobs()}
              >
                <i className="fas fa-search mr-2"></i> Search Jobs
              </button>
            </div>
          </div>

          <div className="filter-section mb-6">
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }} className="mb-3 text-transparent bg-clip-text" >
              <span style={{ background: 'linear-gradient(135deg, #6a11cb, #2575fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Advanced Filters</span>
            </h3>
            <div className="filter-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="filter-group">
                <label className="filter-label block text-sm text-gray-700">Job Type</label>
                <select
                  className="filter-select mt-1 block w-full border border-gray-500 appearance-none outline-none rounded-md p-2"
                  id="job-type-filter"
                  value={jobType}
                  onChange={e => setJobType(normalizeJobTypeParam(e.target.value))}
                >
                  {JOB_TYPE_OPTIONS.map(option => (
                    <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label block text-sm text-gray-700">Category</label>
                <select
                  className="filter-select mt-1 block w-full border border-gray-500 appearance-none outline-none rounded-md p-2"
                  id="category-filter"
                  value={category}
                  onChange={e => setCategory(normalizeCategoryParam(e.target.value))}
                >
                  {CATEGORY_OPTIONS.map(option => (
                    <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label block text-sm text-gray-700">Salary Range</label>
                <select className="filter-select mt-1 block w-full border border-gray-500 appearance-none outline-none rounded-md p-2" id="salary-filter" value={salary} onChange={e=>setSalary(e.target.value)}>
                  <option value="">Any Salary</option>
                  <option value="0-500">$0 - $500</option>
                  <option value="500-800">$500 - $800</option>
                  <option value="800-1200">$800 - $1,200</option>
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label block text-sm text-gray-700">Posted</label>
                <select className="filter-select mt-1 block w-full border border-gray-500 rounded-md appearance-none outline-none p-2" id="posted-filter" value={posted} onChange={e=>setPosted(e.target.value)}>
                  <option value="">Any Time</option>
                  <option value="1">Last 24 hours</option>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                </select>
              </div>
            </div>
          </div>

          <div className="results-info flex items-center justify-between mb-4">
            <div className="results-count text-lg font-medium">
              {loading ? (
                <span>Loading...</span>
              ) : (
                <span><span id="results-count">{filtered.length}</span> Jobs Found</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Sort by:</label>
              <select className="sort-select border border-gray-500 outline-none appearance-none rounded-md p-2" id="sort-select" value={sortBy} onChange={e=>setSortBy(e.target.value)}>
                <option value="date">Date Posted</option>
                <option value="relevance">Relevance</option>
                <option value="salary">Salary</option>
              </select>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
              <p className="text-gray-600 dark:text-gray-300">Loading jobs...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="text-center py-12">
              <i className="fas fa-exclamation-triangle text-4xl text-red-600 mb-4"></i>
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {/* Jobs Grid */}
          {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="jobs-results">
            {filtered.map((job) => (
              <article key={job.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-6 hover:shadow-lg transition duration-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-16 h-16 flex items-center justify-center">
                      <img
                        src={getLogoSrc(job)}
                        alt="Company Logo"
                        className="h-16 w-16 object-cover rounded-full border border-gray-300"
                        onError={(e) => { e.target.onerror = null; e.target.src = '/Job Portal-logo-transparent.png'; }}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{job.title}</h3>
                      <p className="text-gray-600 dark:text-gray-300">{job.company}</p>
                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-red-500 transition duration-200" aria-label="Save job"><i className="far fa-heart text-lg"></i></button>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-gray-600 dark:text-gray-300 text-sm"><i className="fas fa-map-marker-alt mr-2"></i>{job.location}</div>
                  <div className="flex items-center text-gray-600 dark:text-gray-300 text-sm"><i className="fas fa-clock mr-2"></i>{job.type}</div>
                  <div className="flex items-center text-gray-600 dark:text-gray-300 text-sm"><i className="fas fa-dollar-sign mr-2"></i>{job.salary}</div>
                  <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm"><i className="fas fa-calendar mr-2"></i>Posted {job.posted}</div>
                </div>

                <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">{job.description}</p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {job.tags.map((t) => (
                    <span key={t} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">{t}</span>
                  ))}
                </div>

                {/* Social Media Icons (Follow us) */}
                <div className="flex items-center space-x-3 mb-4">
                  <span className="text-gray-500 text-sm font-medium">Follow us:</span>
                  {(
                    job.socialIcons || [
                      { name: 'Facebook', icon: 'fab fa-facebook-f', color: 'text-blue-600' },
                      { name: 'Twitter', icon: 'fab fa-twitter', color: 'text-blue-400' },
                      { name: 'LinkedIn', icon: 'fab fa-linkedin-in', color: 'text-blue-700' },
                      { name: 'Instagram', icon: 'fab fa-instagram', color: 'text-pink-500' }
                    ]
                  ).map((social, idx) => {
                    const urlMap = {
                      Facebook: 'https://www.facebook.com',
                      Twitter: 'https://www.twitter.com',
                      LinkedIn: 'https://www.linkedin.com',
                      Instagram: 'https://www.instagram.com'
                    };
                    const href = urlMap[social.name] || '#';
                    return (
                      <a key={idx} href={href} target="_blank" rel="noopener noreferrer" className={`${social.color} hover:opacity-75 transition duration-200`} aria-label={social.name}>
                        <i className={`${social.icon} text-lg`}></i>
                      </a>
                    );
                  })}
                </div>

                <div className="flex space-x-2">
                  <button 
                    onClick={() => handleApplyJob(job.id)}
                    disabled={applyingJobId === job.id || appliedJobs.has(job.id)}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm border shadow-md hover:shadow-lg hover:scale-105 duration-200 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                      appliedJobs.has(job.id)
                        ? 'border-green-300 bg-green-50 text-green-700'
                        : 'border-blue-300 text-blue-500'
                    }`}
                  >
                    {applyingJobId === job.id ? (
                      <><i className="fas fa-spinner fa-spin mr-1"></i>Applying...</>
                    ) : appliedJobs.has(job.id) ? (
                      <><i className="fas fa-check-circle mr-1"></i>Applied</>
                    ) : (
                      'Apply Now'
                    )}
                  </button>
                  <Link to={`/jobs/${job.id}`} className="px-4 py-2 border border-none text-green-800 rounded-lg hover:bg-gray-50 transition duration-200 flex items-center justify-center" aria-label={`View details for ${job.title}`}>
                    <i className="fas fa-eye"></i>
                  </Link>
                </div>
              </article>
            ))}
          </div>
          )}
        </div>
      </section>
    </>
  );
}
