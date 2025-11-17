<?php
/**
 * File Download API
 * Handle downloading uploaded resumes
 */

require_once '../config/database.php';
require_once __DIR__ . '/helpers/jwt.php';

header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Get headers
$headers = function_exists('getallheaders') ? getallheaders() : [];
$authHeader = $headers['Authorization'] ?? '';

if (empty($authHeader) || !str_starts_with($authHeader, 'Bearer ')) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit();
}

// Verify JWT token
$token = substr($authHeader, 7);
try {
    $decoded = jwt_decode($token);
    if (!isset($decoded['user_id'])) {
        throw new Exception('Invalid token payload');
    }
} catch (Exception $e) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    exit();
}

$database = new Database();
$db = $database->getConnection();
$userId = $decoded['user_id'];
$userRole = $decoded['role'];

// Get filename from query parameter
$filename = $_GET['file'] ?? null;

if (!$filename) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Filename required']);
    exit();
}

// Security: prevent directory traversal
$filename = basename($filename);
$filepath = __DIR__ . '/../uploads/resumes/' . $filename;

if (!file_exists($filepath)) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'File not found']);
    exit();
}

// Authorization check
// Admin can download any file
// Users can only download their own files
if ($userRole !== 'admin') {
    if (!str_starts_with($filename, 'resume_' . $userId . '_')) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => 'Unauthorized to access this file']);
        exit();
    }
}

// Get file info
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $filepath);
finfo_close($finfo);

$fileSize = filesize($filepath);
$extension = pathinfo($filename, PATHINFO_EXTENSION);

// Set headers for download
header('Content-Type: ' . $mimeType);
header('Content-Length: ' . $fileSize);
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: no-cache, must-revalidate');
header('Pragma: public');

// Output file
readfile($filepath);
exit();
