<?php
/**
 * Application configuration
 * Single place to configure values used by backend endpoints (e.g., base URLs)
 */

if (!defined('APP_BASE_URL')) {
    // Base URL that should point to the backend folder as served by your webserver
    // Adjust this if your backend is served from a different host/port/path
    define('APP_BASE_URL', 'http://localhost/Job_Portal_Project/backend/');
}

if (!defined('APP_JWT_SECRET')) {
    $envSecret = getenv('JOB_PORTAL_JWT_SECRET');
    define('APP_JWT_SECRET', $envSecret && strlen($envSecret) >= 32 ? $envSecret : 'change-me-super-secret-key');
}

if (!defined('APP_JWT_EXP_SECONDS')) {
    $envExp = (int) getenv('JOB_PORTAL_JWT_EXP_SECONDS');
    define('APP_JWT_EXP_SECONDS', $envExp > 0 ? $envExp : 3600); // default 1 hour
}

?>
