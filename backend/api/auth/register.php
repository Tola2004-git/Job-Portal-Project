<?php
error_reporting(E_ALL);
ini_set("display_errors", 1);

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit();
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["success" => false, "error" => "Method not allowed"]);
    exit();
}

require_once "../../config/database.php";
require_once __DIR__ . '/../helpers/avatar.php';
require_once __DIR__ . '/../helpers/jwt.php';

$input = file_get_contents("php://input");
$data = json_decode($input);

if (empty($data->email) || empty($data->password)) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Email and password are required"]);
    exit();
}

if (!filter_var($data->email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Invalid email format"]);
    exit();
}

if (strlen($data->password) < 6) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Password must be at least 6 characters long"]);
    exit();
}

try {
    // Debug registration data
    file_put_contents(__DIR__.'/register_debug.log', json_encode($data, JSON_PRETTY_PRINT)."\n", FILE_APPEND);
    $database = new Database();
    $db = $database->getConnection();
    
    if (!$db) {
        throw new Exception("Database connection failed");
    }

    // Fetch active admins to notify about new registrations
    $adminIds = [];
    $adminQuery = "SELECT id FROM users WHERE role = 'admin' AND status = 'active'";
    $adminStmt = $db->prepare($adminQuery);
    $adminStmt->execute();
    $adminIds = $adminStmt->fetchAll(PDO::FETCH_COLUMN);
    
    $checkQuery = "SELECT id FROM users WHERE email = :email LIMIT 1";
    $checkStmt = $db->prepare($checkQuery);
    $checkStmt->bindParam(":email", $data->email, PDO::PARAM_STR);
    $checkStmt->execute();
    
    if ($checkStmt->fetch(PDO::FETCH_ASSOC)) {
        http_response_code(409);
        echo json_encode(["success" => false, "error" => "Email already registered"]);
        exit();
    }
    
    $username = isset($data->username) && !empty($data->username) ? $data->username : explode("@", $data->email)[0];
    $full_name = isset($data->full_name) && !empty($data->full_name) ? $data->full_name : $username;
    $role = isset($data->role) && in_array($data->role, ["admin", "employer", "job_seeker"]) ? $data->role : "job_seeker";
    $hashedPassword = password_hash($data->password, PASSWORD_DEFAULT);
    
    // Get phone from registration data
    $phone = isset($data->phone) ? $data->phone : '';
    
    $insertQuery = "INSERT INTO users (username, full_name, email, phone, password, role, status, avatar, created_at) VALUES (:username, :full_name, :email, :phone, :password, :role, 'active', :avatar, NOW())";
    $insertStmt = $db->prepare($insertQuery);
    $insertStmt->bindParam(":username", $username, PDO::PARAM_STR);
    $insertStmt->bindParam(":full_name", $full_name, PDO::PARAM_STR);
    $insertStmt->bindParam(":email", $data->email, PDO::PARAM_STR);
    $insertStmt->bindParam(":phone", $phone, PDO::PARAM_STR);
    $insertStmt->bindParam(":password", $hashedPassword, PDO::PARAM_STR);
    $insertStmt->bindParam(":role", $role, PDO::PARAM_STR);
    $defaultAvatar = get_default_avatar_data_uri();
    $insertStmt->bindParam(":avatar", $defaultAvatar, PDO::PARAM_STR);
    
    if ($insertStmt->execute()) {
        $userId = $db->lastInsertId();
        $employerProfile = null;
        // បង្កើត profile សម្រាប់ employer
        if ($role === 'employer') {
            $companyName = isset($data->company_name) ? $data->company_name : $full_name;
            $industry = isset($data->industry) ? $data->industry : 'technology';
            $companySize = isset($data->company_size) ? $data->company_size : '1-10';
            $description = isset($data->description) ? $data->description : '';
            $profileQuery = "INSERT INTO employer_profiles (
                user_id, company_name, industry, company_size, email, 
                website, description, phone, address, linkedin, twitter, facebook, instagram,
                work_type, experience_level, avg_salary, turnover_rate, team_size, founded_year,
                benefits, locations, core_values, active_jobs, total_applications, successful_hires, rating,
                created_at, updated_at
            ) VALUES (
                :user_id, :company_name, :industry, :company_size, :email,
                '', :description, :phone, '', '', '', '', '',
                'onsite', 'entry', '', 0, 0, :founded_year,
                '{}', '[]', '[]', 0, 0, 0, 0,
                NOW(), NOW()
            )";
            $profileStmt = $db->prepare($profileQuery);
            $profileStmt->bindParam(':user_id', $userId);
            $profileStmt->bindParam(':company_name', $companyName);
            $profileStmt->bindParam(':industry', $industry);
            $profileStmt->bindParam(':company_size', $companySize);
            $profileStmt->bindParam(':email', $data->email);
            $profileStmt->bindParam(':description', $description);
            $profileStmt->bindParam(':phone', $phone);
            $foundedYear = date('Y');
            $profileStmt->bindParam(':founded_year', $foundedYear);
            $profileStmt->execute();
            // ទាញ profile ទៅបង្ហាញក្នុង response
            $getProfileQuery = "SELECT company_name, industry, company_size, description FROM employer_profiles WHERE user_id = :user_id LIMIT 1";
            $getProfileStmt = $db->prepare($getProfileQuery);
            $getProfileStmt->bindParam(':user_id', $userId);
            $getProfileStmt->execute();
            $employerProfile = $getProfileStmt->fetch(PDO::FETCH_ASSOC);
        }

        // Create job seeker profile if registering as job seeker
        if ($role === 'job_seeker') {
            $skills = isset($data->skills) ? $data->skills : '';
            $experienceLevel = isset($data->experience_level) ? $data->experience_level : 'entry';
            
            // Convert skills string to JSON array
            if (!empty($skills)) {
                $skillsArray = array_map('trim', explode(',', $skills));
                $skillsJson = json_encode($skillsArray);
            } else {
                $skillsJson = '[]';
            }
            
            // Map experience level to years
            $experienceYears = 0;
            switch($experienceLevel) {
                case 'entry': $experienceYears = 0; break;
                case 'junior': $experienceYears = 2; break;
                case 'mid': $experienceYears = 4; break;
                case 'senior': $experienceYears = 6; break;
                case 'expert': $experienceYears = 10; break;
            }
            
            $seekerProfileQuery = "INSERT INTO job_seeker_profiles (
                user_id, bio, skills, experience_years, education, certifications, languages,
                preferred_job_types, preferred_locations, preferred_categories,
                salary_min, salary_max, availability, willing_to_relocate,
                portfolio_url, linkedin_url, github_url, website_url, resume_path,
                profile_views, total_applications, successful_applications,
                created_at, updated_at
            ) VALUES (
                :user_id, '', :skills, :experience_years, '[]', '[]', '[]',
                '[]', '[]', '[]',
                0, 0, 'immediate', 0,
                '', '', '', '', '',
                0, 0, 0,
                NOW(), NOW()
            )";
            
            $seekerStmt = $db->prepare($seekerProfileQuery);
            $seekerStmt->bindParam(':user_id', $userId);
            $seekerStmt->bindParam(':skills', $skillsJson);
            $seekerStmt->bindParam(':experience_years', $experienceYears);
            $seekerStmt->execute();
        }

        // Notify admins about the new registration
        if (!empty($adminIds)) {
            $subject = $role === 'employer' ? 'New employer registration' : 'New job seeker registration';
            $message = $role === 'employer'
                ? sprintf(
                    "A new employer has registered.\n\nName: %s\nEmail: %s\nCompany: %s",
                    $full_name,
                    $data->email,
                    isset($data->company_name) ? $data->company_name : $full_name
                )
                : sprintf(
                    "A new job seeker has registered.\n\nName: %s\nEmail: %s",
                    $full_name,
                    $data->email
                );

            $messageInsert = $db->prepare(
                "INSERT INTO messages (from_user_id, to_user_id, subject, message, type, status, created_at) " .
                "VALUES (:from_user_id, :to_user_id, :subject, :message, 'inbox', 'unread', NOW())"
            );

            foreach ($adminIds as $adminId) {
                $messageInsert->execute([
                    ':from_user_id' => $userId,
                    ':to_user_id' => $adminId,
                    ':subject' => $subject,
                    ':message' => $message
                ]);
            }
        }
        
        $issuedAt = time();
        $expiresAt = $issuedAt + APP_JWT_EXP_SECONDS;
        $tokenPayload = [
            'user_id' => (int)$userId,
            'email' => $data->email,
            'role' => $role,
            'iat' => $issuedAt,
            'exp' => $expiresAt
        ];
        $token = jwt_encode($tokenPayload);

        $cookieParams = [
            'expires' => $expiresAt,
            'path' => '/',
            'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
            'httponly' => true,
            'samesite' => 'Lax'
        ];
        setcookie('jp_auth', $token, $cookieParams);
        
        http_response_code(201);
        $response = [
            "success" => true,
            "message" => "Registration successful",
            "token" => $token,
            "user" => [
                "id" => (int)$userId,
                "username" => $username,
                "full_name" => $full_name,
                "email" => $data->email,
                "role" => $role,
                "status" => "active",
                "avatar" => $defaultAvatar,
                "phone" => $phone,
                "bio" => null
            ]
        ];
        $response['expires_at'] = $expiresAt;
        if ($employerProfile) {
            $response["employer_profile"] = $employerProfile;
        }
        echo json_encode($response);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "Failed to create user account"]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Server error: " . $e->getMessage()]);
}
