import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { showToast } from '../components/Toaster';
import jobSeekerService from '../services/jobSeekerService';
import { DEFAULT_AVATAR, normalizeAvatar, resolveAvatarSrc } from '../utils/avatar';
import { compressImageFile } from '../utils/image';

export default function SeekerProfilePage() {
  const navigate = useNavigate();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

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
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) setUserDropdownOpen(false);
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
  const [profile, setProfile] = useState(() => {
    try {
      const raw = localStorage.getItem('seekerProfile');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      name: '',
      title: '',
      email: '',
      phone: '',
      location: '',
      bio: '',
      skills: [],
      level: 'Entry Level (0-2 years)',
      applications: 0,
      interviews: 0,
      complete: '0%'
    };
  });
  const [avatar, setAvatar] = useState(() => {
    try {
      const stored = localStorage.getItem('seekerAvatar');
      if (stored) {
        return normalizeAvatar(stored);
      }
    } catch (e) {}
    return DEFAULT_AVATAR;
  });
  const resolvedAvatar = resolveAvatarSrc(avatar);

  // Persist profile and update localStorage.user
// Avatar is always loaded from backend, not localStorage
  useEffect(() => {
    try {
      const normalizedAvatar = normalizeAvatar(avatar);
      if (normalizedAvatar) {
        localStorage.setItem('seekerAvatar', normalizedAvatar);

        // Update user avatar in localStorage for navigation
        const userRaw = localStorage.getItem('user');
        if (userRaw) {
          const user = JSON.parse(userRaw);
          user.avatar = normalizedAvatar;
          localStorage.setItem('user', JSON.stringify(user));
        }
      } else {
        localStorage.removeItem('seekerAvatar');
      }

      window.dispatchEvent(new CustomEvent('seekerAvatarChanged', { detail: normalizedAvatar }));
    } catch (e) {}
  }, [avatar]);

  function onChange(e){ const { name, value } = e.target; setProfile(p => ({ ...p, [name]: value })); }
  async function handleUpload(e) {
    if (avatarUploading) {
      e.target.value = '';
      return;
    }
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      e.target.value = '';
      return;
    }
    try {
      setAvatarUploading(true);
      const optimizedData = await compressImageFile(f, {
        maxWidth: 600,
        maxHeight: 600,
        maxSizeMB: 0.7,
        quality: 0.8
      });

      if (!/^data:image\/(png|jpg|jpeg|gif|webp|svg\+xml);base64,/.test(optimizedData)) {
        showToast('Invalid image format. Only PNG, JPG, JPEG, GIF, WEBP, and SVG are allowed.', 'error');
        return;
      }

      await jobSeekerService.uploadAvatar(optimizedData);
      const data = await jobSeekerService.getProfile();
      if (data.user && data.user.avatar) {
        setAvatar(normalizeAvatar(data.user.avatar));
      } else {
        setAvatar(DEFAULT_AVATAR);
      }
      showToast('Avatar uploaded successfully!', 'success');
    } catch (err) {
      const msg = err?.message || err?.response?.error || 'Failed to upload avatar';
      showToast(msg, 'error');
      console.error('Avatar upload error:', err);
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  }
  // skills as array state and helpers
  const [skills, setSkills] = useState(() => {
    try {
      const raw = localStorage.getItem('seekerProfile');
      if (raw) {
        const p = JSON.parse(raw);
        if (Array.isArray(p.skills)) return p.skills;
        if (typeof p.skills === 'string') return p.skills.split(/,\s*/).filter(Boolean);
      }
    } catch (e) {}
    return Array.isArray(profile.skills) ? profile.skills : (typeof profile.skills === 'string' ? profile.skills.split(/,\s*/).filter(Boolean) : []);
  });
  const [newSkill, setNewSkill] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const editingInputRef = useRef(null);

  useEffect(() => { setProfile(p => ({ ...p, skills })); }, [skills]);
  function addSkillFromInput() {
    const s = (newSkill || '').trim();
    if (!s) return;
    setSkills(prev => prev.includes(s) ? prev : [...prev, s]);
    setNewSkill('');
  }
  function removeSkill(idx) { setSkills(prev => prev.filter((_,i) => i !== idx)); }
  function startEdit(idx) {
    setEditingIndex(idx);
    setEditingValue(skills[idx] || '');
  }
  function cancelEdit() { setEditingIndex(null); setEditingValue(''); }
  function saveEdit() {
    const v = (editingValue || '').trim();
    if (v === '') {
      // remove the skill if emptied
      if (editingIndex !== null) removeSkill(editingIndex);
      cancelEdit();
      return;
    }
    // prevent duplicates
    if (skills.some((s, i) => s.toLowerCase() === v.toLowerCase() && i !== editingIndex)) {
      showToast('Skill already exists', 'error');
      cancelEdit();
      return;
    }
    setSkills(prev => prev.map((s, i) => i === editingIndex ? v : s));
    cancelEdit();
  }

  useEffect(() => {
    if (editingIndex !== null && editingInputRef.current) {
      try { editingInputRef.current.focus(); editingInputRef.current.select(); } catch (e) {}
    }
  }, [editingIndex]);
  
  // Load profile from backend
  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const data = await jobSeekerService.getProfile();
      
      // Set profile data from backend
      if (data.user) {
        setProfile(prev => ({
          ...prev,
          name: data.user.full_name ?? prev.name,
          email: data.user.email ?? prev.email,
          phone: data.user.phone ?? prev.phone,
        }));
        
        if (Object.prototype.hasOwnProperty.call(data.user, 'avatar')) {
          setAvatar(normalizeAvatar(data.user.avatar));
        } else {
          setAvatar(DEFAULT_AVATAR);
        }
      }
      
      if (data.profile) {
        setProfile(prev => ({
          ...prev,
          title: data.profile.title ?? prev.title,
          bio: data.profile.bio ?? prev.bio,
          location: data.profile.preferred_locations && data.profile.preferred_locations.length > 0 
            ? data.profile.preferred_locations[0] 
            : prev.location,
        }));
        
        // Set skills from backend
        if (data.profile.skills && Array.isArray(data.profile.skills)) {
          setSkills(data.profile.skills);
        }
        
        // Set experience level
        const years = data.profile.experience_years || 0;
        let level = 'Entry Level (0-2 years)';
        if (years >= 10) level = 'Expert Level (10+ years)';
        else if (years >= 5) level = 'Senior Level (5+ years)';
        else if (years >= 3) level = 'Mid Level (3-5 years)';
        
        setProfile(prev => ({ ...prev, level }));
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      // Continue with localStorage data as fallback
    } finally {
      setLoading(false);
    }
  }
  
  async function save(e) {
    e && e.preventDefault();
    
    if (saving) return;
    setSaving(true);
    try {
      // Prepare data for backend
      const profileData = {
        full_name: profile.name,
        email: profile.email,
        phone: profile.phone,
        title: profile.title,
        bio: profile.bio,
        skills: Array.isArray(skills) ? skills : (typeof skills === 'string' ? skills.split(/,\s*/) : []),
        experience_level: profile.level || '',
        location: Array.isArray(profile.location) ? profile.location : (profile.location ? [profile.location] : []),
        avatar: normalizeAvatar(avatar)
      };
      const response = await jobSeekerService.updateProfile(profileData);
      // Force refresh user data in localStorage and notify other components
      try {
        const userRaw = localStorage.getItem('user');
        if (userRaw) {
          const user = JSON.parse(userRaw);
          user.full_name = profile.name;
          user.phone = profile.phone;
          localStorage.setItem('user', JSON.stringify(user));
        }
        // Dispatch events to notify other components
        window.dispatchEvent(new CustomEvent('seekerProfileChanged', {detail: profile}));
        window.dispatchEvent(new CustomEvent('userDataRefresh'));
      } catch (e) {}
      showToast('Profile saved successfully!', 'success');
    } catch (error) {
      // Show backend error message for easier debugging
      let msg = error?.message || error?.response?.message || error?.response?.error || 'Failed to save profile';
      showToast(msg, 'error');
      console.error('Error saving profile:', error);
    } finally {
    setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {loading ? (
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
      <>
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-lg">
        <div className="max-w-8xl mx-auto px-4 py-3 flex items-center justify-between h-20">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-3">
              <img src="/Job Portal-logo-transparent.png" alt="JobPortal" className="h-20 w-auto object-contain" />
            </Link>
          </div>

          <div className="flex items-center justify-end">
            <div className="relative" ref={userDropdownRef}>
              <button onClick={() => setUserDropdownOpen(v => !v)} className="flex items-center gap-2 px-3 py-1 rounded" aria-haspopup="true" aria-expanded={userDropdownOpen} title="User menu">
                <img
                  src={resolvedAvatar}
                  alt="User avatar"
                  className="w-10 h-10 rounded-full object-cover border border-gray-300"
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_AVATAR;
                    setAvatar(DEFAULT_AVATAR);
                  }}
                />
                <span className="text-sm hidden sm:inline">{profile.name}</span>
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded shadow border z-30">
                  <Link to="/seeker/dashboard" className="block px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
                    <i className="fas fa-tachometer-alt text-green-500"></i>
                    <span>Dashboard</span>
                  </Link>
                  <Link to="/" className="block px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
                    <i className="fas fa-home text-gray-600"></i>
                    <span>Home</span>
                  </Link>
                  <div className="border-t"></div>
                  <button onClick={logout} className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
                    <i className="fas fa-sign-out-alt text-red-500"></i>
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        <form onSubmit={save} className="space-y-6">
          <header className="text-center">
            <div className="flex justify-center mb-3">
              <label
                className={`relative w-24 h-24 rounded-full bg-white border border-gray-200 flex items-center justify-center text-3xl text-gray-600 shadow-sm overflow-visible ${avatarUploading ? 'opacity-75 cursor-wait pointer-events-none' : 'cursor-pointer'}`}
                onDrop={() => {}}
                onDragOver={(e)=>e.preventDefault()}
              >
                <img
                  src={resolvedAvatar}
                  alt="User avatar"
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
                <input
                  id="seekerAvatarUploadPage"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleUpload}
                  disabled={avatarUploading}
                />
              </label>
            </div>
            <h2 className="text-2xl font-semibold">{profile.name || 'Your Name'}</h2>
            <p className="text-sm text-gray-500">{profile.title || 'Job Seeker'}</p>
            <div className="mt-2 text-sm text-gray-600">Job Seeker Profile</div>
          </header>

          <section className="bg-white p-6 rounded shadow-lg border border-gray-300">
            <h3 className="text-lg font-semibold mb-4"><i className="fas fa-user mr-2"></i>Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Full Name</label>
                <input name="name" value={profile.name} onChange={onChange} className="border p-2 rounded w-full outline-none" />
              </div>
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input name="email" value={profile.email} onChange={onChange} className="border p-2 rounded w-full outline-none" />
              </div>
              <div>
                <label className="block text-sm mb-1">Phone</label>
                <input name="phone" value={profile.phone} onChange={onChange} className="border p-2 rounded w-full outline-none" />
              </div>
              <div>
                <label className="block text-sm mb-1">Location</label>
                <input name="location" value={profile.location} onChange={onChange} className="border p-2 rounded w-full outline-none" />
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded shadow-lg border border-gray-300">
            <h3 className="text-lg font-semibold mb-4"><i className="fas fa-file-alt mr-2"></i>Professional Summary</h3>
            <div>
              <label className="block text-sm mb-1">Bio</label>
              <textarea name="bio" value={profile.bio} onChange={onChange} rows={4} className="w-full border p-2 rounded outline-none" />
            </div>
          </section>

          <section className="bg-white p-6 rounded shadow-lg border border-gray-300">
            <h3 className="text-lg font-semibold mb-4"><i className="fas fa-code mr-2"></i>Skills & Experience</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Technical Skills</label>
                <div className="border border-gray-300 p-2 rounded w-full">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {skills.map((s, idx) => (
                      <span key={s + idx} className="flex items-center">
                        {editingIndex === idx ? (
                          <input
                            ref={editingInputRef}
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onBlur={() => saveEdit()}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
                              if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                            }}
                            className="px-2 py-1 border rounded w-40"
                          />
                        ) : (
                          <span onDoubleClick={() => startEdit(idx)} className="bg-blue-50 text-blue-700 px-2 py-1 rounded flex items-center gap-2 mr-2">
                            {s}
                            <button type="button" onClick={() => removeSkill(idx)} className="text-xs text-red-600">×</button>
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-2 border-t">
                    <input value={newSkill} onChange={e => setNewSkill(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkillFromInput(); } }} placeholder="Add a skill and press Enter" className="flex-1 outline-none " />
                    <button type="button" onClick={addSkillFromInput} className="px-2 py-1 border border-blue-600 text-blue-600 rounded">Add</button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1">Experience Level</label>
                <select name="level" value={profile.level} onChange={onChange} className="border p-2 rounded w-full outline-none appearance-none">
                  <option>Entry Level (0-2 years)</option>
                  <option>Mid Level (3-5 years)</option>
                  <option>Senior Level (5+ years)</option>
                  <option>Expert Level (10+ years)</option>
                </select>
              </div>
            </div>
          </section>

          <div className="text-right">
            <button 
              type="submit" 
              disabled={saving}
              className="px-6 py-2 border border-blue-600 text-blue-600 rounded shadow hover:shadow-lg duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
      </>
      )}
    </div>
  );
}
