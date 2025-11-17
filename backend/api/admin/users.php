<?php
error_reporting(E_ALL);
ini_set("display_errors", 1);

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: GET, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit();
}

require_once "../../config/database.php";
require_once "../../config/app.php";
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
    $tokenData = jwt_decode($token);
    if (($tokenData['role'] ?? '') !== 'admin') {
        throw new Exception('Admin only', 403);
    }
} catch (Exception $e) {
    $status = $e->getCode() === 403 ? 403 : 401;
    http_response_code($status);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    exit();
}

try {
    $database = new Database();
    $db = $database->getConnection();
    $method = $_SERVER["REQUEST_METHOD"];
    
    if ($method === "GET") {
        $page = isset($_GET["page"]) ? (int)$_GET["page"] : 1;
        $limit = isset($_GET["limit"]) ? (int)$_GET["limit"] : 10;
        $role = isset($_GET["role"]) ? $_GET["role"] : "";
        $status = isset($_GET["status"]) ? $_GET["status"] : "";
        $search = isset($_GET["search"]) ? $_GET["search"] : "";
        
        $offset = ($page - 1) * $limit;
        
        $where = ["1=1"];
        $params = [];
        
        if ($role) {
            $where[] = "role = :role";
            $params[":role"] = $role;
        }
        if ($status) {
            $where[] = "status = :status";
            $params[":status"] = $status;
        }
        if ($search) {
            $where[] = "(full_name LIKE :search OR email LIKE :search OR username LIKE :search)";
            $params[":search"] = "%" . $search . "%";
        }
        
        $whereClause = implode(" AND ", $where);
        
        $countQuery = "SELECT COUNT(*) as total FROM users WHERE " . $whereClause;
        $countStmt = $db->prepare($countQuery);
        $countStmt->execute($params);
        $total = $countStmt->fetch(PDO::FETCH_ASSOC)["total"];
        
        $query = "SELECT id, username, full_name, email, role, status, created_at, updated_at FROM users WHERE " . $whereClause . " ORDER BY created_at DESC LIMIT :limit OFFSET :offset";
        $stmt = $db->prepare($query);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(":limit", $limit, PDO::PARAM_INT);
        $stmt->bindValue(":offset", $offset, PDO::PARAM_INT);
        $stmt->execute();
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        http_response_code(200);
        echo json_encode([
            "success" => true,
            "data" => [
                "users" => $users,
                "pagination" => [
                    "page" => $page,
                    "limit" => $limit,
                    "total" => (int)$total,
                    "pages" => ceil($total / $limit)
                ]
            ]
        ]);
    }
    elseif ($method === "PUT") {
        $input = json_decode(file_get_contents("php://input"), true);
        $userId = $input["id"] ?? null;
        
        if (!$userId) {
            http_response_code(400);
            echo json_encode(["success" => false, "error" => "User ID required"]);
            exit();
        }
        
        $updates = [];
        $params = [":id" => $userId];
        
        if (isset($input["status"])) {
            $updates[] = "status = :status";
            $params[":status"] = $input["status"];
        }
        if (isset($input["role"])) {
            $updates[] = "role = :role";
            $params[":role"] = $input["role"];
        }
        
        if (empty($updates)) {
            http_response_code(400);
            echo json_encode(["success" => false, "error" => "No updates provided"]);
            exit();
        }
        
        $updateQuery = "UPDATE users SET " . implode(", ", $updates) . " WHERE id = :id";
        $stmt = $db->prepare($updateQuery);
        $stmt->execute($params);
        
        http_response_code(200);
        echo json_encode(["success" => true, "message" => "User updated"]);
    }
    elseif ($method === "DELETE") {
        $userId = $_GET["id"] ?? null;
        
        if (!$userId) {
            http_response_code(400);
            echo json_encode(["success" => false, "error" => "User ID required"]);
            exit();
        }
        
        $deleteQuery = "DELETE FROM users WHERE id = :id";
        $stmt = $db->prepare($deleteQuery);
        $stmt->execute([":id" => $userId]);
        
        http_response_code(200);
        echo json_encode(["success" => true, "message" => "User deleted"]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
