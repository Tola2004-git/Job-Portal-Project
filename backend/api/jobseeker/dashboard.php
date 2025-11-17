<?php
/**
 * Job Seeker Dashboard API
 * GET: Retrieve dashboard statistics and overview
 */

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../helpers/jwt.php';

try {
    // Only allow GET requests
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        throw new Exception('Method not allowed');
    }

    // Get JWT token from Authorization header
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    
    if (!$authHeader) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'No authorization token provided']);
        exit();
    }

    // Decode JWT token
    $token = str_replace('Bearer ', '', $authHeader);
    try {
        $decoded = jwt_decode($token);
    } catch (Exception $e) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        exit();
    }

    if (($decoded['role'] ?? '') !== 'job_seeker') {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid token or unauthorized']);
        exit();
    }

    $userId = (int) $decoded['user_id'];

    // Database connection
    $database = new Database();
    $db = $database->getConnection();

    // Get applications count and breakdown by status
    $appQuery = "SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'reviewing' THEN 1 ELSE 0 END) as reviewing,
        SUM(CASE WHEN status = 'shortlisted' THEN 1 ELSE 0 END) as shortlisted,
        SUM(CASE WHEN status = 'reviewed' THEN 1 ELSE 0 END) as reviewed,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as interviews,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'hired' THEN 1 ELSE 0 END) as hired
    FROM applications 
    WHERE seeker_id = :user_id";
    
    $stmt = $db->prepare($appQuery);
    $stmt->bindParam(':user_id', $userId);
    $stmt->execute();
    $applications = $stmt->fetch(PDO::FETCH_ASSOC);

    // Get saved jobs count
    $savedQuery = "SELECT COUNT(*) as total FROM saved_jobs WHERE user_id = :user_id";
    $stmt = $db->prepare($savedQuery);
    $stmt->bindParam(':user_id', $userId);
    $stmt->execute();
    $savedResult = $stmt->fetch(PDO::FETCH_ASSOC);
    $savedJobs = $savedResult['total'];

    // Get profile views from job_seeker_profiles
    $profileQuery = "SELECT profile_views, total_applications, successful_applications 
                     FROM job_seeker_profiles 
                     WHERE user_id = :user_id";
    $stmt = $db->prepare($profileQuery);
    $stmt->bindParam(':user_id', $userId);
    $stmt->execute();
    $profile = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $profileViews = $profile ? $profile['profile_views'] : 0;
    
    // Get recent applications (last 5)
    $recentQuery = "SELECT 
        a.id,
        a.status,
        a.applied_at,
        a.cover_letter,
        j.id as job_id,
        j.title,
        j.job_type,
        j.location,
        j.salary_min,
        j.salary_max,
        COALESCE(ep.company_name, u.full_name, 'Unknown Company') as company_name,
        u.avatar as company_logo
    FROM applications a
    INNER JOIN jobs j ON a.job_id = j.id
    INNER JOIN users u ON j.employer_id = u.id
    LEFT JOIN employer_profiles ep ON j.employer_id = ep.user_id
    WHERE a.seeker_id = :user_id
    ORDER BY a.applied_at DESC
    LIMIT 5";
    
    $stmt = $db->prepare($recentQuery);
    $stmt->bindParam(':user_id', $userId);
    $stmt->execute();
    $recentApplications = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Get user's last login and resume path (from users table)
    $userQuery = "SELECT email, full_name, resume_path, updated_at FROM users WHERE id = :user_id";
    $stmt = $db->prepare($userQuery);
    $stmt->bindParam(':user_id', $userId);
    $stmt->execute();
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // Calculate application progress (monthly data for chart)
    $progressQuery = "SELECT 
        DATE_FORMAT(applied_at, '%Y-%m') as month,
        DATE_FORMAT(applied_at, '%b') as month_short,
        COUNT(*) as applications,
        SUM(CASE WHEN status IN ('accepted', 'hired') THEN 1 ELSE 0 END) as interviews
    FROM applications 
    WHERE seeker_id = :user_id 
        AND applied_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
    GROUP BY DATE_FORMAT(applied_at, '%Y-%m')
    ORDER BY month ASC";
    
    $stmt = $db->prepare($progressQuery);
    $stmt->bindParam(':user_id', $userId);
    $stmt->execute();
    $progress = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Prepare response
    $response = [
        'success' => true,
        'data' => [
            'stats' => [
                'applications_sent' => (int)$applications['total'],
                'saved_jobs' => (int)$savedJobs,
                'profile_views' => (int)$profileViews,
                'interviews' => (int)$applications['interviews']
            ],
            'applications_breakdown' => [
                'pending' => (int)($applications['pending'] ?? 0),
                'reviewing' => (int)($applications['reviewing'] ?? 0),
                'shortlisted' => (int)($applications['shortlisted'] ?? 0),
                'reviewed' => (int)($applications['reviewed'] ?? 0),
                'accepted' => (int)($applications['accepted'] ?? 0),
                'rejected' => (int)($applications['rejected'] ?? 0),
                'hired' => (int)($applications['hired'] ?? 0)
            ],
            'recent_applications' => $recentApplications,
            'progress' => $progress,
            'user' => $user
        ]
    ];

    http_response_code(200);
    echo json_encode($response);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
