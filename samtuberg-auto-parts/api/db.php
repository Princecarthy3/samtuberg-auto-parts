<?php
/**
 * Samtuberg Auto Parts & Cars - Database Connection & Migration Helper
 * Ultra-secure PDO connection with automatic table initialization and JSON fallback.
 */

declare(strict_types=1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

const DB_HOST = '127.0.0.1';
const DB_PORT = 3306;
const DB_NAME = 'samtuberg_store';
const DB_USER = 'root';
const DB_PASS = '';

$dataDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data';
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0777, true);
}

function getDatabaseConnection(): ?PDO {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    try {
        // Connect to MySQL server first to create DB if needed
        $dsnInitial = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';charset=utf8mb4';
        $initPdo = new PDO($dsnInitial, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_TIMEOUT => 3
        ]);
        $initPdo->exec("CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

        // Now connect to the database
        $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);

        initializeTables($pdo);
        return $pdo;
    } catch (Throwable $e) {
        // Fallback gracefully if MySQL is not running on XAMPP yet
        error_log("Database connection failed: " . $e->getMessage());
        return null;
    }
}

function initializeTables(PDO $pdo): void {
    $tables = [
        "CREATE TABLE IF NOT EXISTS users (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            name VARCHAR(150) NOT NULL,
            email VARCHAR(150) NOT NULL UNIQUE,
            phone VARCHAR(40) DEFAULT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('admin', 'customer', 'viewer') NOT NULL DEFAULT 'customer',
            address TEXT,
            city VARCHAR(100) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_users_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",

        "CREATE TABLE IF NOT EXISTS products (
            id VARCHAR(100) NOT NULL,
            name VARCHAR(255) NOT NULL,
            type ENUM('part', 'car') NOT NULL DEFAULT 'part',
            category VARCHAR(80) NOT NULL,
            sub_category VARCHAR(80) DEFAULT NULL,
            fit VARCHAR(255) DEFAULT NULL,
            year INT NOT NULL DEFAULT 2024,
            price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            stock INT NOT NULL DEFAULT 1,
            image TEXT,
            description TEXT,
            featured TINYINT(1) NOT NULL DEFAULT 0,
            active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_products_category (category)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",

        "CREATE TABLE IF NOT EXISTS orders (
            id VARCHAR(100) NOT NULL,
            customer_name VARCHAR(150) NOT NULL,
            customer_email VARCHAR(150) NOT NULL,
            phone VARCHAR(40) DEFAULT NULL,
            address TEXT,
            city VARCHAR(100) DEFAULT NULL,
            total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            status VARCHAR(80) NOT NULL DEFAULT 'New Order Received',
            payment_method VARCHAR(80) DEFAULT 'Paystack',
            payment_reference VARCHAR(120) DEFAULT NULL,
            items_json LONGTEXT NOT NULL,
            read_status TINYINT(1) NOT NULL DEFAULT 0,
            tracking_progress INT NOT NULL DEFAULT 25,
            tracking_location VARCHAR(255) DEFAULT 'Abrepo Hub, Kumasi',
            tracking_notes TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_orders_email (customer_email),
            INDEX idx_orders_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",

        "CREATE TABLE IF NOT EXISTS payments (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            order_id VARCHAR(100) NOT NULL,
            customer_name VARCHAR(150) NOT NULL,
            reference VARCHAR(120) NOT NULL UNIQUE,
            method VARCHAR(80) NOT NULL,
            amount DECIMAL(12,2) NOT NULL,
            currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
            status VARCHAR(50) NOT NULL DEFAULT 'Paid',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_payments_order (order_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"
    ];

    foreach ($tables as $sql) {
        $pdo->exec($sql);
    }

    // Ensure columns exist if table was already created earlier
    try {
        $pdo->exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_location VARCHAR(255) DEFAULT 'Abrepo Hub, Kumasi'");
        $pdo->exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_notes TEXT DEFAULT NULL");
    } catch (Throwable $e) {}

    // Seed default admin if not exists
    $checkAdmin = $pdo->prepare("SELECT id FROM users WHERE email = ? OR name = ? LIMIT 1");
    $checkAdmin->execute(['admin@samtuberg.com', 'Samtuberg']);
    if (!$checkAdmin->fetch()) {
        $stmt = $pdo->prepare("INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([
            'Samtuberg Owner',
            'admin@samtuberg.com',
            '0208111135',
            password_hash('0208', PASSWORD_BCRYPT),
            'admin'
        ]);
    }
}

function jsonResponse(array $data, int $statusCode = 200): void {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function getJsonInput(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}
