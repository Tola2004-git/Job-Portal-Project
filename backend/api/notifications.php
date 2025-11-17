<?php
/**
 * Notifications API
 * Send email notifications for various events
 */

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config/database.php';
require_once '../services/EmailService.php';

$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? '';

if (empty($authHeader) || !str_starts_with($authHeader, 'Bearer ')) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit();
}

$token = str_replace('Bearer ', '', $authHeader);
try {
    $decoded = json_decode(base64_decode($token), true);
    
    if (!$decoded || !isset($decoded['user_id'])) {
        throw new Exception('Invalid token');
    }
    
    if (isset($decoded['exp']) && $decoded['exp'] < time()) {
        throw new Exception('Token expired');
    }
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    exit();
}

$database = new Database();
$db = $database->getConnection();
$emailService = new EmailService();

try {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (empty($data['type'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Notification type required']);
        exit();
    }
    
    $type = $data['type'];
    $result = null;
    
    switch ($type) {
        case 'application_received':
            $result = sendApplicationReceived($db, $emailService, $data);
            break;
            
        case 'application_status_changed':
            $result = sendApplicationStatusChanged($db, $emailService, $data);
            break;
            
        case 'new_job_posted':
            $result = sendNewJobPosted($db, $emailService, $data);
            break;
            
        case 'job_application_notification':
            $result = sendJobApplicationNotification($db, $emailService, $data);
            break;
            
        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid notification type']);
            exit();
    }
    
    http_response_code(200);
    echo json_encode($result);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

/**
 * Send application received notification
 */
function sendApplicationReceived($db, $emailService, $data) {
    $applicationId = $data['application_id'] ?? null;
    
    if (!$applicationId) {
        return ['success' => false, 'error' => 'Application ID required'];
    }
    
    $query = "SELECT a.*, j.title as job_title, u.full_name as applicant_name, u.email as applicant_email,
              COALESCE(ep.company_name, emp.full_name) as company_name
              FROM applications a
              JOIN jobs j ON a.job_id = j.id
              JOIN users u ON a.seeker_id = u.id
              JOIN users emp ON j.employer_id = emp.id
              LEFT JOIN employer_profiles ep ON ep.user_id = emp.id
              WHERE a.id = :id";
    
    $stmt = $db->prepare($query);
    $stmt->execute([':id' => $applicationId]);
    $app = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$app) {
        return ['success' => false, 'error' => 'Application not found'];
    }
    
    $templateData = [
        'applicant_name' => $app['applicant_name'],
        'job_title' => $app['job_title'],
        'company_name' => $app['company_name'],
        'applied_date' => date('M d, Y', strtotime($app['applied_at']))
    ];
    
    $template = $emailService->getTemplate('application_received', $templateData);
    return $emailService->send($app['applicant_email'], $template['subject'], $template['body']);
}

/**
 * Send application status changed notification
 */
function sendApplicationStatusChanged($db, $emailService, $data) {
    $applicationId = $data['application_id'] ?? null;
    
    if (!$applicationId) {
        return ['success' => false, 'error' => 'Application ID required'];
    }
    
    $query = "SELECT a.*, j.title as job_title, u.full_name as applicant_name, u.email as applicant_email,
              COALESCE(ep.company_name, emp.full_name) as company_name
              FROM applications a
              JOIN jobs j ON a.job_id = j.id
              JOIN users u ON a.seeker_id = u.id
              JOIN users emp ON j.employer_id = emp.id
              LEFT JOIN employer_profiles ep ON ep.user_id = emp.id
              WHERE a.id = :id";
    
    $stmt = $db->prepare($query);
    $stmt->execute([':id' => $applicationId]);
    $app = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$app) {
        return ['success' => false, 'error' => 'Application not found'];
    }
    
    $templateData = [
        'applicant_name' => $app['applicant_name'],
        'job_title' => $app['job_title'],
        'company_name' => $app['company_name'],
        'status' => $app['status'],
        'notes' => $app['notes'] ?? ''
    ];
    
    $template = $emailService->getTemplate('application_status_changed', $templateData);
    return $emailService->send($app['applicant_email'], $template['subject'], $template['body']);
}

/**
 * Send new job posted notification
 */
function sendNewJobPosted($db, $emailService, $data) {
    $jobId = $data['job_id'] ?? null;
    
    if (!$jobId) {
        return ['success' => false, 'error' => 'Job ID required'];
    }
    
    $query = "SELECT j.*, COALESCE(ep.company_name, u.full_name) as employer_name, u.email as employer_email
              FROM jobs j
              JOIN users u ON j.employer_id = u.id
              LEFT JOIN employer_profiles ep ON ep.user_id = u.id
              WHERE j.id = :id";
    
    $stmt = $db->prepare($query);
    $stmt->execute([':id' => $jobId]);
    $job = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$job) {
        return ['success' => false, 'error' => 'Job not found'];
    }
    
    $templateData = [
        'employer_name' => $job['employer_name'],
        'job_title' => $job['title'],
        'job_type' => $job['job_type'],
        'location' => $job['location'],
        'status' => $job['status']
    ];
    
    $template = $emailService->getTemplate('new_job_posted', $templateData);
    return $emailService->send($job['employer_email'], $template['subject'], $template['body']);
}

/**
 * Send job application notification to employer
 */
function sendJobApplicationNotification($db, $emailService, $data) {
    $applicationId = $data['application_id'] ?? null;
    
    if (!$applicationId) {
        return ['success' => false, 'error' => 'Application ID required'];
    }
    
    $query = "SELECT a.*, j.title as job_title, 
              u.full_name as applicant_name, u.email as applicant_email,
              emp.full_name as employer_name, emp.email as employer_email
              FROM applications a
              JOIN jobs j ON a.job_id = j.id
              JOIN users u ON a.seeker_id = u.id
              JOIN users emp ON j.employer_id = emp.id
              WHERE a.id = :id";
    
    $stmt = $db->prepare($query);
    $stmt->execute([':id' => $applicationId]);
    $app = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$app) {
        return ['success' => false, 'error' => 'Application not found'];
    }
    
    $templateData = [
        'employer_name' => $app['employer_name'],
        'job_title' => $app['job_title'],
        'applicant_name' => $app['applicant_name'],
        'applicant_email' => $app['applicant_email'],
        'applied_date' => date('M d, Y', strtotime($app['applied_at']))
    ];
    
    $template = $emailService->getTemplate('job_application_notification', $templateData);
    return $emailService->send($app['employer_email'], $template['subject'], $template['body']);
}
