<?php
// Real Login API (hardened)
header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: no-referrer');

// Security helpers ---------------------------------------------------------
function respond_with_error(int $status, string $message, array $details = []): void {
    http_response_code($status);
    echo json_encode(['success' => false, 'error' => $message, 'errors' => $details]);
    exit();
}

function log_security_event(string $event, array $context = []): void {
    $logDir = __DIR__ . '/../../logs';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0700, true);
    }
    $entry = [
        'timestamp' => date('c'),
        'event' => $event,
        'context' => $context,
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
    ];
    @file_put_contents($logDir . '/auth.log', json_encode($entry) . PHP_EOL, FILE_APPEND | LOCK_EX);
}

function enforce_rate_limit(string $key, int $limit, int $windowSeconds): void {
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
        log_security_event('login_rate_limit_blocked', ['key' => $key, 'limit' => $limit]);
        respond_with_error(429, 'Too many login attempts. Please try again later.');
    }

    $data['count']++;
    @file_put_contents($file, json_encode($data), LOCK_EX);
}

function sanitize_email($email): ?string {
    $email = filter_var(trim((string) $email), FILTER_SANITIZE_EMAIL);
    return filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond_with_error(405, 'Method not allowed');
}

require_once '../../config/database.php';
require_once __DIR__ . '/../helpers/avatar.php';
require_once __DIR__ . '/../helpers/jwt.php';

$input = file_get_contents("php://input");
$data = json_decode($input, true);
if (!is_array($data)) {
    log_security_event('login_invalid_json', ['raw' => $input]);
    respond_with_error(400, 'Invalid JSON payload.');
}

$email = sanitize_email($data['email'] ?? null);
$password = trim((string)($data['password'] ?? ''));

if (!$email || $password === '') {
    respond_with_error(400, 'Email and password are required');
}

$clientKey = ($email ?: 'anonymous') . '_' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
enforce_rate_limit('login_attempts_' . $clientKey, 10, 300);

try {
    $database = new Database();
    $db = $database->getConnection();
    
    if (!$db) {
        throw new Exception('Database connection failed');
    }
    
    $query = "SELECT id, username, full_name, email, password, role, status, avatar, phone, bio FROM users WHERE email = :email LIMIT 1";

    $stmt = $db->prepare($query);
    $stmt->bindParam(':email', $email, PDO::PARAM_STR);
    $stmt->execute();

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        log_security_event('login_failed', ['email' => $email, 'reason' => 'user_not_found']);
        respond_with_error(401, 'Invalid email or password');
    }

    if (!password_verify($password, $user['password'])) {
        log_security_event('login_failed', ['email' => $email, 'reason' => 'password_mismatch']);
        respond_with_error(401, 'Invalid email or password');
    }

    if ($user['status'] !== 'active') {
        log_security_event('login_blocked', ['email' => $email, 'status' => $user['status']]);
        respond_with_error(403, 'Account is not active');
    }

    $issuedAt = time();
    $expiresAt = $issuedAt + APP_JWT_EXP_SECONDS;
    $tokenPayload = [
        'user_id' => (int)$user['id'],
        'email' => $user['email'],
        'role' => $user['role'],
        'iat' => $issuedAt,
        'exp' => $expiresAt
    ];
    $token = jwt_encode($tokenPayload);

    $cookieParams = [
        'expires' => $expiresAt,
        'path' => '/',
        'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax'
    ];
    setcookie('jp_auth', $token, $cookieParams);

    $userData = [
        'id' => (int)$user['id'],
        'username' => $user['username'],
        'full_name' => $user['full_name'],
        'email' => $user['email'],
        'role' => $user['role'],
        'status' => $user['status'],
        'avatar' => normalize_avatar_field($user['avatar'] ?? null),
        'phone' => $user['phone'],
        'bio' => $user['bio']
    ];

    log_security_event('login_success', ['user_id' => (int)$user['id'], 'email' => $user['email'], 'role' => $user['role']]);

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Login successful',
        'token' => $token,
        'data' => [
            'user' => $userData,
            'token' => $token,
            'expires_at' => $expiresAt
        ]
    ]);
    
} catch (Exception $e) {
    log_security_event('login_error', ['message' => $e->getMessage()]);
    respond_with_error(500, 'Server error: ' . $e->getMessage());
}
