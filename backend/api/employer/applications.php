<?php
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: GET, PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

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
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        // Get applications for employer's jobs
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
        $offset = ($page - 1) * $limit;
        
        $where = ["j.employer_id = :employer_id"];
        $params = [':employer_id' => $employerId];
        
        // Filter by job
        if (isset($_GET['job_id']) && !empty($_GET['job_id'])) {
            $where[] = "a.job_id = :job_id";
            $params[':job_id'] = $_GET['job_id'];
        }
        
        // Filter by status
        if (isset($_GET['status']) && !empty($_GET['status'])) {
            $where[] = "a.status = :status";
            $params[':status'] = $_GET['status'];
        }
        
        $whereClause = implode(' AND ', $where);
        
        // Get total count
        $countQuery = "SELECT COUNT(*) as total 
                       FROM applications a
                       INNER JOIN jobs j ON a.job_id = j.id
                       WHERE " . $whereClause;
        $stmt = $db->prepare($countQuery);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        $total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Get applications
        $query = "SELECT a.*, 
                         j.id as job_id, j.title as job_title, j.location as job_location, j.job_type,
                         u.id as applicant_id, u.full_name as applicant_name, u.email as applicant_email, u.phone as applicant_phone,
                         u.resume_path
                  FROM applications a
                  INNER JOIN jobs j ON a.job_id = j.id
                  INNER JOIN users u ON a.seeker_id = u.id
                  WHERE " . $whereClause . "
                  ORDER BY a.applied_at DESC
                  LIMIT :limit OFFSET :offset";
        
        $stmt = $db->prepare($query);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        
        $applications = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => [
                'applications' => $applications,
                'pagination' => [
                    'current_page' => $page,
                    'total_pages' => ceil($total / $limit),
                    'total_applications' => (int)$total,
                    'per_page' => $limit
                ]
            ]
        ]);
        
    } elseif ($method === 'PUT') {
        // Update application status
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data['id']) || empty($data['status'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Application ID and status are required']);
            exit();
        }
        
        // Verify application belongs to employer's job
        $checkQuery = "SELECT a.id 
                       FROM applications a
                       INNER JOIN jobs j ON a.job_id = j.id
                       WHERE a.id = :id AND j.employer_id = :employer_id";
        $stmt = $db->prepare($checkQuery);
        $stmt->bindParam(':id', $data['id']);
        $stmt->bindParam(':employer_id', $employerId);
        $stmt->execute();
        
        if ($stmt->rowCount() === 0) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Application not found or unauthorized']);
            exit();
        }
        
        $query = "UPDATE applications SET 
                    status = :status,
                    notes = :notes
                  WHERE id = :id";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $data['id']);
        $stmt->bindParam(':status', $data['status']);
        $notes = isset($data['notes']) ? $data['notes'] : null;
        $stmt->bindParam(':notes', $notes);
        
        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Application status updated successfully'
            ]);
        } else {
            throw new Exception('Failed to update application');
        }
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
