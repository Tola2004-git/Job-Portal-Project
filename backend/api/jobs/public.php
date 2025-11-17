<?php
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../../config/database.php';
require_once '../../config/app.php';

$database = new Database();
$db = $database->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        // Pagination parameters
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 6; // Default 6 for featured jobs
        $offset = ($page - 1) * $limit;
        
        // Build WHERE clause for filters
        $where = ["j.status = 'active'"]; // Only show active jobs
        $params = [];
        
        // Search by keyword (title, description, company name)
        if (isset($_GET['keyword']) && !empty($_GET['keyword'])) {
            $keywordRaw = trim((string) $_GET['keyword']);
            if ($keywordRaw !== '') {
                $keyword = function_exists('mb_strtolower')
                    ? mb_strtolower($keywordRaw, 'UTF-8')
                    : strtolower($keywordRaw);

                $where[] = "(LOWER(CONVERT(j.title USING utf8mb4)) LIKE :keyword
                    OR LOWER(CONVERT(j.description USING utf8mb4)) LIKE :keyword
                    OR LOWER(CONVERT(COALESCE(ep.company_name, u.full_name) USING utf8mb4)) LIKE :keyword)";
                $params[':keyword'] = '%' . $keyword . '%';
            }
        }
        
        // Filter by location
        if (isset($_GET['location']) && !empty($_GET['location'])) {
            $locationRaw = trim((string) $_GET['location']);
            if ($locationRaw !== '') {
                $location = function_exists('mb_strtolower')
                    ? mb_strtolower($locationRaw, 'UTF-8')
                    : strtolower($locationRaw);

                $where[] = "LOWER(CONVERT(j.location USING utf8mb4)) LIKE :location";
                $params[':location'] = '%' . $location . '%';
            }
        }
        
        // Filter by job type
        if (isset($_GET['jobType']) && $_GET['jobType'] !== '') {
            $jobTypeRaw = trim((string) $_GET['jobType']);
            if ($jobTypeRaw !== '') {
                $normalizedJobType = strtolower(str_replace(['_', ' '], '-', $jobTypeRaw));
                $where[] = "LOWER(REPLACE(j.job_type, ' ', '-')) = :jobType";
                $params[':jobType'] = $normalizedJobType;
            }
        }
        
        // Filter by category
        if (isset($_GET['category']) && $_GET['category'] !== '') {
            $categoryRaw = trim((string) $_GET['category']);
            if ($categoryRaw !== '') {
                $where[] = "LOWER(j.category) = :category";
                $params[':category'] = strtolower($categoryRaw);
            }
        }
        
        $whereClause = implode(' AND ', $where);
        
        // Get total count for pagination
    $countQuery = "SELECT COUNT(*) as total FROM jobs j 
               LEFT JOIN users u ON j.employer_id = u.id 
               LEFT JOIN employer_profiles ep ON ep.user_id = u.id 
                       WHERE " . $whereClause;
        $stmt = $db->prepare($countQuery);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        $total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Get jobs with employer info
                $query = "SELECT 
                    j.id,
                    j.title,
                    j.description,
                    j.location,
                    j.job_type,
                    j.category,
                    j.salary_min,
                    j.salary_max,
                    j.requirements,
                    j.created_at,
                    j.updated_at,
                    u.id as employer_id,
                                        COALESCE(ep.company_name, u.full_name) as company,
                    u.email as employer_email,
                    u.avatar as company_logo,
                    DATEDIFF(NOW(), j.created_at) as days_ago
                  FROM jobs j 
                                    LEFT JOIN users u ON j.employer_id = u.id 
                                    LEFT JOIN employer_profiles ep ON ep.user_id = u.id 
                  WHERE " . $whereClause . " 
                  ORDER BY j.created_at DESC 
                  LIMIT :limit OFFSET :offset";
        
        $stmt = $db->prepare($query);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        
        $jobs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Format the response
    $formattedJobs = array_map(function($job) {
            // Parse skills from requirements text (split by comma or newline)
            $skills = [];
            if (!empty($job['requirements'])) {
                // Split by comma or newline and get first 5
                $allSkills = array_filter(array_map('trim', preg_split('/[,\n]/', $job['requirements'])));
                $skills = array_slice($allSkills, 0, 5);
            }
            
            // Format salary range
            $salary = 'Competitive';
            if ($job['salary_min'] && $job['salary_max']) {
                $salary = '$' . number_format($job['salary_min'], 0) . ' - $' . number_format($job['salary_max'], 0);
            } elseif ($job['salary_min']) {
                $salary = '$' . number_format($job['salary_min'], 0) . '+';
            }
            
            // Format posted date
            $daysAgo = (int)$job['days_ago'];
            if ($daysAgo === 0) {
                $posted = 'Today';
            } elseif ($daysAgo === 1) {
                $posted = '1 day ago';
            } elseif ($daysAgo < 7) {
                $posted = $daysAgo . ' days ago';
            } elseif ($daysAgo < 30) {
                $weeks = floor($daysAgo / 7);
                $posted = $weeks . ($weeks === 1 ? ' week ago' : ' weeks ago');
            } else {
                $months = floor($daysAgo / 30);
                $posted = $months . ($months === 1 ? ' month ago' : ' months ago');
            }
            
            // Normalize company_logo to absolute URL when necessary
            $logoVal = '/Job Portal-logo-transparent.png'; // Default
            if (!empty($job['company_logo'])) {
                $logo = trim($job['company_logo']);
                if (!empty($logo) && $logo !== 'null') {
                    // If it's a base64 data URI or absolute URL, use as-is
                    if (preg_match('/^(data:image|https?:\/\/)/i', $logo)) {
                        $logoVal = $logo;
                    } else {
                        // It's a relative path, make it absolute
                        $logoVal = rtrim(APP_BASE_URL, '/') . '/' . ltrim($logo, '/');
                    }
                }
            }

            return [
                'id' => (int)$job['id'],
                'title' => $job['title'],
                'company' => $job['company'] ?? 'Company Name',
                'location' => $job['location'] ?? 'Remote',
                'type' => ucfirst(str_replace('-', ' ', $job['job_type'] ?? 'full-time')),
                'category' => $job['category'] ?? 'General',
                'salary' => $salary,
                'posted' => $posted,
                'logo' => $logoVal,
                'skills' => $skills,
                'description' => $job['description'] ?? ''
            ];
        }, $jobs);
        
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => [
                'jobs' => $formattedJobs,
                'pagination' => [
                    'current_page' => $page,
                    'total_pages' => ceil($total / $limit),
                    'total_jobs' => (int)$total,
                    'per_page' => $limit
                ]
            ]
        ]);
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
