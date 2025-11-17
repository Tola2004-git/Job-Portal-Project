<?php
/**
 * Job Seeker Profile API
 * GET: Retrieve job seeker profile
 * PUT: Update job seeker profile
 */

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: no-referrer');

require_once __DIR__ . '/../helpers/avatar.php';
require_once __DIR__ . '/../helpers/jwt.php';

// --- Helper functions for sanitization & responses ---
function respond_with_error(int $status, string $message, array $details = []): void {
    http_response_code($status);
    echo json_encode(['success' => false, 'message' => $message, 'errors' => $details]);
    exit();
}

function log_security_event(int $userId, string $event, array $context = []): void {
    $logDir = __DIR__ . '/../../logs';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0700, true);
    }
    $entry = [
        'timestamp' => date('c'),
        'user_id' => $userId,
        'event' => $event,
        'context' => $context,
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
    ];
    @file_put_contents($logDir . '/security.log', json_encode($entry) . PHP_EOL, FILE_APPEND | LOCK_EX);
}

function enforce_rate_limit(string $key, int $limit, int $windowSeconds, ?int $userId = null): void {
    $rateDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'jp_rate_limit';
    if (!is_dir($rateDir)) {
        @mkdir($rateDir, 0700, true);
    }

    $file = $rateDir . DIRECTORY_SEPARATOR . sha1($key) . '.json';
    $now = time();
    $data = ['count' => 0, 'start' => $now];

    if (file_exists($file)) {
        $raw = @file_get_contents($file);
        if ($raw !== false) {
            $decoded = json_decode($raw, true);
            if (is_array($decoded) && isset($decoded['count'], $decoded['start'])) {
                $data = $decoded;
            }
        }
    }

    if ($now - $data['start'] >= $windowSeconds) {
        $data = ['count' => 0, 'start' => $now];
    }

    if ($data['count'] >= $limit) {
        $logUser = $userId ?? 0;
        log_security_event($logUser, 'rate_limit_blocked', ['key' => $key, 'limit' => $limit, 'window' => $windowSeconds]);
        respond_with_error(429, 'Too many requests. Please try again later.');
    }

    $data['count']++;
    @file_put_contents($file, json_encode($data), LOCK_EX);
}

function sanitize_string($value, int $maxLength = 255): string {
    $value = trim(strip_tags((string) $value));
    if ($value === '') {
        return '';
    }
    if (strlen($value) > $maxLength) {
        $value = substr($value, 0, $maxLength);
    }
    return $value;
}

function sanitize_url($value): ?string {
    $value = trim((string) $value);
    if ($value === '') {
        return null;
    }
    $sanitized = filter_var($value, FILTER_SANITIZE_URL);
    return filter_var($sanitized, FILTER_VALIDATE_URL) ? $sanitized : null;
}

function sanitize_phone($value, int $maxLength = 30): string {
    $value = preg_replace('/[^0-9+\-()\s]/', '', (string) $value);
    $value = trim($value);
    if (strlen($value) > $maxLength) {
        $value = substr($value, 0, $maxLength);
    }
    return $value;
}

function sanitize_string_array($value, int $maxItems = 50, int $maxLength = 120): array {
    if (is_string($value)) {
        $value = array_map('trim', explode(',', $value));
    }
    if (!is_array($value)) {
        return [];
    }
    $clean = [];
    foreach ($value as $entry) {
        $entry = sanitize_string($entry, $maxLength);
        if ($entry !== '' && !in_array($entry, $clean, true)) {
            $clean[] = $entry;
        }
        if (count($clean) >= $maxItems) {
            break;
        }
    }
    return $clean;
}

function sanitize_location($value): array {
    if (is_array($value)) {
        return sanitize_string_array($value, 10, 120);
    }
    $single = sanitize_string($value, 120);
    return $single !== '' ? [$single] : [];
}

function sanitize_avatar_payload($value, array &$errors): ?string {
    $value = trim((string) $value);
    if ($value === '') {
        return null;
    }
    if (!preg_match('/^data:image\/(png|jpg|jpeg|gif|webp|svg\+xml);base64,/', $value)) {
        $errors['avatar'] = 'Avatar must be a base64 encoded PNG, JPG, JPEG, GIF, WEBP, or SVG image.';
        return null;
    }
    return $value;
}

function sanitize_profile_payload(array $payload): array {
    $clean = [];
    $errors = [];

    if (isset($payload['name'])) {
        $clean['name'] = sanitize_string($payload['name'], 120);
        if ($clean['name'] === '') {
            $errors['name'] = 'Name cannot be empty.';
        }
    }

    if (isset($payload['full_name'])) {
        $clean['full_name'] = sanitize_string($payload['full_name'], 120);
        if ($clean['full_name'] === '') {
            $errors['full_name'] = 'Full name cannot be empty.';
        }
    }

    if (isset($payload['email'])) {
        $email = filter_var(trim((string) $payload['email']), FILTER_SANITIZE_EMAIL);
        if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'Invalid email address.';
        } else {
            $clean['email'] = $email;
        }
    }

    if (isset($payload['phone'])) {
        $clean['phone'] = sanitize_phone($payload['phone']);
    }

    if (isset($payload['title'])) {
        $clean['title'] = sanitize_string($payload['title'], 150);
    }

    if (isset($payload['bio'])) {
        $clean['bio'] = sanitize_string($payload['bio'], 2000);
    }

    if (isset($payload['skills'])) {
        $clean['skills'] = sanitize_string_array($payload['skills']);
    }

    if (isset($payload['experience_level'])) {
        $clean['experience_level'] = sanitize_string($payload['experience_level'], 80);
    }

    if (isset($payload['location'])) {
        $clean['location'] = sanitize_location($payload['location']);
    }

    if (isset($payload['portfolio_url'])) {
        $portfolio = sanitize_url($payload['portfolio_url']);
        if ($portfolio === null && trim((string) $payload['portfolio_url']) !== '') {
            $errors['portfolio_url'] = 'Invalid portfolio URL.';
        } else {
            $clean['portfolio_url'] = $portfolio;
        }
    }

    if (isset($payload['linkedin_url'])) {
        $linkedin = sanitize_url($payload['linkedin_url']);
        if ($linkedin === null && trim((string) $payload['linkedin_url']) !== '') {
            $errors['linkedin_url'] = 'Invalid LinkedIn URL.';
        } else {
            $clean['linkedin_url'] = $linkedin;
        }
    }

    if (isset($payload['github_url'])) {
        $github = sanitize_url($payload['github_url']);
        if ($github === null && trim((string) $payload['github_url']) !== '') {
            $errors['github_url'] = 'Invalid GitHub URL.';
        } else {
            $clean['github_url'] = $github;
        }
    }

    if (isset($payload['website_url'])) {
        $website = sanitize_url($payload['website_url']);
        if ($website === null && trim((string) $payload['website_url']) !== '') {
            $errors['website_url'] = 'Invalid website URL.';
        } else {
            $clean['website_url'] = $website;
        }
    }

    if (isset($payload['availability'])) {
        $clean['availability'] = sanitize_string($payload['availability'], 60);
    }

    if (isset($payload['salary_min'])) {
        $salaryMin = filter_var($payload['salary_min'], FILTER_SANITIZE_NUMBER_FLOAT, FILTER_FLAG_ALLOW_FRACTION);
        $clean['salary_min'] = $salaryMin !== '' ? (float) $salaryMin : null;
    }

    if (isset($payload['salary_max'])) {
        $salaryMax = filter_var($payload['salary_max'], FILTER_SANITIZE_NUMBER_FLOAT, FILTER_FLAG_ALLOW_FRACTION);
        $clean['salary_max'] = $salaryMax !== '' ? (float) $salaryMax : null;
    }

    if (isset($payload['avatar'])) {
        $avatar = sanitize_avatar_payload($payload['avatar'], $errors);
        if ($avatar !== null) {
            $clean['avatar'] = $avatar;
        }
    }

    return [$clean, $errors];
}

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../config/database.php';

try {
    // Get JWT token from Authorization header
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    
    if (!$authHeader) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'No authorization token provided']);
        exit();
    }

    // Decode JWT token
    $token = str_replace('Bearer ', '', $authHeader);
    try {
        $decoded = jwt_decode($token);
    } catch (Exception $e) {
        respond_with_error(401, $e->getMessage());
    }

    if (($decoded['role'] ?? '') !== 'job_seeker') {
        respond_with_error(403, 'Forbidden: role not permitted.');
    }

    $userId = $decoded['user_id'];

    // Database connection
    $database = new Database();
    $db = $database->getConnection();

    // Apply rate limiting (per user & method)
    enforce_rate_limit('jobseeker_profile_' . $userId . '_requests', 120, 60, $userId); // overall burst protection

    // GET: Retrieve profile
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        enforce_rate_limit('jobseeker_profile_' . $userId . '_get', 60, 60, $userId);
        // Get user basic info
        $userQuery = "SELECT id, username, full_name, email, phone, avatar, created_at 
                      FROM users 
                      WHERE id = :user_id";
        $stmt = $db->prepare($userQuery);
        $stmt->bindParam(':user_id', $userId);
        $stmt->execute();
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        // Fallback to default avatar if missing or not base64 image
        if ($user) {
            $user['avatar'] = normalize_avatar_field($user['avatar'] ?? null);
        }
        if (!$user) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'User not found']);
            exit();
        }

        // Get or create profile
        $profileQuery = "SELECT * FROM job_seeker_profiles WHERE user_id = :user_id";
        $stmt = $db->prepare($profileQuery);
        $stmt->bindParam(':user_id', $userId);
        $stmt->execute();
        $profile = $stmt->fetch(PDO::FETCH_ASSOC);

        // If no profile exists, create default one
        if (!$profile) {
            $createQuery = "INSERT INTO job_seeker_profiles 
                (user_id, title, bio, skills, experience_years, education, certifications, 
                 languages, preferred_job_types, preferred_locations, preferred_categories,
                 salary_min, salary_max, availability, willing_to_relocate,
                 portfolio_url, linkedin_url, github_url, website_url, resume_path,
                 profile_views, total_applications, successful_applications) 
                VALUES 
                (:user_id, :title, :bio, :skills, :experience_years, :education, :certifications,
                 :languages, :preferred_job_types, :preferred_locations, :preferred_categories,
                 :salary_min, :salary_max, :availability, :willing_to_relocate,
                 :portfolio_url, :linkedin_url, :github_url, :website_url, :resume_path,
                 :profile_views, :total_applications, :successful_applications)";
            
            $stmt = $db->prepare($createQuery);
            
            // Default values
            $defaultTitle = 'Job Seeker';
            $defaultBio = '';
            $defaultSkills = json_encode([]);
            $defaultExperienceYears = 0;
            $defaultEducation = json_encode([]);
            $defaultCertifications = json_encode([]);
            $defaultLanguages = json_encode([]);
            $defaultPreferredJobTypes = json_encode([]);
            $defaultPreferredLocations = json_encode([]);
            $defaultPreferredCategories = json_encode([]);
            $defaultSalaryMin = null;
            $defaultSalaryMax = null;
            $defaultAvailability = 'Available';
            $defaultWillingToRelocate = 0;
            $defaultPortfolioUrl = null;
            $defaultLinkedinUrl = null;
            $defaultGithubUrl = null;
            $defaultWebsiteUrl = null;
            $defaultResumePath = null;
            $defaultProfileViews = 0;
            $defaultTotalApplications = 0;
            $defaultSuccessfulApplications = 0;
            
            $stmt->bindParam(':user_id', $userId);
            $stmt->bindParam(':title', $defaultTitle);
            $stmt->bindParam(':bio', $defaultBio);
            $stmt->bindParam(':skills', $defaultSkills);
            $stmt->bindParam(':experience_years', $defaultExperienceYears);
            $stmt->bindParam(':education', $defaultEducation);
            $stmt->bindParam(':certifications', $defaultCertifications);
            $stmt->bindParam(':languages', $defaultLanguages);
            $stmt->bindParam(':preferred_job_types', $defaultPreferredJobTypes);
            $stmt->bindParam(':preferred_locations', $defaultPreferredLocations);
            $stmt->bindParam(':preferred_categories', $defaultPreferredCategories);
            $stmt->bindParam(':salary_min', $defaultSalaryMin);
            $stmt->bindParam(':salary_max', $defaultSalaryMax);
            $stmt->bindParam(':availability', $defaultAvailability);
            $stmt->bindParam(':willing_to_relocate', $defaultWillingToRelocate);
            $stmt->bindParam(':portfolio_url', $defaultPortfolioUrl);
            $stmt->bindParam(':linkedin_url', $defaultLinkedinUrl);
            $stmt->bindParam(':github_url', $defaultGithubUrl);
            $stmt->bindParam(':website_url', $defaultWebsiteUrl);
            $stmt->bindParam(':resume_path', $defaultResumePath);
            $stmt->bindParam(':profile_views', $defaultProfileViews);
            $stmt->bindParam(':total_applications', $defaultTotalApplications);
            $stmt->bindParam(':successful_applications', $defaultSuccessfulApplications);
            
            $stmt->execute();
            
            // Fetch the newly created profile
            $stmt = $db->prepare($profileQuery);
            $stmt->bindParam(':user_id', $userId);
            $stmt->execute();
            $profile = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        // Decode JSON fields
        $profile['skills'] = json_decode($profile['skills'] ?? '[]', true);
        $profile['education'] = json_decode($profile['education'] ?? '[]', true);
        $profile['certifications'] = json_decode($profile['certifications'] ?? '[]', true);
        $profile['languages'] = json_decode($profile['languages'] ?? '[]', true);
        $profile['preferred_job_types'] = json_decode($profile['preferred_job_types'] ?? '[]', true);
        $profile['preferred_locations'] = json_decode($profile['preferred_locations'] ?? '[]', true);
        $profile['preferred_categories'] = json_decode($profile['preferred_categories'] ?? '[]', true);

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => [
                'user' => $user,
                'profile' => $profile
            ]
        ]);
        exit();
    }

    // PUT: Update profile
    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        enforce_rate_limit('jobseeker_profile_' . $userId . '_put', 20, 120, $userId);
        $contentType = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
        if (stripos($contentType, 'application/json') === false) {
            respond_with_error(415, 'Content-Type must be application/json.');
        }
        $rawJson = file_get_contents("php://input");
        $data = json_decode($rawJson, true);
        if (!is_array($data)) {
            log_security_event($userId, 'invalid_json_payload', ['raw' => $rawJson]);
            respond_with_error(400, 'Invalid JSON payload.');
        }

        [$data, $validationErrors] = sanitize_profile_payload($data);
        if (!empty($validationErrors)) {
                log_security_event($userId, 'profile_validation_failed', ['errors' => $validationErrors]);
            respond_with_error(422, 'Invalid profile data provided.', $validationErrors);
        }

        // Update user basic info if provided
        if (isset($data['name']) || isset($data['full_name']) || isset($data['email']) || isset($data['phone']) || isset($data['avatar'])) {
            $userUpdates = [];
            $userParams = [':user_id' => $userId];

            // Handle name field - map to full_name
            if (isset($data['name'])) {
                $userUpdates[] = "full_name = :full_name";
                $userParams[':full_name'] = $data['name'];
            } else if (isset($data['full_name'])) {
                $userUpdates[] = "full_name = :full_name";
                $userParams[':full_name'] = $data['full_name'];
            }
            if (isset($data['email'])) {
                $userUpdates[] = "email = :email";
                $userParams[':email'] = $data['email'];
            }
            if (isset($data['phone'])) {
                $userUpdates[] = "phone = :phone";
                $userParams[':phone'] = $data['phone'];
            }
            if (isset($data['avatar'])) {
                $userUpdates[] = "avatar = :avatar";
                $userParams[':avatar'] = $data['avatar'];
            }

            if (!empty($userUpdates)) {
                $userUpdateQuery = "UPDATE users SET " . implode(', ', $userUpdates) . ", updated_at = NOW() WHERE id = :user_id";
                $stmt = $db->prepare($userUpdateQuery);
                $stmt->execute($userParams);
            }
        }

        // Update or create profile
        $profileQuery = "SELECT id FROM job_seeker_profiles WHERE user_id = :user_id";
        $stmt = $db->prepare($profileQuery);
        $stmt->bindParam(':user_id', $userId);
        $stmt->execute();
        $profileExists = $stmt->fetch(PDO::FETCH_ASSOC);

        $profileUpdates = [];
        $profileParams = [':user_id' => $userId];

        // Map frontend fields to database fields
        $fieldMapping = [
            'title' => 'title',
            'bio' => 'bio',
            'skills' => 'skills',
            'experience_level' => 'experience_years', // Convert level to years
            'location' => 'preferred_locations', // Store as array
            'portfolio_url' => 'portfolio_url',
            'linkedin_url' => 'linkedin_url',
            'github_url' => 'github_url',
            'website_url' => 'website_url',
            'availability' => 'availability',
            'salary_min' => 'salary_min',
            'salary_max' => 'salary_max'
        ];

        foreach ($fieldMapping as $frontendField => $dbField) {
            if (isset($data[$frontendField])) {
                $value = $data[$frontendField];
                
                // Convert experience level to years
                if ($frontendField === 'experience_level') {
                    if (strpos($value, 'Entry') !== false) $value = 1;
                    elseif (strpos($value, 'Mid') !== false) $value = 4;
                    elseif (strpos($value, 'Senior') !== false) $value = 7;
                    elseif (strpos($value, 'Expert') !== false) $value = 10;
                    else $value = 0;
                }
                
                // Convert arrays to JSON
                if (is_array($value)) {
                    $value = json_encode($value);
                } elseif ($frontendField === 'location' && is_string($value)) {
                    // Convert location string to array
                    $value = json_encode([$value]);
                }
                
                $profileUpdates[] = "$dbField = :$dbField";
                $profileParams[":$dbField"] = $value;
            }
        }

        if (!empty($profileUpdates)) {
            if ($profileExists) {
                // Update existing profile
                $updateQuery = "UPDATE job_seeker_profiles 
                               SET " . implode(', ', $profileUpdates) . ", updated_at = NOW() 
                               WHERE user_id = :user_id";
                $stmt = $db->prepare($updateQuery);
                $stmt->execute($profileParams);
            } else {
                // Create new profile with provided values
                $fields = array_keys($profileParams);
                $placeholders = ':' . implode(', :', array_keys($profileParams));
                
                $insertQuery = "INSERT INTO job_seeker_profiles (" . implode(', ', $fields) . ") 
                               VALUES (" . $placeholders . ")";
                $stmt = $db->prepare($insertQuery);
                $stmt->execute($profileParams);
            }
            log_security_event($userId, 'profile_updated', ['fields' => array_keys($profileParams)]);
        }

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Profile updated successfully'
        ]);
        exit();
    }

    // Invalid method
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);

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
