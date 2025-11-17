<?php
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: GET, PUT, OPTIONS");
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
} catch (Exception $e) {
    $status = $e->getCode() === 403 ? 403 : 401;
    http_response_code($status);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    exit();
}

$database = new Database();
$db = $database->getConnection();
$method = $_SERVER['REQUEST_METHOD'];
$adminId = (int) $decoded['user_id'];

try {
    if ($method === 'GET') {
        // Get admin profile
        $query = "SELECT id, username, email, full_name, phone, avatar, bio, role, created_at, updated_at 
                  FROM users 
                  WHERE id = :id AND role = 'admin'";
        
        $stmt = $db->prepare($query);
        $stmt->execute([':id' => $adminId]);
        $admin = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$admin) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Admin profile not found']);
            exit();
        }
        
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => [
                'profile' => $admin
            ]
        ]);
        
    } elseif ($method === 'PUT') {
        // Update admin profile
        $data = json_decode(file_get_contents('php://input'), true);
        
        $updates = [];
        $params = [':id' => $adminId];
        
        // Allow updating these fields
        if (isset($data['full_name'])) {
            $updates[] = "full_name = :full_name";
            $params[':full_name'] = $data['full_name'];
        }
        
        if (isset($data['email'])) {
            // Check if email already exists for another user
            $checkQuery = "SELECT id FROM users WHERE email = :email AND id != :id";
            $checkStmt = $db->prepare($checkQuery);
            $checkStmt->execute([':email' => $data['email'], ':id' => $adminId]);
            
            if ($checkStmt->fetch()) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Email already in use']);
                exit();
            }
            
            $updates[] = "email = :email";
            $params[':email'] = $data['email'];
        }
        
        if (isset($data['username'])) {
            // Check if username already exists for another user
            $checkQuery = "SELECT id FROM users WHERE username = :username AND id != :id";
            $checkStmt = $db->prepare($checkQuery);
            $checkStmt->execute([':username' => $data['username'], ':id' => $adminId]);
            
            if ($checkStmt->fetch()) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Username already in use']);
                exit();
            }
            
            $updates[] = "username = :username";
            $params[':username'] = $data['username'];
        }
        
        if (isset($data['phone'])) {
            $updates[] = "phone = :phone";
            $params[':phone'] = $data['phone'];
        }
        
        if (isset($data['avatar'])) {
            $updates[] = "avatar = :avatar";
            $params[':avatar'] = $data['avatar'];
        }
        
        if (isset($data['bio'])) {
            $updates[] = "bio = :bio";
            $params[':bio'] = $data['bio'];
        }
        
        if (count($updates) === 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No fields to update']);
            exit();
        }
        
        $updates[] = "updated_at = NOW()";
        
        $query = "UPDATE users SET " . implode(', ', $updates) . " WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->execute($params);
        
        http_response_code(200);
        echo json_encode(['success' => true, 'message' => 'Profile updated successfully']);
        
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
