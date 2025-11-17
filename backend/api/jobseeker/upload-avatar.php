<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: no-referrer');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../../config/database.php';
require_once __DIR__ . '/../helpers/jwt.php';

// --- Security helpers ----------------------------------------------------
function respond_with_error(int $status, string $message, array $details = []): void {
    http_response_code($status);
    echo json_encode(['success' => false, 'error' => $message, 'details' => $details]);
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

function sanitize_avatar_base64($value, array &$errors): ?string {
    $value = trim((string) $value);
    if ($value === '') {
        $errors['avatar'] = 'Avatar data is required.';
        return null;
    }
    if (!preg_match('/^data:image\/(png|jpg|jpeg|gif|webp|svg\+xml);base64,/', $value)) {
        $errors['avatar'] = 'Invalid image format. Only PNG, JPG, JPEG, GIF, WEBP, and SVG are allowed.';
        return null;
    }
    return $value;
}

// JWT Authentication
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? '';

if (empty($authHeader) || !str_starts_with($authHeader, 'Bearer ')) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit();
}

$token = str_replace('Bearer ', '', $authHeader);
try {
    $decoded = jwt_decode($token);
    if (($decoded['role'] ?? '') !== 'job_seeker') {
        throw new Exception('Invalid token or not a job seeker');
    }
    $userId = (int) $decoded['user_id'];
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    exit();
}

$database = new Database();
$db = $database->getConnection();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        enforce_rate_limit('jobseeker_avatar_' . $userId . '_post', 15, 300, $userId);
        $contentType = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
        if (stripos($contentType, 'application/json') === false) {
            respond_with_error(415, 'Content-Type must be application/json.');
        }

        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            log_security_event($userId, 'invalid_json_payload', ['endpoint' => 'upload-avatar', 'raw' => $raw]);
            respond_with_error(400, 'Invalid JSON payload.');
        }

        $errors = [];
        $avatarData = sanitize_avatar_base64($data['avatar'] ?? '', $errors);
        if (!empty($errors)) {
            log_security_event($userId, 'avatar_validation_failed', ['errors' => $errors]);
            respond_with_error(422, 'Invalid avatar data.', $errors);
        }
        // Update avatar in users table
        $updateQuery = "UPDATE users SET avatar = :avatar, updated_at = NOW() WHERE id = :id";
        $updateStmt = $db->prepare($updateQuery);
        $updateStmt->bindParam(':avatar', $avatarData);
        $updateStmt->bindParam(':id', $userId);
        if ($updateStmt->execute()) {
            log_security_event($userId, 'avatar_updated', []);
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Avatar uploaded successfully',
                'data' => [
                    'avatar' => $avatarData
                ]
            ]);
        } else {
            log_security_event($userId, 'avatar_update_failed', []);
            respond_with_error(500, 'Failed to update avatar');
        }
    } catch (PDOException $e) {
        log_security_event($userId, 'avatar_db_error', ['message' => $e->getMessage()]);
        respond_with_error(500, 'Database error: ' . $e->getMessage());
    } catch (Exception $e) {
        log_security_event($userId, 'avatar_generic_error', ['message' => $e->getMessage()]);
        respond_with_error(500, $e->getMessage());
    }
} else {
    respond_with_error(405, 'Method not allowed');
}
?>
