import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef(null);

  useEffect(() => {
    function handleDocClick(e) {
      if (!userDropdownOpen) return;
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
    }
    function handleKey(e) {
      if (e.key === 'Escape') setUserDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleDocClick);
    document.addEventListener('touchstart', handleDocClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDocClick);
      document.removeEventListener('touchstart', handleDocClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [userDropdownOpen]);

  function showSection(section) {
    setActiveSection(section);
    // close dropdown if open
    setUserDropdownOpen(false);
  }

  function logout() {
    alert('Logged out (simulated)');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-8xl mx-auto px-4 py-3 flex items-center justify-between h-20">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 text-white rounded-md p-2">
                <i className="fas fa-briefcase"></i>
              </div>
              <h1 className="text-xl font-semibold">JobPortal</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative" ref={userDropdownRef}>
              <button onClick={() => setUserDropdownOpen(v => !v)} className="flex items-center gap-2 px-3 py-1 rounded hover:bg-gray-100">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center font-semibold">TC</div>
                <span className="text-sm">TechCorp Inc.</span>
                <i className={`fas fa-chevron-down text-sm ${userDropdownOpen ? 'rotate-180' : ''}`}></i>
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded shadow border z-30">
                  <Link to="#" className="block px-4 py-2 hover:bg-gray-100 flex items-center gap-2"><i className="fas fa-building"></i><span>Company Profile</span></Link>
                  <Link to="/" className="block px-4 py-2 hover:bg-gray-100 flex items-center gap-2"><i className="fas fa-home"></i><span>Home</span></Link>
                  <div className="border-t"></div>
                  <button onClick={logout} className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"><i className="fas fa-sign-out-alt"></i><span>Logout</span></button>
                </div>
              )}
            </div>

            <button className="p-2 rounded hover:bg-gray-100" title="Theme (not implemented)"><i className="fas fa-sun"></i></button>
          </div>
        </div>
      </nav>

      {/* Main layout */}
      <div className="flex max-w-8xl mx-auto mt-6 px-4">
        {/* Sidebar */}
        <aside className="w-72 bg-white rounded-lg shadow p-4 mr-6">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-xl font-semibold mb-2">TC</div>
            <div className="font-medium">TechCorp Inc.</div>
            <div className="text-xs text-gray-500">Employer Dashboard</div>
          </div>

          <ul className="space-y-2">
            <li>
              <button onClick={() => showSection('dashboard')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='dashboard' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}>
                <i className="fas fa-tachometer-alt"></i>
                <span>Dashboard</span>
              </button>
            </li>
            <li>
              <button onClick={() => showSection('post-job')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='post-job' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}>
                <i className="fas fa-plus"></i>
                <span>Post New Job</span>
              </button>
            </li>
            <li>
              <button onClick={() => showSection('manage-jobs')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='manage-jobs' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}>
                <i className="fas fa-list"></i>
                <span>Manage Jobs</span>
              </button>
            </li>
            <li>
              <button onClick={() => showSection('applications')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='applications' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}>
                <i className="fas fa-users"></i>
                <span>View Applications</span>
              </button>
            </li>
            <li>
              <button onClick={() => showSection('candidates')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='candidates' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}>
                <i className="fas fa-search"></i>
                <span>Browse Candidates</span>
              </button>
            </li>
            <li>
              <button onClick={() => showSection('settings')} className={`w-full flex items-center gap-3 p-2 rounded ${activeSection==='settings' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}>
                <i className="fas fa-cog"></i>
                <span>Settings</span>
              </button>
            </li>
          </ul>
        </aside>

        {/* Content area */}
        <main className="flex-1">
          {/* Dashboard */}
          {activeSection === 'dashboard' && (
            <div>
              <h1 className="text-2xl font-semibold mb-4">Dashboard Overview</h1>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded shadow text-center">
                  <div className="text-3xl font-bold">12</div>
                  <div className="text-sm text-gray-500">Active Jobs</div>
                </div>
                <div className="bg-white p-4 rounded shadow text-center">
                  <div className="text-3xl font-bold">248</div>
                  <div className="text-sm text-gray-500">Total Applications</div>
                </div>
                <div className="bg-white p-4 rounded shadow text-center">
                  <div className="text-3xl font-bold">1,543</div>
                  <div className="text-sm text-gray-500">Job Views</div>
                </div>
                <div className="bg-white p-4 rounded shadow text-center">
                  <div className="text-3xl font-bold">8</div>
                  <div className="text-sm text-gray-500">Hired</div>
                </div>
              </div>

              <div className="bg-white p-4 rounded shadow">
                <h3 className="font-semibold mb-3">Recent Activity</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-sm text-gray-500">
                        <th className="py-2">Activity</th>
                        <th className="py-2">Job Title</th>
                        <th className="py-2">Candidate</th>
                        <th className="py-2">Date</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="py-2">New Application</td>
                        <td>Senior React Developer</td>
                        <td>John Smith</td>
                        <td>2024-08-09</td>
                        <td><span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700">Pending</span></td>
                      </tr>
                      <tr className="border-t">
                        <td className="py-2">Application Reviewed</td>
                        <td>UI/UX Designer</td>
                        <td>Jane Doe</td>
                        <td>2024-08-08</td>
                        <td><span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">Reviewed</span></td>
                      </tr>
                      <tr className="border-t">
                        <td className="py-2">Interview Scheduled</td>
                        <td>Backend Developer</td>
                        <td>Mike Johnson</td>
                        <td>2024-08-07</td>
                        <td><span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">Scheduled</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Post Job */}
          {activeSection === 'post-job' && (
            <div>
              <h1 className="text-2xl font-semibold mb-4">Post New Job</h1>
              <div className="bg-white p-4 rounded shadow">
                <h3 className="font-semibold mb-3">Job Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1">Job Title</label>
                    <input className="w-full border p-2 rounded" placeholder="e.g. Senior React Developer" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Department</label>
                    <select className="w-full border p-2 rounded">
                      <option>Engineering</option>
                      <option>Design</option>
                      <option>Marketing</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Employment Type</label>
                    <select className="w-full border p-2 rounded">
                      <option>Full-time</option>
                      <option>Part-time</option>
                      <option>Contract</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Experience Level</label>
                    <select className="w-full border p-2 rounded">
                      <option>Entry Level</option>
                      <option>Mid Level</option>
                      <option>Senior Level</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Salary Range</label>
                    <input className="w-full border p-2 rounded" placeholder="e.g. $80,000 - $120,000" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Location</label>
                    <input className="w-full border p-2 rounded" placeholder="e.g. San Francisco, CA" />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm mb-1">Job Description</label>
                  <textarea className="w-full border p-2 rounded" rows={4} placeholder="Describe the role..." />
                </div>

                <div className="mt-4">
                  <label className="block text-sm mb-1">Requirements</label>
                  <textarea className="w-full border p-2 rounded" rows={3} placeholder="List required skills..." />
                </div>

                <div className="mt-4">
                  <label className="block text-sm mb-1">Benefits</label>
                  <textarea className="w-full border p-2 rounded" rows={2} placeholder="Describe benefits..." />
                </div>

                <div className="mt-4">
                  <button className="btn btn-primary bg-blue-600 text-white px-4 py-2 rounded"><i className="fas fa-paper-plane mr-2"></i> Post Job</button>
                </div>
              </div>
            </div>
          )}

          {/* Manage Jobs */}
          {activeSection === 'manage-jobs' && (
            <div>
              <h1 className="text-2xl font-semibold mb-4">Manage Jobs</h1>
              <div className="bg-white p-4 rounded shadow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Your Job Postings</h3>
                  <button onClick={() => showSection('post-job')} className="bg-blue-600 text-white px-3 py-1 rounded"><i className="fas fa-plus mr-2"></i>Post New Job</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-sm text-gray-500">
                        <th className="py-2">Job Title</th>
                        <th className="py-2">Department</th>
                        <th className="py-2">Posted Date</th>
                        <th className="py-2">Applications</th>
                        <th className="py-2">Status</th>
                        <th className="py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="py-2">Senior React Developer</td>
                        <td>Engineering</td>
                        <td>2024-08-01</td>
                        <td>45</td>
                        <td><span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">Active</span></td>
                        <td>
                          <button className="px-2 py-1 mr-2 rounded bg-gray-100"><i className="fas fa-edit"></i></button>
                          <button className="px-2 py-1 rounded bg-gray-100"><i className="fas fa-trash"></i></button>
                        </td>
                      </tr>
                      <tr className="border-t">
                        <td className="py-2">UI/UX Designer</td>
                        <td>Design</td>
                        <td>2024-07-28</td>
                        <td>32</td>
                        <td><span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">Active</span></td>
                        <td>
                          <button className="px-2 py-1 mr-2 rounded bg-gray-100"><i className="fas fa-edit"></i></button>
                          <button className="px-2 py-1 rounded bg-gray-100"><i className="fas fa-trash"></i></button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Applications */}
          {activeSection === 'applications' && (
            <div>
              <h1 className="text-2xl font-semibold mb-4">Job Applications</h1>
              <div className="bg-white p-4 rounded shadow">
                <h3 className="font-semibold mb-3">Recent Applications</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-sm text-gray-500">
                        <th className="py-2">Candidate</th>
                        <th className="py-2">Job Title</th>
                        <th className="py-2">Applied Date</th>
                        <th className="py-2">Experience</th>
                        <th className="py-2">Status</th>
                        <th className="py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="py-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-500 text-white flex items-center justify-center font-semibold">JS</div>
                            <div>
                              <div className="font-medium">John Smith</div>
                              <div className="text-xs text-gray-500">john@email.com</div>
                            </div>
                          </div>
                        </td>
                        <td>Senior React Developer</td>
                        <td>2024-08-09</td>
                        <td>5 years</td>
                        <td><span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700">New</span></td>
                        <td>
                          <button className="px-3 py-1 mr-2 bg-blue-600 text-white rounded"><i className="fas fa-eye"></i></button>
                          <button className="px-3 py-1 bg-gray-100 rounded"><i className="fas fa-download"></i></button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Candidates */}
          {activeSection === 'candidates' && (
            <div>
              <h1 className="text-2xl font-semibold mb-4">Browse Candidates</h1>
              <div className="bg-white p-4 rounded shadow mb-4">
                <h3 className="font-semibold mb-3">Search Filters</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input className="border p-2 rounded" placeholder="Skills (e.g. React)" />
                  <select className="border p-2 rounded">
                    <option>Any</option>
                    <option>Entry Level</option>
                    <option>Mid Level</option>
                    <option>Senior Level</option>
                  </select>
                  <input className="border p-2 rounded" placeholder="Location" />
                  <select className="border p-2 rounded">
                    <option>Any</option>
                    <option>Immediately</option>
                    <option>Within 2 weeks</option>
                  </select>
                </div>
                <div className="mt-3">
                  <button className="bg-blue-600 text-white px-3 py-1 rounded"><i className="fas fa-search mr-2"></i> Search Candidates</button>
                </div>
              </div>

              <div className="bg-white p-4 rounded shadow">
                <h3 className="font-semibold mb-3">Candidate Results</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-blue-400 text-white flex items-center justify-center font-semibold">AS</div>
                      <div>
                        <div className="font-medium">Alice Smith</div>
                        <div className="text-sm text-gray-500">Frontend Developer</div>
                      </div>
                    </div>
                    <div className="mb-3">
                      <div className="text-sm font-semibold">Skills</div>
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">React</span>
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">JavaScript</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-500">3 years exp.</div>
                      <button className="bg-blue-600 text-white px-3 py-1 rounded"><i className="fas fa-eye mr-2"></i>View Profile</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Settings */}
          {activeSection === 'settings' && (
            <div>
              <h1 className="text-2xl font-semibold mb-4">Account Settings</h1>
              <div className="bg-white p-4 rounded shadow mb-4">
                <h3 className="font-semibold mb-3">Notification Preferences</h3>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-3"><input type="checkbox" defaultChecked /> <span>Email notifications for new applications</span></label>
                  <label className="flex items-center gap-3"><input type="checkbox" defaultChecked /> <span>SMS notifications for urgent updates</span></label>
                  <label className="flex items-center gap-3"><input type="checkbox" /> <span>Weekly activity summary</span></label>
                </div>
              </div>

              <div className="bg-white p-4 rounded shadow mb-4">
                <h3 className="font-semibold mb-3">Change Password</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <input type="password" className="border p-2 rounded" placeholder="Current Password" />
                  <input type="password" className="border p-2 rounded" placeholder="New Password" />
                </div>
                <button className="bg-blue-600 text-white px-3 py-1 rounded"><i className="fas fa-save mr-2"></i>Update Password</button>
              </div>

              <div className="bg-white p-4 rounded shadow">
                <h3 className="font-semibold mb-3">Danger Zone</h3>
                <p className="text-sm text-red-700 mb-3">These actions cannot be undone. Please be careful.</p>
                <button className="bg-red-100 text-red-700 px-3 py-1 rounded"><i className="fas fa-trash mr-2"></i>Delete Account</button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
