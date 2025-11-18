import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import Toast from '../components/Toast';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [userType, setUserType] = useState('job_seeker');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [experience, setExperience] = useState('');
  const [skills, setSkills] = useState('');
  const [company, setCompany] = useState('');
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  function selectUserType(type) {
    setUserType(type);
    // clear fields that don't apply
    setCompany('');
    setIndustry('');
    setCompanySize('');
    setExperience('');
    setSkills('');
  }

  function togglePassword(which) {
    if (which === 'password') setShowPassword((s) => !s);
    if (which === 'confirm') setShowConfirm((s) => !s);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Build full name
    const fullName = `${firstName} ${lastName}`.trim();
    // Map userType to backend role format
    const role = userType === 'job_seeker' ? 'job_seeker' : userType;
    // Client-side validation
    if (!firstName.trim() || !email.trim() || !password) {
      setError('Please fill in name, email and password.');
      setLoading(false);
      return;
    }
    // Validate employer fields
    if (role === 'employer') {
      if (!industry) {
        setError('Please select Industry.');
        setLoading(false);
        return;
      }
      if (!companySize) {
        setError('Please select Company Size.');
        setLoading(false);
        return;
      }
    }
    if (!terms) {
      setError('You must agree to the terms and conditions.');
      setLoading(false);
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    try {
      // Build full name
      const fullName = `${firstName} ${lastName}`.trim();
      
      // Map userType to backend role format
      const role = userType === 'jobseeker' ? 'job_seeker' : userType;
      
      // Call backend API
      const registerData = {
        email: email,
        password: password,
        full_name: fullName,
        role: role
      };

      if (phone) {
        registerData.phone = phone;
      }

      // Add employer-specific fields if registering as employer
      if (role === 'employer') {
  if (company) registerData.company_name = company;
  // Convert industry UI value to backend value
  if (industry) {
    let industryValue = industry;
    if (industry.toLowerCase() === 'technology') industryValue = 'Technology';
    else if (industry.toLowerCase() === 'finance') industryValue = 'Finance';
    else if (industry.toLowerCase() === 'healthcare') industryValue = 'Healthcare';
    else if (industry.toLowerCase() === 'education') industryValue = 'Education';
    else if (industry.toLowerCase() === 'retail') industryValue = 'Retail';
    else if (industry.toLowerCase() === 'manufacturing') industryValue = 'Manufacturing';
    else if (industry.toLowerCase() === 'other') industryValue = 'Other';
    registerData.industry = industryValue;
  }
  // Convert companySize UI value to backend value
  if (companySize) {
    let sizeValue = companySize;
    if (companySize.toLowerCase() === 'startup') sizeValue = '1-10';
    else if (companySize.toLowerCase() === 'small') sizeValue = '11-50';
    else if (companySize.toLowerCase() === 'medium') sizeValue = '51-200';
    else if (companySize.toLowerCase() === 'large') sizeValue = '200+';
    registerData.company_size = sizeValue;
  }
  // បន្ថែម description
  if (description) registerData.description = description;
      }

      // Add job seeker-specific fields if registering as job seeker
      if (role === 'job_seeker') {
        if (country) registerData.location = country;
        if (experience) registerData.experience_level = experience;
        if (skills) registerData.skills = skills;
      }

      const response = await authService.register(registerData);
      
      if (response.success && response.data.user) {
        const user = response.data.user;
        // បើជា employer បញ្ចូល employer_profile ទៅ localStorage
        if (role === 'employer' && response.data.employer_profile) {
          localStorage.setItem('employerProfile', JSON.stringify(response.data.employer_profile));
        }
        // Clear localStorage tokens (don't auto-login)
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        // Show success toast
        setToast({
          message: `Registration successful!`,
          type: 'success'
        });
        // Redirect
        setTimeout(() => {
          if (role === 'employer') {
            navigate('/employer/profile');
          } else {
            navigate('/login', { 
              state: { 
                registeredEmail: email,
                message: `Account created successfully! Please login with ${email}`
              } 
            });
          }
        }, 1500);
      } else {
        setError(response.error || 'Registration failed. Please try again.');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8 px-4 sm:py-12 sm:px-6">
      <div className="max-w-3xl w-full bg-white rounded-2xl shadow-lg p-6 sm:p-8">
        <div className="text-center mb-6">
          <img src="/Job Portal-logo-transparent.png" alt="Job Portal" className="h-16 sm:h-20 md:h-24 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900">Create Your Account</h2>
          <p className="text-sm text-gray-600">Join our community and start your journey</p>

          <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              className={`w-full sm:w-auto px-4 py-2 rounded-lg border shadow-sm hover:shadow-md transition duration-200 ${userType === 'job_seeker' ? 'bg-blue-50 border-blue-300 text-blue-500' : 'bg-white border-gray-200'}`}
              onClick={() => selectUserType('job_seeker')}
            >
              <i className="fas fa-user mr-2"></i>
              Job Seeker
            </button>
            <button
              type="button"
              className={`w-full sm:w-auto px-4 py-2 rounded-lg border shadow-sm hover:shadow-md transition duration-200 ${userType === 'employer' ? 'bg-blue-50 border-blue-300 text-blue-500' : 'bg-white border-gray-200'}`}
              onClick={() => selectUserType('employer')}
            >
              <i className="fas fa-building mr-2"></i>
              Employer
            </button>
          </div>
        </div>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded">
            {error}
          </div>
        )}

        <form id="register-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="input-group relative">
              <label className="block text-sm font-medium text-gray-700">First Name</label>
              <div className="relative">
                <i className="fas fa-user absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" aria-hidden="true"></i>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  placeholder="Enter first name"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="pl-10 pr-3 py-2 w-full border border-gray-500 rounded-lg focus:outline-none"
                />
              </div>
            </div>

            <div className="input-group relative">
              <label className="block text-sm font-medium text-gray-700">Last Name</label>
              <div className="relative">
                <i className="fas fa-user absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" aria-hidden="true"></i>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  placeholder="Enter last name"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="pl-10 pr-3 py-2 w-full border border-gray-500 rounded-lg focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="input-group relative">
              <label className="block text-sm font-medium text-gray-700">Email Address</label>
              <div className="relative">
                <i className="fas fa-envelope absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" aria-hidden="true"></i>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="Enter your email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 pr-3 py-2 w-full border border-gray-500 rounded-lg focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="input-group relative">
              <label className="block text-sm font-medium text-gray-700">Phone Number</label>
              <div className="relative">
                <i className="fas fa-phone absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" aria-hidden="true"></i>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  placeholder="Enter phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10 pr-3 py-2 w-full border border-gray-500 rounded-lg focus:outline-none"
                />
              </div>
            </div>

            <div className="input-group relative">
              <label className="block text-sm font-medium text-gray-700">Country</label>
              <div className="relative">
                <i className="fas fa-globe absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" aria-hidden="true"></i>
                <select
                  id="country"
                  name="country"
                  required
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="pl-10 pr-3 py-2 w-full border border-gray-500 rounded-lg bg-white focus:outline-none appearance-none"
                >
                  <option value="">Select Country</option>
                  <option value="cambodia">Cambodia</option>
                  <option value="thailand">Thailand</option>
                  <option value="vietnam">Vietnam</option>
                  <option value="singapore">Singapore</option>
                  <option value="malaysia">Malaysia</option>
                  <option value="philippines">Philippines</option>
                  <option value="indonesia">Indonesia</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {userType === 'jobseeker' && (
            <div id="jobseeker-fields">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="input-group relative">
                  <label className="block text-sm font-medium text-gray-700">Experience Level</label>
                  <div className="relative">
                    <i className="fas fa-briefcase absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" aria-hidden="true"></i>
                    <select className="pl-10 pr-3 py-2 w-full border border-gray-500 rounded-lg focus:outline-none appearance-none" value={experience} onChange={(e)=>setExperience(e.target.value)}>
                      <option value="">Select Experience</option>
                      <option value="entry">Entry Level (0-1 years)</option>
                      <option value="junior">Junior (1-3 years)</option>
                      <option value="mid">Mid Level (3-5 years)</option>
                      <option value="senior">Senior (5+ years)</option>
                      <option value="expert">Expert (10+ years)</option>
                    </select>
                  </div>
                </div>

                <div className="input-group relative">
                  <label className="block text-sm font-medium text-gray-700">Skills/Field</label>
                  <div className="relative">
                    <i className="fas fa-tools absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" aria-hidden="true"></i>
                    <input type="text" placeholder="e.g. Web Development, Marketing" className="pl-10 pr-3 py-2 w-full border border-gray-500 rounded-lg focus:outline-none" value={skills} onChange={e=>setSkills(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {userType === 'employer' && (
            <div id="employer-fields">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="input-group relative">
                  <label className="block text-sm font-medium text-gray-700">Company Name</label>
                  <div className="relative">
                    <i className="fas fa-building absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" aria-hidden="true"></i>
                    <input type="text" placeholder="Enter company name" className="pl-10 pr-3 py-2 w-full border border-gray-500 rounded-lg focus:outline-none" value={company} onChange={e=>setCompany(e.target.value)} />
                  </div>
                </div>

                <div className="input-group relative">
                  <label className="block text-sm font-medium text-gray-700">Industry</label>
                  <div className="relative">
                    <i className="fas fa-industry absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" aria-hidden="true"></i>
                    <select className="pl-10 pr-3 py-2 w-full border border-gray-500 rounded-lg focus:outline-none appearance-none" value={industry} onChange={e=>setIndustry(e.target.value)}>
                      <option value="">Select Industry</option>
                      <option value="technology">Technology</option>
                      <option value="finance">Finance</option>
                      <option value="healthcare">Healthcare</option>
                      <option value="education">Education</option>
                      <option value="retail">Retail</option>
                      <option value="manufacturing">Manufacturing</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 mt-4">
                <div className="input-group relative">
                  <label className="block text-sm font-medium text-gray-700">Company Size</label>
                  <div className="relative">
                    <i className="fas fa-users absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" aria-hidden="true"></i>
                    <select className="pl-10 pr-3 py-2 w-full border border-gray-500 rounded-lg focus:outline-none appearance-none" value={companySize} onChange={e=>setCompanySize(e.target.value)}>
                      <option value="">Select Company Size</option>
                      <option value="startup">Startup (1-10 employees)</option>
                      <option value="small">Small (11-50 employees)</option>
                      <option value="medium">Medium (51-200 employees)</option>
                      <option value="large">Large (200+ employees)</option>
                    </select>
                  </div>
                </div>
              </div>

            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="input-group relative">
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <i className="fas fa-lock absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" aria-hidden="true"></i>
                <input type={showPassword ? 'text' : 'password'} id="password" name="password" placeholder="Create password" required value={password} onChange={e=>setPassword(e.target.value)} className="pl-10 pr-10 py-2 w-full border border-gray-500 rounded-lg focus:outline-none" />
                <button type="button" className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500" onClick={()=>togglePassword('password')} aria-label="Toggle password visibility">
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <div className="input-group relative">
              <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
              <div className="relative">
                <i className="fas fa-lock absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" aria-hidden="true"></i>
                <input type={showConfirm ? 'text' : 'password'} id="confirmPassword" name="confirmPassword" placeholder="Confirm password" required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className="pl-10 pr-10 py-2 w-full border border-gray-500 rounded-lg focus:outline-none" />
                <button type="button" className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500" onClick={()=>togglePassword('confirm')} aria-label="Toggle confirm password visibility">
                  <i className={`fas ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" id="terms" checked={terms} onChange={e=>setTerms(e.target.checked)} className="h-4 w-4 rounded border border-gray-500" />
            <label htmlFor="terms" className="text-sm">I agree to the <a href="/terms" className="text-blue-600">Terms of Service</a> and <a href="/privacy" className="text-blue-600">Privacy Policy</a></label>
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" id="marketing" checked={marketing} onChange={e=>setMarketing(e.target.checked)} className="h-4 w-4 rounded border border-gray-500" />
            <label htmlFor="marketing" className="text-sm">I would like to receive job alerts and career tips via email</label>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="btn w-3/4 mt-2 py-3 border border-blue-500 rounded-lg flex shadow-md hover:shadow-lg items-center justify-center gap-2 text-blue-500 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="form-footer mt-6 text-center text-sm text-gray-600">
          <p>Already have an account? <Link to="/login" className="text-blue-600">Sign in here</Link></p>
          <Link to="/" className="inline-block mt-2 text-gray-600">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
