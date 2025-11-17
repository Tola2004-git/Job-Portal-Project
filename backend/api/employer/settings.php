<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: GET, PUT');
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
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        // Get all settings for this employer
        $query = "SELECT 
                    setting_key,
                    setting_value,
                    setting_type
                  FROM settings 
                  WHERE user_id = :user_id
                  ORDER BY setting_key";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':user_id', $userId);
        $stmt->execute();
        
        $settings = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Convert to key-value format
        $settingsData = [];
        foreach ($settings as $setting) {
            $key = $setting['setting_key'];
            $value = $setting['setting_value'];
            
            // Convert based on type
            if ($setting['setting_type'] === 'boolean') {
                $value = $value === '1' || $value === 'true';
            } elseif ($setting['setting_type'] === 'number') {
                $value = (int)$value;
            }
            
            $settingsData[$key] = $value;
        }
        
        // Set defaults if no settings exist
        if (empty($settingsData)) {
            $settingsData = [
                'email_notifications' => true,
                'sms_notifications' => false,
                'notify_new_applications' => true,
                'notify_profile_views' => true,
                'auto_response' => false,
                'application_deadline_days' => 30,
                'max_applications_per_job' => 100,
                'company_visible' => true
            ];
        }
        
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => [
                'settings' => $settingsData
            ]
        ]);
        
    } elseif ($method === 'PUT') {
        // Update settings
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No settings data provided']);
            exit();
        }
        
        // Begin transaction
        $db->beginTransaction();
        
        try {
            foreach ($data as $key => $value) {
                // Determine type
                $type = 'string';
                if (is_bool($value)) {
                    $type = 'boolean';
                    $value = $value ? '1' : '0';
                } elseif (is_numeric($value)) {
                    $type = 'number';
                }
                
                // Check if setting exists
                $checkQuery = "SELECT id FROM settings 
                              WHERE user_id = :user_id AND setting_key = :key";
                $stmt = $db->prepare($checkQuery);
                $stmt->bindParam(':user_id', $userId);
                $stmt->bindParam(':key', $key);
                $stmt->execute();
                
                if ($stmt->rowCount() > 0) {
                    // Update existing setting
                    $updateQuery = "UPDATE settings 
                                   SET setting_value = :value,
                                       setting_type = :type,
                                       updated_at = NOW(),
                                       updated_by = :user_id
                                   WHERE user_id = :user_id 
                                     AND setting_key = :key";
                    $stmt = $db->prepare($updateQuery);
                    $stmt->bindParam(':value', $value);
                    $stmt->bindParam(':type', $type);
                    $stmt->bindParam(':user_id', $userId);
                    $stmt->bindParam(':key', $key);
                    $stmt->execute();
                } else {
                    // Insert new setting
                    $insertQuery = "INSERT INTO settings 
                                   (user_id, setting_key, setting_value, setting_type, updated_by) 
                                   VALUES (:user_id, :key, :value, :type, :user_id)";
                    $stmt = $db->prepare($insertQuery);
                    $stmt->bindParam(':user_id', $userId);
                    $stmt->bindParam(':key', $key);
                    $stmt->bindParam(':value', $value);
                    $stmt->bindParam(':type', $type);
                    $stmt->execute();
                }
            }
            
            $db->commit();
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Settings updated successfully'
            ]);
            
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
