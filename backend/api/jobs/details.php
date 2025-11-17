<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require_once '../../config/database.php';
require_once '../../config/app.php';
require_once __DIR__ . '/../helpers/jwt.php';

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    // Get job ID from query parameter
    if (!isset($_GET['id']) || empty($_GET['id'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Job ID is required'
        ]);
        exit();
    }

    $jobId = intval($_GET['id']);

    $database = new Database();
    $db = $database->getConnection();

    // Fetch job details with employer information and statistics
    $query = "SELECT 
                j.id,
                j.employer_id,
                j.title,
                j.description,
                j.requirements,
                j.location,
                j.salary_min,
                j.salary_max,
                j.job_type,
                j.category,
                j.status,
                j.views,
                j.created_at,
                j.updated_at,
                                COALESCE(ep.company_name, u.full_name) as company_name,
                u.email as company_email,
                u.avatar as company_logo,
                (SELECT COUNT(*) FROM applications WHERE job_id = j.id) as application_count
              FROM jobs j
                            LEFT JOIN users u ON j.employer_id = u.id
                            LEFT JOIN employer_profiles ep ON ep.user_id = u.id
              WHERE j.id = :job_id
              LIMIT 1";

    $stmt = $db->prepare($query);
    $stmt->bindParam(':job_id', $jobId, PDO::PARAM_INT);
    $stmt->execute();

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Job not found'
        ]);
        exit();
    }

    $job = $stmt->fetch(PDO::FETCH_ASSOC);

    $viewerId = null;
    $viewerRole = null;

    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $authHeader = '';
    foreach ($headers as $key => $value) {
        if (strtolower($key) === 'authorization') {
            $authHeader = $value;
            break;
        }
    }

    if (!empty($authHeader) && str_starts_with(strtolower($authHeader), 'bearer ')) {
        $token = trim(substr($authHeader, 7));
        try {
            $decoded = jwt_decode($token);
            if (is_array($decoded)) {
                $viewerId = isset($decoded['user_id']) ? (int) $decoded['user_id'] : null;
                $viewerRole = $decoded['role'] ?? null;
            }
        } catch (Exception $e) {
            // Ignore invalid token and treat as guest viewer
        }
    }

    // Create tracking table if it doesn't exist yet
    $createViewsTableSql = "CREATE TABLE IF NOT EXISTS job_views (
        id INT AUTO_INCREMENT PRIMARY KEY,
        job_id INT NOT NULL,
        user_id INT DEFAULT NULL,
        viewer_hash VARCHAR(64) DEFAULT NULL,
        last_viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_job_user (job_id, user_id),
        UNIQUE KEY uniq_job_hash (job_id, viewer_hash),
        KEY idx_job (job_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci";

    try {
        $db->exec($createViewsTableSql);
    } catch (PDOException $e) {
        // If table creation fails, continue without tracking to avoid breaking job details
    }

    $shouldIncrement = true;
    $currentViews = (int) $job['views'];

    if ($viewerId !== null && $viewerId === (int) $job['employer_id']) {
        // Employers viewing their own job should not increment views
        $shouldIncrement = false;
    }

    if ($shouldIncrement) {
        if ($viewerId !== null) {
            try {
                $checkStmt = $db->prepare("SELECT id FROM job_views WHERE job_id = :job_id AND user_id = :user_id LIMIT 1");
                $checkStmt->execute([
                    ':job_id' => $jobId,
                    ':user_id' => $viewerId
                ]);

                if ($existing = $checkStmt->fetch(PDO::FETCH_ASSOC)) {
                    $shouldIncrement = false;
                    $updateLastViewed = $db->prepare("UPDATE job_views SET last_viewed_at = NOW() WHERE id = :id");
                    $updateLastViewed->execute([':id' => $existing['id']]);
                } else {
                    $insertStmt = $db->prepare("INSERT INTO job_views (job_id, user_id) VALUES (:job_id, :user_id)");
                    $insertStmt->execute([
                        ':job_id' => $jobId,
                        ':user_id' => $viewerId
                    ]);
                }
            } catch (PDOException $e) {
                // On failure, prevent increment to avoid duplicate counts
                $shouldIncrement = false;
            }
        } else {
            $remoteAddr = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
            $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
            $viewerHash = hash('sha256', $remoteAddr . '|' . $userAgent);

            try {
                $checkStmt = $db->prepare("SELECT id FROM job_views WHERE job_id = :job_id AND viewer_hash = :viewer_hash LIMIT 1");
                $checkStmt->execute([
                    ':job_id' => $jobId,
                    ':viewer_hash' => $viewerHash
                ]);

                if ($existing = $checkStmt->fetch(PDO::FETCH_ASSOC)) {
                    $shouldIncrement = false;
                    $updateLastViewed = $db->prepare("UPDATE job_views SET last_viewed_at = NOW() WHERE id = :id");
                    $updateLastViewed->execute([':id' => $existing['id']]);
                } else {
                    $insertStmt = $db->prepare("INSERT INTO job_views (job_id, viewer_hash) VALUES (:job_id, :viewer_hash)");
                    $insertStmt->execute([
                        ':job_id' => $jobId,
                        ':viewer_hash' => $viewerHash
                    ]);
                }
            } catch (PDOException $e) {
                $shouldIncrement = false;
            }
        }
    }

    if ($shouldIncrement) {
        $updateViewQuery = "UPDATE jobs SET views = views + 1 WHERE id = :job_id";
        $updateStmt = $db->prepare($updateViewQuery);
        $updateStmt->bindParam(':job_id', $jobId, PDO::PARAM_INT);
        if ($updateStmt->execute()) {
            $currentViews++;
        }
    }

    // Format the response
    $jobData = [
        'id' => (int)$job['id'],
        'employerId' => (int)$job['employer_id'],
        'title' => $job['title'],
        'description' => $job['description'],
        'requirements' => $job['requirements'],
        'location' => $job['location'],
        'salary_min' => (int)$job['salary_min'],
        'salary_max' => (int)$job['salary_max'],
        'job_type' => $job['job_type'],
        'category' => $job['category'],
        'status' => $job['status'],
        'company_name' => $job['company_name'],
        'company_email' => $job['company_email'],
        'company_logo' => $job['company_logo'],
        'views' => $currentViews,
        'applications' => (int)$job['application_count'],
        'created_at' => $job['created_at'],
        'updated_at' => $job['updated_at']
    ];

    http_response_code(200);
    // Normalize company_logo to absolute URL when necessary
    if (!empty($jobData['company_logo'])) {
        $logo = trim($jobData['company_logo']);
        if (!empty($logo) && $logo !== 'null') {
            // If it's a base64 data URI or absolute URL, use as-is
            if (!preg_match('/^(data:image|https?:\/\/)/i', $logo)) {
                // It's a relative path, make it absolute
                $logo = rtrim(APP_BASE_URL, '/') . '/' . ltrim($logo, '/');
            }
            $jobData['company_logo'] = $logo;
        } else {
            $jobData['company_logo'] = '/Job Portal-logo-transparent.png';
        }
    } else {
        $jobData['company_logo'] = '/Job Portal-logo-transparent.png';
    }

    echo json_encode([
        'success' => true,
        'data' => $jobData
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
