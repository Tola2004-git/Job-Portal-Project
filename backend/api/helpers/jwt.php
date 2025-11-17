<?php
/**
 * Minimal JWT utilities (HS256) for encoding and decoding tokens.
 * Avoids external dependencies while providing signature validation and expiry checks.
 */

if (!defined('APP_JWT_SECRET')) {
    require_once __DIR__ . '/../../config/app.php';
    if (!defined('APP_JWT_SECRET')) {
        define('APP_JWT_SECRET', 'change-me-super-secret-key');
    }
}

if (!function_exists('base64url_encode')) {
    function base64url_encode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}

if (!function_exists('base64url_decode')) {
    function base64url_decode(string $data): string {
        $remainder = strlen($data) % 4;
        if ($remainder !== 0) {
            $data .= str_repeat('=', 4 - $remainder);
        }
        return base64_decode(strtr($data, '-_', '+/')) ?: '';
    }
}

if (!function_exists('jwt_encode')) {
    function jwt_encode(array $payload, string $secret = APP_JWT_SECRET, string $algorithm = 'HS256'): string {
        $header = ['typ' => 'JWT', 'alg' => $algorithm];
        $encodedHeader = base64url_encode(json_encode($header));
        $encodedPayload = base64url_encode(json_encode($payload));

        $signature = hash_hmac('sha256', $encodedHeader . '.' . $encodedPayload, $secret, true);
        $encodedSignature = base64url_encode($signature);

        return $encodedHeader . '.' . $encodedPayload . '.' . $encodedSignature;
    }
}

if (!function_exists('jwt_decode')) {
    function jwt_decode(string $token, string $secret = APP_JWT_SECRET): array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            throw new InvalidArgumentException('Malformed token.');
        }

        [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;
        $header = json_decode(base64url_decode($encodedHeader), true);
        $payload = json_decode(base64url_decode($encodedPayload), true);
        $signature = base64url_decode($encodedSignature);

        if (!is_array($header) || !is_array($payload) || !$signature) {
            throw new InvalidArgumentException('Invalid token payload.');
        }

        if (($header['alg'] ?? '') !== 'HS256') {
            throw new InvalidArgumentException('Unsupported signing algorithm.');
        }

        $expected = hash_hmac('sha256', $encodedHeader . '.' . $encodedPayload, $secret, true);
        if (!hash_equals($expected, $signature)) {
            throw new RuntimeException('Token signature mismatch.');
        }

        if (isset($payload['exp']) && time() >= (int) $payload['exp']) {
            throw new RuntimeException('Token expired.');
        }

        return $payload;
    }
}

?>
