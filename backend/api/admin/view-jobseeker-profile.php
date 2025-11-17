<?php
/**
 * Admin View Job Seeker Profile API
 * GET: View detailed job seeker profile
 */

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/app.php';
require_once __DIR__ . '/../helpers/jwt.php';

try {
    // Get JWT token from Authorization header
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $authHeader = $headers['Authorization'] ?? '';
    
    if (empty($authHeader) || !str_starts_with($authHeader, 'Bearer ')) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'No authorization token provided']);
        exit();
    }

    // Decode JWT token
    $token = substr($authHeader, 7);
    try {
        $decoded = jwt_decode($token);
    } catch (Exception $decodeError) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => $decodeError->getMessage()]);
        exit();
    }

    if (($decoded['role'] ?? '') !== 'admin') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid token or unauthorized']);
        exit();
    }

    // Check if user_id is provided
    if (!isset($_GET['user_id']) || empty($_GET['user_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'User ID is required']);
        exit();
    }

    $userId = intval($_GET['user_id']);

    // Database connection
    $database = new Database();
    $db = $database->getConnection();

    // Get user basic info
    $userQuery = "SELECT id, username, full_name, email, phone, avatar, status, role, created_at 
                  FROM users 
                  WHERE id = :user_id AND role = 'job_seeker'";
    
    $stmt = $db->prepare($userQuery);
    $stmt->bindParam(':user_id', $userId);
    $stmt->execute();
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Job seeker not found']);
        exit();
    }

    // Get job seeker profile
    $profileQuery = "SELECT * FROM job_seeker_profiles WHERE user_id = :user_id";
    $stmt = $db->prepare($profileQuery);
    $stmt->bindParam(':user_id', $userId);
    $stmt->execute();
    $profile = $stmt->fetch(PDO::FETCH_ASSOC);

    // Decode JSON fields if profile exists
    if ($profile) {
        $profile['skills'] = json_decode($profile['skills'] ?? '[]', true);
        $profile['education'] = json_decode($profile['education'] ?? '[]', true);
        $profile['certifications'] = json_decode($profile['certifications'] ?? '[]', true);
        $profile['languages'] = json_decode($profile['languages'] ?? '[]', true);
        $profile['preferred_job_types'] = json_decode($profile['preferred_job_types'] ?? '[]', true);
        $profile['preferred_locations'] = json_decode($profile['preferred_locations'] ?? '[]', true);
        $profile['preferred_categories'] = json_decode($profile['preferred_categories'] ?? '[]', true);
    }

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'data' => [
            'user' => $user,
            'profile' => $profile
        ]
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}
?>
