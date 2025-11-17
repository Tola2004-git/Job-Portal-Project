<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../../config/database.php';

require_once __DIR__ . '/../helpers/jwt.php';

function respond(int $status, array $payload): void {
    http_response_code($status);
    echo json_encode($payload);
    exit();
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
$headers = function_exists('getallheaders') ? getallheaders() : [];
$authHeader = $headers['Authorization'] ?? '';

if (empty($authHeader) || !str_starts_with($authHeader, 'Bearer ')) {
    respond(401, ['success' => false, 'error' => 'Unauthorized']);
}

$token = substr($authHeader, 7);
try {
    $decoded = jwt_decode($token);
    if (($decoded['role'] ?? '') !== 'employer') {
        throw new Exception('Invalid token or not an employer', 403);
    }
    $userId = (int) ($decoded['user_id'] ?? 0);
    if (!$userId) {
        throw new Exception('Invalid token payload');
    }
} catch (Exception $e) {
    $status = $e->getCode() === 403 ? 403 : 401;
    respond($status, ['success' => false, 'error' => $e->getMessage()]);
}

$database = new Database();
$db = $database->getConnection();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        
        // Validate input
        if (empty($data['current_password']) || empty($data['new_password']) || empty($data['confirm_password'])) {
            respond(400, [
                'success' => false,
                'error' => 'All fields are required'
            ]);
        }
        
        // Check if new passwords match
        if ($data['new_password'] !== $data['confirm_password']) {
            respond(400, [
                'success' => false,
                'error' => 'New passwords do not match'
            ]);
        }
        
        $strengthErrors = validate_password_strength($data['new_password']);
        if (!empty($strengthErrors)) {
            respond(422, [
                'success' => false,
                'error' => 'Password does not meet complexity requirements.',
                'errors' => $strengthErrors
            ]);
        }
        
        // Get current user password from database
        $query = "SELECT password FROM users WHERE id = :user_id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':user_id', $userId);
        $stmt->execute();
        
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            respond(404, [
                'success' => false,
                'error' => 'User not found'
            ]);
        }
        
        // Verify current password
        if (!password_verify($data['current_password'], $user['password'])) {
            respond(400, [
                'success' => false,
                'error' => 'Current password is incorrect'
            ]);
        }
        
        // Hash new password
        $newPasswordHash = password_hash($data['new_password'], PASSWORD_DEFAULT);
        
        // Update password in database
        $updateQuery = "UPDATE users SET password = :password, updated_at = NOW() WHERE id = :user_id";
        $updateStmt = $db->prepare($updateQuery);
        $updateStmt->bindParam(':password', $newPasswordHash);
        $updateStmt->bindParam(':user_id', $userId);
        
        if ($updateStmt->execute()) {
            respond(200, [
                'success' => true,
                'message' => 'Password changed successfully'
            ]);
        }

        respond(500, [
            'success' => false,
            'error' => 'Failed to update password'
        ]);
        
    } catch (PDOException $e) {
        respond(500, [
            'success' => false,
            'error' => 'Database error: ' . $e->getMessage()
        ]);
    } catch (Exception $e) {
        respond(500, [
            'success' => false,
            'error' => $e->getMessage()
        ]);
    }
} else {
    respond(405, [
        'success' => false,
        'error' => 'Method not allowed'
    ]);
}
?>
