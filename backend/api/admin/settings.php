<?php
/**
 * Admin - Settings Management API
 * GET: Get all settings
 * PUT: Update settings
 */

// CORS Headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Include files
require_once '../../config/database.php';
require_once '../../config/app.php';
require_once __DIR__ . '/../helpers/jwt.php';

// Get Authorization header
$headers = function_exists('getallheaders') ? getallheaders() : [];
$authHeader = $headers['Authorization'] ?? '';

if (empty($authHeader) || !str_starts_with($authHeader, 'Bearer ')) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Authorization token required']);
    exit();
}

// Extract and verify token
$token = substr($authHeader, 7);

try {
    $tokenData = jwt_decode($token);
    if (($tokenData['role'] ?? '') !== 'admin') {
        throw new Exception('Admin access required', 403);
    }
    
    $database = new Database();
    $db = $database->getConnection();
    
    $method = $_SERVER['REQUEST_METHOD'];
    
    // GET - Get all settings
    if ($method === 'GET') {
        $query = "SELECT 
                    id,
                    setting_key,
                    setting_value,
                    setting_type,
                    description,
                    updated_at
                  FROM settings
                  ORDER BY setting_key ASC";
        
        $stmt = $db->prepare($query);
        $stmt->execute();
        $settingsArray = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Convert to key-value pairs for easier frontend usage
        $settings = [];
        foreach ($settingsArray as $setting) {
            $value = $setting['setting_value'];
            
            // Convert value based on type
            if ($setting['setting_type'] === 'boolean') {
                $value = ($value === '1' || $value === 'true');
            } elseif ($setting['setting_type'] === 'number') {
                $value = is_numeric($value) ? (int)$value : 0;
            } elseif ($setting['setting_type'] === 'json') {
                $value = json_decode($value, true);
            }
            
            $settings[$setting['setting_key']] = [
                'id' => $setting['id'],
                'value' => $value,
                'type' => $setting['setting_type'],
                'description' => $setting['description'],
                'updated_at' => $setting['updated_at']
            ];
        }
        
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => [
                'settings' => $settings
            ]
        ]);
    }
    
    // PUT - Update settings
    elseif ($method === 'PUT') {
        $data = json_decode(file_get_contents("php://input"), true);
        
        if (empty($data['settings']) || !is_array($data['settings'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Settings array is required']);
            exit();
        }
        
        $db->beginTransaction();
        
        try {
            $updateQuery = "UPDATE settings SET setting_value = :value, updated_at = NOW() WHERE setting_key = :key";
            $updateStmt = $db->prepare($updateQuery);
            
            foreach ($data['settings'] as $key => $value) {
                // Get setting type
                $typeQuery = "SELECT setting_type FROM settings WHERE setting_key = :key";
                $typeStmt = $db->prepare($typeQuery);
                $typeStmt->bindValue(':key', $key);
                $typeStmt->execute();
                $settingType = $typeStmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$settingType) {
                    continue; // Skip if setting doesn't exist
                }
                
                // Convert value based on type
                $storedValue = $value;
                if ($settingType['setting_type'] === 'boolean') {
                    $storedValue = $value ? '1' : '0';
                } elseif ($settingType['setting_type'] === 'number') {
                    $storedValue = (string)$value;
                } elseif ($settingType['setting_type'] === 'json') {
                    $storedValue = json_encode($value);
                } else {
                    $storedValue = (string)$value;
                }
                
                $updateStmt->bindValue(':key', $key);
                $updateStmt->bindValue(':value', $storedValue);
                $updateStmt->execute();
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
    $status = $e->getCode() === 403 ? 403 : 500;
    $message = 'Server error: ' . $e->getMessage();
    if ($e instanceof InvalidArgumentException || $e instanceof RuntimeException) {
        $status = 401;
        $message = $e->getMessage();
    } elseif ($status === 403) {
        $message = $e->getMessage();
    }
    http_response_code($status);
    echo json_encode([
        'success' => false,
        'error' => $message
    ]);
}
