import React, { useState, useEffect } from 'react';
import api from '../services/api';

const HeroSectionClean = () => {
  const [stats, setStats] = useState({
    total_jobs: 0,
    total_companies: 0,
    total_seekers: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get('/jobs/stats.php');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  return (
    <section id="home" className="bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="text-center mb-16">
          {/* Main heading */}
          <h2 className="text-4xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Find Your Dream
            <span className="text-blue-600 block">Job Today</span>
          </h2>
          
          {/* Subtitle */}
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Connect with top employers and discover opportunities that match your skills and aspirations. Your career journey starts here.
          </p>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center border border-gray-200 dark:border-gray-700">
            <div className="text-3xl font-bold text-blue-600 mb-2">{stats.total_jobs.toLocaleString()}+</div>
            <div className="text-gray-600 dark:text-gray-300">Active Jobs</div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center border border-gray-200 dark:border-gray-700">
            <div className="text-3xl font-bold text-green-600 mb-2">{stats.total_companies.toLocaleString()}+</div>
            <div className="text-gray-600 dark:text-gray-300">Companies</div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center border border-gray-200 dark:border-gray-700">
            <div className="text-3xl font-bold text-purple-600 mb-2">{stats.total_seekers.toLocaleString()}+</div>
            <div className="text-gray-600 dark:text-gray-300">Job Seekers</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSectionClean;