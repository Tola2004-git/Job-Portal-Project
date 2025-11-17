<?php
/**
 * Download Candidate Resume API for Employers
 * Downloads job seeker's resume
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

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

    if (($decoded['role'] ?? '') !== 'employer') {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid token or unauthorized']);
        exit();
    }

    // Check if user_id is provided
    if (!isset($_GET['user_id']) || empty($_GET['user_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'User ID is required']);
        exit();
    }

    $userId = intval($_GET['user_id']);

    // Database connection
    $database = new Database();
    $db = $database->getConnection();

    // Get resume path
    $query = "SELECT resume_path, full_name FROM users WHERE id = :user_id AND role = 'job_seeker'";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':user_id', $userId);
    $stmt->execute();
    
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user || !$user['resume_path']) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Resume not found']);
        exit();
    }

    $resumePath = __DIR__ . '/../../' . $user['resume_path'];

    // Check if file exists
    if (!file_exists($resumePath)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Resume file not found']);
        exit();
    }

    // Get file info
    $fileName = basename($resumePath);
    $fileExtension = pathinfo($fileName, PATHINFO_EXTENSION);
    
    // Set content type based on file extension
    $contentType = 'application/octet-stream';
    if ($fileExtension === 'pdf') {
        $contentType = 'application/pdf';
    } elseif (in_array($fileExtension, ['doc', 'docx'])) {
        $contentType = 'application/msword';
    }

    // Download filename
    $downloadName = $user['full_name'] . '_Resume.' . $fileExtension;

    // Set headers for download
    header('Content-Type: ' . $contentType);
    header('Content-Disposition: attachment; filename="' . $downloadName . '"');
    header('Content-Length: ' . filesize($resumePath));
    header('Cache-Control: no-cache, must-revalidate');
    header('Expires: 0');

    // Output file
    readfile($resumePath);
    exit();

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
