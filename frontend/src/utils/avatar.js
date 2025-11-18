export const DEFAULT_AVATAR = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20128%20128%22%3E%3Crect%20fill%3D%22%23e5e7eb%22%20width%3D%22128%22%20height%3D%22128%22%20rx%3D%2264%22/%3E%3Ccircle%20cx%3D%2264%22%20cy%3D%2248%22%20r%3D%2228%22%20fill%3D%22%23cbd5f5%22/%3E%3Cpath%20d%3D%22M32%20108c0-22%2018-40%2032-40s32%2018%2032%2040%22%20fill%3D%22%239ca3af%22/%3E%3C/svg%3E';

let DEFAULT_AVATAR_BASE64 = DEFAULT_AVATAR;
try {
  const [header, body] = DEFAULT_AVATAR.split(',', 2);
  const hasBase64 = header.includes(';base64');
  const toBase64 = typeof window !== 'undefined' && window.btoa ? window.btoa : (typeof btoa === 'function' ? btoa : null);
  if (!hasBase64 && body && toBase64) {
    const decoded = decodeURIComponent(body);
    DEFAULT_AVATAR_BASE64 = `${header};base64,${toBase64(decoded)}`;
  }
} catch (error) {
  DEFAULT_AVATAR_BASE64 = DEFAULT_AVATAR;
}

const LEGACY_DEFAULTS = new Set([
  '',
  'null',
  '/user-avatar.png',
  '/uploads/avatars/default.png',
  'uploads/avatars/default.png',
  'backend/uploads/avatars/default.png',
  'http://localhost/Job_Portal_Project/backend/uploads/avatars/default.png',
  DEFAULT_AVATAR_BASE64
]);

const BACKEND_BASE_URL = process.env.REACT_APP_BACKEND_BASE_URL || 'http://localhost/Job_Portal_Project/backend';

export const normalizeAvatar = (value) => {
  const trimmed = (value ?? '').trim();
  if (LEGACY_DEFAULTS.has(trimmed)) {
    return DEFAULT_AVATAR;
  }
  if (!trimmed) {
    return DEFAULT_AVATAR;
  }
  return trimmed;
};

export const isDefaultAvatar = (value) => normalizeAvatar(value) === DEFAULT_AVATAR;

export const resolveAvatarSrc = (value) => {
  const normalized = normalizeAvatar(value);
  if (normalized.startsWith('data:image/')) {
    return normalized;
  }
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  const path = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `${BACKEND_BASE_URL}${path}`;
};

export const ensureBase64DataUri = (value) => {
  if (typeof value !== 'string') {
    return value;
  }
  const input = value.trim();
  if (!input.startsWith('data:image/')) {
    return input;
  }
  if (input.includes(';base64,')) {
    return input;
  }
  const parts = input.split(',', 2);
  if (parts.length !== 2) {
    return input;
  }
  try {
    const decoded = decodeURIComponent(parts[1]);
    const toBase64 = typeof window !== 'undefined' && window.btoa ? window.btoa : (typeof btoa === 'function' ? btoa : null);
    if (!toBase64) {
      return input;
    }
    const encoded = toBase64(decoded);
    return `${parts[0]};base64,${encoded}`;
  } catch (error) {
    console.error('Failed to convert avatar to base64 data URI', error);
    return input;
  }
};
