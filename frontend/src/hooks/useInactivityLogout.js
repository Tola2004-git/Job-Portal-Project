import { useCallback, useEffect, useRef, useState } from 'react';
import authService from '../services/authService';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
const STORAGE_ACTIVITY_KEY = 'jp:last-activity-ts';
const DEFAULT_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

/**
 * Global inactivity watcher that logs the user out after the configured timeout.
 * Keeps timers in sync across tabs via localStorage so every session expires together.
 */
export default function useInactivityLogout(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const [enabled, setEnabled] = useState(() => Boolean(localStorage.getItem('authToken')));
  const timerRef = useRef(null);
  const isLoggingOutRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const performLogout = useCallback(() => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    try {
      authService.logout();
    } finally {
      clearTimer();
    }
  }, [clearTimer]);

  const scheduleTimer = useCallback(
    (remainingMs = timeoutMs, force = false) => {
      clearTimer();
      if (!enabled && !force) return;
      timerRef.current = setTimeout(performLogout, remainingMs);
    },
    [clearTimer, enabled, performLogout, timeoutMs]
  );

  const stampActivity = useCallback(
    (timestamp = Date.now(), force = false) => {
      if (!enabled && !force) return;
      localStorage.setItem(STORAGE_ACTIVITY_KEY, String(timestamp));
      scheduleTimer(timeoutMs, force);
    },
    [enabled, scheduleTimer, timeoutMs]
  );

  useEffect(() => {
    const evaluateAuth = () => {
      isLoggingOutRef.current = false;
      const hasToken = Boolean(localStorage.getItem('authToken'));
      setEnabled(hasToken);
      if (hasToken) {
        const stored = Number(localStorage.getItem(STORAGE_ACTIVITY_KEY));
        const now = Date.now();
        if (Number.isFinite(stored) && stored > 0) {
          const elapsed = now - stored;
          if (elapsed >= timeoutMs) {
            performLogout();
          } else {
            scheduleTimer(timeoutMs - elapsed, true);
          }
        } else {
          stampActivity(now, true);
        }
      } else {
        clearTimer();
        localStorage.removeItem(STORAGE_ACTIVITY_KEY);
      }
    };

    const onStorage = (event) => {
      if (event.key === 'authToken') {
        evaluateAuth();
      }
      if (event.key === STORAGE_ACTIVITY_KEY && event.newValue) {
        const last = Number(event.newValue);
        if (!Number.isFinite(last) || !enabled) {
          return;
        }
        const elapsed = Date.now() - last;
        if (elapsed >= timeoutMs) {
          performLogout();
        } else {
          scheduleTimer(timeoutMs - elapsed, true);
        }
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        stampActivity(Date.now(), true);
      }
    };

    const onActivity = () => stampActivity(Date.now());

    evaluateAuth();

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    window.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);
    window.addEventListener('authChanged', evaluateAuth);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
      window.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('authChanged', evaluateAuth);
      clearTimer();
    };
  }, [clearTimer, enabled, performLogout, scheduleTimer, stampActivity, timeoutMs]);
}
