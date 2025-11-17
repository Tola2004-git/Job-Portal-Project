<?php
/**
 * Job Seeker Change Password API
 * POST: Change user password
 */

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: no-referrer');

// --- Helper utilities ----------------------------------------------------
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

function sanitize_password_input($value): string {
    return trim((string) $value);
}

function validate_password_strength(string $password): array {
    $errors = [];
    if (strlen($password) < 8) {
        $errors[] = 'Password must be at least 8 characters long.';
    }
    if (!preg_match('/[A-Z]/', $password)) {
        $errors[] = 'Password must include at least one uppercase letter.';
    }
    if (!preg_match('/[a-z]/', $password)) {
        $errors[] = 'Password must include at least one lowercase letter.';
    }
    if (!preg_match('/[0-9]/', $password)) {
        $errors[] = 'Password must include at least one number.';
    }
    if (!preg_match('/[^A-Za-z0-9]/', $password)) {
        $errors[] = 'Password must include at least one special character.';
    }
    return $errors;
}

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../helpers/jwt.php';

try {
    // Only allow POST requests
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond_with_error(405, 'Method not allowed');
    }

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

    enforce_rate_limit('jobseeker_change_password_' . $userId, 5, 600, $userId);

    $contentType = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
    if (stripos($contentType, 'application/json') === false) {
        respond_with_error(415, 'Content-Type must be application/json.');
    }

    // Get request data
    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        log_security_event($userId, 'invalid_json_payload', ['endpoint' => 'change-password', 'raw' => $raw]);
        respond_with_error(400, 'Invalid JSON payload.');
    }
    
    // Validate required fields
    $currentPassword = sanitize_password_input($data['currentPassword'] ?? '');
    $newPassword = sanitize_password_input($data['newPassword'] ?? '');
    $confirmPassword = sanitize_password_input($data['confirmPassword'] ?? '');

    if ($currentPassword === '' || $newPassword === '' || $confirmPassword === '') {
        respond_with_error(400, 'All password fields are required');
    }

    // Validate passwords match
    if ($newPassword !== $confirmPassword) {
        respond_with_error(400, 'New password and confirmation do not match');
    }

    // Validate password length
    $strengthErrors = validate_password_strength($newPassword);
    if (!empty($strengthErrors)) {
        respond_with_error(422, 'Password does not meet complexity requirements.', $strengthErrors);
    }

    // Database connection
    $database = new Database();
    $db = $database->getConnection();

    // Get current password hash
    $query = "SELECT password FROM users WHERE id = :user_id";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':user_id', $userId);
    $stmt->execute();
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        respond_with_error(404, 'User not found');
    }

    // Verify current password
    if (!password_verify($currentPassword, $user['password'])) {
        log_security_event($userId, 'password_change_failed', ['reason' => 'incorrect_current']);
        respond_with_error(400, 'Current password is incorrect');
    }

    // Hash new password
    $newPasswordHash = password_hash($newPassword, PASSWORD_DEFAULT);

    // Update password
    $updateQuery = "UPDATE users SET password = :password, updated_at = NOW() WHERE id = :user_id";
    $stmt = $db->prepare($updateQuery);
    $stmt->bindParam(':password', $newPasswordHash);
    $stmt->bindParam(':user_id', $userId);

    if ($stmt->execute()) {
        log_security_event($userId, 'password_changed', []);
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Password changed successfully'
        ]);
    } else {
        log_security_event($userId, 'password_change_failed', ['reason' => 'update_failed']);
        respond_with_error(500, 'Failed to update password');
    }

} catch (Exception $e) {
    respond_with_error(500, 'Server error: ' . $e->getMessage());
}
