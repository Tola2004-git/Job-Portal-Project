# 🔧 Job Portal - Backend API (PHP)

នេះគឺជា backend API សម្រាប់ Job Portal ដែលសរសេរដោយប្រើ PHP 8, MySQL និង JWT authentication។

## 📋 មាតិកា
- សង្ខេប
- បច្ចេកវិទ្យាដែលប្រើ
- តម្រូវការប្រព័ន្ធ
- ការតំឡើង
- ការរៀបចំ Database
- រចនាសម្ព័ន្ធ Project
- API Endpoints
- Authentication
- File Uploads
- សុវត្ថិភាព
- Error Handling
- Testing
- Troubleshooting
- License
- Acknowledgments

## 🎯 សង្ខេប

Backend API ផ្តល់ endpoints សម្រាប់គ្រប់គ្រងអ្នកប្រើ, jobs, applications, profiles។ មាន role-based access, JWT authentication, និង file upload (avatar/resume)។

## 🛠 បច្ចេកវិទ្យាដែលប្រើ
- **PHP** (v8.x)
- **MySQL** (v5.7+)
- **PDO**
- **JWT**
- **bcrypt**
- **Apache/XAMPP**

## 💻 តម្រូវការប្រព័ន្ធ
- PHP 8.0+ (XAMPP recommended)
- MySQL 5.7+
- Apache 2.4+

## 📦 ការតំឡើង
1. Clone ឬ Copy backend ទៅ htdocs
2. បង្កើត database: `job_portal_db`
3. Import schema: `database/job_portal_db.sql`
4. កំណត់ credentials នៅ `config/database.php`
5. Start Apache និង MySQL

## 🗄 ការរៀបចំ Database
```sql
CREATE DATABASE job_portal_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
mysql -u root -p job_portal_db < database/job_portal_db.sql
```

## 📁 រចនាសម្ព័ន្ធ Project
```
backend/
├── api/           # API endpoints
│   ├── auth/      # Login/Register
│   ├── admin/     # Admin APIs
│   ├── employer/  # Employer APIs
│   ├── jobs/      # Public job APIs
│   └── jobseeker/ # Job seeker APIs
├── config/        # Database config
├── database/      # SQL schema
├── models/        # Data models
├── uploads/       # Avatars/Resumes
```

## 🔌 API Endpoints
- Authentication: `/api/auth/login.php`, `/api/auth/register.php`
- Jobs: `/api/jobs/public.php`, `/api/jobs/details.php`, `/api/jobs/stats.php`
- Job Seeker: `/api/jobseeker/profile.php`, `/api/jobseeker/apply.php`, ...
- Employer: `/api/employer/jobs.php`, `/api/employer/profile.php`, ...
- Admin: `/api/admin/users.php`, `/api/admin/jobs.php`, ...

## 🔐 Authentication
- JWT-based authentication
- Role-based access control (Admin, Employer, Job Seeker)
- Password hashing (bcrypt)
- Token expiration (24h)

## 📁 File Uploads
- Avatars: `uploads/avatars/` (Base64 data URI)
- Resumes: `uploads/resumes/` (PDF, DOC, DOCX)
- File path រក្សាទុកក្នុង database

## 🛡️ សុវត្ថិភាព
- Password hashing (bcrypt)
- SQL injection prevention (PDO prepared statements)
- XSS protection
- CORS headers
- Role-based access
- File validation

## ⚠️ Error Handling
- HTTP status codes: 200, 201, 400, 401, 404, 500
- JSON response: `{ success: false, error: "Error message" }`

## 🧪 Testing
- Postman/cURL: Test endpoints
- Add header: `Authorization: Bearer {token}`
- Example:
```bash
curl -X POST http://localhost/Job_Portal_Project/backend/api/auth/login.php \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

## 🐛 Troubleshooting
- Database connection: Check MySQL, credentials, db exists
- CORS: Check headers, frontend URL
- File upload: Check permissions, php.ini
- JWT: Check header, token expiration

## 📄 License
- MIT License

## 🙏 អរគុណ
- PHP, MySQL, JWT, XAMPP

---
**អរគុណច្រើនសម្រាប់ការគាំទ្រ**
---
