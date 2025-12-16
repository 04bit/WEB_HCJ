const express = require('express');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// 打刻
router.post('/clock', authMiddleware, async (req, res) => {
  const { type, time } = req.body;
  const userId = req.userId;
  const date = new Date().toISOString().split('T')[0];

  // バリデーション
  if (!type || !time) {
    return res.status(400).json({ error: 'Type and time are required' });
  }

  const validTypes = ['出勤', '退勤', '休憩開始', '休憩終了'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 既存レコードの取得
    const [records] = await connection.query(
      'SELECT id, clock_in, clock_out FROM attendance_records WHERE user_id = ? AND date = ?',
      [userId, date]
    );

    let recordId;
    if (records.length === 0) {
      // 新規レコード作成
      if (type !== '出勤') {
        await connection.rollback();
        return res.status(400).json({ error: '出勤打刻が必要です' });
      }

      const [result] = await connection.query(
        'INSERT INTO attendance_records (user_id, date, clock_in) VALUES (?, ?, ?)',
        [userId, date, time]
      );
      recordId = result.insertId;
    } else {
      recordId = records[0].id;
      const record = records[0];

      // ビジネスロジックのバリデーション
      if (type === '出勤' && record.clock_in) {
        await connection.rollback();
        return res.status(400).json({ error: '既に出勤済みです' });
      }

      if (type === '退勤' && !record.clock_in) {
        await connection.rollback();
        return res.status(400).json({ error: '出勤打刻が必要です' });
      }

      if (type === '退勤' && record.clock_out) {
        await connection.rollback();
        return res.status(400).json({ error: '既に退勤済みです' });
      }

      // 出勤・退勤の更新
      if (type === '出勤') {
        await connection.query(
          'UPDATE attendance_records SET clock_in = ? WHERE id = ?',
          [time, recordId]
        );
      } else if (type === '退勤') {
        await connection.query(
          'UPDATE attendance_records SET clock_out = ? WHERE id = ?',
          [time, recordId]
        );
      }
    }

    // 詳細レコードの挿入
    await connection.query(
      'INSERT INTO attendance_details (record_id, type, time) VALUES (?, ?, ?)',
      [recordId, type, time]
    );

    // 退勤時に労働時間と休憩時間を計算
    if (type === '退勤') {
      await calculateWorkHours(connection, recordId);
    }

    await connection.commit();

    res.json({
      success: true,
      message: '打刻が完了しました',
      record: { type, time, date }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Clock error:', error);
    res.status(500).json({ error: '打刻に失敗しました' });
  } finally {
    connection.release();
  }
});

// 勤怠履歴取得（ページネーション対応）
router.get('/history', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const { page = 1, limit = 30, month, year } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = `
      SELECT 
        date,
        clock_in as clockIn,
        clock_out as clockOut,
        break_time as breakTime,
        work_hours as workHours
      FROM attendance_records
      WHERE user_id = ?
    `;
    const params = [userId];

    // フィルタリング
    if (month && year) {
      query += ` AND MONTH(date) = ? AND YEAR(date) = ?`;
      params.push(month, year);
    }

    query += ` ORDER BY date DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [records] = await db.query(query, params);

    // 総件数取得
    let countQuery = 'SELECT COUNT(*) as total FROM attendance_records WHERE user_id = ?';
    const countParams = [userId];

    if (month && year) {
      countQuery += ' AND MONTH(date) = ? AND YEAR(date) = ?';
      countParams.push(month, year);
    }

    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({ error: '履歴の取得に失敗しました' });
  }
});

// 本日の勤怠取得
router.get('/today', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const date = new Date().toISOString().split('T')[0];

  try {
    const [records] = await db.query(
      'SELECT id, clock_in, clock_out FROM attendance_records WHERE user_id = ? AND date = ?',
      [userId, date]
    );

    if (records.length === 0) {
      return res.json({
        details: [],
        summary: { clockIn: null, clockOut: null, status: '未出勤' }
      });
    }

    const [details] = await db.query(
      'SELECT type, time FROM attendance_details WHERE record_id = ? ORDER BY time ASC',
      [records[0].id]
    );

    // 現在のステータスを判定
    let status = '退勤中';
    if (details.length > 0) {
      const lastAction = details[details.length - 1].type;
      if (lastAction === '出勤' || lastAction === '休憩終了') {
        status = '勤務中';
      } else if (lastAction === '休憩開始') {
        status = '休憩中';
      } else if (lastAction === '退勤') {
        status = '退勤済';
      }
    }

    res.json({
      details,
      summary: {
        clockIn: records[0].clock_in,
        clockOut: records[0].clock_out,
        status
      }
    });
  } catch (error) {
    console.error('Today fetch error:', error);
    res.status(500).json({ error: '本日の勤怠取得に失敗しました' });
  }
});

// 特定の日付の勤怠取得
router.get('/date/:date', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const { date } = req.params;

  // 日付のバリデーション
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  try {
    const [records] = await db.query(
      `SELECT 
        date,
        clock_in as clockIn,
        clock_out as clockOut,
        break_time as breakTime,
        work_hours as workHours
      FROM attendance_records 
      WHERE user_id = ? AND date = ?`,
      [userId, date]
    );

    if (records.length === 0) {
      return res.json({ record: null });
    }

    // 詳細取得
    const [recordId] = await db.query(
      'SELECT id FROM attendance_records WHERE user_id = ? AND date = ?',
      [userId, date]
    );

    const [details] = await db.query(
      'SELECT type, time FROM attendance_details WHERE record_id = ? ORDER BY time ASC',
      [recordId[0].id]
    );

    res.json({
      record: records[0],
      details
    });
  } catch (error) {
    console.error('Date fetch error:', error);
    res.status(500).json({ error: '勤怠データの取得に失敗しました' });
  }
});

// データエクスポート（CSV形式）
router.get('/export', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const { month, year } = req.query;

  try {
    let query = `
      SELECT 
        date as '日付',
        clock_in as '出勤時刻',
        clock_out as '退勤時刻',
        break_time as '休憩時間（分）',
        work_hours as '労働時間'
      FROM attendance_records
      WHERE user_id = ?
    `;
    const params = [userId];

    if (month && year) {
      query += ` AND MONTH(date) = ? AND YEAR(date) = ?`;
      params.push(month, year);
    }

    query += ` ORDER BY date ASC`;

    const [records] = await db.query(query, params);

    if (records.length === 0) {
      return res.status(404).json({ error: 'No data found' });
    }

    // CSV生成
    const headers = Object.keys(records[0]);
    const csvRows = [
      headers.join(','),
      ...records.map(row =>
        headers.map(header => {
          const value = row[header];
          return value === null ? '' : `"${value}"`;
        }).join(',')
      )
    ];

    const csv = csvRows.join('\n');
    const filename = `attendance_${year || 'all'}_${month || 'all'}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // UTF-8 BOM for Excel
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'エクスポートに失敗しました' });
  }
});

// 労働時間と休憩時間の計算
async function calculateWorkHours(connection, recordId) {
  // レコード取得
  const [records] = await connection.query(
    'SELECT clock_in, clock_out FROM attendance_records WHERE id = ?',
    [recordId]
  );

  const record = records[0];
  if (!record.clock_in || !record.clock_out) {
    return;
  }

  // 労働時間計算（時間）
  const clockIn = new Date(`1970-01-01T${record.clock_in}`);
  const clockOut = new Date(`1970-01-01T${record.clock_out}`);
  const diffMs = clockOut - clockIn;
  const totalMinutes = diffMs / (1000 * 60);

  // 休憩時間計算（分）
  const [details] = await connection.query(
    'SELECT type, time FROM attendance_details WHERE record_id = ? ORDER BY time ASC',
    [recordId]
  );

  let breakMinutes = 0;
  let breakStart = null;

  details.forEach(detail => {
    if (detail.type === '休憩開始') {
      breakStart = new Date(`1970-01-01T${detail.time}`);
    } else if (detail.type === '休憩終了' && breakStart) {
      const breakEnd = new Date(`1970-01-01T${detail.time}`);
      breakMinutes += (breakEnd - breakStart) / (1000 * 60);
      breakStart = null;
    }
  });

  // 実労働時間 = 総時間 - 休憩時間
  const workMinutes = totalMinutes - breakMinutes;
  const workHours = (workMinutes / 60).toFixed(2);

  // 更新
  await connection.query(
    'UPDATE attendance_records SET work_hours = ?, break_time = ? WHERE id = ?',
    [workHours, Math.round(breakMinutes), recordId]
  );
}

module.exports = router;