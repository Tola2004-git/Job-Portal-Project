# 🚀 Job Portal – ស្វែងរកការងារដែលអ្នកស្រមៃ

Job Portal គឺជាប្រព័ន្ធ Full-stack (React + PHP + MySQL) ដែលភ្ជាប់ Job Seekers, Employers និង Admin ក្នុងឧបករណ៍តែមួយ។ Repository នេះមាន frontend SPA (React) និង backend REST API (PHP) សម្រាប់ដំណើរការផ្សព្វផ្សាយការងារ ការដាក់ពាក្យ និងការគ្រប់គ្រងស្ថិតិ។

![Job Portal](frontend/public/Job%20Portal-logo-transparent.png)

## 📚 មាតិកា
- [សង្ខេប](#សង្ខេប)
- [Architecture](#architecture)
- [លក្ខណៈពិសេស](#លក្ខណៈពិសេស)
- [Tech Stack](#tech-stack)
- [តម្រូវការប្រព័ន្ធ](#តម្រូវការប្រព័ន្ធ)
- [ការរៀបចំកូដ](#ការរៀបចំកូដ)
- [ការរៀបចំ Database](#ការរៀបចំ-database)
- [Environment Variables](#environment-variables)
- [ការបើកដំណើរការ Local](#ការបើកដំណើរការ-local)
- [Testing](#testing)
- [Deployment Guide](#deployment-guide)
- [Security Checklist](#security-checklist)
- [Folder Structure](#folder-structure)
- [User Roles](#user-roles)
- [API Overview](#api-overview)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [ឯកសារផ្សេង](#ឯកសារផ្សេង)

## 🎯 សង្ខេប
- Job seekers៖ ស្វែងរកការងារ ដាក់ពាក្យ តាមដានស្ថានភាព និងគ្រប់គ្រង resume/profile
- Employers៖ បង្ហោះការងារ ត្រួតពិនិត្យពាក្យស្នើសុំ និងគ្រប់គ្រងក្រុមហ៊ុន
- Admins៖ ត្រួតពិនិត្យស្ថិតិ សម្គាល់អ្នកប្រើ ការងារ និងពាក្យស្នើសុំ

## 🏗 Architecture
- **Frontend**: React (SPA) build with Tailwind, Axios services, context hooks
- **Backend**: PHP REST endpoints (procedural style) + JWT auth + PDO queries
- **Database**: MySQL schema confined in `backend/database/job_portal_db.sql`
- **Storage**: Resumes/avatars នៅក្នុង `backend/uploads`
- **Auth Flow**: JWT stored in `localStorage` → attached as `Authorization: Bearer <token>`

## ✨ លក្ខណៈពិសេស
- Role-based dashboards (Admin / Employer / Job Seeker)
- Job management, application tracking, status updates, analytics widgets
- Resume upload/download (secured with JWT validation)
- Avatar upload with compression + caching
- Notifications/messages module (admin ↔ users)
- Responsive UI + PWA manifest icons (Vercel friendly)

## 💻 Tech Stack
- **Frontend**: React 18, Tailwind CSS, Axios, React Router
- **Backend**: PHP 8, PDO/MySQLi, JWT helper, PHPMailer (email config ready)
- **Tooling**: Node.js 18+, npm, PowerShell scripts (Windows friendly), VS Code

## 🧰 តម្រូវការប្រព័ន្ធ
- Node.js ≥ 18 & npm ≥ 9 (frontend build)
- PHP ≥ 8.1 & Composer (optional future packages)
- MySQL ≥ 8.0 (tested with 5.7+) 
- XAMPP/WAMP/Laragon ឬ Docker stack
- Git (សម្រាប់ deploy ទៅ GitHub/Vercel)

## 📦 ការរៀបចំកូដ
```bash
git clone https://github.com/YOUR_USERNAME/job-portal.git
cd Job_Portal_Project

# frontend dependencies
cd frontend
npm install

# optional: lint/test hooks (when available)
npm run build
```

### `.gitignore` ផ្តល់អនុសាសន៍
- ដាក់ `backend/config/*.php` (ដែលមាន credential) ទៅក្នុង `.gitignore`
- បង្កើត `backend/config/database.example.php` ជា template
- មិន push `backend/uploads/` ទៅ repo (លើកលែងអ្នកប្រើត្រូវការរូបភាព sample)

## 🗄 ការរៀបចំ Database
```bash
mysql -u root -p -e "CREATE DATABASE job_portal_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p job_portal_db < backend/database/job_portal_db.sql
```

កែ `backend/config/database.php`
```php
$host = '127.0.0.1';
$db_name = 'job_portal_db';
$username = 'root';
$password = '';
```

## 🔐 Environment Variables
| File | Variable | សារៈសំខាន់ |
|------|----------|-------------|
| `frontend/.env` | `REACT_APP_API_BASE_URL` | URL base backend (ឧ. `https://api.example.com`) |
| `backend/config/app.php` | `APP_URL`, `JWT_SECRET`, `CORS_ALLOWED_ORIGINS` | កំណត់ domain និង JWT secret |
| `backend/config/email.php` | SMTP creds (optional) | សម្រាប់ future notification |

ឧទាហរណ៍ `frontend/.env.local`
```env
REACT_APP_API_BASE_URL=http://localhost/Job_Portal_Project/backend/api
```

## 🧑‍💻 ការបើកដំណើរការ Local
```bash
# backend under XAMPP
http://localhost/Job_Portal_Project/backend/api

# frontend dev server
cd frontend
npm start
# CRA proxy, or configure services/api.js ให้ចង្អុលទៅ backend
```

### Build Production Assets
```bash
cd frontend
npm run build
# output -> frontend/build (upload to Vercel/netlify)
```

## ✅ Testing
- Manual test plan (recommended):
	- Auth (register/login/logout per role)
	- Profile update + avatar upload
	- Job posting/editing/deleting (Employer/Admin)
	- Application status changes + resume download
	- Analytics filters, messages module
- Automated tests: (pending) → ផែនការបន្ថែម Playwright/PHPUnit

## 🚀 Deployment Guide

### 1. Frontend → Vercel (Free Tier)
1. Push repo ទៅ GitHub
2. Login Vercel → New Project → Import repo → Root directory `frontend`
3. Build Command `npm run build`, Output Directory `build`
4. Add Env Variable `REACT_APP_API_BASE_URL=https://<backend-domain>/backend/api`
5. Deploy → បង្កើត URL `https://your-app.vercel.app`

> Tip: ពេល update favicon/icons មិនភ្លេច clear cache ឬ bump `manifest.json` version

### 2. Backend → Free PHP Hosting (InfinityFree/000webhost)
1. បង្កើត subdomain (ឧ. `jobportal.<host>.app`)
2. Upload `backend/` ទៅ `htdocs/` តាម FTP (FileZilla)
3. Import database `job_portal_db.sql` តាម phpMyAdmin
4. កែ `backend/config/database.php`, `app.php`, `email.php`
5. កំណត់ CHMOD `backend/uploads/avatars`, `backend/uploads/resumes` → writable
6. Update CORS (`Access-Control-Allow-Origin`) → domain frontend ពិត

### 3. DNS / Reverse Proxy (ಐ​​Optional)
- បើមាន domain ផ្ទាល់ខ្លួន, point A-record ទៅ hosting, ឬប្រើ Cloudflare
- បង្កើត subdomain `api.example.com` → proxy ទៅ PHP hosting

### 4. Smoke Test After Deploy
- Login/logout សម្រាប់ទាំង៣តួនាទី
- Upload + download resume (verify JWT header accepted)
- Update password (check policy)
- Verify manifest icons & install prompt (PWA)

## 🔒 Security Checklist
- ប្តូរ `JWT_SECRET` ជា string random ≥ 32 chars
- បិទ `error_reporting` នៅ production (ឬ log សម្រាប់ admin ប៉ុណ្ណោះ)
- ដាក់ HTTPS (Let’s Encrypt) សម្រាប់ទាំង frontend/backend
- Rate limiting មានសម្រាប់ change password / login (job seeker already has; employer/admin optional)
- Sanitize file uploads + limit MIME/size (implemented; monitor logs)

## 🗂 Folder Structure (High-level)
```
backend/
	api/
		admin/
		employer/
		jobseeker/
		auth/
		jobs/
		download.php
	config/
	database/
	uploads/
frontend/
	public/
	src/
		components/
		pages/
		services/
		hooks/
		data/
tools/
	resize-icons.ps1
```

## 👥 User Roles
| Role | Credentials (Dev) | ហត្ថលេខា |
|------|-------------------|-----------|
| Admin | `admin@jobportal.com` / `admin123` | Manage users + jobs + analytics |
| Employer | Create via register | Manage company postings |
| Job Seeker | Register via UI | Apply & manage resume |

> សូមប្តូរ credential លំនាំដើម មុន deploy production

## 🔌 API Overview
- Auth: `/auth/login.php`, `/auth/register.php`
- Admin: `/admin/jobs.php`, `/admin/applications.php`, `/admin/analytics.php`
- Employer: `/employer/jobs.php`, `/employer/change-password.php`
- Job Seeker: `/jobseeker/applications.php`, `/jobseeker/change-password.php`
- Shared: `/download.php`, `/upload.php`

ហៅ API តាម Axios service (`frontend/src/services/*Service.js`) ដែលបន្ថែម header JWT អូតូម៉ាទិក។

## 🛠 Troubleshooting
- **CORS Error**: ពិនិត្យ `Access-Control-Allow-Origin` និង `REACT_APP_API_BASE_URL`
- **JWT invalid/expired**: ត្រូវ login ថ្មី ឬ verify clock drift hosting
- **Resume download fail**: តម្រូវ `Authorization: Bearer <token>` + folder permissions
- **PWA icon still outdated**: Clear browser cache ឬ bump manifest query string
- **Build error on Vercel**: ប្រាកដ `package-lock.json` ទាន់សម័យ និង Node version 18

## 🛣 Roadmap (សង្ខេប)
- Automated testing suite (React Testing Library, PHPUnit)
- Background jobs (email notifications, digest)
- Real-time messaging/employer contact
- Recommendation engine និង advanced filters
- Multi-language UI និង i18n support

## ឯកសារផ្សេង
- Support: បង្កើត GitHub Issue ឬទំនាក់ទំនង `admin@jobportal.com`
- License: [MIT](LICENSE) (បង្កើតឯកសារ LICENSE ប្រសិនបើមិនមាន)
- Acknowledgments: React, Tailwind, Font Awesome, XAMPP, Vercel community

---
សូមអរគុណដែលបានប្រើប្រាស់ Job Portal! 🚀
