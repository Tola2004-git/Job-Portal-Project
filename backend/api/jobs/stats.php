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

$database = new Database();
$db = $database->getConnection();

try {
    // Get total active jobs
    $jobsQuery = "SELECT COUNT(*) as total FROM jobs WHERE status = 'active'";
    $stmt = $db->prepare($jobsQuery);
    $stmt->execute();
    $totalJobs = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    // Get total companies (employers)
    $companiesQuery = "SELECT COUNT(*) as total FROM users WHERE role = 'employer'";
    $stmt = $db->prepare($companiesQuery);
    $stmt->execute();
    $totalCompanies = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    // Get total job seekers
    $seekersQuery = "SELECT COUNT(*) as total FROM users WHERE role = 'job_seeker'";
    $stmt = $db->prepare($seekersQuery);
    $stmt->execute();
    $totalSeekers = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    // Get recent jobs (last 7 days)
    $recentQuery = "SELECT COUNT(*) as total FROM jobs WHERE status = 'active' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
    $stmt = $db->prepare($recentQuery);
    $stmt->execute();
    $recentJobs = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    // Get job categories with counts
    $categoriesQuery = "SELECT category, COUNT(*) as count FROM jobs WHERE status = 'active' GROUP BY category ORDER BY count DESC LIMIT 5";
    $stmt = $db->prepare($categoriesQuery);
    $stmt->execute();
    $topCategories = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get job types distribution
    $typesQuery = "SELECT job_type, COUNT(*) as count FROM jobs WHERE status = 'active' GROUP BY job_type";
    $stmt = $db->prepare($typesQuery);
    $stmt->execute();
    $jobTypes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'data' => [
            'total_jobs' => (int)$totalJobs,
            'total_companies' => (int)$totalCompanies,
            'total_seekers' => (int)$totalSeekers,
            'recent_jobs' => (int)$recentJobs,
            'top_categories' => $topCategories,
            'job_types' => $jobTypes
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
