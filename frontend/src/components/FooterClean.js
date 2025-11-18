import React from 'react';
import { Link } from 'react-router-dom';

const FooterClean = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    company: [
      { name: 'About Us', to: { pathname: '/', hash: '#about' } },
      { name: 'Careers', to: '/jobs' },
      { name: 'Press', to: { pathname: '/', hash: '#about' } },
      { name: 'Blog', to: '/jobs' }
    ],
    jobSeekers: [
      { name: 'Browse Jobs', to: '/jobs' },
      { name: 'Career Advice', to: { pathname: '/', hash: '#how' } },
      { name: 'Resume Builder', to: '/seeker/profile' },
      { name: 'Salary Guide', to: '/jobs' }
    ],
    employers: [
      { name: 'Post a Job', to: '/dashboard' },
      { name: 'Talent Search', to: '/dashboard' },
      { name: 'Pricing', to: '/dashboard' },
      { name: 'Enterprise', to: '/dashboard' }
    ],
    support: [
      { name: 'Help Center', to: { pathname: '/', hash: '#help-center' } },
      { name: 'Contact Us', to: { pathname: '/', hash: '#contact' } },
      { name: 'Privacy Policy', to: { pathname: '/', hash: '#privacy-policy' } },
      { name: 'Terms of Service', to: { pathname: '/', hash: '#terms-of-service' } }
    ]
  };

  const socialLinks = [
    { name: 'Facebook', icon: 'fab fa-facebook-f', href: '#facebook', color: 'hover:bg-blue-600' },
    { name: 'Twitter', icon: 'fab fa-twitter', href: '#twitter', color: 'hover:bg-blue-400' },
    { name: 'LinkedIn', icon: 'fab fa-linkedin-in', href: '#linkedin', color: 'hover:bg-blue-700' },
    { name: 'Instagram', icon: 'fab fa-instagram', href: '#instagram', color: 'hover:bg-pink-500' }
  ];

  const bottomLinks = [
    { name: 'Privacy Policy', to: { pathname: '/', hash: '#privacy-policy' } },
    { name: 'Terms of Service', to: { pathname: '/', hash: '#terms-of-service' } },
    { name: 'Cookie Policy', to: { pathname: '/', hash: '#cookie-policy' } }
  ];

  const renderNavLink = (link, className) => {
    if (link.href) {
      const isExternal = /^(https?:|mailto:|tel:)/i.test(link.href);
      return (
        <a
          href={link.href}
          className={className}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
        >
          {link.name}
        </a>
      );
    }

    return (
      <Link to={link.to} className={className}>
        {link.name}
      </Link>
    );
  };

  return (
  <footer id="contact" className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          
          {/* Company Info */}
          <div className="lg:col-span-1">
            <div className="flex items-center space-x-3 mb-4">
              <div>
                <img 
                  src="/Job Portal-logo-transparent.png" 
                  alt="JobPortal Logo" 
                  className="h-32 w-auto"
                />
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Connecting talented professionals with amazing career opportunities worldwide.
            </p>
            
            {/* Social Links */}
            <div className="flex space-x-3">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  className={`w-10 h-10 border shadow-sm ${social.color} dark:${social.color} text-gray-600 hover:text-white rounded-lg flex items-center justify-center transition duration-200 sm:hover:shadow-md shadow-md`}
                  aria-label={social.name}
                >
                  <i className={social.icon}></i>
                </a>
              ))}
            </div>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Company
            </h3>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  {renderNavLink(
                    link,
                    'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition duration-200'
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Job Seekers Links */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Job Seekers
            </h3>
            <ul className="space-y-2">
              {footerLinks.jobSeekers.map((link) => (
                <li key={link.name}>
                  {renderNavLink(
                    link,
                    'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition duration-200'
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Employers Links */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Employers
            </h3>
            <ul className="space-y-2">
              {footerLinks.employers.map((link) => (
                <li key={link.name}>
                  {renderNavLink(
                    link,
                    'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition duration-200'
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Support
            </h3>
            <ul className="space-y-2">
              {footerLinks.support.map((link) => (
                <li key={link.name}>
                  {renderNavLink(
                    link,
                    'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition duration-200'
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-600 dark:text-gray-300 text-sm mb-4 md:mb-0">
              © {currentYear} JobPortal. All rights reserved.
            </div>
            
            <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600 dark:text-gray-300">
              {bottomLinks.map((link) => (
                <React.Fragment key={link.name}>
                  {renderNavLink(
                    link,
                    'hover:text-blue-600 dark:hover:text-blue-400 transition duration-200'
                  )}
                </React.Fragment>
              ))}
              <div className="flex items-center">
                <i className="fas fa-heart text-red-500 mx-1"></i>
                Made in Cambodia
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default FooterClean;