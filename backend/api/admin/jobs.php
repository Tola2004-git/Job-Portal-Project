<?php
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
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
            $where[] = "j.status = :status";
            $params[':status'] = $_GET['status'];
        }
        
        if (isset($_GET['job_type'])) {
            $where[] = "j.job_type = :job_type";
            $params[':job_type'] = $_GET['job_type'];
        }
        
        if (isset($_GET['search'])) {
            $where[] = "(j.title LIKE :search OR j.description LIKE :search OR j.location LIKE :search)";
            $params[':search'] = '%' . $_GET['search'] . '%';
        }
        
        $whereClause = count($where) > 0 ? implode(' AND ', $where) : '1=1';
        
        $countQuery = "SELECT COUNT(*) as total FROM jobs j WHERE " . $whereClause;
        $stmt = $db->prepare($countQuery);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        $total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
    $query = "SELECT j.*, 
             u.full_name as employer_name, 
             u.email as employer_email,
             (SELECT COUNT(*) FROM applications WHERE job_id = j.id) AS applications_count 
                  FROM jobs j 
                  LEFT JOIN users u ON j.employer_id = u.id 
                  WHERE " . $whereClause . " 
                  ORDER BY j.created_at DESC 
                  LIMIT :limit OFFSET :offset";
        
        $stmt = $db->prepare($query);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        
        $jobs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => [
                'jobs' => $jobs,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => (int)$total,
                    'pages' => ceil($total / $limit)
                ]
            ]
        ]);
        
    } elseif ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data['title']) || empty($data['employer_id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Title and employer_id required']);
            exit();
        }
        
        $query = "INSERT INTO jobs (employer_id, title, description, requirements, location, 
                  salary_min, salary_max, job_type, category, status) 
                  VALUES (:employer_id, :title, :description, :requirements, :location, 
                  :salary_min, :salary_max, :job_type, :category, :status)";
        
        $stmt = $db->prepare($query);
        $stmt->execute([
            ':employer_id' => $data['employer_id'],
            ':title' => $data['title'],
            ':description' => $data['description'] ?? '',
            ':requirements' => $data['requirements'] ?? '',
            ':location' => $data['location'] ?? '',
            ':salary_min' => $data['salary_min'] ?? null,
            ':salary_max' => $data['salary_max'] ?? null,
            ':job_type' => $data['job_type'] ?? 'full-time',
            ':category' => $data['category'] ?? '',
            ':status' => $data['status'] ?? 'draft'
        ]);
        
        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Job created',
            'id' => $db->lastInsertId()
        ]);
        
    } elseif ($method === 'PUT') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data['id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Job ID required']);
            exit();
        }
        
        $updates = [];
        $params = [':id' => $data['id']];
        
        if (isset($data['title'])) {
            $updates[] = "title = :title";
            $params[':title'] = $data['title'];
        }
        if (isset($data['description'])) {
            $updates[] = "description = :description";
            $params[':description'] = $data['description'];
        }
        if (isset($data['location'])) {
            $updates[] = "location = :location";
            $params[':location'] = $data['location'];
        }
        if (isset($data['salary_min'])) {
            $updates[] = "salary_min = :salary_min";
            $params[':salary_min'] = $data['salary_min'];
        }
        if (isset($data['salary_max'])) {
            $updates[] = "salary_max = :salary_max";
            $params[':salary_max'] = $data['salary_max'];
        }
        if (isset($data['status'])) {
            $updates[] = "status = :status";
            $params[':status'] = $data['status'];
        }
        
        if (count($updates) === 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No fields to update']);
            exit();
        }
        
        $query = "UPDATE jobs SET " . implode(', ', $updates) . " WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->execute($params);
        
        http_response_code(200);
        echo json_encode(['success' => true, 'message' => 'Job updated']);
        
    } elseif ($method === 'DELETE') {
        $jobId = $_GET['id'] ?? null;
        
        if (!$jobId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Job ID required']);
            exit();
        }
        
        $query = "DELETE FROM jobs WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->execute([':id' => $jobId]);
        
        http_response_code(200);
        echo json_encode(['success' => true, 'message' => 'Job deleted']);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
