import React, { useEffect, useState } from 'react';

// Helper to show a toast from anywhere
export function showToast(message, type = 'info', duration = 4000) {
  try {
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type, duration } }));
  } catch (e) {
    // fallback: console
    // eslint-disable-next-line no-console
    console.log('toast:', message, type);
  }
}

export default function Toaster() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    function onShow(e) {
      const { message, type = 'info', duration = 4000 } = (e && e.detail) || {};
      const id = Date.now() + Math.random();
      const toast = { id, message, type, visible: false };
      setToasts(t => [...t, toast]);
      // trigger enter animation
      setTimeout(() => {
        setToasts(t => t.map(x => x.id === id ? { ...x, visible: true } : x));
      }, 20);
      // schedule hide
      setTimeout(() => {
        setToasts(t => t.map(x => x.id === id ? { ...x, visible: false } : x));
        // remove after animation
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 300);
      }, duration);
    }
    window.addEventListener('show-toast', onShow);
    return () => window.removeEventListener('show-toast', onShow);
  }, []);

  function dismiss(id) {
    setToasts(t => t.map(x => x.id === id ? { ...x, visible: false } : x));
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 300);
  }

  function colorFor(type) {
    if (type === 'success') return 'bg-green-50 border-green-400 text-green-800';
    if (type === 'error') return 'bg-red-50 border-red-400 text-red-800';
    if (type === 'warn' || type === 'warning') return 'bg-yellow-50 border-yellow-400 text-yellow-800';
    return 'bg-white border-gray-200 text-gray-900';
  }

  return (
    <div className="fixed right-6 bottom-6 z-50 flex flex-col gap-3 items-end">
      {toasts.map(t => (
        <div key={t.id} className={`max-w-sm w-full border px-4 py-3 rounded shadow-lg ${colorFor(t.type)} flex items-start gap-3 transform transition-all duration-300 ${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
          <div className="flex-1">
            <div className="font-medium">{t.type === 'success' ? 'Success' : t.type === 'error' ? 'Error' : t.type === 'warning' ? 'Warning' : ''}</div>
            <div className="text-sm">{t.message}</div>
          </div>
          <button onClick={() => dismiss(t.id)} className="text-sm font-bold ml-2">×</button>
        </div>
      ))}
    </div>
  );
}
