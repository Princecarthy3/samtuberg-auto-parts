<?php
/**
 * Samtuberg Auto Parts & Cars - Master RESTful API Router
 * Full CRUD, Role-Based Access Control (Admin vs Customer/Viewer), Order Tracking, and Payment Handling.
 */

declare(strict_types=1);

require_once __DIR__ . '/db.php';

$pdo = getDatabaseConnection();
$dataDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data';
$ordersFile = $dataDir . DIRECTORY_SEPARATOR . 'orders-store.json';
$catalogFile = $dataDir . DIRECTORY_SEPARATOR . 'catalog-overrides.json';
$usersFile = $dataDir . DIRECTORY_SEPARATOR . 'users-store.json';

// Helper to load/save JSON fallback
function loadJsonStore(string $file, array $default = []): array {
    if (file_exists($file)) {
        $content = file_get_contents($file);
        $data = json_decode($content, true);
        if (is_array($data)) return $data;
    }
    return $default;
}

function saveJsonStore(string $file, array $data): void {
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
}

// Request path parsing
$requestUri = $_SERVER['REQUEST_URI'] ?? '';
$path = parse_url($requestUri, PHP_URL_PATH) ?? '';
$path = str_replace(['/samtuberg-auto-parts', '/api/index.php', '/api'], '', $path);
$path = '/' . ltrim($path, '/');
$method = $_SERVER['REQUEST_METHOD'];

// Extract Bearer token / auth
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
$token = '';
if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
    $token = trim($matches[1]);
}

// Simple token authentication check
function getAuthenticatedUser(string $token): ?array {
    if (!$token) return null;
    if ($token === 'admin_token_0208' || str_starts_with($token, 'admin_session_')) {
        return ['name' => 'Samtuberg Admin', 'role' => 'admin', 'email' => 'admin@samtuberg.com'];
    }
    if (str_starts_with($token, 'customer_token_')) {
        return ['name' => 'Customer', 'role' => 'customer', 'email' => 'customer@samtuberg.com'];
    }
    return null;
}

$currentUser = getAuthenticatedUser($token);

/* ===========================================================
   ROUTE: /auth/login
   =========================================================== */
if ($path === '/auth/login' && $method === 'POST') {
    $input = getJsonInput();
    $username = trim($input['username'] ?? $input['email'] ?? '');
    $password = trim($input['password'] ?? '');

    if (!$username || !$password) {
        jsonResponse(['status' => false, 'message' => 'Username/email and password are required.'], 400);
    }

    // Check Master Admin Credentials
    if (($username === 'Samtuberg' || $username === 'admin@samtuberg.com') && $password === '0208') {
        jsonResponse([
            'status' => true,
            'message' => 'Store Admin authenticated successfully.',
            'data' => [
                'token' => 'admin_session_' . bin2hex(random_bytes(16)),
                'user' => [
                    'name' => 'Samtuberg Owner',
                    'username' => 'Samtuberg',
                    'email' => 'admin@samtuberg.com',
                    'role' => 'admin',
                    'can_crud' => true
                ]
            ]
        ]);
    }

    // Check database if available
    if ($pdo) {
        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? OR name = ? LIMIT 1");
        $stmt->execute([$username, $username]);
        $user = $stmt->fetch();
        if ($user && password_verify($password, $user['password_hash'])) {
            $isAdmin = $user['role'] === 'admin';
            jsonResponse([
                'status' => true,
                'message' => $isAdmin ? 'Admin login successful.' : 'Customer login successful. You have tracking and catalog access.',
                'data' => [
                    'token' => ($isAdmin ? 'admin_session_' : 'customer_token_') . bin2hex(random_bytes(16)),
                    'user' => [
                        'id' => $user['id'],
                        'name' => $user['name'],
                        'email' => $user['email'],
                        'phone' => $user['phone'],
                        'role' => $user['role'],
                        'can_crud' => $isAdmin
                    ]
                ]
            ]);
        }
    }

    // Check local JSON users fallback
    $usersStore = loadJsonStore($usersFile, []);
    foreach ($usersStore as $u) {
        if (($u['email'] === $username || $u['name'] === $username) && password_verify($password, $u['password_hash'])) {
            $isAdmin = ($u['role'] ?? 'customer') === 'admin';
            jsonResponse([
                'status' => true,
                'message' => 'Login successful.',
                'data' => [
                    'token' => ($isAdmin ? 'admin_session_' : 'customer_token_') . bin2hex(random_bytes(16)),
                    'user' => [
                        'name' => $u['name'],
                        'email' => $u['email'],
                        'role' => $u['role'] ?? 'customer',
                        'can_crud' => $isAdmin
                    ]
                ]
            ]);
        }
    }

    // Default viewer fallback if password is valid
    if ($username === 'viewer' && $password === 'viewer123') {
        jsonResponse([
            'status' => true,
            'message' => 'Customer Viewer logged in. Access limited to viewing products and tracking orders.',
            'data' => [
                'token' => 'customer_token_' . bin2hex(random_bytes(16)),
                'user' => [
                    'name' => 'Store Viewer',
                    'username' => 'viewer',
                    'email' => 'viewer@samtuberg.com',
                    'role' => 'viewer',
                    'can_crud' => false
                ]
            ]
        ]);
    }

    jsonResponse(['status' => false, 'message' => 'Invalid credentials entered.'], 401);
}

/* ===========================================================
   ROUTE: /auth/register (Create Customer Account)
   =========================================================== */
if ($path === '/auth/register' && $method === 'POST') {
    $input = getJsonInput();
    $name = trim($input['name'] ?? '');
    $email = trim($input['email'] ?? '');
    $phone = trim($input['phone'] ?? '');
    $password = trim($input['password'] ?? '');
    $address = trim($input['address'] ?? 'Ghana');

    if (!$name || !$email || !$password) {
        jsonResponse(['status' => false, 'message' => 'Name, email, and password are required to create an account.'], 400);
    }

    if (strlen($password) < 4) {
        jsonResponse(['status' => false, 'message' => 'Password must be at least 4 characters long.'], 400);
    }

    $passwordHash = password_hash($password, PASSWORD_BCRYPT);
    $userRecord = [
        'name' => $name,
        'email' => $email,
        'phone' => $phone,
        'address' => $address,
        'password_hash' => $passwordHash,
        'role' => 'customer',
        'created_at' => date('Y-m-d H:i:s')
    ];

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("INSERT INTO users (name, email, phone, address, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([$name, $email, $phone, $address, $passwordHash, 'customer']);
            $userRecord['id'] = $pdo->lastInsertId();
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) {
                jsonResponse(['status' => false, 'message' => 'An account with this email address already exists.'], 409);
            }
        }
    }

    // Save in JSON fallback
    $usersStore = loadJsonStore($usersFile, []);
    $exists = false;
    foreach ($usersStore as $u) {
        if ($u['email'] === $email) {
            $exists = true;
            break;
        }
    }
    if (!$exists) {
        $usersStore[] = $userRecord;
        saveJsonStore($usersFile, $usersStore);
    }

    jsonResponse([
        'status' => true,
        'message' => 'Account created successfully! You now have access to track your orders and view products.',
        'data' => [
            'token' => 'customer_token_' . bin2hex(random_bytes(16)),
            'user' => [
                'name' => $name,
                'email' => $email,
                'phone' => $phone,
                'role' => 'customer',
                'can_crud' => false
            ]
        ]
    ], 201);
}

/* ===========================================================
   ROUTE: /products (GET: Public, POST/PUT/DELETE: Admin CRUD Only)
   =========================================================== */
if (preg_match('#^/products(?:/([^/]+))?$#', $path, $matches)) {
    $productId = $matches[1] ?? null;

    if ($method === 'GET') {
        $catalogData = loadJsonStore($catalogFile, ['overrides' => [], 'deletedIds' => []]);
        if ($pdo) {
            try {
                $stmt = $pdo->query("SELECT * FROM products WHERE active = 1 ORDER BY created_at DESC");
                $dbProducts = $stmt->fetchAll();
                if (!empty($dbProducts)) {
                    jsonResponse(['status' => true, 'data' => $dbProducts]);
                }
            } catch (Throwable $e) {
                // fallback
            }
        }
        jsonResponse(['status' => true, 'data' => $catalogData]);
    }

    // CRUD ACTIONS: STRICT ADMIN ACCESS ONLY!
    if (in_array($method, ['POST', 'PUT', 'DELETE'])) {
        if (!$currentUser || $currentUser['role'] !== 'admin') {
            jsonResponse([
                'status' => false,
                'message' => 'UNAUTHORIZED: Only the Store Administrator with admin password can add, edit, or delete catalog products.'
            ], 403);
        }

        $catalogData = loadJsonStore($catalogFile, ['overrides' => [], 'deletedIds' => []]);

        if ($method === 'POST' || $method === 'PUT') {
            $payload = getJsonInput();
            $id = $payload['id'] ?? $productId ?? ('p_' . time());
            $payload['id'] = $id;

            // Update in JSON
            $found = false;
            foreach ($catalogData['overrides'] as &$item) {
                if ($item['id'] === $id) {
                    $item = array_merge($item, $payload);
                    $found = true;
                    break;
                }
            }
            if (!$found) {
                $catalogData['overrides'][] = $payload;
            }
            saveJsonStore($catalogFile, $catalogData);

            if ($pdo) {
                try {
                    $stmt = $pdo->prepare("REPLACE INTO products (id, name, type, category, fit, year, price, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                    $stmt->execute([
                        $id,
                        $payload['name'] ?? '',
                        $payload['type'] ?? 'part',
                        $payload['category'] ?? 'bumpers',
                        $payload['fit'] ?? '',
                        $payload['year'] ?? 2024,
                        $payload['price'] ?? 0,
                        $payload['image'] ?? ''
                    ]);
                } catch (Throwable $e) {}
            }

            jsonResponse(['status' => true, 'message' => 'Product saved to store successfully.', 'data' => $payload]);
        }

        if ($method === 'DELETE') {
            if (!$productId) {
                jsonResponse(['status' => false, 'message' => 'Product ID required for deletion.'], 400);
            }
            $catalogData['deletedIds'] = array_values(array_unique(array_merge($catalogData['deletedIds'] ?? [], [$productId])));
            $catalogData['overrides'] = array_values(array_filter($catalogData['overrides'] ?? [], fn($p) => $p['id'] !== $productId));
            saveJsonStore($catalogFile, $catalogData);

            if ($pdo) {
                try {
                    $stmt = $pdo->prepare("DELETE FROM products WHERE id = ?");
                    $stmt->execute([$productId]);
                } catch (Throwable $e) {}
            }

            jsonResponse(['status' => true, 'message' => "Product '{$productId}' removed from store."]);
        }
    }
}

/* ===========================================================
// Helper to generate full tracking structure
function buildLiveTracking(string $status, ?string $location = null, ?string $notes = null): array {
    $norm = strtolower(trim($status));
    $progress = match($norm) {
        'new order received', 'new order (invoice created)', 'confirmed', 'paid' => 25,
        'processing', 'processing & fitment check' => 50,
        'in transit', 'dispatched / in transit' => 75,
        'delivered', 'delivered to customer' => 100,
        'cancelled' => 0,
        default => 30
    };

    $defaultLocation = match(true) {
        $progress >= 100 => 'Delivered to Customer Destination Address',
        $progress >= 75 => 'Dispatched from Kumasi Abrepo Depot — Express Transit to Destination',
        $progress >= 50 => 'Samtuberg Logistics & Fitment Hub (Kumasi) — Fitment Verified & Packaging',
        default => 'Order Queue — Awaiting Processing at Abrepo Store'
    };

    $loc = $location ?: $defaultLocation;

    return [
        'status' => $status,
        'progress' => $progress,
        'location' => $loc,
        'notes' => $notes ?: '',
        'updated_at' => date('Y-m-d H:i:s'),
        'steps' => [
            ['title' => 'Order Received', 'label' => 'Order Received', 'description' => 'Invoice created & order queued', 'completed' => $progress >= 25, 'current' => $progress === 25],
            ['title' => 'Processing & Fitment', 'label' => 'Processing & Fitment', 'description' => 'Genuine fitment verified & packaged', 'completed' => $progress >= 50, 'current' => $progress === 50],
            ['title' => 'Dispatched / In Transit', 'label' => 'Dispatched / In Transit', 'description' => 'Express Courier / delivery fleet in transit', 'completed' => $progress >= 75, 'current' => $progress === 75],
            ['title' => 'Delivered to Customer', 'label' => 'Delivered to Customer', 'description' => 'Package inspected and received', 'completed' => $progress >= 100, 'current' => $progress === 100]
        ]
    ];
}

/* ===========================================================
   ROUTE: /orders (GET, POST, PATCH) & /orders/mine
   =========================================================== */
if (preg_match('#^/orders(?:/([^/]+))?$#', $path, $matches)) {
    $subPath = $matches[1] ?? null;

    // CUSTOMER ORDERS: /orders/mine
    if ($subPath === 'mine' && $method === 'GET') {
        $targetEmail = strtolower(trim($_GET['email'] ?? ($currentUser['email'] ?? '')));
        $targetPhone = trim($_GET['phone'] ?? '');

        $store = loadJsonStore($ordersFile, ['orders' => []]);
        $allOrders = $store['orders'] ?? [];

        $matchedOrders = [];
        foreach ($allOrders as $ord) {
            $ordEmail = strtolower(trim($ord['customerEmail'] ?? ''));
            $ordPhone = trim($ord['phone'] ?? '');
            
            // If target email is provided, filter; otherwise if authenticated customer, match their records
            if ($targetEmail && ($ordEmail === $targetEmail || str_contains($ordEmail, $targetEmail))) {
                $ord['tracking'] = buildLiveTracking($ord['status'] ?? 'New Order Received', $ord['trackingLocation'] ?? null, $ord['trackingNotes'] ?? null);
                $matchedOrders[] = $ord;
            } elseif ($targetPhone && $ordPhone === $targetPhone) {
                $ord['tracking'] = buildLiveTracking($ord['status'] ?? 'New Order Received', $ord['trackingLocation'] ?? null, $ord['trackingNotes'] ?? null);
                $matchedOrders[] = $ord;
            }
        }

        // If no filter matched but user is logged in, return latest matching or recent
        if (empty($matchedOrders) && !$targetEmail && !$targetPhone && !empty($allOrders)) {
            $matchedOrders = array_map(function($o) {
                $o['tracking'] = buildLiveTracking($o['status'] ?? 'New Order Received', $o['trackingLocation'] ?? null, $o['trackingNotes'] ?? null);
                return $o;
            }, $allOrders);
        }

        jsonResponse(['status' => true, 'data' => $matchedOrders]);
    }

    if ($method === 'GET') {
        $store = loadJsonStore($ordersFile, ['orders' => [], 'salesBackup' => []]);
        $orders = array_map(function($o) {
            $o['tracking'] = buildLiveTracking($o['status'] ?? 'New Order Received', $o['trackingLocation'] ?? null, $o['trackingNotes'] ?? null);
            return $o;
        }, $store['orders'] ?? []);
        jsonResponse(['status' => true, 'data' => $orders]);
    }

    if ($method === 'POST') {
        $input = getJsonInput();
        $id = $input['id'] ?? ('STB-' . time() . '-' . rand(1000, 9999));
        $input['id'] = $id;
        $input['timestamp'] = $input['timestamp'] ?? date('c');
        
        // If payment is completed, automatically set status to 'Processing'
        $rawStatus = $input['status'] ?? 'New Order Received';
        if (strtolower($rawStatus) === 'paid' || !empty($input['paymentReference']) && !str_starts_with($input['paymentReference'], 'UNPAID')) {
            $rawStatus = 'Processing';
        }
        $input['status'] = $rawStatus;
        $input['read'] = false;
        $input['trackingLocation'] = $input['trackingLocation'] ?? 'Samtuberg Abrepo Logistics Hub, Kumasi';
        $input['trackingNotes'] = $input['trackingNotes'] ?? 'Order placed and verified.';
        $input['tracking'] = buildLiveTracking($rawStatus, $input['trackingLocation'], $input['trackingNotes']);

        $store = loadJsonStore($ordersFile, ['orders' => [], 'salesBackup' => []]);
        array_unshift($store['orders'], $input);
        array_unshift($store['salesBackup'], $input);
        saveJsonStore($ordersFile, $store);

        // Attempt PHP mail notification & log
        $mailSubject = "🚨 NEW ORDER: {$id} — GH₵ " . number_format((float)($input['total'] ?? 0), 2) . " (" . ($input['customerName'] ?? 'Customer') . ")";
        $mailBody = "New Order received on Samtuberg store:\nID: {$id}\nCustomer: " . ($input['customerName'] ?? '') . " (" . ($input['phone'] ?? '') . ")\nEmail: " . ($input['customerEmail'] ?? '') . "\nTotal: GH₵ " . number_format((float)($input['total'] ?? 0), 2) . "\nAddress: " . ($input['address'] ?? '') . "\nStatus: {$rawStatus}\nTime: " . date('Y-m-d H:i:s');
        @mail('samtuberg34@gmail.com', $mailSubject, $mailBody, "From: store@samtuberg.com\r\nReply-To: " . ($input['customerEmail'] ?? 'samtuberg34@gmail.com'));

        $emailLogFile = $dataDir . DIRECTORY_SEPARATOR . 'email-log.json';
        $emailLogs = loadJsonStore($emailLogFile, []);
        $emailLogs[] = [
            'timestamp' => date('c'),
            'to' => 'samtuberg34@gmail.com',
            'subject' => $mailSubject,
            'order_id' => $id,
            'customer' => $input['customerName'] ?? '',
            'status' => 'dispatched'
        ];
        saveJsonStore($emailLogFile, array_slice($emailLogs, -200));

        if ($pdo) {
            try {
                $stmt = $pdo->prepare("INSERT INTO orders (id, customer_name, customer_email, phone, address, total, status, payment_method, payment_reference, items_json, tracking_progress, tracking_location, tracking_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([
                    $id,
                    $input['customerName'] ?? 'Customer',
                    $input['customerEmail'] ?? '',
                    $input['phone'] ?? '',
                    $input['address'] ?? '',
                    $input['total'] ?? 0,
                    $input['status'],
                    $input['paymentMethod'] ?? 'Paystack',
                    $input['paymentReference'] ?? null,
                    json_encode($input['items'] ?? []),
                    $input['tracking']['progress'] ?? 25,
                    $input['trackingLocation'],
                    $input['trackingNotes']
                ]);
            } catch (Throwable $e) {}
        }

        jsonResponse(['status' => true, 'message' => 'Order recorded successfully.', 'data' => $input], 201);
    }

    if ($method === 'PATCH') {
        $orderId = $subPath;
        if (!$orderId) {
            jsonResponse(['status' => false, 'message' => 'Order ID required.'], 400);
        }

        $input = getJsonInput();
        $newStatus = $input['status'] ?? 'Processing';
        $newLocation = $input['location'] ?? $input['trackingLocation'] ?? null;
        $newNotes = $input['notes'] ?? $input['trackingNotes'] ?? null;

        $store = loadJsonStore($ordersFile, ['orders' => [], 'salesBackup' => []]);
        $found = false;
        $updatedOrder = null;
        foreach ($store['orders'] as &$order) {
            if ($order['id'] === $orderId) {
                $order['status'] = $newStatus;
                if ($newLocation !== null) $order['trackingLocation'] = $newLocation;
                if ($newNotes !== null) $order['trackingNotes'] = $newNotes;
                $order['tracking'] = buildLiveTracking($newStatus, $order['trackingLocation'] ?? null, $order['trackingNotes'] ?? null);
                $updatedOrder = $order;
                $found = true;
                break;
            }
        }
        if ($found) {
            saveJsonStore($ordersFile, $store);
        }

        if ($pdo) {
            try {
                $trackingData = buildLiveTracking($newStatus, $newLocation, $newNotes);
                $stmt = $pdo->prepare("UPDATE orders SET status = ?, tracking_progress = ?, tracking_location = COALESCE(?, tracking_location), tracking_notes = COALESCE(?, tracking_notes) WHERE id = ?");
                $stmt->execute([$newStatus, $trackingData['progress'], $newLocation, $newNotes, $orderId]);
            } catch (Throwable $e) {}
        }

        jsonResponse(['status' => true, 'message' => "Order {$orderId} tracking updated to '{$newStatus}'.", 'data' => $updatedOrder]);
    }
}

/* ===========================================================
   ROUTE: /tracking/:id (Live Tracking Timeline)
   =========================================================== */
if (preg_match('#^/tracking/([^/]+)$#', $path, $matches)) {
    $targetId = strtolower(trim($matches[1]));
    $store = loadJsonStore($ordersFile, ['orders' => []]);
    $matched = null;
    foreach ($store['orders'] as $order) {
        $orderIdMatch = strtolower(trim($order['id'] ?? ''));
        $emailMatch = strtolower(trim($order['customerEmail'] ?? ''));
        $phoneMatch = trim($order['phone'] ?? '');

        if ($orderIdMatch === $targetId || $emailMatch === $targetId || ($phoneMatch && $phoneMatch === $targetId)) {
            $matched = $order;
            break;
        }
    }

    if (!$matched) {
        jsonResponse(['status' => false, 'message' => 'Order not found for tracking.'], 404);
    }

    $status = $matched['status'] ?? 'New Order Received';
    $loc = $matched['trackingLocation'] ?? null;
    $notes = $matched['trackingNotes'] ?? null;
    $tracking = buildLiveTracking($status, $loc, $notes);

    jsonResponse([
        'status' => true,
        'data' => [
            'order_id' => $matched['id'],
            'customer_name' => $matched['customerName'] ?? 'Customer',
            'phone' => $matched['phone'] ?? '',
            'status' => $status,
            'progress' => $tracking['progress'],
            'location' => $tracking['location'],
            'notes' => $tracking['notes'],
            'steps' => $tracking['steps'],
            'destination' => $matched['address'] ?? 'Ghana Delivery',
            'total' => $matched['total'] ?? 0,
            'items' => $matched['items'] ?? [],
            'date' => $matched['timestamp'] ?? date('c')
        ]
    ]);
}

// Fallback for unmatched routes
jsonResponse(['status' => true, 'message' => 'Samtuberg Auto Parts API operational.', 'version' => '2.0.0']);
