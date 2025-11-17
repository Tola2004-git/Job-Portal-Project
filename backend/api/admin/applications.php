<?php
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: GET, PUT, DELETE, OPTIONS");
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
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
        $offset = ($page - 1) * $limit;
        
        $where = [];
        $params = [];
        
        if (isset($_GET['status'])) {
            $where[] = "a.status = :status";
            $params[':status'] = $_GET['status'];
        }
        
        if (isset($_GET['job_id'])) {
            $where[] = "a.job_id = :job_id";
            $params[':job_id'] = $_GET['job_id'];
        }
        
        if (isset($_GET['seeker_id'])) {
            $where[] = "a.seeker_id = :seeker_id";
            $params[':seeker_id'] = $_GET['seeker_id'];
        }
        
        if (isset($_GET['search'])) {
            $where[] = "(j.title LIKE :search OR u.full_name LIKE :search OR u.email LIKE :search)";
            $params[':search'] = '%' . $_GET['search'] . '%';
        }
        
        $whereClause = count($where) > 0 ? implode(' AND ', $where) : '1=1';
        
        $countQuery = "SELECT COUNT(*) as total FROM applications a WHERE " . $whereClause;
        $stmt = $db->prepare($countQuery);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        $total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        $query = "SELECT a.*, 
                  j.title as job_title, j.location as job_location, j.job_type, j.employer_id,
                  u.full_name as seeker_name, u.email as seeker_email, u.phone as seeker_phone,
                  emp.full_name as employer_name
                  FROM applications a
                  LEFT JOIN jobs j ON a.job_id = j.id
                  LEFT JOIN users u ON a.seeker_id = u.id
                  LEFT JOIN users emp ON j.employer_id = emp.id
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
                    'page' => $page,
                    'limit' => $limit,
                    'total' => (int)$total,
                    'pages' => ceil($total / $limit)
                ]
            ]
        ]);
        
    } elseif ($method === 'PUT') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data['id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Application ID required']);
            exit();
        }
        
        $updates = [];
        $params = [':id' => $data['id']];
        
        if (isset($data['status'])) {
            $updates[] = "status = :status";
            $params[':status'] = $data['status'];
            
            $checkQuery = "SELECT status FROM applications WHERE id = :id";
            $checkStmt = $db->prepare($checkQuery);
            $checkStmt->execute([':id' => $data['id']]);
            $currentStatus = $checkStmt->fetch(PDO::FETCH_ASSOC)['status'];
            
            if ($currentStatus === 'pending' && $data['status'] !== 'pending') {
                $updates[] = "reviewed_at = NOW()";
            }
        }
        
        if (isset($data['notes'])) {
            $updates[] = "notes = :notes";
            $params[':notes'] = $data['notes'];
        }
        
        if (count($updates) === 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No fields to update']);
            exit();
        }
        
        $query = "UPDATE applications SET " . implode(', ', $updates) . " WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->execute($params);
        
        http_response_code(200);
        echo json_encode(['success' => true, 'message' => 'Application updated']);
        
    } elseif ($method === 'DELETE') {
        $appId = $_GET['id'] ?? null;
        
        if (!$appId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Application ID required']);
            exit();
        }
        
        $query = "DELETE FROM applications WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->execute([':id' => $appId]);
        
        http_response_code(200);
        echo json_encode(['success' => true, 'message' => 'Application deleted']);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
