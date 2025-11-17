<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../../config/database.php';
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

  $employerId = (int)($decoded['user_id'] ?? 0);
  if ($employerId <= 0) {
    throw new Exception('Invalid user identifier');
  }
} catch (Exception $e) {
  http_response_code(401);
  echo json_encode(['success' => false, 'error' => $e->getMessage()]);
  exit();
}

$database = new Database();
$db = $database->getConnection();

try {
    // Monthly job postings (last 6 months)
    $monthlyQuery = "SELECT 
                        DATE_FORMAT(created_at, '%Y-%m') as month,
                        DATE_FORMAT(created_at, '%M %Y') as month_name,
                        COUNT(*) as count
                     FROM jobs 
                     WHERE employer_id = :employer_id 
                        AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
                     GROUP BY DATE_FORMAT(created_at, '%Y-%m')
                     ORDER BY month ASC";
    $stmt = $db->prepare($monthlyQuery);
    $stmt->bindParam(':employer_id', $employerId);
    $stmt->execute();
    $monthlyData = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Jobs by category
    $categoryQuery = "SELECT 
                        category,
                        COUNT(*) as count
                      FROM jobs 
                      WHERE employer_id = :employer_id
                      GROUP BY category
                      ORDER BY count DESC";
    $stmt = $db->prepare($categoryQuery);
    $stmt->bindParam(':employer_id', $employerId);
    $stmt->execute();
    $categoryData = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Jobs by type
    $typeQuery = "SELECT 
                    job_type,
                    COUNT(*) as count
                  FROM jobs 
                  WHERE employer_id = :employer_id
                  GROUP BY job_type
                  ORDER BY count DESC";
    $stmt = $db->prepare($typeQuery);
    $stmt->bindParam(':employer_id', $employerId);
    $stmt->execute();
    $typeData = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Jobs by status
    $statusQuery = "SELECT 
                      status,
                      COUNT(*) as count
                    FROM jobs 
                    WHERE employer_id = :employer_id
                    GROUP BY status
                    ORDER BY count DESC";
    $stmt = $db->prepare($statusQuery);
    $stmt->bindParam(':employer_id', $employerId);
    $stmt->execute();
    $statusData = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Applications trend (last 6 months)
    $applicationsQuery = "SELECT 
                            DATE_FORMAT(a.applied_at, '%Y-%m') as month,
                            DATE_FORMAT(a.applied_at, '%M %Y') as month_name,
                            COUNT(*) as count
                          FROM applications a
                          INNER JOIN jobs j ON a.job_id = j.id
                          WHERE j.employer_id = :employer_id 
                            AND a.applied_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
                          GROUP BY DATE_FORMAT(a.applied_at, '%Y-%m')
                          ORDER BY month ASC";
    $stmt = $db->prepare($applicationsQuery);
    $stmt->bindParam(':employer_id', $employerId);
    $stmt->execute();
    $applicationsData = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Applications by status
    $appStatusQuery = "SELECT 
                        a.status,
                        COUNT(*) as count
                      FROM applications a
                      INNER JOIN jobs j ON a.job_id = j.id
                      WHERE j.employer_id = :employer_id
                      GROUP BY a.status
                      ORDER BY count DESC";
    $stmt = $db->prepare($appStatusQuery);
    $stmt->bindParam(':employer_id', $employerId);
    $stmt->execute();
    $appStatusData = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Top performing jobs (most applications)
    $topJobsQuery = "SELECT 
                        j.id,
                        j.title,
                        j.category,
                        j.views,
                        COUNT(a.id) as applications_count
                      FROM jobs j
                      LEFT JOIN applications a ON j.id = a.job_id
                      WHERE j.employer_id = :employer_id
                      GROUP BY j.id
                      ORDER BY applications_count DESC, j.views DESC
                      LIMIT 10";
    $stmt = $db->prepare($topJobsQuery);
    $stmt->bindParam(':employer_id', $employerId);
    $stmt->execute();
    $topJobs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Average time to hire
    $timeToHireQuery = "SELECT 
                          AVG(DATEDIFF(a.reviewed_at, a.applied_at)) as avg_days
                        FROM applications a
                        INNER JOIN jobs j ON a.job_id = j.id
                        WHERE j.employer_id = :employer_id 
                          AND a.status = 'accepted'
                          AND a.reviewed_at IS NOT NULL";
    $stmt = $db->prepare($timeToHireQuery);
    $stmt->bindParam(':employer_id', $employerId);
    $stmt->execute();
    $timeToHire = $stmt->fetch(PDO::FETCH_ASSOC);
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'data' => [
            'monthly_jobs' => $monthlyData,
            'jobs_by_category' => $categoryData,
            'jobs_by_type' => $typeData,
            'jobs_by_status' => $statusData,
            'monthly_applications' => $applicationsData,
            'applications_by_status' => $appStatusData,
            'top_jobs' => $topJobs,
            'avg_time_to_hire_days' => round($timeToHire['avg_days'] ?? 0, 1)
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
