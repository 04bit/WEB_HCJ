<?php
// api/auth/register.php
require_once '../config.php';

$data = json_decode(file_get_contents('php://input'), true);

$name = $data['name'];
$email = $data['email'];
$password = password_hash($data['password'], PASSWORD_DEFAULT); 

try {
    $stmt = $pdo->prepare("INSERT INFO users (name, email, password) VALUES (?, ?, ?)");
    $stmt->execute([$name, $email, $password]);

    echo json_encode(['success' => true, 'message' => 'Successfully registered']);
} catch(PDOException $e) {
    if ($e->getCode() == 23000) {
        echo json_encode(['error' => 'Email already exists']);
    } else {
        echo json_encode(['error' => 'Failed to register']);
    }
}
?>