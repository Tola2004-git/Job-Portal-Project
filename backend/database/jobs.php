<?php
error_reporting(E_ALL);
ini_set("display_errors", 1);

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit();
}

require_once "../../config/database.php";

$headers = apache_request_headers();
$authHeader = isset($headers["Authorization"]) ? $headers["Authorization"] : "";

if (empty($authHeader)) {
    http_response_code(401);
    echo json_encode(["success" => false, "error" => "No token"]);
    exit();
}

$token = str_replace("Bearer ", "", $authHeader);
$tokenData = json_decode(base64_decode($token), true);

if (!$tokenData || $tokenData["role"] !== "admin") {
    http_response_code(403);
    echo json_encode(["success" => false, "error" => "Admin only"]);
    exit();
}

try {
    $database = new Database();
    $db = $database->getConnection();
    $method = $_SERVER["REQUEST_METHOD"];
    
    if ($method === "GET") {
        $page = isset($_GET["page"]) ? (int)$_GET["page"] : 1;
        $limit = isset($_GET["limit"]) ? (int)$_GET["limit"] : 10;
        $status = isset($_GET["status"]) ? $_GET["status"] : "";
        $job_type = isset($_GET["job_type"]) ? $_GET["job_type"] : "";
        $search = isset($_GET["search"]) ? $_GET["search"] : "";
        
        $offset = ($page - 1) * $limit;
        
        $where = ["1=1"];
        $params = [];
        
        if ($status) {
            $where[] = "j.status = :status";
            $params[":status"] = $status;
        }
        if ($job_type) {
            $where[] = "j.job_type = :job_type";
            $params[":job_type"] = $job_type;
        }
        if ($search) {
            $where[] = "(j.title LIKE :search OR j.description LIKE :search OR j.location LIKE :search)";
            $params[":search"] = "%" . $search . "%";
        }
        
        $whereClause = implode(" AND ", $where);
        
        $countQuery = "SELECT COUNT(*) as total FROM jobs j WHERE " . $whereClause;
        $countStmt = $db->prepare($countQuery);
        $countStmt->execute($params);
        $total = $countStmt->fetch(PDO::FETCH_ASSOC)["total"];
        
        $query = "SELECT j.*, u.full_name as employer_name, u.email as employer_email 
            FROM jobs j 
            LEFT JOIN users u ON j.employer_id = u.id 
            WHERE " . $whereClause . " 
            ORDER BY j.created_at DESC 
            LIMIT :limit OFFSET :offset";
        $stmt = $db->prepare($query);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(":limit", $limit, PDO::PARAM_INT);
        $stmt->bindValue(":offset", $offset, PDO::PARAM_INT);
        $stmt->execute();
        $jobs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        http_response_code(200);
        echo json_encode([
            "success" => true,
            "data" => [
                "jobs" => $jobs,
                "pagination" => [
                    "page" => $page,
                    "limit" => $limit,
                    "total" => (int)$total,
                    "pages" => ceil($total / $limit)
                ]
            ]
        ]);
    }
    elseif ($method === "POST") {
        $input = json_decode(file_get_contents("php://input"), true);
        
        $title = $input["title"] ?? null;
        $description = $input["description"] ?? null;
        $employer_id = $input["employer_id"] ?? null;
        
        if (!$title || !$description || !$employer_id) {
            http_response_code(400);
            echo json_encode(["success" => false, "error" => "Title, description, and employer_id required"]);
            exit();
        }
        
        $insertQuery = "INSERT INTO jobs (employer_id, title, description, requirements, location, salary_min, salary_max, job_type, category, status) 
            VALUES (:employer_id, :title, :description, :requirements, :location, :salary_min, :salary_max, :job_type, :category, :status)";
        $stmt = $db->prepare($insertQuery);
        $stmt->execute([
            ":employer_id" => $employer_id,
            ":title" => $title,
            ":description" => $description,
            ":requirements" => $input["requirements"] ?? null,
            ":location" => $input["location"] ?? null,
            ":salary_min" => $input["salary_min"] ?? null,
            ":salary_max" => $input["salary_max"] ?? null,
            ":job_type" => $input["job_type"] ?? "full-time",
            ":category" => $input["category"] ?? null,
            ":status" => $input["status"] ?? "draft"
        ]);
        
        http_response_code(201);
        echo json_encode(["success" => true, "message" => "Job created", "id" => $db->lastInsertId()]);
    }
    elseif ($method === "PUT") {
        $input = json_decode(file_get_contents("php://input"), true);
        $jobId = $input["id"] ?? null;
        
        if (!$jobId) {
            http_response_code(400);
            echo json_encode(["success" => false, "error" => "Job ID required"]);
            exit();
        }
        
        $updates = [];
        $params = [":id" => $jobId];
        
        if (isset($input["status"])) {
            $updates[] = "status = :status";
            $params[":status"] = $input["status"];
        }
        if (isset($input["title"])) {
            $updates[] = "title = :title";
            $params[":title"] = $input["title"];
        }
        if (isset($input["description"])) {
            $updates[] = "description = :description";
            $params[":description"] = $input["description"];
        }
        if (isset($input["location"])) {
            $updates[] = "location = :location";
            $params[":location"] = $input["location"];
        }
        if (isset($input["salary_min"])) {
            $updates[] = "salary_min = :salary_min";
            $params[":salary_min"] = $input["salary_min"];
        }
        if (isset($input["salary_max"])) {
            $updates[] = "salary_max = :salary_max";
            $params[":salary_max"] = $input["salary_max"];
        }
        
        if (empty($updates)) {
            http_response_code(400);
            echo json_encode(["success" => false, "error" => "No updates provided"]);
            exit();
        }
        
        $updateQuery = "UPDATE jobs SET " . implode(", ", $updates) . " WHERE id = :id";
        $stmt = $db->prepare($updateQuery);
        $stmt->execute($params);
        
        http_response_code(200);
        echo json_encode(["success" => true, "message" => "Job updated"]);
    }
    elseif ($method === "DELETE") {
        $jobId = $_GET["id"] ?? null;
        
        if (!$jobId) {
            http_response_code(400);
            echo json_encode(["success" => false, "error" => "Job ID required"]);
            exit();
        }
        
        $deleteQuery = "DELETE FROM jobs WHERE id = :id";
        $stmt = $db->prepare($deleteQuery);
        $stmt->execute([":id" => $jobId]);
        
        http_response_code(200);
        echo json_encode(["success" => true, "message" => "Job deleted"]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
