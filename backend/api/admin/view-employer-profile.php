<?php
/**
 * Admin View Employer Profile API
 * GET: View detailed employer/company profile
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
                  WHERE id = :user_id AND role = 'employer'";
    
    $stmt = $db->prepare($userQuery);
    $stmt->bindParam(':user_id', $userId);
    $stmt->execute();
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Employer not found']);
        exit();
    }

    // Get employer/company profile
    $profileQuery = "SELECT * FROM employer_profiles WHERE user_id = :user_id";
    $stmt = $db->prepare($profileQuery);
    $stmt->bindParam(':user_id', $userId);
    $stmt->execute();
    $companyProfile = $stmt->fetch(PDO::FETCH_ASSOC);

    // Decode JSON fields if profile exists
    if ($companyProfile) {
        $companyProfile['benefits'] = json_decode($companyProfile['benefits'] ?? '[]', true);
        $companyProfile['social_links'] = json_decode($companyProfile['social_links'] ?? '{}', true);
    }

    // Get employer statistics
    $statsQuery = "SELECT 
                    (SELECT COUNT(*) FROM jobs WHERE employer_id = :user_id) as total_jobs,
                    (SELECT COUNT(*) FROM jobs WHERE employer_id = :user_id AND status = 'active') as active_jobs,
                    (SELECT COUNT(*) FROM applications a 
                     JOIN jobs j ON a.job_id = j.id 
                     WHERE j.employer_id = :user_id) as total_applications
                   FROM users 
                   WHERE id = :user_id";
    
    $stmt = $db->prepare($statsQuery);
    $stmt->bindParam(':user_id', $userId);
    $stmt->execute();
    $stats = $stmt->fetch(PDO::FETCH_ASSOC);

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'data' => [
            'user' => $user,
            'company_profile' => $companyProfile,
            'stats' => $stats
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
