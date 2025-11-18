import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import NavigationClean from './components/NavigationClean';
import HeroSectionClean from './components/HeroSectionClean';
import FeaturedJobsClean from './components/FeaturedJobsClean';
import HowItWorksClean from './components/HowItWorksClean';
import AboutSectionClean from './components/AboutSectionClean';
import FooterClean from './components/FooterClean';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import EmployerDashboard from './pages/EmployerDashboard';
import JobSeekerDashboard from './pages/JobSeekerDashboard';
import JobsPage from './pages/JobsPage';
import JobDetailsPage from './pages/JobDetailsPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminProfile from './pages/AdminProfile';
import EmployerProfile from './pages/EmployerProfile';
import SeekerProfilePage from './pages/SeekerProfilePage';
import Toaster from './components/Toaster';
import Toast from './components/Toast';
import useInactivityLogout from './hooks/useInactivityLogout';

const getDefaultRouteForRole = (role) => {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'employer':
      return '/dashboard';
    case 'job_seeker':
      return '/seeker/dashboard';
    default:
      return '/';
  }
};

const ProtectedRoute = ({ allowedRoles, children }) => {
  const location = useLocation();
  const token = localStorage.getItem('authToken');
  const userRaw = localStorage.getItem('user');
  let user = null;

  if (userRaw) {
    try {
      user = JSON.parse(userRaw);
    } catch (error) {
      user = null;
    }
  }

  if (!token || !user) {
    localStorage.setItem('redirectAfterLogin', location.pathname + location.search);
    return <Navigate to="/login" replace />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    const fallback = getDefaultRouteForRole(user.role);
    return <Navigate to={fallback} replace />;
  }

  return children;
};

function HomePage() {
  const [toast, setToast] = useState(null);
  
  useEffect(() => {
    // Check for logout toast flag
    const showLogoutToast = localStorage.getItem('showLogoutToast');
    if (showLogoutToast === 'true') {
      localStorage.removeItem('showLogoutToast');
      setToast({
        message: 'Logout successful! See you again soon!',
        type: 'success'
      });
    }
  }, []);
  
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
      
      <NavigationClean />
      <HeroSectionClean />
      <FeaturedJobsClean />
      <HowItWorksClean />
      <AboutSectionClean />
      <FooterClean />
    </>
  );
}

function App() {
  useInactivityLogout();

  return (
    <BrowserRouter>
      <ScrollRestoration />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/dashboard"
          element={(
            <ProtectedRoute allowedRoles={[ 'employer' ]}>
              <EmployerDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/employer/profile"
          element={(
            <ProtectedRoute allowedRoles={[ 'employer' ]}>
              <EmployerProfile />
            </ProtectedRoute>
          )}
        />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/:id" element={<JobDetailsPage />} />
        <Route
          path="/seeker"
          element={(
            <ProtectedRoute allowedRoles={[ 'job_seeker' ]}>
              <JobSeekerDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/seeker/dashboard"
          element={(
            <ProtectedRoute allowedRoles={[ 'job_seeker' ]}>
              <JobSeekerDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/seeker/profile"
          element={(
            <ProtectedRoute allowedRoles={[ 'job_seeker' ]}>
              <SeekerProfilePage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/admin"
          element={(
            <ProtectedRoute allowedRoles={[ 'admin' ]}>
              <AdminDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/admin/profile"
          element={(
            <ProtectedRoute allowedRoles={[ 'admin' ]}>
              <AdminProfile />
            </ProtectedRoute>
          )}
        />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;

function ScrollRestoration() {
  const location = useLocation();
  const previousLocationRef = useRef(location);

  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useLayoutEffect(() => {
    const previousLocation = previousLocationRef.current;
    if (previousLocation && getStorageKey(previousLocation) !== getStorageKey(location)) {
      saveScrollPosition(previousLocation);
    }

    previousLocationRef.current = location;
    restoreScrollPosition(location);
  }, [location]);

  useEffect(() => {
    const saveOnHide = () => saveScrollPosition(location);

    window.addEventListener('beforeunload', saveOnHide);
    window.addEventListener('pagehide', saveOnHide);

    return () => {
      window.removeEventListener('beforeunload', saveOnHide);
      window.removeEventListener('pagehide', saveOnHide);
    };
  }, [location]);

  return null;
}

function saveScrollPosition(location) {
  const key = getStorageKey(location);
  sessionStorage.setItem(key, JSON.stringify({ x: window.scrollX, y: window.scrollY }));
}

function restoreScrollPosition(location) {
  const key = getStorageKey(location);
  const raw = sessionStorage.getItem(key);

  if (!raw) {
    if (location.hash) {
      const target = document.querySelector(location.hash.replace(/\s/g, '\\ '));
      if (target) {
        window.requestAnimationFrame(() => target.scrollIntoView({ behavior: 'auto', block: 'start' }));
        return;
      }
    }

    window.requestAnimationFrame(() => window.scrollTo(0, 0));
    return;
  }

  try {
    const { x = 0, y = 0 } = JSON.parse(raw);
    window.requestAnimationFrame(() => window.scrollTo(x, y));
  } catch (error) {
    window.requestAnimationFrame(() => window.scrollTo(0, 0));
  }
}

function getStorageKey(location) {
  return `scroll-pos:${location.pathname}${location.search}${location.hash ?? ''}`;
}
