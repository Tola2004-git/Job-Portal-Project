<?php
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../../config/database.php';
require_once '../../config/app.php';
require_once __DIR__ . '/../helpers/jwt.php';

// JWT Authentication
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? '';

if (empty($authHeader) || !str_starts_with($authHeader, 'Bearer ')) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit();
}

$token = str_replace('Bearer ', '', $authHeader);
try {
    $decoded = jwt_decode($token);
    if (($decoded['role'] ?? '') !== 'employer') {
        throw new Exception('Invalid token or not an employer');
    }
    $employerId = (int) $decoded['user_id'];
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    exit();
}

$database = new Database();
$db = $database->getConnection();

try {
    // Get total jobs posted by employer
    $jobsQuery = "SELECT COUNT(*) as total FROM jobs WHERE employer_id = :employer_id";
    $stmt = $db->prepare($jobsQuery);
    $stmt->bindParam(':employer_id', $employerId);
    $stmt->execute();
    $totalJobs = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    // Get active jobs count
    $activeJobsQuery = "SELECT COUNT(*) as active FROM jobs WHERE employer_id = :employer_id AND status = 'active'";
    $stmt = $db->prepare($activeJobsQuery);
    $stmt->bindParam(':employer_id', $employerId);
    $stmt->execute();
    $activeJobs = $stmt->fetch(PDO::FETCH_ASSOC)['active'];
    
    // Get total applications for employer's jobs
    $appsQuery = "SELECT COUNT(*) as total 
                  FROM applications a 
                  INNER JOIN jobs j ON a.job_id = j.id 
                  WHERE j.employer_id = :employer_id";
    $stmt = $db->prepare($appsQuery);
    $stmt->bindParam(':employer_id', $employerId);
    $stmt->execute();
    $totalApplications = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    // Get pending applications count
    $pendingQuery = "SELECT COUNT(*) as pending 
                     FROM applications a 
                     INNER JOIN jobs j ON a.job_id = j.id 
                     WHERE j.employer_id = :employer_id AND a.status = 'pending'";
    $stmt = $db->prepare($pendingQuery);
    $stmt->bindParam(':employer_id', $employerId);
    $stmt->execute();
    $pendingApplications = $stmt->fetch(PDO::FETCH_ASSOC)['pending'];
    
    // Get accepted (hired) count
    $hiredQuery = "SELECT COUNT(*) as hired 
                   FROM applications a 
                   INNER JOIN jobs j ON a.job_id = j.id 
                   WHERE j.employer_id = :employer_id AND a.status = 'accepted'";
    $stmt = $db->prepare($hiredQuery);
    $stmt->bindParam(':employer_id', $employerId);
    $stmt->execute();
    $hiredCount = $stmt->fetch(PDO::FETCH_ASSOC)['hired'];
    
    // Get total job views
    $viewsQuery = "SELECT SUM(views) as total_views FROM jobs WHERE employer_id = :employer_id";
    $stmt = $db->prepare($viewsQuery);
    $stmt->bindParam(':employer_id', $employerId);
    $stmt->execute();
    $totalViews = $stmt->fetch(PDO::FETCH_ASSOC)['total_views'] ?? 0;
    
    // Get recent jobs
    $recentJobsQuery = "SELECT j.id, j.title, j.job_type, j.status, j.views, 
                        COALESCE(ep.company_name, u.full_name) as company_name, u.avatar as company_logo,
                        (SELECT COUNT(*) FROM applications WHERE job_id = j.id) as applications_count,
                        j.created_at 
                        FROM jobs j
                        LEFT JOIN users u ON j.employer_id = u.id
                        LEFT JOIN employer_profiles ep ON ep.user_id = u.id
                        WHERE j.employer_id = :employer_id 
                        ORDER BY j.created_at DESC 
                        LIMIT 5";
    $stmt = $db->prepare($recentJobsQuery);
    $stmt->bindParam(':employer_id', $employerId);
    $stmt->execute();
    $recentJobs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    // Normalize company_logo in recent jobs
    foreach ($recentJobs as &$rj) {
        if (!empty($rj['company_logo'])) {
            $logo = trim($rj['company_logo']);
            if (!preg_match('/^(data:|https?:\/\/)/i', $logo)) {
                $logo = rtrim(APP_BASE_URL, '/') . '/' . ltrim($logo, '/');
            }
            $rj['company_logo'] = $logo;
        } else {
            $rj['company_logo'] = rtrim(APP_BASE_URL, '/') . '/' . ltrim('/Job Portal-logo-transparent.png', '/');
        }
    }
    unset($rj);
    
    // Get recent applications
    $recentAppsQuery = "SELECT a.id, a.status, a.applied_at, a.cover_letter,
                               j.id as job_id, j.title as job_title,
                               u.id as applicant_id, u.full_name as applicant_name, u.email as applicant_email
                        FROM applications a
                        INNER JOIN jobs j ON a.job_id = j.id
                        INNER JOIN users u ON a.seeker_id = u.id
                        WHERE j.employer_id = :employer_id
                        ORDER BY a.applied_at DESC
                        LIMIT 10";
    $stmt = $db->prepare($recentAppsQuery);
    $stmt->bindParam(':employer_id', $employerId);
    $stmt->execute();
    $recentApplications = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get employer profile data (including avatar)
        $employerQuery = "SELECT 
                                                u.id, u.username, u.full_name, u.email, u.avatar, u.phone, u.bio, u.role,
                                                COALESCE(ep.company_name, u.full_name) as company_name
                                            FROM users u
                                            LEFT JOIN employer_profiles ep ON ep.user_id = u.id
                                            WHERE u.id = :id";
        $employerStmt = $db->prepare($employerQuery);
        $employerStmt->execute([':id' => $employerId]);
        $employerProfile = $employerStmt->fetch(PDO::FETCH_ASSOC);
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'data' => [
            'stats' => [
                'total_jobs' => (int)$totalJobs,
                'active_jobs' => (int)$activeJobs,
                'total_applications' => (int)$totalApplications,
                'pending_applications' => (int)$pendingApplications,
                'hired' => (int)$hiredCount,
                'total_views' => (int)$totalViews
            ],
            'recent_jobs' => $recentJobs,
            'recent_applications' => $recentApplications,
            'employer_profile' => $employerProfile
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
