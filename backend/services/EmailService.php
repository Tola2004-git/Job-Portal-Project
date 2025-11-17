<?php
/**
 * Email Service
 * Handle sending emails for notifications
 */

require_once __DIR__ . '/../config/email.php';

class EmailService {
    private $logs = [];
    
    /**
     * Send email using PHP mail() or log to file
     */
    public function send($to, $subject, $body, $fromName = null) {
        $fromEmail = EmailConfig::FROM_EMAIL;
        $fromName = $fromName ?? EmailConfig::FROM_NAME;
        
        // Log email details
        $this->log("Sending email to: $to");
        $this->log("Subject: $subject");
        
        if (!EmailConfig::ENABLE_EMAIL) {
            // Email disabled - log to file instead
            $this->logToFile($to, $subject, $body);
            return [
                'success' => true,
                'message' => 'Email logged (sending disabled)',
                'logs' => $this->logs
            ];
        }
        
        if (EmailConfig::USE_PHP_MAIL) {
            // Use PHP built-in mail()
            return $this->sendWithPHPMail($to, $subject, $body, $fromEmail, $fromName);
        } else {
            // Use SMTP (requires PHPMailer)
            return $this->sendWithSMTP($to, $subject, $body, $fromEmail, $fromName);
        }
    }
    
    /**
     * Send using PHP mail() function
     */
    private function sendWithPHPMail($to, $subject, $body, $fromEmail, $fromName) {
        $headers = "MIME-Version: 1.0\r\n";
        $headers .= "Content-type: text/html; charset=UTF-8\r\n";
        $headers .= "From: $fromName <$fromEmail>\r\n";
        $headers .= "Reply-To: $fromEmail\r\n";
        
        $success = mail($to, $subject, $body, $headers);
        
        if ($success) {
            $this->log("Email sent successfully");
            return [
                'success' => true,
                'message' => 'Email sent',
                'logs' => $this->logs
            ];
        } else {
            $this->log("Failed to send email");
            return [
                'success' => false,
                'error' => 'Failed to send email',
                'logs' => $this->logs
            ];
        }
    }
    
    /**
     * Send using SMTP (fallback to PHP mail)
     */
    private function sendWithSMTP($to, $subject, $body, $fromEmail, $fromName) {
        // Fallback to PHP mail() function since PHPMailer is not available
        $this->log("SMTP not configured, using PHP mail() instead");
        return $this->sendWithPHPMail($to, $subject, $body, $fromEmail, $fromName);
    }
    
    /**
     * Log email to file (for testing/debugging)
     */
    private function logToFile($to, $subject, $body) {
        $logDir = __DIR__ . '/../logs';
        if (!file_exists($logDir)) {
            mkdir($logDir, 0777, true);
        }
        
        $timestamp = date('Y-m-d H:i:s');
        $logFile = $logDir . '/emails_' . date('Y-m-d') . '.log';
        
        $logContent = "\n" . str_repeat('=', 80) . "\n";
        $logContent .= "Time: $timestamp\n";
        $logContent .= "To: $to\n";
        $logContent .= "Subject: $subject\n";
        $logContent .= str_repeat('-', 80) . "\n";
        $logContent .= $body . "\n";
        $logContent .= str_repeat('=', 80) . "\n";
        
        file_put_contents($logFile, $logContent, FILE_APPEND);
        $this->log("Email logged to: $logFile");
    }
    
    /**
     * Add to debug logs
     */
    private function log($message) {
        if (EmailConfig::DEBUG_MODE) {
            $this->logs[] = $message;
        }
    }
    
    /**
     * Get email template
     */
    public function getTemplate($type, $data) {
        $templates = new EmailTemplates();
        
        switch ($type) {
            case 'application_received':
                return $templates->applicationReceived($data);
            case 'application_status_changed':
                return $templates->applicationStatusChanged($data);
            case 'new_job_posted':
                return $templates->newJobPosted($data);
            case 'job_application_notification':
                return $templates->jobApplicationNotification($data);
            default:
                return ['subject' => '', 'body' => ''];
        }
    }
}

/**
 * Email Templates
 */
class EmailTemplates {
    
    /**
     * Template: Application Received (to job seeker)
     */
    public function applicationReceived($data) {
        $subject = "Application Received - " . $data['job_title'];
        
        $body = "
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #3B82F6; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background: #f9f9f9; }
                .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
                .button { display: inline-block; padding: 10px 20px; background: #3B82F6; color: white; text-decoration: none; border-radius: 5px; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h1>Application Received</h1>
                </div>
                <div class='content'>
                    <p>Dear {$data['applicant_name']},</p>
                    <p>Thank you for applying for the position of <strong>{$data['job_title']}</strong>.</p>
                    <p>We have received your application and it is currently under review. Our team will carefully evaluate your qualifications and experience.</p>
                    <p><strong>Application Details:</strong></p>
                    <ul>
                        <li>Job Title: {$data['job_title']}</li>
                        <li>Company: {$data['company_name']}</li>
                        <li>Application Date: {$data['applied_date']}</li>
                        <li>Status: Pending Review</li>
                    </ul>
                    <p>You will receive an update on your application status soon.</p>
                    <p>Best regards,<br>The Job Portal Team</p>
                </div>
                <div class='footer'>
                    <p>&copy; 2025 Job Portal. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        ";
        
        return ['subject' => $subject, 'body' => $body];
    }
    
    /**
     * Template: Application Status Changed
     */
    public function applicationStatusChanged($data) {
        $statusColors = [
            'reviewed' => '#3B82F6',
            'accepted' => '#10B981',
            'rejected' => '#EF4444'
        ];
        
        $color = $statusColors[$data['status']] ?? '#666';
        $subject = "Application Status Update - " . ucfirst($data['status']);
        
        $body = "
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: $color; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background: #f9f9f9; }
                .status-badge { display: inline-block; padding: 5px 15px; background: $color; color: white; border-radius: 20px; font-weight: bold; }
                .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h1>Application Status Update</h1>
                </div>
                <div class='content'>
                    <p>Dear {$data['applicant_name']},</p>
                    <p>Your application for <strong>{$data['job_title']}</strong> has been updated.</p>
                    <p><strong>New Status:</strong> <span class='status-badge'>" . strtoupper($data['status']) . "</span></p>
                    " . (isset($data['notes']) && !empty($data['notes']) ? "<p><strong>Notes:</strong> {$data['notes']}</p>" : "") . "
                    <p>Thank you for your interest in joining our team.</p>
                    <p>Best regards,<br>{$data['company_name']}</p>
                </div>
                <div class='footer'>
                    <p>&copy; 2025 Job Portal. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        ";
        
        return ['subject' => $subject, 'body' => $body];
    }
    
    /**
     * Template: New Job Posted (to employer)
     */
    public function newJobPosted($data) {
        $subject = "Job Posted Successfully - " . $data['job_title'];
        
        $body = "
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #10B981; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background: #f9f9f9; }
                .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h1>Job Posted Successfully</h1>
                </div>
                <div class='content'>
                    <p>Dear {$data['employer_name']},</p>
                    <p>Your job posting has been published successfully!</p>
                    <p><strong>Job Details:</strong></p>
                    <ul>
                        <li>Title: {$data['job_title']}</li>
                        <li>Type: {$data['job_type']}</li>
                        <li>Location: {$data['location']}</li>
                        <li>Status: {$data['status']}</li>
                    </ul>
                    <p>Your job is now visible to job seekers on our platform.</p>
                    <p>Best regards,<br>The Job Portal Team</p>
                </div>
                <div class='footer'>
                    <p>&copy; 2025 Job Portal. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        ";
        
        return ['subject' => $subject, 'body' => $body];
    }
    
    /**
     * Template: New Application Notification (to employer)
     */
    public function jobApplicationNotification($data) {
        $subject = "New Application Received - " . $data['job_title'];
        
        $body = "
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #8B5CF6; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background: #f9f9f9; }
                .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h1>New Application Received</h1>
                </div>
                <div class='content'>
                    <p>Dear {$data['employer_name']},</p>
                    <p>You have received a new application for your job posting:</p>
                    <p><strong>Job:</strong> {$data['job_title']}</p>
                    <p><strong>Applicant Details:</strong></p>
                    <ul>
                        <li>Name: {$data['applicant_name']}</li>
                        <li>Email: {$data['applicant_email']}</li>
                        <li>Applied: {$data['applied_date']}</li>
                    </ul>
                    <p>Please log in to your dashboard to review the application.</p>
                    <p>Best regards,<br>The Job Portal Team</p>
                </div>
                <div class='footer'>
                    <p>&copy; 2025 Job Portal. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        ";
        
        return ['subject' => $subject, 'body' => $body];
    }
}
