import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Toast from './Toast';
import { DEFAULT_AVATAR, normalizeAvatar, resolveAvatarSrc } from '../utils/avatar';

const Navigation = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [toast, setToast] = useState(null);
  const [avatarRefresh, setAvatarRefresh] = useState(0);
  const [adminProfile, setAdminProfile] = useState(null);
  
  // Ref for dropdown menu
  const dropdownRef = React.useRef(null);

  // ✅ Get avatar from localStorage based on user role (with avatarRefresh dependency)
  const getAvatarUrl = useCallback(() => {
    const fallback = DEFAULT_AVATAR;

    if (!authUser) {
      return fallback;
    }

    const resolveCandidate = (raw) => {
      if (!raw) {
        return null;
      }
      try {
        return resolveAvatarSrc(normalizeAvatar(raw));
      } catch (error) {
        console.error('❌ Failed to resolve avatar candidate:', error);
        return null;
      }
    };

    try {
      let roleAvatar = null;

      if (authUser.role === 'admin') {
        roleAvatar = localStorage.getItem('adminAvatar');
      } else if (authUser.role === 'employer') {
        roleAvatar = localStorage.getItem('employerAvatar');
      } else if (authUser.role === 'job_seeker') {
        roleAvatar = localStorage.getItem('seekerAvatar');
      }

      const roleResolved = resolveCandidate(roleAvatar);
      if (roleResolved) {
        return roleResolved;
      }

      const userRaw = localStorage.getItem('user');
      if (userRaw) {
        try {
          const user = JSON.parse(userRaw);
          const userResolved = resolveCandidate(user?.avatar);
          if (userResolved) {
            return userResolved;
          }
        } catch (error) {
          console.error('❌ Error parsing user from localStorage:', error);
        }
      }

      const authResolved = resolveCandidate(authUser.avatar);
      if (authResolved) {
        return authResolved;
      }
    } catch (error) {
      console.error('❌ Error getting avatar URL:', error);
    }

    return fallback;
  }, [authUser, avatarRefresh]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };
  
  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // ✅ Load auth state from localStorage
  useEffect(() => {
    const loadAuthState = () => {
      try {
        const token = localStorage.getItem('authToken');
        const userRaw = localStorage.getItem('user');
        
        if (token && userRaw) {
          const parsed = JSON.parse(userRaw);
          const authUserData = {
            email: parsed.email,
            displayName: parsed.full_name || parsed.username,
            role: parsed.role,
            avatar: normalizeAvatar(parsed.avatar),
            id: parsed.id
          };
          setAuthUser(authUserData);
          setIsUserLoggedIn(true);
          
          // Force avatar refresh after loading auth state
          setAvatarRefresh(prev => prev + 1);
          return;
        }
        
        // No auth found
        setAuthUser(null);
        setIsUserLoggedIn(false);
      } catch (error) {
        console.error('❌ Error loading auth state:', error);
        setAuthUser(null);
        setIsUserLoggedIn(false);
      }
    };

    loadAuthState();

    // Listen for localStorage changes
    const handleStorageChange = (e) => {
      if (e.key === 'user' || e.key === 'authToken') {
        loadAuthState();
      }
      // Avatar changes - force re-render
      if (e.key === 'employerAvatar' || e.key === 'seekerAvatar' || e.key === 'adminAvatar') {
        console.log('🔄 Avatar changed in localStorage, refreshing...');
        setAvatarRefresh(prev => prev + 1);
      }
    };

    // Listen for page visibility changes (when user comes back to the page)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 Page visible, checking for avatar updates...');
        setAvatarRefresh(prev => prev + 1);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // ✅ Listen for custom events (profile changes, avatar updates)
  useEffect(() => {
    const handleProfileChange = () => {
      try {
        const userRaw = localStorage.getItem('user');
        if (userRaw) {
          const parsed = JSON.parse(userRaw);
          setAuthUser({
            email: parsed.email,
            displayName: parsed.full_name || parsed.username,
            role: parsed.role,
            avatar: normalizeAvatar(parsed.avatar),
            id: parsed.id
          });
        }
        // Force avatar refresh
        setAvatarRefresh(prev => prev + 1);
      } catch (error) {
        console.error('❌ Error handling profile change:', error);
      }
    };
    
    const handleAvatarChange = () => {
      console.log('🔄 Avatar change event received, refreshing...');
      setAvatarRefresh(prev => prev + 1);
    };

    const handleUserDataRefresh = () => {
      try {
        const token = localStorage.getItem('authToken');
        const userRaw = localStorage.getItem('user');
        
        if (token && userRaw) {
          const parsed = JSON.parse(userRaw);
          setAuthUser({
            email: parsed.email,
            displayName: parsed.full_name || parsed.username,
            role: parsed.role,
            avatar: normalizeAvatar(parsed.avatar),
            id: parsed.id
          });
          setIsUserLoggedIn(true);
        } else {
          setAuthUser(null);
          setIsUserLoggedIn(false);
        }
        // Force avatar refresh
        setAvatarRefresh(prev => prev + 1);
      } catch (error) {
        console.error('❌ Error refreshing user data:', error);
        setAuthUser(null);
        setIsUserLoggedIn(false);
      }
    };
    
    // Register all event listeners
    window.addEventListener('employerProfileChanged', handleProfileChange);
    window.addEventListener('adminProfileChanged', handleProfileChange);
    window.addEventListener('seekerProfileChanged', handleProfileChange);
    window.addEventListener('employerAvatarChanged', handleAvatarChange);
    window.addEventListener('adminAvatarChanged', handleAvatarChange);
    window.addEventListener('seekerAvatarChanged', handleAvatarChange);
    window.addEventListener('userDataRefresh', handleUserDataRefresh);
    
    return () => {
      window.removeEventListener('employerProfileChanged', handleProfileChange);
      window.removeEventListener('adminProfileChanged', handleProfileChange);
      window.removeEventListener('seekerProfileChanged', handleProfileChange);
      window.removeEventListener('employerAvatarChanged', handleAvatarChange);
      window.removeEventListener('adminAvatarChanged', handleAvatarChange);
      window.removeEventListener('seekerAvatarChanged', handleAvatarChange);
      window.removeEventListener('userDataRefresh', handleUserDataRefresh);
    };
  }, []);

  // ✅ Load admin profile (for admin-specific display name)
  useEffect(() => {
    const loadAdminProfile = () => {
      try {
        const raw = localStorage.getItem('adminProfile');
        if (raw) setAdminProfile(JSON.parse(raw));
      } catch (error) {
        console.error('❌ Error loading admin profile:', error);
      }
    };
    
    loadAdminProfile();

    const handleAdminProfileChange = (e) => {
      const data = e?.detail;
      if (data) setAdminProfile(data);
    };

    window.addEventListener('adminProfileChanged', handleAdminProfileChange);
    
    return () => {
      window.removeEventListener('adminProfileChanged', handleAdminProfileChange);
    };
  }, []);

  // ✅ Force avatar refresh when authUser changes or page loads
  useEffect(() => {
    if (authUser) {
      console.log('🔄 AuthUser changed, refreshing avatar...');
      setAvatarRefresh(prev => prev + 1);
    }
  }, [authUser]);

  const handleLogout = () => {
    // Show confirmation dialog
    const confirmed = window.confirm('Are you sure you want to logout?');
    
    if (!confirmed) {
      return; // User cancelled logout
    }
    
    setIsUserLoggedIn(false);
    setIsDropdownOpen(false);
    setAuthUser(null);
    // Clear both old and new format
    try { 
      localStorage.removeItem('authUser'); 
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.setItem('showLogoutToast', 'true');
      window.dispatchEvent(new CustomEvent('authChanged', { detail: null })); 
    } catch (e) {}
    
    // Redirect to home
    window.location.href = '/';
  };

  const resolvedNavAvatar = getAvatarUrl();

  return (
    <>
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={2000}
          onClose={() => setToast(null)}
        />
      )}
      
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={toggleMobileMenu}
        />
      )}

      {/* Navigation */}
      <nav className="bg-white border-b shadow sticky top-0 z-50">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-8xl h-20 ">
          <div className="flex justify-between items-center h-full">
            
            {/* Mobile Menu Toggle (Left) */}
            <button
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              onClick={toggleMobileMenu}
              aria-label="Toggle mobile navigation menu"
            >
              <i className="fas fa-bars text-xl"></i>
            </button>

            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <img 
                  src="/Job Portal-logo-transparent.png" 
                  alt="JobPortal Logo" 
                  className="h-24 w-auto cursor-pointer hover:opacity-80 transition-opacity duration-200"
                />
              </Link>
            </div>

            {/* Center: Navigation Links - Desktop */}
            <div className="hidden lg:flex lg:items-center lg:space-x-8">
              {/* Navigation links removed */}
            </div>

            {/* Right: Auth Buttons + Theme Toggle */}
            <div className="flex items-center space-x-4">
              {/* User not logged in */}
                  {!isUserLoggedIn && (
                <div className="hidden sm:flex items-center space-x-3">
                  <Link
                    to="/login"
                    className="border border-purple-300 rounded-md text-purple-500 px-4 py-3 text-lg font-medium transition duration-200 hover:shadow-lg shadow-md hover:scale-105"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="border border-blue-300 text-blue-500 px-5 py-3 rounded-lg text-lg font-medium transition duration-200 hover:shadow-lg shadow-md hover:scale-105"
                  >
                    Sign Up
                  </Link>
                </div>
              )}

              {/* User logged in */}
              {isUserLoggedIn && authUser && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    className="flex items-center space-x-2 text-gray-700 duration-200 hover:scale-105 focus:outline-none"
                    onClick={toggleDropdown}
                    aria-expanded={isDropdownOpen}
                    aria-haspopup="true"
                  >
                    {/* ✅ Avatar display using normalized source */}
                    <div className="h-10 w-10 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center text-gray-600 overflow-hidden">
                      <img
                        src={resolvedNavAvatar}
                        alt={authUser.displayName || 'User'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_AVATAR;
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {authUser.role === 'admin' 
                        ? (adminProfile ? `${adminProfile.firstName} ${adminProfile.lastName}` : authUser.displayName || authUser.email)
                        : (authUser.displayName || authUser.email)
                      }
                    </span>
                  </button>
                  
                  {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                      {/* <Link to="/" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => setIsDropdownOpen(false)}>
                        <i className="fas fa-home mr-3 text-purple-600"></i>
                        Home
                      </Link> */}
                      <Link to={authUser.role === 'admin' ? '/admin/profile' : authUser.role === 'employer' ? '/employer/profile' : '/seeker/profile'} className="flex items-center px-4 py-2 text-sm text-gray-700  hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => setIsDropdownOpen(false)}>
                        <i className="fas fa-user mr-3 text-blue-600"></i>
                        Profile
                      </Link>
                      <Link to={authUser.role === 'admin' ? '/admin' : authUser.role === 'employer' ? '/dashboard' : '/seeker/dashboard'} className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => setIsDropdownOpen(false)}>
                        <i className="fas fa-tachometer-alt mr-3 text-green-600"></i>
                        Dashboard
                      </Link>
                      <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <i className="fas fa-sign-out-alt mr-3"></i>
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              {/* Mobile navigation links removed */}
              
              {/* Mobile auth buttons */}
              {!isUserLoggedIn && (
                <div className="pt-4 pb-3 border-t border-purple-200">
                  <div className="space-y-1">
                    <Link to="/login" className="text-blue-500 border border-blue-300 block px-4 py-3 rounded-md text-lg font-medium text-center transition duration-200 hover:shadow-lg shadow-md">
                      Login
                    </Link>
                    <Link to="/register" className="border border-red-300 text-red-500 block px-4 py-3 rounded-md text-lg font-medium text-center transition duration-200 hover:shadow-lg shadow-md">
                      Sign Up
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  );
};

export default Navigation;