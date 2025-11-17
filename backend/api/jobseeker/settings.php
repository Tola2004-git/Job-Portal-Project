<?php
/**
 * Job Seeker Settings API
 * GET: Retrieve user settings
 * PUT: Update user settings
 */

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: no-referrer');

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

function sanitize_boolean($value, bool $default = true): int {
    if (is_null($value)) {
        return $default ? 1 : 0;
    }
    if (is_bool($value)) {
        return $value ? 1 : 0;
    }
    if (is_string($value)) {
        $value = strtolower(trim($value));
        if (in_array($value, ['true', '1', 'yes'], true)) {
            return 1;
        }
        if (in_array($value, ['false', '0', 'no'], true)) {
            return 0;
        }
    }
    return (int) (bool) $value;
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

    enforce_rate_limit('jobseeker_settings_' . $userId . '_requests', 120, 60, $userId);

    // Database connection
    $database = new Database();
    $db = $database->getConnection();

    // GET: Retrieve settings
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    enforce_rate_limit('jobseeker_settings_' . $userId . '_get', 60, 60, $userId);
    // Check if settings exist for this user
        $query = "SELECT * FROM settings WHERE user_id = :user_id LIMIT 1";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':user_id', $userId);
        $stmt->execute();
        $settings = $stmt->fetch(PDO::FETCH_ASSOC);

        // If no settings exist, create default settings
        if (!$settings) {
            $settingKey = 'jobseeker_preferences_' . $userId;
            $insertQuery = "INSERT INTO settings (
                user_id, 
                setting_key,
                email_notifications, 
                profile_visible, 
                daily_summary, 
                created_at, 
                updated_at
            ) VALUES (
                :user_id, 
                :setting_key,
                1, 
                1, 
                0, 
                NOW(), 
                NOW()
            )";
            $stmt = $db->prepare($insertQuery);
            $stmt->bindParam(':user_id', $userId);
            $stmt->bindParam(':setting_key', $settingKey);
            $stmt->execute();

            // Fetch the newly created settings
            $stmt = $db->prepare($query);
            $stmt->bindParam(':user_id', $userId);
            $stmt->execute();
            $settings = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        // Convert to boolean for frontend
        $response = [
            'success' => true,
            'data' => [
                'emailNotifications' => (bool)$settings['email_notifications'],
                'profileVisible' => (bool)$settings['profile_visible'],
                'dailySummary' => (bool)$settings['daily_summary']
            ]
        ];

        http_response_code(200);
        echo json_encode($response);
        exit();
    }

    // PUT: Update settings
    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        enforce_rate_limit('jobseeker_settings_' . $userId . '_put', 30, 120, $userId);
        $contentType = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
        if (stripos($contentType, 'application/json') === false) {
            respond_with_error(415, 'Content-Type must be application/json.');
        }
        $raw = file_get_contents("php://input");
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            log_security_event($userId, 'invalid_json_payload', ['endpoint' => 'settings', 'raw' => $raw]);
            respond_with_error(400, 'Invalid JSON payload.');
        }

        // Get current settings or create if not exist
        $query = "SELECT id FROM settings WHERE user_id = :user_id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':user_id', $userId);
        $stmt->execute();
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);

        // Convert camelCase to snake_case
    $emailNotifications = sanitize_boolean($data['emailNotifications'] ?? ($data['email_notifications'] ?? true));
    $profileVisible = sanitize_boolean($data['profileVisible'] ?? ($data['profile_visible'] ?? true));
    $dailySummary = sanitize_boolean($data['dailySummary'] ?? ($data['daily_summary'] ?? false), false);

        if ($existing) {
            // Update existing settings
            $updateQuery = "UPDATE settings 
                           SET email_notifications = :email_notifications,
                               profile_visible = :profile_visible,
                               daily_summary = :daily_summary,
                               updated_at = NOW()
                           WHERE user_id = :user_id";
            $stmt = $db->prepare($updateQuery);
            $stmt->bindParam(':user_id', $userId);
            $stmt->bindParam(':email_notifications', $emailNotifications);
            $stmt->bindParam(':profile_visible', $profileVisible);
            $stmt->bindParam(':daily_summary', $dailySummary);
        } else {
            // Insert new settings
            $settingKey = 'jobseeker_preferences_' . $userId;
            $insertQuery = "INSERT INTO settings (
                user_id, 
                setting_key,
                email_notifications, 
                profile_visible, 
                daily_summary, 
                created_at, 
                updated_at
            ) VALUES (
                :user_id,
                :setting_key,
                :email_notifications, 
                :profile_visible, 
                :daily_summary, 
                NOW(), 
                NOW()
            )";
            $stmt = $db->prepare($insertQuery);
            $stmt->bindParam(':user_id', $userId);
            $stmt->bindParam(':setting_key', $settingKey);
            $stmt->bindParam(':email_notifications', $emailNotifications);
            $stmt->bindParam(':profile_visible', $profileVisible);
            $stmt->bindParam(':daily_summary', $dailySummary);
        }

        if ($stmt->execute()) {
            log_security_event($userId, 'settings_updated', [
                'email_notifications' => (bool)$emailNotifications,
                'profile_visible' => (bool)$profileVisible,
                'daily_summary' => (bool)$dailySummary
            ]);
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Settings updated successfully',
                'data' => [
                    'emailNotifications' => (bool)$emailNotifications,
                    'profileVisible' => (bool)$profileVisible,
                    'dailySummary' => (bool)$dailySummary
                ]
            ]);
        } else {
            log_security_event($userId, 'settings_update_failed', []);
            throw new Exception('Failed to update settings');
        }
        exit();
    }

    respond_with_error(405, 'Method not allowed');

} catch (Exception $e) {
        log_security_event($userId ?? 0, 'settings_error', ['message' => $e->getMessage()]);
        respond_with_error(500, 'Server error: ' . $e->getMessage());
}
