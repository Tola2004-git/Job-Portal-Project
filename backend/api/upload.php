<?php
/**
 * File Upload API
 * Handle resume uploads for job applications
 */
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: POST, GET, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config/database.php';

// Get headers
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? '';

if (empty($authHeader) || !str_starts_with($authHeader, 'Bearer ')) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit();
}

// Verify JWT token
$token = str_replace('Bearer ', '', $authHeader);
try {
    $decoded = json_decode(base64_decode($token), true);
    
    if (!$decoded || !isset($decoded['user_id'])) {
        throw new Exception('Invalid token');
    }
    
    if (isset($decoded['exp']) && $decoded['exp'] < time()) {
        throw new Exception('Token expired');
    }
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    exit();
}

$database = new Database();
$db = $database->getConnection();
$method = $_SERVER['REQUEST_METHOD'];
$userId = $decoded['user_id'];

// Upload configuration
define('UPLOAD_DIR', __DIR__ . '/../uploads/resumes/');
define('MAX_FILE_SIZE', 5 * 1024 * 1024); // 5MB
define('ALLOWED_TYPES', ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
define('ALLOWED_EXTENSIONS', ['pdf', 'doc', 'docx']);

try {
    if ($method === 'POST') {
        // Upload resume
        if (!isset($_FILES['resume']) || $_FILES['resume']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No file uploaded or upload error']);
            exit();
        }
        
        $file = $_FILES['resume'];
        
        // Validate file size
        if ($file['size'] > MAX_FILE_SIZE) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'File too large. Maximum size is 5MB']);
            exit();
        }
        
        // Validate file type
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        
        if (!in_array($mimeType, ALLOWED_TYPES)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid file type. Only PDF, DOC, and DOCX allowed']);
            exit();
        }
        
        // Validate file extension
        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($extension, ALLOWED_EXTENSIONS)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid file extension']);
            exit();
        }
        
        // Generate unique filename
        $filename = 'resume_' . $userId . '_' . time() . '.' . $extension;
        $filepath = UPLOAD_DIR . $filename;
        
        // Create upload directory if not exists
        if (!file_exists(UPLOAD_DIR)) {
            mkdir(UPLOAD_DIR, 0777, true);
        }
        
        // Move uploaded file
        if (!move_uploaded_file($file['tmp_name'], $filepath)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Failed to save file']);
            exit();
        }
        
        // Save to database (optional: store in user profile or application)
        $relativeFilePath = 'uploads/resumes/' . $filename;
        
        // If application_id provided, update application
        $applicationId = $_POST['application_id'] ?? null;
        if ($applicationId) {
            $query = "UPDATE applications SET resume_path = :resume_path WHERE id = :id AND seeker_id = :seeker_id";
            $stmt = $db->prepare($query);
            $stmt->execute([
                ':resume_path' => $relativeFilePath,
                ':id' => $applicationId,
                ':seeker_id' => $userId
            ]);
        }
        
        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Resume uploaded successfully',
            'data' => [
                'filename' => $filename,
                'filepath' => $relativeFilePath,
                'size' => $file['size'],
                'type' => $extension
            ]
        ]);
        
    } elseif ($method === 'GET') {
        // Get user's resume info
        $applicationId = $_GET['application_id'] ?? null;
        
        if ($applicationId) {
            // Get resume for specific application
            $query = "SELECT resume_path FROM applications WHERE id = :id AND seeker_id = :seeker_id";
            $stmt = $db->prepare($query);
            $stmt->execute([':id' => $applicationId, ':seeker_id' => $userId]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($result && $result['resume_path']) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'data' => [
                        'resume_path' => $result['resume_path'],
                        'exists' => file_exists(__DIR__ . '/../' . $result['resume_path'])
                    ]
                ]);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'No resume found']);
            }
        } else {
            // List all resumes for user
            $pattern = UPLOAD_DIR . 'resume_' . $userId . '_*';
            $files = glob($pattern);
            
            $resumes = array_map(function($file) {
                return [
                    'filename' => basename($file),
                    'filepath' => 'uploads/resumes/' . basename($file),
                    'size' => filesize($file),
                    'uploaded' => date('Y-m-d H:i:s', filemtime($file))
                ];
            }, $files);
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $resumes
            ]);
        }
        
    } elseif ($method === 'DELETE') {
        // Delete resume
        $filename = $_GET['filename'] ?? null;
        
        if (!$filename) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Filename required']);
            exit();
        }
        
        // Security: ensure filename belongs to user
        if (!str_starts_with($filename, 'resume_' . $userId . '_')) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Unauthorized to delete this file']);
            exit();
        }
        
        $filepath = UPLOAD_DIR . $filename;
        
        if (!file_exists($filepath)) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'File not found']);
            exit();
        }
        
        if (unlink($filepath)) {
            // Update applications that used this resume
            $relativeFilePath = 'uploads/resumes/' . $filename;
            $query = "UPDATE applications SET resume_path = NULL WHERE resume_path = :resume_path AND seeker_id = :seeker_id";
            $stmt = $db->prepare($query);
            $stmt->execute([
                ':resume_path' => $relativeFilePath,
                ':seeker_id' => $userId
            ]);
            
            http_response_code(200);
            echo json_encode(['success' => true, 'message' => 'Resume deleted successfully']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Failed to delete file']);
        }
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
