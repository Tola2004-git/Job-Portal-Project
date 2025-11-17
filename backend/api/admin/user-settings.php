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
        // Get admin user settings
        $query = "SELECT setting_key, setting_value, setting_type 
                  FROM settings 
                  WHERE user_id = :user_id 
                  ORDER BY setting_key";
        
        $stmt = $db->prepare($query);
        $stmt->execute([':user_id' => $adminId]);
        $settings = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Convert to key-value object
        $settingsObject = [];
        foreach ($settings as $setting) {
            $key = str_replace('admin_', '', $setting['setting_key']); // Remove 'admin_' prefix
            $value = $setting['setting_value'];
            
            // Type casting
            if ($setting['setting_type'] === 'number') {
                $value = is_numeric($value) ? (int)$value : $value;
            } elseif ($setting['setting_type'] === 'boolean') {
                $value = (bool)$value;
            }
            
            $settingsObject[$key] = $value;
        }
        
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => [
                'settings' => $settingsObject
            ]
        ]);
        
    } elseif ($method === 'PUT') {
        // Update admin user settings
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No data provided']);
            exit();
        }
        
        $updatedCount = 0;
        
        // Update each setting
        foreach ($data as $key => $value) {
            // Add 'admin_' prefix back
            $settingKey = 'admin_' . $key;
            
            // Check if setting exists
            $checkQuery = "SELECT id, setting_type FROM settings 
                          WHERE user_id = :user_id AND setting_key = :key";
            $checkStmt = $db->prepare($checkQuery);
            $checkStmt->execute([':user_id' => $adminId, ':key' => $settingKey]);
            $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($existing) {
                // Update existing setting
                $updateQuery = "UPDATE settings 
                               SET setting_value = :value, updated_at = NOW(), updated_by = :user_id 
                               WHERE user_id = :user_id AND setting_key = :key";
                $updateStmt = $db->prepare($updateQuery);
                $updateStmt->execute([
                    ':value' => $value,
                    ':user_id' => $adminId,
                    ':key' => $settingKey
                ]);
                $updatedCount++;
            } else {
                // Insert new setting
                $insertQuery = "INSERT INTO settings (user_id, setting_key, setting_value, setting_type, updated_by) 
                               VALUES (:user_id, :key, :value, 'text', :updated_by)";
                $insertStmt = $db->prepare($insertQuery);
                $insertStmt->execute([
                    ':user_id' => $adminId,
                    ':key' => $settingKey,
                    ':value' => $value,
                    ':updated_by' => $adminId
                ]);
                $updatedCount++;
            }
        }
        
        http_response_code(200);
        echo json_encode([
            'success' => true, 
            'message' => "Updated {$updatedCount} settings successfully"
        ]);
        
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
