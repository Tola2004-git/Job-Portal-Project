<?php
/**
 * Delete Resume API
 * DELETE: Delete job seeker's resume
 */

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: DELETE, OPTIONS');
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

    enforce_rate_limit('jobseeker_delete_resume_' . $userId, 5, 600, $userId);

    // Database connection
    $database = new Database();
    $db = $database->getConnection();

    // DELETE: Remove resume
    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        // Get current resume path
        $query = "SELECT resume_path FROM users WHERE id = :user_id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':user_id', $userId);
        $stmt->execute();
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !$user['resume_path']) {
            respond_with_error(404, 'No resume found');
        }

        $resumePath = $user['resume_path'];
        $baseDir = realpath(__DIR__ . '/../../uploads/resumes');
        if (!$baseDir) {
            respond_with_error(500, 'Resume storage is not configured.');
        }
        $targetPath = realpath(__DIR__ . '/../../' . $resumePath);
        if (!$targetPath || strpos($targetPath, $baseDir) !== 0) {
            log_security_event($userId, 'resume_path_invalid', ['path' => $resumePath]);
            respond_with_error(400, 'Invalid resume path.');
        }

        // Delete file from server
        if (file_exists($targetPath)) {
            @unlink($targetPath);
        }

        // Update database to remove resume path
        $updateQuery = "UPDATE users SET resume_path = NULL, updated_at = NOW() WHERE id = :user_id";
        $stmt = $db->prepare($updateQuery);
        $stmt->bindParam(':user_id', $userId);

        if ($stmt->execute()) {
            log_security_event($userId, 'resume_deleted', ['path' => $resumePath]);
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Resume deleted successfully'
            ]);
        } else {
            log_security_event($userId, 'resume_delete_failed', ['reason' => 'db_update_failed']);
            respond_with_error(500, 'Failed to delete resume from database');
        }
        exit();
    }

    // Invalid request method
    respond_with_error(405, 'Method not allowed');

} catch (PDOException $e) {
    log_security_event($userId ?? 0, 'resume_delete_db_error', ['message' => $e->getMessage()]);
    respond_with_error(500, 'Database error: ' . $e->getMessage());
} catch (Exception $e) {
    log_security_event($userId ?? 0, 'resume_delete_error', ['message' => $e->getMessage()]);
    respond_with_error(500, 'Server error: ' . $e->getMessage());
}
?>
