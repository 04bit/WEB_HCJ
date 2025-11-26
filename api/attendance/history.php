<?php
// api/attendance/history.php
require_once '../config.php';

$userId = $_GET['userId']; 

$stmt = $pdo->prepare("
    SELECT 
        ar.date,
        ar.clock_in as clockIn,
        ar.clock_out as clockOut,
        ar.break_time as breakTime,
        ar.work_hours as workHours
    FROM attendance_records ar
    WHERE ar.user_id = ?
    ORDER BY ar.date DESC
");
$stmt->execute([$userId]);
$records = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode(['records' => $records]);
?>