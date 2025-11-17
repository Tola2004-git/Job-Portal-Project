<?php
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

require_once '../../config/database.php';
require_once '../../config/app.php';
require_once __DIR__ . '/../helpers/jwt.php';

$headers = function_exists('getallheaders') ? getallheaders() : [];
$authHeader = $headers['Authorization'] ?? '';

if (empty($authHeader) || !str_starts_with($authHeader, 'Bearer ')) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit();
}

$token = substr($authHeader, 7);
try {
    $decoded = jwt_decode($token);
    if (($decoded['role'] ?? '') !== 'admin') {
        throw new Exception('Admin only', 403);
    }
    $adminId = (int) $decoded['user_id'];
} catch (Exception $e) {
    $status = $e->getCode() === 403 ? 403 : 401;
    http_response_code($status);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    exit();
}

$database = new Database();
$db = $database->getConnection();

try {
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Validate required fields
    if (!isset($data['current_password']) || !isset($data['new_password'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Current password and new password are required']);
        exit();
    }
    
    $currentPassword = $data['current_password'];
    $newPassword = $data['new_password'];
    $confirmPassword = $data['confirm_password'] ?? '';
    
    // Validate new password matches confirmation
    if ($confirmPassword && $newPassword !== $confirmPassword) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'New password and confirmation do not match']);
        exit();
    }
    
    // Validate password strength
    if (strlen($newPassword) < 6) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'New password must be at least 6 characters']);
        exit();
    }
    
    // Get current password hash from database
    $query = "SELECT password FROM users WHERE id = :id";
    $stmt = $db->prepare($query);
    $stmt->execute([':id' => $adminId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'User not found']);
        exit();
    }
    
    // Verify current password
    if (!password_verify($currentPassword, $user['password'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Current password is incorrect']);
        exit();
    }
    
    // Hash new password
    $newPasswordHash = password_hash($newPassword, PASSWORD_DEFAULT);
    
    // Update password
    $updateQuery = "UPDATE users SET password = :password, updated_at = NOW() WHERE id = :id";
    $updateStmt = $db->prepare($updateQuery);
    $updateStmt->execute([
        ':password' => $newPasswordHash,
        ':id' => $adminId
    ]);
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Password changed successfully'
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
