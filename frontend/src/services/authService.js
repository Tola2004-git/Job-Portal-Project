import api from './api';

export const authService = {
  // ✅ Login - Save user data and avatar to localStorage
  async login(credentials) {
    try {
      console.log('🔐 Login attempt:', credentials.email);
      
      const response = await api.post('/auth/login.php', {
        email: credentials.email,
        password: credentials.password,
      });
      
      console.log('📥 Login response:', response.data);
      
      if (response.data.success && response.data.data) {
        const { user, token } = response.data.data;
        
        console.log('👤 User data:', {
          id: user.id,
          email: user.email,
          role: user.role,
          hasAvatar: !!user.avatar,
          avatarPreview: user.avatar ? user.avatar.substring(0, 50) + '...' : 'null'
        });
        
        // Clear old data first
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        localStorage.removeItem('employerAvatar');
        localStorage.removeItem('seekerAvatar');
        localStorage.removeItem('adminAvatar');
        
        // Store new auth data
        localStorage.setItem('authToken', token);
        localStorage.setItem('user', JSON.stringify(user));
        console.log('✅ Saved user to localStorage');
        
        window.dispatchEvent(new Event('authChanged'));

        // Store avatar based on role
        if (user?.avatar && user.avatar !== 'null' && user.avatar.trim() !== '') {
          const avatarKey = `${user.role === 'job_seeker' ? 'seeker' : user.role}Avatar`;
          localStorage.setItem(avatarKey, user.avatar);
          console.log(`✅ Saved avatar to ${avatarKey}`);
          
          // Dispatch avatar change event
          setTimeout(() => {
            const eventName = `${user.role === 'job_seeker' ? 'seeker' : user.role}AvatarChanged`;
            window.dispatchEvent(new CustomEvent(eventName, { detail: user.avatar }));
            window.dispatchEvent(new CustomEvent('userDataRefresh'));
            console.log(`🔔 Dispatched ${eventName} and userDataRefresh events`);
          }, 100);
        } else {
          console.log('⚠️ No avatar to save');
          // Still dispatch refresh even without avatar
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('userDataRefresh'));
            console.log('🔔 Dispatched userDataRefresh event');
          }, 100);
        }
        
        return { success: true, data: response.data.data };
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Login error:', error);
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  },

  // Register - Real backend connection
  async register(userData) {
    try {
      console.log('📝 Attempting registration:', userData.email);

      const payload = { ...userData };
      if (!payload.username && payload.email) {
        payload.username = payload.email.split('@')[0];
      }
      if (!payload.role) {
        payload.role = 'job_seeker';
      }
      if (!payload.full_name && payload.first_name) {
        const last = payload.last_name ? ` ${payload.last_name}` : '';
        payload.full_name = `${payload.first_name}${last}`.trim();
      }

      const response = await api.post('/auth/register.php', payload);
      
      console.log('✅ Registration response:', response.data);
      
      if (response.data.success) {
        // Clear any existing avatar data to ensure fresh start for new user
        localStorage.removeItem('employerAvatar');
        localStorage.removeItem('seekerAvatar');
        localStorage.removeItem('adminAvatar');
        localStorage.removeItem('authUser'); // Clear old format
        
        // Store user data in localStorage after successful registration
        const userData = {
          user: response.data.user,
          token: response.data.token
        };
        localStorage.setItem('authToken', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        window.dispatchEvent(new Event('authChanged'));
        
        // Force refresh navigation component after a brief delay to show default avatar
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('userDataRefresh'));
        }, 100);
        
        return { 
          success: true, 
          data: {
            ...userData,
            employer_profile: response.data.employer_profile || null
          },
          message: response.data.message
        };
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Registration error:', error);
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  },

  // ✅ Logout - Clear all data
  logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('employerAvatar');
    localStorage.removeItem('seekerAvatar');
    localStorage.removeItem('adminAvatar');
    localStorage.removeItem('redirectAfterLogin');
    localStorage.setItem('showLogoutToast', 'true');
    window.dispatchEvent(new Event('authChanged'));
    window.location.href = '/';
  },

  // ✅ Get current user
  getCurrentUser() {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('❌ Error parsing user data:', error);
      return null;
    }
  },

  // ✅ Check authentication
  isAuthenticated() {
    return !!(localStorage.getItem('authToken') && this.getCurrentUser());
  },

  // ✅ Get token
  getToken() {
    return localStorage.getItem('authToken');
  }
};

export default authService;
