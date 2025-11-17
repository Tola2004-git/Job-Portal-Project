<?php
/**
 * Job Seeker Saved Jobs API
 * GET: Retrieve all saved jobs
 * POST: Save a job
 * DELETE: Remove a saved job
 */

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../helpers/jwt.php';

try {
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
            respond_with_error(401, $e->getMessage());
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

    // GET: Retrieve all saved jobs
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $query = "SELECT 
            s.id as saved_id,
            s.job_id,
            s.notes,
            s.saved_at,
            j.title,
            j.job_type,
            j.category,
            j.location,
            j.salary_min,
            j.salary_max,
            j.description,
            j.requirements,
            j.status as job_status,
            COALESCE(ep.company_name, u.full_name, 'Unknown Company') as company_name,
            u.avatar as company_logo
        FROM saved_jobs s
        INNER JOIN jobs j ON s.job_id = j.id
        INNER JOIN users u ON j.employer_id = u.id
        LEFT JOIN employer_profiles ep ON j.employer_id = ep.user_id
        WHERE s.user_id = :user_id
        ORDER BY s.saved_at DESC";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':user_id', $userId);
        $stmt->execute();
        $savedJobs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => $savedJobs
        ]);
        exit();
    }

    // POST: Save a job
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents("php://input"));
        
        if (!isset($data->job_id)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Job ID is required']);
            exit();
        }

        $jobId = $data->job_id;
        $notes = isset($data->notes) ? $data->notes : null;

        // Check if job exists
        $jobCheckQuery = "SELECT id FROM jobs WHERE id = :job_id";
        $stmt = $db->prepare($jobCheckQuery);
        $stmt->bindParam(':job_id', $jobId);
        $stmt->execute();

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Job not found']);
            exit();
        }

        // Check if already saved
        $checkQuery = "SELECT id FROM saved_jobs WHERE user_id = :user_id AND job_id = :job_id";
        $stmt = $db->prepare($checkQuery);
        $stmt->bindParam(':user_id', $userId);
        $stmt->bindParam(':job_id', $jobId);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Job already saved']);
            exit();
        }

        // Insert saved job
        $insertQuery = "INSERT INTO saved_jobs (user_id, job_id, notes, saved_at) 
                        VALUES (:user_id, :job_id, :notes, NOW())";
        $stmt = $db->prepare($insertQuery);
        $stmt->bindParam(':user_id', $userId);
        $stmt->bindParam(':job_id', $jobId);
        $stmt->bindParam(':notes', $notes);
        
        if ($stmt->execute()) {
            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => 'Job saved successfully',
                'saved_id' => $db->lastInsertId()
            ]);
        } else {
            throw new Exception('Failed to save job');
        }
        exit();
    }

    // DELETE: Remove a saved job
    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $data = json_decode(file_get_contents("php://input"));
        
        if (!isset($data->job_id) && !isset($data->saved_id)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Job ID or Saved ID is required']);
            exit();
        }

        // Build delete query based on what was provided
        if (isset($data->saved_id)) {
            $deleteQuery = "DELETE FROM saved_jobs WHERE id = :saved_id AND user_id = :user_id";
            $stmt = $db->prepare($deleteQuery);
            $stmt->bindParam(':saved_id', $data->saved_id);
            $stmt->bindParam(':user_id', $userId);
        } else {
            $deleteQuery = "DELETE FROM saved_jobs WHERE job_id = :job_id AND user_id = :user_id";
            $stmt = $db->prepare($deleteQuery);
            $stmt->bindParam(':job_id', $data->job_id);
            $stmt->bindParam(':user_id', $userId);
        }
        
        if ($stmt->execute()) {
            if ($stmt->rowCount() > 0) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'Saved job removed successfully'
                ]);
            } else {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Saved job not found'
                ]);
            }
        } else {
            throw new Exception('Failed to remove saved job');
        }
        exit();
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
