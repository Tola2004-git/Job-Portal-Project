<?php

declare(strict_types=1);

if (!function_exists('get_default_avatar_data_uri')) {
    function get_default_avatar_data_uri(): string
    {
        return 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20128%20128%22%3E%3Crect%20fill%3D%22%23e5e7eb%22%20width%3D%22128%22%20height%3D%22128%22%20rx%3D%2264%22/%3E%3Ccircle%20cx%3D%2264%22%20cy%3D%2248%22%20r%3D%2228%22%20fill%3D%22%23cbd5f5%22/%3E%3Cpath%20d%3D%22M32%20108c0-22%2018-40%2032-40s32%2018%2032%2040%22%20fill%3D%22%239ca3af%22/%3E%3C/svg%3E';
    }
}

if (!function_exists('get_backend_base_path')) {
    function get_backend_base_path(): string
    {
        static $basePath = null;
        if ($basePath === null) {
            $basePath = dirname(__DIR__, 2);
        }
        return $basePath;
    }
}

if (!function_exists('is_legacy_default_avatar')) {
    function is_legacy_default_avatar(?string $value): bool
    {
        $value = trim((string) $value);
        if ($value === '' || strtolower($value) === 'null') {
            return true;
        }

        $legacy = [
            '/user-avatar.png',
            '/uploads/avatars/default.png',
            'uploads/avatars/default.png',
            'backend/uploads/avatars/default.png',
            'http://localhost/Job_Portal_Project/backend/uploads/avatars/default.png'
        ];

        return in_array($value, $legacy, true);
    }
}

if (!function_exists('normalize_avatar_field')) {
    function normalize_avatar_field(?string $value): string
    {
        $value = trim((string) $value);

        if ($value === '' || strtolower($value) === 'null' || is_legacy_default_avatar($value)) {
            return get_default_avatar_data_uri();
        }

        if (stripos($value, 'data:image/') === 0) {
            return $value;
        }

        if (filter_var($value, FILTER_VALIDATE_URL)) {
            return $value;
        }

        $normalizedPath = '/' . ltrim($value, '/');
        $fullPath = get_backend_base_path() . $normalizedPath;

        if (!is_file($fullPath)) {
            return get_default_avatar_data_uri();
        }

        return $normalizedPath;
    }
}