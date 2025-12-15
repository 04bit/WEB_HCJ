const express = require('express');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/clock', authMiddleware, async (req, res) => {
  const { type, time } = req.body;
  const userId = req.userId;
  const date = new Date().toISOString().split('T')[0];

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [records] = await connection.query(
      'SELECT id FROM attendance_records WHERE user_id = ? AND date = ?',
      [userId, date]
    );

    let recordId;
    if (records.length === 0) {
      const [result] = await connection.query(
        'INSERT INTO attendance_records (user_id, date) VALUES (?, ?)',
        [userId, date]
      );
      recordId = result.insertId;
    } else {
      recordId = records[0].id;
    }

    await connection.query(
      'INSERT INTO attendance_details (record_id, type, time) VALUES (?, ?, ?)',
      [recordId, type, time]
    );

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

      await calculateWorkHours(connection, recordId);
    }

    await connection.commit();

    res.json({ 
      success: true, 
      record: { type, time, date }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Clock error:', error);
    res.status(500).json({ error: '時刻の記録に失敗しました' });
  } finally {
    connection.release();
  }
});

router.get('/history', authMiddleware, async (req, res) => {
  const userId = req.userId;

  try {
    const [records] = await db.query(
      `SELECT 
        date,
        clock_in as clockIn,
        clock_out as clockOut,
        break_time as breakTime,
        work_hours as workHours
      FROM attendance_records
      WHERE user_id = ?
      ORDER BY date DESC`,
      [userId]
    );

    res.json({ records });
  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({ error: '履歴の取得に失敗しました' });
  }
});

router.get('/today', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const date = new Date().toISOString().split('T')[0];

  try {
    const [records] = await db.query(
      'SELECT id FROM attendance_records WHERE user_id = ? AND date = ?',
      [userId, date]
    );

    if (records.length === 0) {
      return res.json({ details: [] });
    }

    const [details] = await db.query(
      'SELECT type, time FROM attendance_details WHERE record_id = ? ORDER BY time ASC',
      [records[0].id]
    );

    res.json({ details });
  } catch (error) {
    console.error('Today fetch error:', error);
    res.status(500).json({ error: '本日の勤怠取得に失敗しました' });
  }
});

async function calculateWorkHours(connection, recordId) {
  const [records] = await connection.query(
    'SELECT clock_in, clock_out FROM attendance_records WHERE id = ?',
    [recordId]
  );

  const record = records[0];
  if (record.clock_in && record.clock_out) {
    const clockIn = new Date(`1970-01-01T${record.clock_in}`);
    const clockOut = new Date(`1970-01-01T${record.clock_out}`);
    const diffMs = clockOut - clockIn;
    const workHours = (diffMs / (1000 * 60 * 60)).toFixed(2);

    await connection.query(
      'UPDATE attendance_records SET work_hours = ? WHERE id = ?',
      [workHours, recordId]
    );
  }
}

module.exports = router;