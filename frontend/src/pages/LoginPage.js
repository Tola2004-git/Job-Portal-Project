import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { authService } from "../services/authService";
import Toast from "../components/Toast";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const getDefaultRoute = (role) => {
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

  const isAllowedRedirect = (role, path) => {
    if (!path || !role) {
      return false;
    }
    const rolePrefixes = {
      admin: ['/admin'],
      employer: ['/dashboard', '/employer'],
      job_seeker: ['/seeker']
    };
    const prefixes = rolePrefixes[role] || [];
    return prefixes.some((prefix) => path.startsWith(prefix));
  };
  
  // Check if coming from registration
  useEffect(() => {
    if (location.state?.registeredEmail) {
      setEmail(location.state.registeredEmail);
      if (location.state.message) {
        setToast({
          message: location.state.message,
          type: 'success'
        });
      }
      // Clear the state
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const togglePassword = () => setShowPassword((p) => !p);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      setLoading(false);
      return;
    }

    try {
      console.log('🔐 Submitting login for:', email);
      
      const response = await authService.login({ email, password });
      
      console.log('📥 Login response:', response);
      
      if (response.success && response.data && response.data.user) {
        const user = response.data.user;
        
        console.log('✅ Login successful! User:', user);
        
        // Dispatch auth changed event for navigation
        try {
          const authUserData = {
            email: user.email,
            displayName: user.full_name || user.username,
            role: user.role,
            avatar: user.avatar || null
          };
          window.dispatchEvent(new CustomEvent('authChanged', { detail: authUserData }));
        } catch (e) {
          console.error('Event dispatch error:', e);
        }
        
        // Show success message
        setToast({
          message: `Welcome ${user.full_name || user.username}!`,
          type: 'success'
        });
        
        // Redirect based on user role after short delay
        setTimeout(() => {
          const storedRedirect = localStorage.getItem('redirectAfterLogin');
          let targetRoute = getDefaultRoute(user.role);

          if (storedRedirect) {
            if (isAllowedRedirect(user.role, storedRedirect)) {
              targetRoute = storedRedirect;
            }
            localStorage.removeItem('redirectAfterLogin');
          }

          navigate(targetRoute, { replace: true });
        }, 500);
      } else {
        console.error('❌ Login failed:', response);
        setError('Invalid email or password.');
      }
    } catch (err) {
      console.error('❌ Login error:', err);
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
      
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8 px-4 sm:py-12 sm:px-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-6 sm:p-8">
        {/* (theme toggle removed) */}

        <div className="text-center mb-6">
          <img src="/Job Portal-logo-transparent.png" alt="Job Portal" className="h-16 sm:h-20 md:h-24 mx-auto mb-4"/>
          <h2 className="text-2xl font-semibold text-gray-900">
            Welcome Back!
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Please sign in to your account
          </p>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} id="login-form" className="space-y-4">
          <div className="input-group relative">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email Address
            </label>
            <div className="relative">
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full pl-10 pr-3 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none"
              />
              <i className="fas fa-envelope absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-center" aria-hidden="true"></i>
            </div>
          </div>

          <div className="input-group relative">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full pl-10 pr-10 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none"
              />
              <i className="fas fa-lock absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" aria-hidden="true"></i>

              <button
                type="button"
                onClick={togglePassword}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <i
                  className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`}
                ></i>
              </button>
            </div>
          </div>

          <div className="form-options flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm gap-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 text-blue-500 rounded border border-gray-300"
              />
              <span className="text-gray-600">
                Remember me
              </span>
            </label>

            <a
              href="/forgot-password"
              className="text-blue-600 hover:underline"
            >
              Forgot Password?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-lg font-semibold shadow-md border border-blue-300 text-blue-600 transition duration-200 hover:shadow-lg flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                <span>Signing In...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        <div className="form-footer mt-6 text-center text-sm text-gray-600 dark:text-gray-300">
          <p className="mb-3">
            Don't have an account?{" "}
            <Link to="/register" className="text-blue-600 hover:underline">
              Sign up here
            </Link>
          </p>
          <Link
            to="/"
            className="inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
    </>
  );
};

export default LoginPage;
