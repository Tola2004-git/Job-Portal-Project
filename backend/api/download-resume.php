<?php
/**
 * Download Resume API
 * GET: Download applicant's resume
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../config/database.php';

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
    $decoded = json_decode(base64_decode($token), true);
    
    if (!$decoded || !isset($decoded['user_id'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid token']);
        exit();
    }

    $currentUserId = $decoded['user_id'];
    $currentUserRole = $decoded['role'];

    // Database connection
    $database = new Database();
    $db = $database->getConnection();

    // GET: Download resume
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if (!isset($_GET['application_id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Application ID is required']);
            exit();
        }

        $applicationId = intval($_GET['application_id']);

        // Get application details with resume path
        $query = "SELECT 
                    a.id,
                    a.seeker_id,
                    a.job_id,
                    a.resume_path,
                    u.resume_path as user_resume_path,
                    u.full_name as applicant_name,
                    j.employer_id,
                    j.title as job_title
                  FROM applications a
                  JOIN users u ON a.seeker_id = u.id
                  JOIN jobs j ON a.job_id = j.id
                  WHERE a.id = :application_id";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':application_id', $applicationId);
        $stmt->execute();

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Application not found']);
            exit();
        }

        $application = $stmt->fetch(PDO::FETCH_ASSOC);

        // Authorization check
        // Only employer who owns the job or the job seeker who applied can download
        if ($currentUserRole === 'employer' && $application['employer_id'] != $currentUserId) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Unauthorized access']);
            exit();
        }

        if ($currentUserRole === 'job_seeker' && $application['seeker_id'] != $currentUserId) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Unauthorized access']);
            exit();
        }

        // Get resume path (from application or user profile)
        $resumePath = $application['resume_path'] ?: $application['user_resume_path'];

        if (!$resumePath) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'No resume available']);
            exit();
        }

        $filePath = __DIR__ . '/../../' . $resumePath;

        if (!file_exists($filePath)) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Resume file not found']);
            exit();
        }

        // Get file info
        $fileName = basename($filePath);
        $fileExt = pathinfo($filePath, PATHINFO_EXTENSION);
        
        // Set appropriate content type
        $contentTypes = [
            'pdf' => 'application/pdf',
            'doc' => 'application/msword',
            'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        $contentType = $contentTypes[$fileExt] ?? 'application/octet-stream';

        // Download file
        header('Content-Type: ' . $contentType);
        header('Content-Disposition: attachment; filename="Resume_' . $application['applicant_name'] . '.' . $fileExt . '"');
        header('Content-Length: ' . filesize($filePath));
        header('Cache-Control: no-cache, must-revalidate');
        header('Pragma: public');
        
        readfile($filePath);
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
