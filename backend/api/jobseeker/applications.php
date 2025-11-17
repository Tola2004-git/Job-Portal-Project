<?php
/**
 * Job Seeker Applications API
 * GET: Retrieve all applications with job details
 * POST: Withdraw an application
 */

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
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
        echo json_encode(['success' => false, 'message' => 'Invalid token or unauthorized']);
        exit();
    }

    $userId = (int) $decoded['user_id'];

    // Database connection
    $database = new Database();
    $db = $database->getConnection();

    // GET: Retrieve all applications
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $query = "SELECT 
            a.id,
            a.job_id,
            a.cover_letter,
            a.resume_path,
            a.status,
            a.applied_at,
            a.reviewed_at,
            a.notes,
            j.title,
            j.job_type,
            j.category,
            j.location,
            j.salary_min,
            j.salary_max,
            j.description,
            j.requirements,
            COALESCE(ep.company_name, u.full_name, 'Unknown Company') as company_name,
            u.avatar as company_logo
        FROM applications a
        INNER JOIN jobs j ON a.job_id = j.id
        INNER JOIN users u ON j.employer_id = u.id
        LEFT JOIN employer_profiles ep ON j.employer_id = ep.user_id
        WHERE a.seeker_id = :user_id
        ORDER BY a.applied_at DESC";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':user_id', $userId);
        $stmt->execute();
        $applications = $stmt->fetchAll(PDO::FETCH_ASSOC);

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => $applications
        ]);
        exit();
    }

    // POST: Withdraw an application
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents("php://input"));
        
        if (!isset($data->application_id)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Application ID is required']);
            exit();
        }

        $applicationId = $data->application_id;

        // Verify the application belongs to this user
        $verifyQuery = "SELECT id FROM applications WHERE id = :app_id AND seeker_id = :user_id";
        $stmt = $db->prepare($verifyQuery);
        $stmt->bindParam(':app_id', $applicationId);
        $stmt->bindParam(':user_id', $userId);
        $stmt->execute();

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Application not found or unauthorized']);
            exit();
        }

        // Update application status to withdrawn (we'll use 'rejected' for now or add a new status)
        $updateQuery = "UPDATE applications 
                        SET status = 'rejected', 
                            notes = CONCAT(COALESCE(notes, ''), '\nWithdrawn by applicant on ', NOW())
                        WHERE id = :app_id";
        $stmt = $db->prepare($updateQuery);
        $stmt->bindParam(':app_id', $applicationId);
        
        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Application withdrawn successfully'
            ]);
        } else {
            throw new Exception('Failed to withdraw application');
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
