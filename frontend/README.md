# 🎨 Job Portal - Frontend (React.js)

កម្មវិធី Frontend សម្រាប់ Job Portal ត្រូវបានសរសេរដោយប្រើ React.js, Tailwind CSS និងបច្ចេកវិទ្យាទំនើប។ ផ្តល់ UI ស្រស់ស្អាត សម្រាប់ Job Seeker, Employer និង Admin។

## 📋 មាតិកា
- សង្ខេប
- បច្ចេកវិទ្យាដែលប្រើ
- តម្រូវការប្រព័ន្ធ
- ការតំឡើង
- ការប្រើប្រាស់
- រចនាសម្ព័ន្ធ Project
- Component & Page
- ការប្រើ Tailwind CSS
- ការប្រើ React Router
- ការប្រើ Axios
- ការប្រើ .env
- Build & Deployment
- Browser Support
- Support
- License
- Acknowledgments

## 🎯 សង្ខេប

Frontend គឺជា Single Page Application (SPA) ដែលផ្តល់ UI សម្រាប់ការចុះឈ្មោះ, Login, Dashboard, Profile, Search Jobs, Apply, Upload Resume, និងគ្រប់គ្រងទិន្នន័យតាម API។

## 🛠 បច្ចេកវិទ្យាដែលប្រើ
- **React.js** (v18.x)
- **React Router** (v6.x)
- **Tailwind CSS** (v3.x)
- **Font Awesome**
- **Axios**
- **Toast/Toaster**
- **Custom Hooks** (useAuth, usePosts)

## 💻 តម្រូវការប្រព័ន្ធ
- Node.js 14.x+ (https://nodejs.org/)
- npm 6.x+ (https://www.npmjs.com/)
- Web Browser ទំនើប
- Backend API (PHP) ត្រូវបើក

## 📦 ការតំឡើង
```bash
cd frontend
npm install
npm start
```
- Development: `npm start` (http://localhost:3000)
- Production: `npm run build`

## 🚀 ការប្រើប្រាស់
- Navigation និង UI ស្រួលប្រើ
- Dashboard សម្រាប់ Job Seeker, Employer, Admin
- Profile Management (Avatar, Info)
- Search & Filter Jobs
- Apply for Jobs
- Upload Resume
- Toast Notification
- Responsive Design

## 📁 រចនាសម្ព័ន្ធ Project
```
frontend/
├── public/              # Static files
│   ├── index.html
│   └── manifest.json
│   └── Job Portal-logo-transparent.png
├── src/
│   ├── components/      # UI Components (Navigation, Footer, Hero, FeaturedJobs, Toast...)
│   ├── pages/           # Page Components (Login, Register, Dashboard, Profile, JobsPage...)
│   ├── services/        # API Services (api.js, authService.js, employerService.js...)
│   ├── hooks/           # Custom React Hooks (useAuth.js, usePosts.js)
│   ├── data/            # Mock Data (jobs.js)
│   ├── App.js           # Main App Component
│   └── index.js         # Entry Point
├── build/               # Production Build
├── package.json         # Dependencies
└── tailwind.config.js   # Tailwind CSS Config
```

## 🧩 Component & Page
- NavigationClean.js, FooterClean.js, HeroSectionClean.js, FeaturedJobsClean.js, Toaster.js
- LoginPage.js, RegisterPage.js, JobsPage.js, JobDetailsPage.js, EmployerDashboard.js, EmployerProfile.js, JobSeekerDashboard.js, SeekerProfilePage.js, AdminDashboard.js, AdminProfile.js

## 🎨 Tailwind CSS
- Utility-first CSS framework សម្រាប់ UI
- Responsive breakpoints: sm, md, lg, xl

## 🔗 React Router
- Routing: `/`, `/login`, `/register`, `/jobs`, `/jobs/:id`, `/dashboard`, `/seeker/profile`, `/employer/profile`, `/admin`, ...

## 🔌 Axios
- សម្រាប់សំណើ API ទៅ backend
- Base URL: `http://localhost/Job_Portal_Project/backend/api`
- JWT Bearer token

## 📝 ការប្រើ .env
- បង្កើត `.env` នៅ root directory
```env
REACT_APP_API_BASE_URL=http://localhost/Job_Portal_Project/backend/api
```

## 🚢 Build & Deployment
- Production: `npm run build` → build/ folder
- Deploy build folder ទៅ server (Apache/XAMPP, Netlify, Vercel...)

## 🌐 Browser Support
- Chrome, Firefox, Safari, Edge, Opera, Mobile Browsers

## 📞 Support
- Email: support@jobportal.com
- បង្កើត Issue នៅ Repository

## 📄 License
- MIT License

## 🙏 Acknowledgments
- React.js, Tailwind CSS, Font Awesome

---
**អរគុណសម្រាប់ការប្រើប្រាស់ Job Portal**
---
