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
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        // Get all jobs for this employer
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
        $offset = ($page - 1) * $limit;
        
        $where = ["j.employer_id = :employer_id"];
        $params = [':employer_id' => $employerId];
        
        // Filter by status
        if (isset($_GET['status']) && !empty($_GET['status'])) {
            $where[] = "j.status = :status";
            $params[':status'] = $_GET['status'];
        }
        
        // Filter by type
        if (isset($_GET['type']) && !empty($_GET['type'])) {
            $where[] = "j.type = :type";
            $params[':type'] = $_GET['type'];
        }
        
        $whereClause = implode(' AND ', $where);
        
        // Get total count
        $countQuery = "SELECT COUNT(*) as total FROM jobs j WHERE " . $whereClause;
        $stmt = $db->prepare($countQuery);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        $total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Get jobs
     $query = "SELECT j.*, 
                COALESCE(ep.company_name, u.full_name) as company_name,
                         u.avatar as company_logo,
                         (SELECT COUNT(*) FROM applications WHERE job_id = j.id) as applications_count
                  FROM jobs j
            LEFT JOIN users u ON j.employer_id = u.id
            LEFT JOIN employer_profiles ep ON ep.user_id = u.id
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
        // Normalize company_logo to absolute URL when necessary
        foreach ($jobs as &$jobItem) {
            if (!empty($jobItem['company_logo'])) {
                $logo = trim($jobItem['company_logo']);
                if (!preg_match('/^(data:|https?:\/\/)/i', $logo)) {
                    $logo = rtrim(APP_BASE_URL, '/') . '/' . ltrim($logo, '/');
                }
                $jobItem['company_logo'] = $logo;
            }
            else {
                $jobItem['company_logo'] = rtrim(APP_BASE_URL, '/') . '/' . ltrim('/Job Portal-logo-transparent.png', '/');
            }
        }
        unset($jobItem);
        
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => [
                'jobs' => $jobs,
                'pagination' => [
                    'current_page' => $page,
                    'total_pages' => ceil($total / $limit),
                    'total_jobs' => (int)$total,
                    'per_page' => $limit
                ]
            ]
        ]);
        
    } elseif ($method === 'POST') {
        // Create new job
        $data = json_decode(file_get_contents('php://input'), true);
        
        // Validation
        if (empty($data['title'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Job title is required']);
            exit();
        }
        
        $query = "INSERT INTO jobs (
                    employer_id, 
                    title, 
                    description, 
                    requirements, 
                    location, 
                    salary_min, 
                    salary_max, 
                    job_type, 
                    category, 
                    status
                  ) VALUES (
                    :employer_id,
                    :title,
                    :description,
                    :requirements,
                    :location,
                    :salary_min,
                    :salary_max,
                    :job_type,
                    :category,
                    :status
                  )";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':employer_id', $employerId);
        $stmt->bindParam(':title', $data['title']);
        $stmt->bindParam(':description', $data['description']);
        $stmt->bindParam(':requirements', $data['requirements']);
        $stmt->bindParam(':location', $data['location']);
        
        $salaryMin = isset($data['salary_min']) ? $data['salary_min'] : null;
        $salaryMax = isset($data['salary_max']) ? $data['salary_max'] : null;
        $stmt->bindParam(':salary_min', $salaryMin);
        $stmt->bindParam(':salary_max', $salaryMax);
        
        $jobType = isset($data['job_type']) ? $data['job_type'] : 'full-time';
        $stmt->bindParam(':job_type', $jobType);
        
        $category = isset($data['category']) ? $data['category'] : null;
        $stmt->bindParam(':category', $category);
        
        $status = isset($data['status']) ? $data['status'] : 'active';
        $stmt->bindParam(':status', $status);
        
        if ($stmt->execute()) {
            $jobId = $db->lastInsertId();

            // Fetch the newly created job with employer info (company_name, company_logo)
         $jobQuery = "SELECT j.id, j.employer_id, j.title, j.description, j.requirements, j.location,
                    j.salary_min, j.salary_max, j.job_type, j.category, j.status, j.views,
                    j.created_at, j.updated_at,
                    COALESCE(ep.company_name, u.full_name) as company_name, u.avatar as company_logo,
                                (SELECT COUNT(*) FROM applications WHERE job_id = j.id) as applications_count
                         FROM jobs j
                LEFT JOIN users u ON j.employer_id = u.id
                LEFT JOIN employer_profiles ep ON ep.user_id = u.id
                         WHERE j.id = :job_id
                         LIMIT 1";

            $jobStmt = $db->prepare($jobQuery);
            $jobStmt->bindParam(':job_id', $jobId, PDO::PARAM_INT);
            $jobStmt->execute();
            $job = $jobStmt->fetch(PDO::FETCH_ASSOC);

            $jobData = null;
            if ($job) {
                // Normalize company_logo to absolute URL when necessary
                if (!empty($job['company_logo'])) {
                    $logo = trim($job['company_logo']);
                    if (!preg_match('/^(data:|https?:\/\/)/i', $logo)) {
                        $logo = 'http://localhost/Job_Portal_Project/backend/' . ltrim($logo, '/');
                    }
                    $job['company_logo'] = $logo;
                }
                $jobData = [
                    'id' => (int)$job['id'],
                    'employer_id' => (int)$job['employer_id'],
                    'title' => $job['title'],
                    'description' => $job['description'],
                    'requirements' => $job['requirements'],
                    'location' => $job['location'],
                    'salary_min' => $job['salary_min'] !== null ? (int)$job['salary_min'] : null,
                    'salary_max' => $job['salary_max'] !== null ? (int)$job['salary_max'] : null,
                    'job_type' => $job['job_type'],
                    'category' => $job['category'],
                    'status' => $job['status'],
                    'company_name' => $job['company_name'],
                    'company_logo' => $job['company_logo'],
                    'views' => (int)$job['views'],
                    'applications_count' => (int)$job['applications_count'],
                    'created_at' => $job['created_at'],
                    'updated_at' => $job['updated_at']
                ];
            }

            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => 'Job posted successfully',
                'data' => [
                    'job_id' => (int)$jobId,
                    'job' => $jobData
                ]
            ]);
        } else {
            throw new Exception('Failed to create job');
        }
        
    } elseif ($method === 'PUT') {
        // Update job
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data['id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Job ID is required']);
            exit();
        }
        
        // Verify job belongs to this employer
        $checkQuery = "SELECT id FROM jobs WHERE id = :id AND employer_id = :employer_id";
        $stmt = $db->prepare($checkQuery);
        $stmt->bindParam(':id', $data['id']);
        $stmt->bindParam(':employer_id', $employerId);
        $stmt->execute();
        
        if ($stmt->rowCount() === 0) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Job not found or unauthorized']);
            exit();
        }
        
        $query = "UPDATE jobs SET 
                    title = :title,
                    description = :description,
                    requirements = :requirements,
                    location = :location,
                    salary_min = :salary_min,
                    salary_max = :salary_max,
                    job_type = :job_type,
                    category = :category,
                    status = :status
                  WHERE id = :id AND employer_id = :employer_id";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $data['id']);
        $stmt->bindParam(':employer_id', $employerId);
        $stmt->bindParam(':title', $data['title']);
        $stmt->bindParam(':description', $data['description']);
        $stmt->bindParam(':requirements', $data['requirements']);
        $stmt->bindParam(':location', $data['location']);
        $stmt->bindParam(':salary_min', $data['salary_min']);
        $stmt->bindParam(':salary_max', $data['salary_max']);
        $stmt->bindParam(':job_type', $data['job_type']);
        $stmt->bindParam(':category', $data['category']);
        $stmt->bindParam(':status', $data['status']);
        
        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Job updated successfully'
            ]);
        } else {
            throw new Exception('Failed to update job');
        }
        
    } elseif ($method === 'DELETE') {
        // Delete job
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data['id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Job ID is required']);
            exit();
        }
        
        $query = "DELETE FROM jobs WHERE id = :id AND employer_id = :employer_id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $data['id']);
        $stmt->bindParam(':employer_id', $employerId);
        
        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Job deleted successfully'
            ]);
        } else {
            throw new Exception('Failed to delete job');
        }
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
