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

$headers = function_exists('getallheaders') ? getallheaders() : [];
$authHeader = $headers['Authorization'] ?? '';

if (empty($authHeader) || !str_starts_with($authHeader, 'Bearer ')) {
  http_response_code(401);
  echo json_encode(['success' => false, 'error' => 'Unauthorized']);
  exit();
}

$token = substr($authHeader, 7);
try {
  $decoded = jwt_decode($token);
  if (($decoded['role'] ?? '') !== 'admin') {
    throw new Exception('Admin only', 403);
  }
} catch (Exception $e) {
  $status = $e->getCode() === 403 ? 403 : 401;
  http_response_code($status);
  echo json_encode(['success' => false, 'error' => $e->getMessage()]);
  exit();
}

$database = new Database();
$db = $database->getConnection();

try {
    $analytics = [];
    
    $rangeDays = isset($_GET['range']) ? (int) $_GET['range'] : 30;
    if ($rangeDays <= 0) {
        $rangeDays = 30;
    } elseif ($rangeDays > 365) {
        $rangeDays = 365;
    }
    $startDate = (new DateTime())->modify("-{$rangeDays} days")->format('Y-m-d H:i:s');
    $analytics['meta'] = [
      'range_days' => $rangeDays,
      'start_date' => $startDate
    ];
    
    $query = "SELECT 
                COUNT(*) as total_users,
                SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
                SUM(CASE WHEN role = 'employer' THEN 1 ELSE 0 END) as employers,
                SUM(CASE WHEN role = 'job_seeker' THEN 1 ELSE 0 END) as job_seekers,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_users
              FROM users
              WHERE created_at >= :start_date";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':start_date', $startDate);
    $stmt->execute();
    $analytics['user_summary'] = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $query = "SELECT 
                COUNT(*) as total_jobs,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
                SUM(views) as total_views
              FROM jobs
              WHERE created_at >= :start_date";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':start_date', $startDate);
    $stmt->execute();
    $analytics['jobs_summary'] = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $query = "SELECT 
                COUNT(*) as total_applications,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted
              FROM applications
              WHERE applied_at >= :start_date";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':start_date', $startDate);
    $stmt->execute();
    $analytics['applications_summary'] = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $query = "SELECT 
                job_type,
                COUNT(*) as count
              FROM jobs
              WHERE created_at >= :start_date
              GROUP BY job_type
              ORDER BY count DESC";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':start_date', $startDate);
    $stmt->execute();
    $analytics['job_type_distribution'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $query = "SELECT 
                status,
                COUNT(*) as count
              FROM applications
              WHERE applied_at >= :start_date
              GROUP BY status
              ORDER BY count DESC";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':start_date', $startDate);
    $stmt->execute();
    $analytics['application_status_chart'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $query = "SELECT 
                category,
                COUNT(*) as job_count
              FROM jobs
              WHERE category IS NOT NULL
                AND created_at >= :start_date
              GROUP BY category
              ORDER BY job_count DESC
              LIMIT 5";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':start_date', $startDate);
    $stmt->execute();
    $analytics['top_job_categories'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $query = "SELECT 
                u.full_name as employer_name,
                COUNT(j.id) as total_jobs,
                SUM(CASE WHEN j.status = 'active' THEN 1 ELSE 0 END) as active_jobs
              FROM users u
              INNER JOIN jobs j ON u.id = j.employer_id
              WHERE u.role = 'employer'
                AND j.created_at >= :start_date
              GROUP BY u.id
              ORDER BY total_jobs DESC
              LIMIT 5";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':start_date', $startDate);
    $stmt->execute();
    $analytics['top_employers'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $query = "SELECT 
                j.title,
                COUNT(a.id) as application_count
              FROM jobs j
              LEFT JOIN applications a ON j.id = a.job_id
                AND a.applied_at >= :start_date
              WHERE j.created_at >= :start_date
              GROUP BY j.id
              HAVING application_count > 0
              ORDER BY application_count DESC
              LIMIT 5";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':start_date', $startDate);
    $stmt->execute();
    $analytics['most_applied_jobs'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    http_response_code(200);
    echo json_encode(['success' => true, 'data' => $analytics]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
