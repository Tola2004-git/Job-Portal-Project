<?php
/**
 * Job Seeker Apply Job API
 * POST: Apply for a job
 */

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: POST, OPTIONS');
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
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        exit();
    }

    if (($decoded['role'] ?? '') !== 'job_seeker') {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid token or unauthorized. Only job seekers can apply']);
        exit();
    }

    $userId = (int) $decoded['user_id'];

    // Database connection
    $database = new Database();
    $db = $database->getConnection();

    // POST: Apply for a job
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents("php://input"));
        
        if (!isset($data->job_id)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Job ID is required']);
            exit();
        }

        $jobId = $data->job_id;
        $coverLetter = isset($data->cover_letter) ? $data->cover_letter : null;

        // Check if job exists and is active
        $jobCheckQuery = "SELECT id, status, title FROM jobs WHERE id = :job_id";
        $stmt = $db->prepare($jobCheckQuery);
        $stmt->bindParam(':job_id', $jobId);
        $stmt->execute();

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Job not found']);
            exit();
        }

        $job = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($job['status'] !== 'active') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'This job is no longer accepting applications']);
            exit();
        }

        // Check if already applied
        $checkQuery = "SELECT id FROM applications WHERE seeker_id = :seeker_id AND job_id = :job_id";
        $stmt = $db->prepare($checkQuery);
        $stmt->bindParam(':seeker_id', $userId);
        $stmt->bindParam(':job_id', $jobId);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'You have already applied for this job']);
            exit();
        }

        // Get user's resume path
        $resumeQuery = "SELECT resume_path FROM users WHERE id = :user_id";
        $resumeStmt = $db->prepare($resumeQuery);
        $resumeStmt->bindParam(':user_id', $userId);
        $resumeStmt->execute();
        $userData = $resumeStmt->fetch(PDO::FETCH_ASSOC);
        $resumePath = isset($userData['resume_path']) ? trim((string) $userData['resume_path']) : '';

        if ($resumePath === '') {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Please upload your resume before applying for this job'
            ]);
            exit();
        }

        // Insert application with resume path
        $insertQuery = "INSERT INTO applications 
                        (seeker_id, job_id, cover_letter, resume_path, status, applied_at) 
                        VALUES 
                        (:seeker_id, :job_id, :cover_letter, :resume_path, 'pending', NOW())";
        
        $stmt = $db->prepare($insertQuery);
        $stmt->bindParam(':seeker_id', $userId);
        $stmt->bindParam(':job_id', $jobId);
        $stmt->bindParam(':cover_letter', $coverLetter);
        $stmt->bindParam(':resume_path', $resumePath);
        
        if ($stmt->execute()) {
            $applicationId = $db->lastInsertId();
            
            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => 'Application submitted successfully',
                'application_id' => $applicationId,
                'job_title' => $job['title']
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to submit application']);
        }
        exit();
    }

    // Invalid request method
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}
?>
