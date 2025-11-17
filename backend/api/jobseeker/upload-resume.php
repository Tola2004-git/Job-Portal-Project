<?php
/**
 * Job Seeker Resume Upload API
 * POST: Upload resume file
 */

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: no-referrer');

// Security helpers
function respond_with_error(int $status, string $message, array $details = []): void {
    http_response_code($status);
    echo json_encode(['success' => false, 'message' => $message, 'errors' => $details]);
    exit();
}

function log_security_event(int $userId, string $event, array $context = []): void {
    $logDir = __DIR__ . '/../../logs';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0700, true);
    }
    $entry = [
        'timestamp' => date('c'),
        'user_id' => $userId,
        'event' => $event,
        'context' => $context,
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
    ];
    @file_put_contents($logDir . '/security.log', json_encode($entry) . PHP_EOL, FILE_APPEND | LOCK_EX);
}

function enforce_rate_limit(string $key, int $limit, int $windowSeconds, ?int $userId = null): void {
    $rateDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'jp_rate_limit';
    if (!is_dir($rateDir)) {
        @mkdir($rateDir, 0700, true);
    }

    $file = $rateDir . DIRECTORY_SEPARATOR . sha1($key) . '.json';
    $now = time();
    $data = ['count' => 0, 'start' => $now];

    if (file_exists($file)) {
        $raw = @file_get_contents($file);
        if ($raw !== false) {
            $decoded = json_decode($raw, true);
            if (is_array($decoded) && isset($decoded['count'], $decoded['start'])) {
                $data = $decoded;
            }
        }
    }

    if ($now - $data['start'] >= $windowSeconds) {
        $data = ['count' => 0, 'start' => $now];
    }

    if ($data['count'] >= $limit) {
        log_security_event($userId ?? 0, 'rate_limit_blocked', ['key' => $key, 'limit' => $limit, 'window' => $windowSeconds]);
        respond_with_error(429, 'Too many requests. Please try again later.');
    }

    $data['count']++;
    @file_put_contents($file, json_encode($data), LOCK_EX);
}

function sanitize_filename(string $name): string {
    $name = preg_replace('/[^A-Za-z0-9_.-]/', '_', $name);
    return substr($name, 0, 120);
}

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
        respond_with_error(401, 'No authorization token provided');
    }

    // Decode JWT token
    $token = str_replace('Bearer ', '', $authHeader);
    try {
        $decoded = jwt_decode($token);
    } catch (Exception $e) {
        respond_with_error(401, $e->getMessage());
    }

    if (($decoded['role'] ?? '') !== 'job_seeker') {
        respond_with_error(403, 'Forbidden: role not permitted.');
    }

    $userId = (int) $decoded['user_id'];

    enforce_rate_limit('jobseeker_upload_resume_' . $userId, 5, 600, $userId);

    // Database connection
    $database = new Database();
    $db = $database->getConnection();

    // POST: Upload resume
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if (empty($_FILES)) {
            log_security_event($userId, 'resume_upload_no_files', []);
        }
        // Check if file was uploaded
        if (!isset($_FILES['resume']) || $_FILES['resume']['error'] !== UPLOAD_ERR_OK) {
            respond_with_error(400, 'No file uploaded or upload error occurred');
        }

        $file = $_FILES['resume'];
        $fileName = $file['name'];
        $fileTmpName = $file['tmp_name'];
        $fileSize = $file['size'];
        $fileError = $file['error'];
        
        if ($fileError !== UPLOAD_ERR_OK || !is_uploaded_file($fileTmpName)) {
            log_security_event($userId, 'resume_upload_invalid_tmp', ['error' => $fileError]);
            respond_with_error(400, 'Invalid file upload.');
        }

        // Get file extension
        $fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        
        // Allowed file types
        $allowedExtensions = ['pdf', 'doc', 'docx'];
        
        if (!in_array($fileExt, $allowedExtensions)) {
            log_security_event($userId, 'resume_upload_invalid_extension', ['extension' => $fileExt]);
            respond_with_error(400, 'Invalid file type. Only PDF, DOC, and DOCX files are allowed.');
        }
        
        // Check file size (max 5MB)
        if ($fileSize > 5242880) {
            respond_with_error(400, 'File size too large. Maximum size is 5MB.');
        }

        // Validate MIME type with finfo
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($fileTmpName);
        $allowedMime = [
            'application/pdf' => 'pdf',
            'application/msword' => 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx'
        ];
        if (!isset($allowedMime[$mimeType]) || $allowedMime[$mimeType] !== $fileExt) {
            log_security_event($userId, 'resume_upload_invalid_mime', ['mime' => $mimeType]);
            respond_with_error(400, 'File MIME type not allowed.');
        }

        $cleanBaseName = sanitize_filename(pathinfo($fileName, PATHINFO_FILENAME));
        
        // Create upload directory if it doesn't exist
        $uploadDir = __DIR__ . '/../../uploads/resumes/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
        
        // Generate unique filename
        $newFileName = 'resume_' . $userId . '_' . $cleanBaseName . '_' . time() . '.' . $fileExt;
        $uploadPath = $uploadDir . $newFileName;
        $relativePath = 'uploads/resumes/' . $newFileName;
        
        // Delete old resume if exists
        $queryOld = "SELECT resume_path FROM users WHERE id = :user_id";
        $stmtOld = $db->prepare($queryOld);
        $stmtOld->bindParam(':user_id', $userId);
        $stmtOld->execute();
        $oldResume = $stmtOld->fetch(PDO::FETCH_ASSOC);
        
        if ($oldResume && $oldResume['resume_path']) {
            $baseDir = realpath(__DIR__ . '/../../uploads/resumes');
            $oldFilePath = realpath(__DIR__ . '/../../' . $oldResume['resume_path']);
            if ($baseDir && $oldFilePath && strpos($oldFilePath, $baseDir) === 0 && file_exists($oldFilePath)) {
                @unlink($oldFilePath);
            }
        }
        
        // Move uploaded file
        if (move_uploaded_file($fileTmpName, $uploadPath)) {
            @chmod($uploadPath, 0640);
            // Update user's resume path in database
            $updateQuery = "UPDATE users SET resume_path = :resume_path, updated_at = NOW() WHERE id = :user_id";
            $stmt = $db->prepare($updateQuery);
            $stmt->bindParam(':resume_path', $relativePath);
            $stmt->bindParam(':user_id', $userId);
            
            if ($stmt->execute()) {
                log_security_event($userId, 'resume_uploaded', ['path' => $relativePath, 'size' => $fileSize]);
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'Resume uploaded successfully',
                    'resume_path' => $relativePath,
                    'file_name' => $newFileName
                ]);
            } else {
                // Delete uploaded file if database update fails
                @unlink($uploadPath);
                log_security_event($userId, 'resume_upload_failed', ['reason' => 'db_update_failed']);
                respond_with_error(500, 'Failed to update database');
            }
        } else {
            log_security_event($userId, 'resume_upload_move_failed', []);
            respond_with_error(500, 'Failed to upload file');
        }
        exit();
    }

    // Invalid request method
    respond_with_error(405, 'Method not allowed');

} catch (PDOException $e) {
    log_security_event($userId ?? 0, 'resume_upload_db_error', ['message' => $e->getMessage()]);
    respond_with_error(500, 'Database error: ' . $e->getMessage());
} catch (Exception $e) {
    log_security_event($userId ?? 0, 'resume_upload_error', ['message' => $e->getMessage()]);
    respond_with_error(500, 'Server error: ' . $e->getMessage());
}
?>
