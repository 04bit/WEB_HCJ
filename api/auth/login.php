<?php
// api/auth/login.php
require_once '../config.php';

$data = json_decode(file_get_contents('php://input'), true);

$email = $data['email'];
$password = $data['password'];

$stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
$stmt->execute([$email]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if ($user && password_verify($password, $user['password'])) {
    $token = bin2hex(random_bytes(32));
    
    echo json_encode([
        'success' => true,
        'token' => $token,
        'user' => [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email']
        ]
    ]);
} else {
    echo json_encode(['error' => 'メールアドレスまたはパスワードが正しくありません']);
}
?>