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
    // Pagination
    $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
    $offset = ($page - 1) * $limit;
    
    // Build query with filters - Only show candidates who applied to employer's jobs
    $where = ["u.role = 'job_seeker'", "u.status = 'active'"];
    $params = [':employer_id' => $employerId];
    
    // Add condition to only show job seekers who have applied to this employer's jobs
    $where[] = "EXISTS (
        SELECT 1 FROM applications a 
        INNER JOIN jobs j ON a.job_id = j.id 
        WHERE a.seeker_id = u.id AND j.employer_id = :employer_id
    )";
    
    // Filter by skills (search in profile or applications)
    if (isset($_GET['skills']) && !empty($_GET['skills'])) {
        $where[] = "(u.full_name LIKE :skills OR u.email LIKE :skills)";
        $params[':skills'] = '%' . $_GET['skills'] . '%';
    }
    
    // Filter by location
    if (isset($_GET['location']) && !empty($_GET['location'])) {
        $where[] = "u.phone LIKE :location";
        $params[':location'] = '%' . $_GET['location'] . '%';
    }
    
    $whereClause = implode(' AND ', $where);
    
    // Get total count of job seekers who applied to employer's jobs
    $countQuery = "SELECT COUNT(DISTINCT u.id) as total 
                   FROM users u 
                   INNER JOIN applications a ON u.id = a.seeker_id
                   INNER JOIN jobs j ON a.job_id = j.id AND j.employer_id = :employer_id_count
                   WHERE " . $whereClause;
    $stmt = $db->prepare($countQuery);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue(':employer_id_count', $employerId, PDO::PARAM_INT);
    $stmt->execute();
    $total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    // Get job seekers who have applied to employer's jobs with their application history
    $query = "SELECT 
                u.id,
                u.username,
                u.full_name,
                u.email,
                u.phone,
                u.avatar,
                u.resume_path,
                u.created_at,
                COUNT(DISTINCT a.id) as total_applications,
                COUNT(DISTINCT CASE WHEN a.status = 'accepted' THEN a.id END) as accepted_applications,
                MAX(a.applied_at) as last_application_date
              FROM users u
              INNER JOIN applications a ON u.id = a.seeker_id
              INNER JOIN jobs j ON a.job_id = j.id AND j.employer_id = :employer_id_main
              WHERE " . $whereClause . "
              GROUP BY u.id
              ORDER BY last_application_date DESC, u.created_at DESC
              LIMIT :limit OFFSET :offset";
    
    $stmt = $db->prepare($query);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue(':employer_id_main', $employerId, PDO::PARAM_INT);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    
    $candidates = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // For each candidate, get their applications to employer's jobs
    foreach ($candidates as &$candidate) {
        $appQuery = "SELECT 
                        a.id,
                        a.job_id,
                        a.status,
                        a.applied_at,
                        j.title as job_title
                     FROM applications a
                     INNER JOIN jobs j ON a.job_id = j.id
                     WHERE a.seeker_id = :seeker_id 
                        AND j.employer_id = :employer_id
                     ORDER BY a.applied_at DESC
                     LIMIT 5";
        $stmt = $db->prepare($appQuery);
        $stmt->bindParam(':seeker_id', $candidate['id']);
        $stmt->bindParam(':employer_id', $employerId);
        $stmt->execute();
        $candidate['applications_to_my_jobs'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'data' => [
            'candidates' => $candidates,
            'pagination' => [
                'current_page' => $page,
                'total_pages' => ceil($total / $limit),
                'total_candidates' => (int)$total,
                'per_page' => $limit
            ]
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
