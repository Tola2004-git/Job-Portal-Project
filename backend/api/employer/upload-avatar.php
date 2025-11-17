<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../../config/database.php';
require_once __DIR__ . '/../helpers/jwt.php';

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
    if (($decoded['role'] ?? '') !== 'employer') {
        throw new Exception('Invalid token or not an employer');
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
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($data['avatar']) || empty($data['avatar'])) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'Avatar data is required'
            ]);
            exit();
        }
        
        $avatarData = $data['avatar'];
        
        // Validate base64 image
        if (!preg_match('/^data:image\/(png|jpg|jpeg|gif|webp|svg\+xml);base64,/', $avatarData)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'Invalid image format. Only PNG, JPG, JPEG, GIF, WEBP, and SVG are allowed.'
            ]);
            exit();
        }
        
        // Check if old avatar exists to delete
        $query = "SELECT avatar FROM users WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $userId);
        $stmt->execute();
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($user && !empty($user['avatar'])) {
            $oldAvatar = $user['avatar'];
            // If it's a file path (not base64), delete the old file
            if (!str_starts_with($oldAvatar, 'data:image')) {
                $uploadsDir = __DIR__ . '/../../uploads/avatars/';
                $oldFilePath = $uploadsDir . basename($oldAvatar);
                if (file_exists($oldFilePath)) {
                    @unlink($oldFilePath);
                }
            }
        }
        
        // Option 1: Save as base64 in database (simpler, works immediately)
        // This is what we'll use for consistency with the current setup
        $updateQuery = "UPDATE users SET avatar = :avatar, updated_at = NOW() WHERE id = :id";
        $updateStmt = $db->prepare($updateQuery);
        $updateStmt->bindParam(':avatar', $avatarData);
        $updateStmt->bindParam(':id', $userId);
        
        if ($updateStmt->execute()) {
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Avatar uploaded successfully',
                'data' => [
                    'avatar' => $avatarData
                ]
            ]);
        } else {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error' => 'Failed to update avatar'
            ]);
        }
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Database error: ' . $e->getMessage()
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
    }
} else {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed'
    ]);
}
?>
