<?php
// api/attendance/clock.php
require_once '../config.php';

$data = json_decode(file_get_contents('php://input'), true);
$userId = $data['userId']; // 実際はトークンから取得
$type = $data['type'];
$time = $data['time'];
$date = date('Y-m-d');

try {
    $pdo->beginTransaction();
    
    // 当日の勤怠レコードを取得または作成
    $stmt = $pdo->prepare("SELECT id FROM attendance_records WHERE user_id = ? AND date = ?");
    $stmt->execute([$userId, $date]);
    $record = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$record) {
        $stmt = $pdo->prepare("INSERT INTO attendance_records (user_id, date) VALUES (?, ?)");
        $stmt->execute([$userId, $date]);
        $recordId = $pdo->lastInsertId();
    } else {
        $recordId = $record['id'];
    }
    
    // 打刻詳細を追加
    $stmt = $pdo->prepare("INSERT INTO attendance_details (record_id, type, time) VALUES (?, ?, ?)");
    $stmt->execute([$recordId, $type, $time]);
    
    // 出勤・退勤時刻を更新
    if ($type === '出勤') {
        $stmt = $pdo->prepare("UPDATE attendance_records SET clock_in = ? WHERE id = ?");
        $stmt->execute([$time, $recordId]);
    } elseif ($type === '退勤') {
        $stmt = $pdo->prepare("UPDATE attendance_records SET clock_out = ? WHERE id = ?");
        $stmt->execute([$time, $recordId]);
        
        // 労働時間を計算
        calculateWorkHours($pdo, $recordId);
    }
    
    $pdo->commit();
    echo json_encode(['success' => true, 'record' => $data]);
    
} catch(PDOException $e) {
    $pdo->rollBack();
    echo json_encode(['error' => '打刻に失敗しました']);
}

function calculateWorkHours($pdo, $recordId) {
    // 労働時間計算ロジック
    $stmt = $pdo->prepare("
        SELECT clock_in, clock_out FROM attendance_records WHERE id = ?
    ");
    $stmt->execute([$recordId]);
    $record = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($record['clock_in'] && $record['clock_out']) {
        // 時間計算処理...
    }
}
?>