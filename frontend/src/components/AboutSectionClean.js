import React from 'react';

const AboutSectionClean = () => {
  const features = [
    {
      title: "Global Reach",
      description: "Connect with opportunis worldwide",
      icon: "fas fa-globe",
      stats: "50+ Countries"
    },
    {
      title: "Industry Experts", 
      description: "Get guidance from experienced career professionals",
      icon: "fas fa-users",
      stats: "500+ Mentors"
    },
    {
      title: "Smart Matching",
      description: "AI-powered job recommendations based on your profile",
      icon: "fas fa-brain",
      stats: "95% Match Rate"
    },
    {
      title: "Success Stories",
      description: "Join thousands who found their dream jobs through us",
      icon: "fas fa-trophy",
      stats: "10,000+ Hired"
    }
  ];



  return (
  <section id="about" className="bg-white dark:bg-gray-800 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Why Choose JobPortal?
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            We're more than just a job board. We're your career partner, dedicated to connecting talented individuals 
            with exceptional opportunities that drive success.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-6 text-center hover:shadow-lg transition duration-200"
            >
              {/* Icon */}
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <i className={`${feature.icon} text-2xl text-blue-600 dark:text-blue-400`}></i>
              </div>

              {/* Stats */}
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                {feature.stats}
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AboutSectionClean;