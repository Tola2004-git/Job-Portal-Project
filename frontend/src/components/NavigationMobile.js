import React, { useState } from 'react';

// JobPortal-specific mobile navigation (custom, not a generic template)
export default function NavigationMobile() {
  const [open, setOpen] = useState(false);
  const [isLoggedIn] = useState(false); // replace with actual auth state later

  return (
    <>
      <nav className="bg-white border-b shadow sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Hamburger */}
            <button
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="p-2 rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none"
            >
              <i className="fas fa-bars text-lg"></i>
            </button>

            {/* Center: Logo + Name */}
            <div className="flex items-center space-x-3">
              <img src="/Job Portal-logo-transparent.png" alt="JobPortal" className="h-8 w-auto" />
              <span className="font-semibold text-lg text-gray-800">JobPortal</span>
            </div>

            {/* Right: small placeholder to balance layout */}
            <div className="w-8" />
          </div>
        </div>

        {/* Slide-over menu */}
        {open && (
          <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <button
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            />

            {/* Panel */}
            <aside className="relative w-80 max-w-full bg-white shadow-xl overflow-y-auto">
              <div className="p-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <div className="flex items-center space-x-3">
                  <img src="/Job Portal-logo-transparent.png" alt="JobPortal" className="h-10 w-auto rounded-md bg-white/10" />
                  <div>
                    <div className="font-semibold">JobPortal</div>
                    <div className="text-sm opacity-90">Connecting talent with opportunity</div>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="absolute right-3 top-3 text-white/80 hover:text-white p-1 rounded-md"
                  aria-label="Close"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="p-4 space-y-2">
                <a href="#home" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
                  <i className="fas fa-home text-gray-500 w-6 text-center" />
                  <span className="font-medium">Home</span>
                </a>

                <a href="#jobs" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
                  <i className="fas fa-briefcase text-gray-500 w-6 text-center" />
                  <span className="font-medium">Jobs</span>
                </a>

                <a href="#featured" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
                  <i className="fas fa-star text-gray-500 w-6 text-center" />
                  <span className="font-medium">Featured</span>
                </a>

                <a href="#about" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
                  <i className="fas fa-info-circle text-gray-500 w-6 text-center" />
                  <span className="font-medium">About</span>
                </a>

                <a href="#contact" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
                  <i className="fas fa-envelope text-gray-500 w-6 text-center" />
                  <span className="font-medium">Contact</span>
                </a>

                <div className="border-t my-2" />

                <a href="#how" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
                  <i className="fas fa-rocket text-gray-500 w-6 text-center" />
                  <span className="font-medium">How It Works</span>
                </a>

                <a href="#blog" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
                  <i className="fas fa-pen-nib text-gray-500 w-6 text-center" />
                  <span className="font-medium">Blog</span>
                </a>

                <div className="border-t my-2" />

                {!isLoggedIn ? (
                  <div className="space-y-3 px-1">
                      <a href="/login" className="block w-full text-center py-3 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold">Login</a>
                      <a href="/register" className="block w-full text-center py-3 rounded-lg border border-blue-600 text-blue-600 font-semibold">Sign Up</a>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <a href="#profile" className="block p-3 rounded-lg hover:bg-gray-50">Profile</a>
                    <a href="#dashboard" className="block p-3 rounded-lg hover:bg-gray-50">Dashboard</a>
                    <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50">Logout</button>
                  </div>
                )}

                <div className="mt-4">
                  <div className="text-sm text-gray-500">Follow JobPortal</div>
                  <div className="flex gap-3 mt-2">
                    <a href="#facebook" aria-label="Facebook" className="text-blue-600">
                      <i className="fab fa-facebook-f" />
                    </a>
                    <a href="#twitter" aria-label="Twitter" className="text-sky-400">
                      <i className="fab fa-twitter" />
                    </a>
                    <a href="#linkedin" aria-label="LinkedIn" className="text-blue-700">
                      <i className="fab fa-linkedin-in" />
                    </a>
                    <a href="#instagram" aria-label="Instagram" className="text-pink-500">
                      <i className="fab fa-instagram" />
                    </a>
                  </div>
                </div>

                <div className="mt-6 text-xs text-gray-400">© {new Date().getFullYear()} JobPortal</div>
              </div>
            </aside>
          </div>
        )}
      </nav>
    </>
  );
}
