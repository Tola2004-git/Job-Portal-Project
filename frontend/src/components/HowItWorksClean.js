import React from 'react';

const HowItWorksClean = () => {
  const steps = [
    {
      id: 1,
      title: "Create Your Profile",
      description: "Sign up and build a comprehensive profile showcasing your skills, experience, and career goals.",
      icon: "fas fa-user-plus",
      color: "blue"
    },
    {
      id: 2,
      title: "Search & Discover",
      description: "Browse through thousands of job opportunities using our advanced search and filtering options.",
      icon: "fas fa-search",
      color: "green"
    },
    {
      id: 3,
      title: "Apply with Ease",
      description: "Submit applications quickly with your saved profile information and custom cover letters.",
      icon: "fas fa-paper-plane",
      color: "purple"
    },
    {
      id: 4,
      title: "Get Hired",
      description: "Connect with employers, schedule interviews, and land your dream job with our support.",
      icon: "fas fa-handshake",
      color: "orange"
    }
  ];

  const getColorClasses = (color) => {
    const colorMap = {
      blue: {
        bg: "bg-blue-100 dark:bg-blue-900",
        text: "text-blue-600 dark:text-blue-400",
        border: "border-blue-200 dark:border-blue-700"
      },
      green: {
        bg: "bg-green-100 dark:bg-green-900",
        text: "text-green-600 dark:text-green-400",
        border: "border-green-200 dark:border-green-700"
      },
      purple: {
        bg: "bg-purple-100 dark:bg-purple-900",
        text: "text-purple-600 dark:text-purple-400",
        border: "border-purple-200 dark:border-purple-700"
      },
      orange: {
        bg: "bg-orange-100 dark:bg-orange-900",
        text: "text-orange-600 dark:text-orange-400",
        border: "border-orange-200 dark:border-orange-700"
      }
    };
    return colorMap[color] || colorMap.blue;
  };

  return (
  <section id="how" className="bg-gray-50 dark:bg-gray-900 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            How It Works
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Finding your perfect job has never been easier. Follow these simple steps to kickstart your career journey.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => {
            const colors = getColorClasses(step.color);
            return (
              <div
                key={step.id}
                className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center hover:shadow-lg transition duration-200"
              >
                {/* Step Number */}
                <div className={`absolute -top-4 left-1/2 transform -translate-x-1/2 w-8 h-8 ${colors.bg} ${colors.border} border-2 rounded-full flex items-center justify-center`}>
                  <span className={`text-sm font-bold ${colors.text}`}>
                    {step.id}
                  </span>
                </div>

                {/* Icon */}
                <div className={`w-16 h-16 mx-auto mb-4 ${colors.bg} rounded-full flex items-center justify-center mt-4`}>
                  <i className={`${step.icon} text-2xl ${colors.text}`}></i>
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  {step.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                  {step.description}
                </p>

                {/* Connection Line (except for last item) */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 -right-4 w-8 h-0.5 bg-gray-300 dark:bg-gray-600"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksClean;