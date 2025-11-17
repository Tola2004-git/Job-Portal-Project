<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: GET, POST, PUT');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../../config/database.php';
require_once __DIR__ . '/../helpers/avatar.php';
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

// GET - Retrieve employer profile
if ($method === 'GET') {
    try {
        // Get user basic info
        $userQuery = "SELECT id, username, full_name, email, avatar, phone, bio, created_at 
                      FROM users WHERE id = :user_id AND role = 'employer'";
        $userStmt = $db->prepare($userQuery);
        $userStmt->bindParam(':user_id', $userId);
        $userStmt->execute();
        $user = $userStmt->fetch(PDO::FETCH_ASSOC);
        if ($user) {
            $user['avatar'] = normalize_avatar_field($user['avatar'] ?? null);
        }
        if (!$user) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'User not found']);
            exit();
        }
        
        // Get employer profile
        $profileQuery = "SELECT * FROM employer_profiles WHERE user_id = :user_id";
        $profileStmt = $db->prepare($profileQuery);
        $profileStmt->bindParam(':user_id', $userId);
        $profileStmt->execute();
        $profile = $profileStmt->fetch(PDO::FETCH_ASSOC);
        
        // If no profile exists, create default one
        if (!$profile) {
            $defaultProfile = [
                'user_id' => $userId,
                'company_name' => $user['full_name'] ?: 'My Company',
                'industry' => 'technology',
                'company_size' => '1-10',
                'website' => '',
                'description' => '',
                'email' => $user['email'],
                'phone' => $user['phone'] ?: '',
                'address' => '',
                'linkedin' => '',
                'twitter' => '',
                'facebook' => '',
                'instagram' => '',
                'work_type' => 'onsite',
                'experience_level' => 'entry',
                'avg_salary' => '',
                'turnover_rate' => 0,
                'team_size' => 0,
                'founded_year' => date('Y'),
                'benefits' => json_encode([
                    'health' => false,
                    'dental' => false,
                    'retirement' => false,
                    'stock' => false,
                    'flexible' => false,
                    'remote' => false,
                    'gym' => false,
                    'development' => false
                ]),
                'locations' => json_encode([]),
                'core_values' => json_encode([]),
                'active_jobs' => 0,
                'total_applications' => 0,
                'successful_hires' => 0,
                'rating' => 0.00
            ];
            
            $insertQuery = "INSERT INTO employer_profiles (
                user_id, company_name, industry, company_size, website, description,
                email, phone, address, linkedin, twitter, facebook, instagram,
                work_type, experience_level, avg_salary, turnover_rate, team_size, founded_year,
                benefits, locations, core_values, active_jobs, total_applications, successful_hires, rating
            ) VALUES (
                :user_id, :company_name, :industry, :company_size, :website, :description,
                :email, :phone, :address, :linkedin, :twitter, :facebook, :instagram,
                :work_type, :experience_level, :avg_salary, :turnover_rate, :team_size, :founded_year,
                :benefits, :locations, :core_values, :active_jobs, :total_applications, :successful_hires, :rating
            )";
            
            $insertStmt = $db->prepare($insertQuery);
            foreach ($defaultProfile as $key => $value) {
                $insertStmt->bindValue(':' . $key, $value);
            }
            $insertStmt->execute();
            
            // Fetch the newly created profile
            $profileStmt->execute();
            $profile = $profileStmt->fetch(PDO::FETCH_ASSOC);
        }
        
        // Parse JSON fields
        if ($profile) {
            $profile['benefits'] = json_decode($profile['benefits'], true) ?: [];
            $profile['locations'] = json_decode($profile['locations'], true) ?: [];
            $profile['core_values'] = json_decode($profile['core_values'], true) ?: [];
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
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
}

// PUT - Update employer profile
elseif ($method === 'PUT') {
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid input data']);
            exit();
        }
        
        // Update user table (basic info)
        if (isset($data['full_name']) || isset($data['email']) || isset($data['phone']) || isset($data['bio']) || isset($data['avatar'])) {
            $updateUserFields = [];
            $userParams = [':user_id' => $userId];
            
            if (isset($data['full_name'])) {
                $updateUserFields[] = "full_name = :full_name";
                $userParams[':full_name'] = $data['full_name'];
            }
            if (isset($data['email'])) {
                // Check if email already exists for another user
                $checkEmailQuery = "SELECT id FROM users WHERE email = :email AND id != :user_id";
                $checkStmt = $db->prepare($checkEmailQuery);
                $checkStmt->bindParam(':email', $data['email']);
                $checkStmt->bindParam(':user_id', $userId);
                $checkStmt->execute();
                if ($checkStmt->fetch()) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Email already exists']);
                    exit();
                }
                $updateUserFields[] = "email = :email";
                $userParams[':email'] = $data['email'];
            }
            if (isset($data['phone'])) {
                $updateUserFields[] = "phone = :phone";
                $userParams[':phone'] = $data['phone'];
            }
            if (isset($data['bio'])) {
                $updateUserFields[] = "bio = :bio";
                $userParams[':bio'] = $data['bio'];
            }
            if (isset($data['avatar'])) {
                $updateUserFields[] = "avatar = :avatar";
                $userParams[':avatar'] = $data['avatar'];
            }
            
            if (!empty($updateUserFields)) {
                $updateUserQuery = "UPDATE users SET " . implode(', ', $updateUserFields) . ", updated_at = NOW() WHERE id = :user_id";
                $updateUserStmt = $db->prepare($updateUserQuery);
                foreach ($userParams as $key => $value) {
                    $updateUserStmt->bindValue($key, $value);
                }
                $updateUserStmt->execute();
            }
        }
        
        // Update employer_profiles table
        $updateProfileFields = [];
        $profileParams = [':user_id' => $userId];
        
        $profileFieldMapping = [
            'company_name' => 'company_name',
            'name' => 'company_name', // Allow 'name' to map to 'company_name'
            'industry' => 'industry',
            'company_size' => 'company_size',
            'size' => 'company_size', // Allow 'size' to map to 'company_size'
            'website' => 'website',
            'description' => 'description',
            'email' => 'email',
            'phone' => 'phone',
            'address' => 'address',
            'linkedin' => 'linkedin',
            'twitter' => 'twitter',
            'facebook' => 'facebook',
            'instagram' => 'instagram',
            'work_type' => 'work_type',
            'workType' => 'work_type',
            'experience_level' => 'experience_level',
            'experienceLevel' => 'experience_level',
            'avg_salary' => 'avg_salary',
            'avgSalary' => 'avg_salary',
            'turnover_rate' => 'turnover_rate',
            'turnoverRate' => 'turnover_rate',
            'team_size' => 'team_size',
            'teamSize' => 'team_size',
            'founded_year' => 'founded_year',
            'foundedYear' => 'founded_year',
            'active_jobs' => 'active_jobs',
            'activeJobs' => 'active_jobs',
            'total_applications' => 'total_applications',
            'totalApplications' => 'total_applications',
            'successful_hires' => 'successful_hires',
            'successfulHires' => 'successful_hires',
            'rating' => 'rating'
        ];
        
        foreach ($profileFieldMapping as $inputKey => $dbField) {
            if (isset($data[$inputKey])) {
                $updateProfileFields[] = "$dbField = :$dbField";
                $profileParams[":$dbField"] = $data[$inputKey];
            }
        }
        
        // Handle JSON fields
        if (isset($data['benefits'])) {
            $updateProfileFields[] = "benefits = :benefits";
            $profileParams[':benefits'] = is_string($data['benefits']) ? $data['benefits'] : json_encode($data['benefits']);
        }
        if (isset($data['locations'])) {
            $updateProfileFields[] = "locations = :locations";
            $profileParams[':locations'] = is_string($data['locations']) ? $data['locations'] : json_encode($data['locations']);
        }
        if (isset($data['core_values']) || isset($data['coreValues'])) {
            $updateProfileFields[] = "core_values = :core_values";
            $coreValues = $data['core_values'] ?? $data['coreValues'];
            $profileParams[':core_values'] = is_string($coreValues) ? $coreValues : json_encode($coreValues);
        }
        
        if (!empty($updateProfileFields)) {
            $updateProfileQuery = "UPDATE employer_profiles SET " . implode(', ', $updateProfileFields) . " WHERE user_id = :user_id";
            $updateProfileStmt = $db->prepare($updateProfileQuery);
            foreach ($profileParams as $key => $value) {
                $updateProfileStmt->bindValue($key, $value);
            }
            $updateProfileStmt->execute();
        }
        
        // Return updated profile
        $profileQuery = "SELECT * FROM employer_profiles WHERE user_id = :user_id";
        $profileStmt = $db->prepare($profileQuery);
        $profileStmt->bindParam(':user_id', $userId);
        $profileStmt->execute();
        $profile = $profileStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($profile) {
            $profile['benefits'] = json_decode($profile['benefits'], true) ?: [];
            $profile['locations'] = json_decode($profile['locations'], true) ?: [];
            $profile['core_values'] = json_decode($profile['core_values'], true) ?: [];
        }
        
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Profile updated successfully',
            'data' => ['profile' => $profile]
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
}

// Method not allowed
else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}
?>
