<?php
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: POST, OPTIONS");
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
    // Get JSON body with base64 image
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['avatar']) || empty($data['avatar'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No avatar data provided']);
        exit();
    }
    
    $base64Image = $data['avatar'];
    
    $isSvg = false;
    if (preg_match('/^data:image\/(jpeg|jpg|png|gif|webp);base64,/', $base64Image)) {
        // Extract image data
        $imageData = preg_replace('/^data:image\/(jpeg|jpg|png|gif|webp);base64,/', '', $base64Image);
        $imageData = base64_decode($imageData);

        if ($imageData === false) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Failed to decode image']);
            exit();
        }
    } elseif (preg_match('/^data:image\/svg\+xml;base64,/', $base64Image)) {
        $isSvg = true;
        $imageData = base64_decode(preg_replace('/^data:image\/svg\+xml;base64,/', '', $base64Image));
        if ($imageData === false) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Failed to decode SVG image']);
            exit();
        }
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid image format']);
        exit();
    }
    
    // Get current avatar path from database
    $query = "SELECT avatar FROM users WHERE id = :id";
    $stmt = $db->prepare($query);
    $stmt->execute([':id' => $adminId]);
    $currentUser = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Delete old avatar file if exists
    if ($currentUser && !empty($currentUser['avatar'])) {
        $oldAvatarValue = $currentUser['avatar'];
        if (strpos($oldAvatarValue, 'uploads/avatars/') !== false) {
            $oldAvatarPath = '../../' . ltrim($oldAvatarValue, '/');
            if (file_exists($oldAvatarPath)) {
                unlink($oldAvatarPath);
            }
        }
    }
    
    // Generate unique filename
    if (!$isSvg) {
        $extension = 'jpg'; // Default to jpg
        if (preg_match('/^data:image\/(jpeg|jpg|png|gif|webp);base64,/', $base64Image, $matches)) {
            $extension = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
        }

        $filename = 'admin_' . $adminId . '_' . time() . '.' . $extension;
        $uploadDir = '../../uploads/avatars/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
        $filePath = $uploadDir . $filename;

        if (!file_put_contents($filePath, $imageData)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Failed to save image']);
            exit();
        }

        $avatarUrl = 'uploads/avatars/' . $filename;
    } else {
        // Keep SVG data URI in database directly
        $avatarUrl = $base64Image;
    }
    
    $updateQuery = "UPDATE users SET avatar = :avatar, updated_at = NOW() WHERE id = :id";
    $updateStmt = $db->prepare($updateQuery);
    $updateStmt->execute([
        ':avatar' => $avatarUrl,
        ':id' => $adminId
    ]);
    
    http_response_code(200);
    $responseData = ['avatar_url' => $avatarUrl];
    if (!$isSvg) {
        $responseData['full_url'] = 'http://localhost/Job_Portal_Project/backend/' . $avatarUrl;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Avatar uploaded successfully',
        'data' => $responseData
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
