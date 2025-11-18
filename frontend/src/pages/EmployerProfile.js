import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import employerService from '../services/employerService';
import { DEFAULT_AVATAR, normalizeAvatar, resolveAvatarSrc } from '../utils/avatar';
import { compressImageFile } from '../utils/image';

export default function EmployerProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  

  const [profile, setProfile] = useState({
    name: '',
    industry: 'technology',
    size: '1-10',
    website: '',
    description: '',
    email: '',
    phone: '',
    address: '',
    linkedin: '',
    twitter: '',
    facebook: '',
    instagram: '',
    workType: 'onsite',
    experienceLevel: 'entry',
    avgSalary: '',
    turnoverRate: 0,
    teamSize: 0,
    foundedYear: new Date().getFullYear(),
    benefits: {
      health: false,
      dental: false,
      retirement: false,
      stock: false,
      flexible: false,
      remote: false,
      gym: false,
      development: false
    },
    locations: [],
    coreValues: [],
    activeJobs: 0,
    totalApplications: 0,
    successfulHires: 0,
    rating: 0
  });

  const [avatar, setAvatar] = useState(() => {
    try {
      const stored = localStorage.getItem('employerAvatar');
      if (stored) {
        return normalizeAvatar(stored);
      }
    } catch (e) {}
    return DEFAULT_AVATAR;
  });
  const resolvedAvatar = resolveAvatarSrc(avatar);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const userDropdownRef = useRef(null);

  function logout() {
    const confirmed = window.confirm('Are you sure you want to logout?');
    if (!confirmed) return;
    
    try {
      localStorage.removeItem('authUser');
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.setItem('showLogoutToast', 'true');
      window.dispatchEvent(new CustomEvent('authChanged', { detail: null }));
    } catch (e) {}
    
    navigate('/');
  }

  useEffect(() => {
    function handleDocClick(e) {
      if (!userDropdownOpen) return;
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
    }
    function handleKey(e) { if (e.key === 'Escape') setUserDropdownOpen(false); }
    document.addEventListener('mousedown', handleDocClick);
    document.addEventListener('touchstart', handleDocClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDocClick);
      document.removeEventListener('touchstart', handleDocClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [userDropdownOpen]);

  const [newLocation, setNewLocation] = useState('');
  const [newCoreValue, setNewCoreValue] = useState('');
  const [errors, setErrors] = useState({});

  // Load profile from database on mount
  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const response = await employerService.getProfile();
      if (response.success && response.data.profile) {
        const dbProfile = response.data.profile;
        const user = response.data.user;
        // Debug dbProfile
        console.log('EmployerProfile API dbProfile:', dbProfile);
        // Map database fields to component state
        setProfile({
          name: dbProfile.company_name || user.full_name || '',
          industry: dbProfile.industry || 'technology',
          size: dbProfile.company_size || '1-10',
          website: dbProfile.website || '',
          description: dbProfile.description || '',
          email: dbProfile.email || user.email || '',
          phone: dbProfile.phone || user.phone || '',
          address: dbProfile.address || '',
          linkedin: dbProfile.linkedin || '',
          twitter: dbProfile.twitter || '',
          facebook: dbProfile.facebook || '',
          instagram: dbProfile.instagram || '',
          workType: dbProfile.work_type || 'onsite',
          experienceLevel: dbProfile.experience_level || 'entry',
          avgSalary: dbProfile.avg_salary || '',
          turnoverRate: dbProfile.turnover_rate || 0,
          teamSize: dbProfile.team_size || 0,
          foundedYear: dbProfile.founded_year || new Date().getFullYear(),
          benefits: dbProfile.benefits || {
            health: false,
            dental: false,
            retirement: false,
            stock: false,
            flexible: false,
            remote: false,
            gym: false,
            development: false
          },
          locations: dbProfile.locations || [],
          coreValues: dbProfile.core_values || [],
          activeJobs: dbProfile.active_jobs || 0,
          totalApplications: dbProfile.total_applications || 0,
          successfulHires: dbProfile.successful_hires || 0,
          rating: parseFloat(dbProfile.rating) || 0
        });
        // Update avatar if exists
        if (Object.prototype.hasOwnProperty.call(user, 'avatar')) {
          setAvatar(normalizeAvatar(user.avatar));
        } else {
          setAvatar(DEFAULT_AVATAR);
        }
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      setToast({ type: 'error', message: 'Failed to load profile' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    try {
      const normalizedAvatar = normalizeAvatar(avatar);
      if (normalizedAvatar) {
        localStorage.setItem('employerAvatar', normalizedAvatar);
        // Update user avatar in localStorage
        const userRaw = localStorage.getItem('user');
        if (userRaw) {
          const user = JSON.parse(userRaw);
          user.avatar = normalizedAvatar;
          localStorage.setItem('user', JSON.stringify(user));
        }
        
        // Upload to database
        uploadAvatarToDatabase(normalizedAvatar);
      } else {
        localStorage.removeItem('employerAvatar');
      }
    } catch (e) {}
  }, [avatar]);

  async function uploadAvatarToDatabase(avatarData) {
    try {
      setAvatarUploading(true);
      const response = await employerService.uploadAvatar(avatarData);
      if (response.success) {
        console.log('Avatar uploaded to database successfully');
        // Notify other parts of the app
        window.dispatchEvent(new CustomEvent('employerAvatarChanged', { detail: avatarData }));
      }
    } catch (err) {
      console.error('Failed to upload avatar:', err);
      // Don't show error toast here to avoid annoying the user
      // Avatar is still saved in localStorage
    } finally {
      setAvatarUploading(false);
    }
  }

  function onChange(e) {
    const { name, value } = e.target;
    setProfile(p => ({ ...p, [name]: value }));
  }

  

  function handleDrop(e) {
    e.preventDefault();
    if (avatarUploading) {
      return;
    }
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      alert('Please drop an image file');
      return;
    }
    compressImageFile(f, {
      maxWidth: 600,
      maxHeight: 600,
      maxSizeMB: 0.7,
      quality: 0.8
    }).then((dataUrl) => {
      setAvatar(normalizeAvatar(dataUrl));
    }).catch((err) => {
      console.error('Drag-drop avatar compression failed:', err);
      alert('Failed to process avatar image');
    });
  }

  function handleDragOver(e) { e.preventDefault(); }

  function addLocation(name) {
    if (!name || !name.trim()) return;
    setProfile(p => ({ ...p, locations: Array.from(new Set([...(p.locations||[]), name.trim()])) }));
    setNewLocation('');
  }

  function removeLocation(idx) {
    setProfile(p => ({ ...p, locations: (p.locations || []).filter((_,i) => i!==idx) }));
  }

  function toggleBenefit(key) {
    setProfile(p => ({ ...p, benefits: { ...(p.benefits||{}), [key]: !((p.benefits||{})[key]) } }));
  }

  function addCoreValue(val) {
    if (!val || !val.trim()) return;
    setProfile(p => ({ ...p, coreValues: Array.from(new Set([...(p.coreValues||[]), val.trim()])) }));
    setNewCoreValue('');
  }

  function removeCoreValue(idx) {
    setProfile(p => ({ ...p, coreValues: (p.coreValues||[]).filter((_,i)=>i!==idx) }));
  }
  function handleFile(e) {
    if (avatarUploading) {
      return;
    }
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    compressImageFile(f, {
      maxWidth: 600,
      maxHeight: 600,
      maxSizeMB: 0.7,
      quality: 0.8
    }).then((dataUrl) => {
      setAvatar(normalizeAvatar(dataUrl));
    }).catch((err) => {
      console.error('Avatar compression failed:', err);
      alert('Failed to process avatar image');
    });
  }

  async function save(e) {
    e.preventDefault();
    
    // Validate before saving
    const valid = validate();
    if (!valid) {
      // Focus first invalid field
      const first = Object.keys(errors)[0];
      if (first) {
        const el = document.querySelector(`[name="${first}"]`);
        if (el) el.focus();
      }
      return;
    }
    
    setLoading(true);
    try {
      // Prepare data for API (convert camelCase to snake_case)
      const profileData = {
        company_name: profile.name,
        full_name: profile.name, // Also update user's full_name
        industry: profile.industry,
        company_size: profile.size,
        website: profile.website,
        description: profile.description,
        email: profile.email,
        phone: profile.phone,
        address: profile.address,
        linkedin: profile.linkedin,
        twitter: profile.twitter,
        facebook: profile.facebook,
        instagram: profile.instagram,
        work_type: profile.workType,
        experience_level: profile.experienceLevel,
        avg_salary: profile.avgSalary,
        turnover_rate: parseInt(profile.turnoverRate) || 0,
        team_size: parseInt(profile.teamSize) || 0,
        founded_year: parseInt(profile.foundedYear) || new Date().getFullYear(),
        benefits: profile.benefits,
        locations: profile.locations,
        core_values: profile.coreValues,
        avatar: avatar // Include avatar to save to database
      };
      
      const response = await employerService.updateProfile(profileData);
      
      if (response.success) {
        setToast({ type: 'success', message: 'Profile updated successfully!' });
        
        // Update localStorage for navigation
        try {
          const userRaw = localStorage.getItem('user');
          if (userRaw) {
            const user = JSON.parse(userRaw);
            user.full_name = profile.name;
            localStorage.setItem('user', JSON.stringify(user));
          }
        } catch (e) {}
        
        // Dispatch event for other components
        try { 
          window.dispatchEvent(new CustomEvent('employerProfileChanged', { detail: profile })); 
        } catch (e) {}
        
        // Reload profile to get fresh data
        await loadProfile();
      }
    } catch (err) {
      console.error('Failed to save profile:', err);
      const errorMsg = err.error || err.message || 'Failed to save profile';
      setToast({ type: 'error', message: errorMsg });
    } finally {
      setLoading(false);
    }
  }

  function validate() {
    const errs = {};
    if (!profile.name || !profile.name.trim()) errs.name = 'Company name is required';
    const email = (profile.email||'').trim();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) errs.email = 'Enter a valid email address';
    const website = (profile.website||'').trim();
    if (website && !/^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/.*)?$/.test(website)) errs.website = 'Enter a valid URL (include http:// or https://)';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

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
      
      <div className="min-h-screen bg-gray-50 text-gray-800">
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-lg">
        <div className="max-w-8xl mx-auto px-4 py-3 flex items-center justify-between h-20">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-3">
              <img src="/Job Portal-logo-transparent.png" alt="JobPortal" className="h-24 w-auto object-contain" />
            </Link>
          </div>

          <div className="flex items-center justify-end">
            <div className="relative" ref={userDropdownRef}>
              <button onClick={() => setUserDropdownOpen(v => !v)} className="flex items-center gap-2 px-3 py-1 rounded duration-200 hover:scale-105" aria-haspopup="true" aria-expanded={userDropdownOpen} title="Company menu">
                {avatar ? (
                  <img
                    src={resolvedAvatar}
                    alt={`Company avatar`}
                    className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_AVATAR;
                      setAvatar(DEFAULT_AVATAR);
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 border-2 border-gray-200 rounded-full duration-200 hover:scale-105 flex items-center justify-center font-semibold">TC</div>
                )}
                <span className="text-sm font-medium hidden sm:inline">{profile.name}</span>
                {/* <i className={`fas fa-chevron-down text-xs transition-transform duration-200 ${userDropdownOpen ? 'rotate-180' : ''}`}></i> */}
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded shadow border z-30">
                  <Link to="/dashboard" className="flex items-center px-4 py-2 hover:bg-gray-100">
                    <i className="fas fa-tachometer-alt mr-3 text-blue-600"></i>
                    Dashboard
                  </Link>
                  <Link to="/" className="flex items-center px-4 py-2 hover:bg-gray-100">
                    <i className="fas fa-home mr-3 text-green-600"></i>
                    Home
                  </Link>
                  <div className="border-t"></div>
                  <button onClick={logout} className="w-full text-left flex items-center px-4 py-2 hover:bg-red-50 text-red-600">
                    <i className="fas fa-sign-out-alt mr-3"></i>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {loading ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading profile...</p>
          </div>
        </div>
      ) : (
        <main className="max-w-6xl mx-auto p-6">
        <form onSubmit={save} className="space-y-6">
          <header className="text-center">
            <label
              className={`mx-auto relative w-24 h-24 rounded-full bg-white border border-gray-200 flex items-center justify-center text-3xl text-gray-600 mb-3 shadow-sm overflow-visible ${avatarUploading ? 'opacity-75 cursor-wait pointer-events-none' : 'cursor-pointer'}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <img
                src={resolvedAvatar}
                alt="Company"
                className="w-full h-full object-cover rounded-full"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_AVATAR;
                  setAvatar(DEFAULT_AVATAR);
                }}
              />
              {avatarUploading && (
                <div className="absolute inset-0 bg-white/70 rounded-full flex items-center justify-center">
                  <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
                </div>
              )}
              <span className={`absolute -bottom-1 -right-1 bg-white border border-gray-200 text-gray-600 p-0.5 rounded-full shadow hover:bg-gray-50 z-10 w-7 h-7 flex items-center justify-center ${avatarUploading ? 'opacity-0' : ''}`}>
                <i className="fas fa-camera text-xs"></i>
              </span>
              <input type="file" accept="image/*" className="sr-only" onChange={handleFile} disabled={avatarUploading} />
            </label>
            <h2 className="text-2xl font-semibold">{profile.name}</h2>
            <p className="text-sm text-gray-500">{profile.description}</p>
            <div className="mt-2 text-sm text-gray-600">Employer Profile</div>
          </header>

          <section className="bg-white p-6 rounded shadow-lg border border-gray-300">
            <h3 className="text-lg font-semibold mb-4"><i className="fas fa-building mr-2"></i>Company Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Company Name</label>
                <input name="name" value={profile.name} onChange={onChange} className={`border p-2 rounded w-full outline-none ${errors.name ? 'border-red-500' : 'border-gray-300'}`} />
                {errors.name && <div className="text-xs text-red-600 mt-1">{errors.name}</div>}
              </div>
              <div>
                <label className="block text-sm mb-1">Industry</label>
                <input name="industry" value={profile.industry} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none" />
              </div>
              <div>
                <label className="block text-sm mb-1">Website</label>
                <input name="website" value={profile.website} onChange={onChange} className={`border p-2 rounded w-full outline-none ${errors.website ? 'border-red-500' : 'border-gray-300'}`} />
                {errors.website && <div className="text-xs text-red-600 mt-1">{errors.website}</div>}
              </div>
              <div>
                <label className="block text-sm mb-1">Company Size</label>
                <input name="size" value={profile.size} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Company Description</label>
                <textarea name="description" value={profile.description} onChange={onChange} rows={4} className="w-full border border-gray-300 p-2 rounded outline-none" />
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded shadow-lg border border-gray-300">
            <h3 className="text-lg font-semibold mb-4"><i className="fas fa-gift mr-2"></i>Benefits Offered</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(profile.benefits||{}).map(([k,v])=> (
                <label key={k} className="flex items-center gap-2">
                  <input type="checkbox" checked={!!v} onChange={() => toggleBenefit(k)} />
                  <span className="capitalize text-sm">{k.replace(/([A-Z])/g,' $1')}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="bg-white p-6 rounded shadow-lg border border-gray-300">
            <h3 className="text-lg font-semibold mb-4"><i className="fas fa-address-book mr-2"></i>Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Contact Email</label>
                <input name="email" value={profile.email} onChange={onChange} className={`border p-2 rounded w-full outline-none ${errors.email ? 'border-red-500' : 'border-gray-300'}`} />
                {errors.email && <div className="text-xs text-red-600 mt-1">{errors.email}</div>}
              </div>
              <div>
                <label className="block text-sm mb-1">Phone</label>
                <input name="phone" value={profile.phone} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Address</label>
                <textarea name="address" value={profile.address} onChange={onChange} rows={2} className="w-full border border-gray-300 p-2 rounded outline-none" />
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded shadow-lg border border-gray-300">
            <h3 className="text-lg font-semibold mb-4"><i className="fas fa-user-tie mr-2"></i>Hiring Preferences</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Preferred Work Type</label>
                <select name="workType" value={profile.workType} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none appearance-none">
                  <option value="onsite">On-site</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="flexible">Flexible</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Experience Level Focus</label>
                <select name="experienceLevel" value={profile.experienceLevel} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none appearance-none">
                  <option value="entry">Entry Level</option>
                  <option value="mid">Mid Level</option>
                  <option value="senior">Senior Level</option>
                  <option value="all">All Levels</option>
                </select>
              </div>
              <div className="md:col-span-2 border-t pt-4">
                <label className="block text-sm mb-1">Hiring Locations</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(profile.locations||[]).map((loc,idx)=> (
                    <span key={idx} className="bg-gray-100 px-2 py-1 rounded flex items-center gap-2">
                      {loc}
                      <button type="button" onClick={()=>removeLocation(idx)} className="text-xs text-red-600">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newLocation} onChange={e=>setNewLocation(e.target.value)} placeholder="Add location" className="border border-gray-300 p-2 rounded flex-1 outline-none" />
                  <button type="button" onClick={() => addLocation(newLocation)} className="border border-blue-600 text-blue-600 px-3 py-1 rounded hover:scale-105 shadow-lg hover:shadow-lg duration-200">Add</button>
                </div>
              </div>
            </div>
          </section>

          {/* Company logo handled via header avatar (camera button + drag/drop) */}

          <section className="bg-white p-6 rounded shadow-lg border border-gray-300">
            <h3 className="text-lg font-semibold mb-4"><i className="fas fa-share-alt mr-2"></i>Social Media</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">LinkedIn</label>
                <input name="linkedin" value={profile.linkedin} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none" />
              </div>
              <div>
                <label className="block text-sm mb-1">Twitter</label>
                <input name="twitter" value={profile.twitter} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none" />
              </div>
              <div>
                <label className="block text-sm mb-1">Facebook</label>
                <input name="facebook" value={profile.facebook} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none" />
              </div>
              <div>
                <label className="block text-sm mb-1">Instagram</label>
                <input name="instagram" value={profile.instagram} onChange={onChange} className="border border-gray-300 p-2 rounded w-full outline-none" />
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded shadow-lg border border-gray-300">
            <h3 className="text-lg font-semibold mb-4"><i className="fas fa-heart mr-2"></i>Company Culture & Values</h3>
            <textarea name="culture" value={profile.culture||''} onChange={onChange} rows={3} className="w-full border border-gray-300 p-2 rounded mb-3 outline-none" placeholder="Describe your company culture..." />
            <div className="flex gap-2 mb-3 flex-wrap">
              {(profile.coreValues||[]).map((v,idx)=> (
                <span key={idx} className="bg-blue-50 text-blue-700 px-2 py-1 rounded flex items-center gap-2">
                  {v}
                  <button type="button" onClick={() => removeCoreValue(idx)} className="text-xs text-red-600">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newCoreValue} onChange={e=>setNewCoreValue(e.target.value)} placeholder="Add value" className="border border-gray-300 p-2 rounded flex-1 outline-none" />
              <button type="button" onClick={()=>addCoreValue(newCoreValue)} className="border border-blue-600 text-blue-600 px-3 py-1 rounded hover:scale-105 shadow-lg hover:shadow-lg duration-200">Add</button>
            </div>
          </section>

          <section className="bg-white p-6 rounded shadow-lg border border-gray-300">
            <h3 className="text-lg font-semibold mb-4"><i className="fas fa-chart-line mr-2"></i>Company Performance</h3>
            <div className="flex justify-center items-center py-12">
              <div className="text-center">
                <i className="fas fa-clock text-4xl text-gray-400 mb-4"></i>
                <div className="text-xl font-semibold text-gray-600">Coming Soon</div>
                <div className="text-sm text-gray-500 mt-2">Performance analytics will be available soon</div>
              </div>
            </div>
          </section>

          <div className="text-right">
            <button type="submit" disabled={loading} className="px-6 py-2 border border-blue-600 text-blue-600 rounded shadow hover:shadow-lg duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </main>
      )}
    </div>
    </>
  );
}
