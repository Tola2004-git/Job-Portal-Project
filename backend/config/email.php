<?php
/**
 * Email Configuration
 * Configure email settings for notifications
 */

class EmailConfig {
    // SMTP Settings (Gmail example)
    const SMTP_HOST = 'smtp.gmail.com';
    const SMTP_PORT = 587;
    const SMTP_USERNAME = 'your-email@gmail.com'; // Change this
    const SMTP_PASSWORD = 'your-app-password';     // Change this
    const SMTP_ENCRYPTION = 'tls';
    
    // Sender Information
    const FROM_EMAIL = 'noreply@jobportal.com';
    const FROM_NAME = 'Job Portal';
    
    // Email Settings
    const ENABLE_EMAIL = false; // Set to true when configured
    const DEBUG_MODE = true;    // Show debug info
    
    // Alternative: Use PHP mail() function instead of SMTP
    const USE_PHP_MAIL = true;  // Set to true to use built-in mail()
}
