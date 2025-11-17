<?php
/**
 * Admin - Messages Management API
 * GET: List all messages (inbox/sent)
 * POST: Send message
 * PUT: Mark message as read
 * DELETE: Delete message
 */

// CORS Headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
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
    $adminId = (int) $tokenData['user_id'];
    
    $method = $_SERVER['REQUEST_METHOD'];
    
    // GET - List messages
    if ($method === 'GET') {
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
        $offset = ($page - 1) * $limit;
        
        $type = isset($_GET['type']) ? $_GET['type'] : 'all'; // all, inbox, sent
        $status = isset($_GET['status']) ? $_GET['status'] : null; // read, unread
        $search = isset($_GET['search']) ? $_GET['search'] : null;
        
        // Build query
        $query = "SELECT 
                    m.id,
                    m.from_user_id,
                    m.to_user_id,
                    m.subject,
                    m.message,
                    m.type,
                    m.status,
                    m.created_at,
                    m.read_at,
                    sender.full_name as sender_name,
                    sender.email as sender_email,
                    sender.role as sender_role,
                    receiver.full_name as receiver_name,
                    receiver.email as receiver_email,
                    receiver.role as receiver_role
                  FROM messages m
                  LEFT JOIN users sender ON m.from_user_id = sender.id
                  LEFT JOIN users receiver ON m.to_user_id = receiver.id
                  WHERE 1=1";
        
        $params = [];
        
        // Filter by type
        if ($type === 'inbox') {
            $query .= " AND m.to_user_id = :admin_id AND m.type = 'inbox'";
            $params[':admin_id'] = $adminId;
        } elseif ($type === 'sent') {
            $query .= " AND m.from_user_id = :admin_id AND m.type = 'sent'";
            $params[':admin_id'] = $adminId;
        } else {
            // Show all messages where admin is sender or receiver
            $query .= " AND (m.from_user_id = :admin_id OR m.to_user_id = :admin_id)";
            $params[':admin_id'] = $adminId;
        }
        
        // Filter by read status
        if ($status === 'read') {
            $query .= " AND m.status = 'read'";
        } elseif ($status === 'unread') {
            $query .= " AND m.status = 'unread'";
        }
        
        // Search
        if ($search) {
            $query .= " AND (m.subject LIKE :search OR m.message LIKE :search OR sender.full_name LIKE :search OR receiver.full_name LIKE :search)";
            $params[':search'] = '%' . $search . '%';
        }
        
        $query .= " ORDER BY m.created_at DESC LIMIT :limit OFFSET :offset";
        
        $stmt = $db->prepare($query);
        
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        
        $stmt->execute();
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Get total count
        $countQuery = "SELECT COUNT(*) as total 
                       FROM messages m
                       LEFT JOIN users sender ON m.from_user_id = sender.id
                       LEFT JOIN users receiver ON m.to_user_id = receiver.id
                       WHERE 1=1";
        
        if ($type === 'inbox') {
            $countQuery .= " AND m.to_user_id = :admin_id AND m.type = 'inbox'";
        } elseif ($type === 'sent') {
            $countQuery .= " AND m.from_user_id = :admin_id AND m.type = 'sent'";
        } else {
            $countQuery .= " AND (m.from_user_id = :admin_id OR m.to_user_id = :admin_id)";
        }
        
        if ($status === 'read') {
            $countQuery .= " AND m.status = 'read'";
        } elseif ($status === 'unread') {
            $countQuery .= " AND m.status = 'unread'";
        }
        
        if ($search) {
            $countQuery .= " AND (m.subject LIKE :search OR m.message LIKE :search OR sender.full_name LIKE :search OR receiver.full_name LIKE :search)";
        }
        
        $countStmt = $db->prepare($countQuery);
        
        foreach ($params as $key => $value) {
            if ($key !== ':limit' && $key !== ':offset') {
                $countStmt->bindValue($key, $value);
            }
        }
        
        $countStmt->execute();
        $totalRow = $countStmt->fetch(PDO::FETCH_ASSOC);
        $total = $totalRow['total'];
        
        // Get unread count
        $unreadQuery = "SELECT COUNT(*) as unread 
                        FROM messages 
                        WHERE to_user_id = :admin_id AND status = 'unread'";
        
        $unreadStmt = $db->prepare($unreadQuery);
        $unreadStmt->bindValue(':admin_id', $adminId, PDO::PARAM_INT);
        $unreadStmt->execute();
        $unreadRow = $unreadStmt->fetch(PDO::FETCH_ASSOC);
        
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => [
                'messages' => $messages,
                'unread_count' => $unreadRow['unread'],
                'pagination' => [
                    'total' => $total,
                    'page' => $page,
                    'limit' => $limit,
                    'pages' => ceil($total / $limit)
                ]
            ]
        ]);
    }
    
    // POST - Send message
    elseif ($method === 'POST') {
        $data = json_decode(file_get_contents("php://input"), true);
        
        // Validate required fields
        if (empty($data['receiver_id']) || empty($data['subject']) || empty($data['message'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Receiver, subject, and message are required']);
            exit();
        }
        
        $query = "INSERT INTO messages (from_user_id, to_user_id, subject, message, type, status, created_at) 
                  VALUES (:from_user_id, :to_user_id, :subject, :message, 'sent', 'read', NOW())";
        
        $stmt = $db->prepare($query);
        $stmt->bindValue(':from_user_id', $adminId, PDO::PARAM_INT);
        $stmt->bindValue(':to_user_id', $data['receiver_id'], PDO::PARAM_INT);
        $stmt->bindValue(':subject', $data['subject']);
        $stmt->bindValue(':message', $data['message']);
        
        if ($stmt->execute()) {
            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => 'Message sent successfully',
                'data' => [
                    'id' => $db->lastInsertId()
                ]
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Failed to send message']);
        }
    }
    
    // PUT - Mark as read
    elseif ($method === 'PUT') {
        $data = json_decode(file_get_contents("php://input"), true);
        
        if (empty($data['id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Message ID is required']);
            exit();
        }
        
        $query = "UPDATE messages 
                  SET status = 'read', read_at = NOW() 
                  WHERE id = :id AND to_user_id = :admin_id";
        
        $stmt = $db->prepare($query);
        $stmt->bindValue(':id', $data['id'], PDO::PARAM_INT);
        $stmt->bindValue(':admin_id', $adminId, PDO::PARAM_INT);
        
        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Message marked as read'
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Failed to update message']);
        }
    }
    
    // DELETE - Delete message
    elseif ($method === 'DELETE') {
        $data = json_decode(file_get_contents("php://input"), true);
        
        if (empty($data['id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Message ID is required']);
            exit();
        }
        
        // Only allow deleting messages where admin is sender or receiver
        $query = "DELETE FROM messages WHERE id = :id AND (from_user_id = :admin_id OR to_user_id = :admin_id)";
        
        $stmt = $db->prepare($query);
        $stmt->bindValue(':id', $data['id'], PDO::PARAM_INT);
        $stmt->bindValue(':admin_id', $adminId, PDO::PARAM_INT);
        
        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Message deleted successfully'
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Failed to delete message']);
        }
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Server error: ' . $e->getMessage()
    ]);
}
