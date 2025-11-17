<?php
error_reporting(E_ALL);
ini_set("display_errors", 1);

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit();
}

require_once "../../config/database.php";
require_once "../../config/app.php";
require_once __DIR__ . '/../helpers/jwt.php';

$headers = function_exists('getallheaders') ? getallheaders() : [];
$authHeader = $headers['Authorization'] ?? '';

if (empty($authHeader) || !str_starts_with($authHeader, 'Bearer ')) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit();
}

$token = str_replace('Bearer ', '', $authHeader);
try {
    $tokenData = jwt_decode($token);
    if (($tokenData['role'] ?? '') !== 'admin') {
        throw new Exception('Admin only');
    }
    $adminId = (int) $tokenData['user_id'];
} catch (Exception $e) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    exit();
}

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Users statistics
    $usersQuery = "SELECT COUNT(*) as total FROM users";
    $totalUsers = $db->query($usersQuery)->fetch(PDO::FETCH_ASSOC)["total"];
    
    $roleQuery = "SELECT 
        SUM(CASE WHEN role = 'job_seeker' THEN 1 ELSE 0 END) as seekers,
        SUM(CASE WHEN role = 'employer' THEN 1 ELSE 0 END) as employers,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
    FROM users";
    $roleStats = $db->query($roleQuery)->fetch(PDO::FETCH_ASSOC);
    
    // Jobs statistics
    $jobsQuery = "SELECT COUNT(*) as total FROM jobs";
    $totalJobs = $db->query($jobsQuery)->fetch(PDO::FETCH_ASSOC)["total"];
    
    $activeJobsQuery = "SELECT COUNT(*) as active FROM jobs WHERE status = 'active'";
    $activeJobs = $db->query($activeJobsQuery)->fetch(PDO::FETCH_ASSOC)["active"];
    
    // Applications statistics
    $appsQuery = "SELECT COUNT(*) as total FROM applications";
    $totalApps = $db->query($appsQuery)->fetch(PDO::FETCH_ASSOC)["total"];
    
    $pendingAppsQuery = "SELECT COUNT(*) as pending FROM applications WHERE status = 'pending'";
    $pendingApps = $db->query($pendingAppsQuery)->fetch(PDO::FETCH_ASSOC)["pending"];
    
    // Recent users
    $recentQuery = "SELECT id, username, full_name, email, role, status, created_at FROM users ORDER BY created_at DESC LIMIT 5";
    $recentUsers = $db->query($recentQuery)->fetchAll(PDO::FETCH_ASSOC);
    
    // Recent jobs
    $recentJobsQuery = "SELECT j.id, j.title, j.location, j.job_type, j.status, j.created_at, u.full_name as employer_name 
        FROM jobs j 
        LEFT JOIN users u ON j.employer_id = u.id 
        ORDER BY j.created_at DESC 
        LIMIT 5";
    $recentJobs = $db->query($recentJobsQuery)->fetchAll(PDO::FETCH_ASSOC);
    
    // Get admin profile data (including avatar)
    $adminQuery = "SELECT id, username, full_name, email, avatar, phone, bio, role FROM users WHERE id = :id";
    $adminStmt = $db->prepare($adminQuery);
    $adminStmt->execute([':id' => $adminId]);
    $adminProfile = $adminStmt->fetch(PDO::FETCH_ASSOC);
    
    http_response_code(200);
    echo json_encode([
        "success" => true,
        "data" => [
            // Stats in format that frontend expects
            "jobs" => [
                "total" => (int)$totalJobs,
                "active" => (int)$activeJobs
            ],
            "users" => [
                "total" => (int)$totalUsers,
                "job_seekers" => (int)$roleStats["seekers"],
                "employers" => (int)$roleStats["employers"],
                "active" => (int)$roleStats["active"]
            ],
            "applications" => [
                "total" => (int)$totalApps,
                "pending" => (int)$pendingApps
            ],
            "recent_users" => $recentUsers,
            "recent_jobs" => $recentJobs,
            "admin_profile" => $adminProfile
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
