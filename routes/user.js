const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ユーザープロフィール取得
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, name, email, created_at FROM users WHERE id = ?',
            [req.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: users[0] });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// プロフィール更新
router.put('/profile', authMiddleware, async (req, res) => {
    const { name, email } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
    }

    try {
        // メールアドレスの重複チェック（自分以外）
        const [existing] = await db.query(
            'SELECT id FROM users WHERE email = ? AND id != ?',
            [email, req.userId]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'Email already in use' });
        }

        await db.query(
            'UPDATE users SET name = ?, email = ? WHERE id = ?',
            [name, email, req.userId]
        );

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: { id: req.userId, name, email }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// パスワード変更
router.put('/password', authMiddleware, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        // 現在のパスワード確認
        const [users] = await db.query(
            'SELECT password FROM users WHERE id = ?',
            [req.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isValid = await bcrypt.compare(currentPassword, users[0].password);
        if (!isValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // 新しいパスワードをハッシュ化
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await db.query(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, req.userId]
        );

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// 統計情報取得
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        // 今月の統計
        const [monthStats] = await db.query(
            `SELECT 
        COUNT(DISTINCT date) as workDays,
        SUM(work_hours) as totalHours,
        AVG(work_hours) as avgHours
      FROM attendance_records
      WHERE user_id = ? 
        AND MONTH(date) = ? 
        AND YEAR(date) = ?
        AND clock_in IS NOT NULL`,
            [userId, currentMonth, currentYear]
        );

        // 今週の統計
        const [weekStats] = await db.query(
            `SELECT 
        COUNT(DISTINCT date) as workDays,
        SUM(work_hours) as totalHours
      FROM attendance_records
      WHERE user_id = ? 
        AND YEARWEEK(date, 1) = YEARWEEK(CURDATE(), 1)
        AND clock_in IS NOT NULL`,
            [userId]
        );

        // 総勤務日数
        const [totalStats] = await db.query(
            `SELECT COUNT(DISTINCT date) as totalWorkDays
      FROM attendance_records
      WHERE user_id = ? AND clock_in IS NOT NULL`,
            [userId]
        );

        res.json({
            month: {
                workDays: monthStats[0].workDays || 0,
                totalHours: parseFloat(monthStats[0].totalHours || 0).toFixed(2),
                avgHours: parseFloat(monthStats[0].avgHours || 0).toFixed(2)
            },
            week: {
                workDays: weekStats[0].workDays || 0,
                totalHours: parseFloat(weekStats[0].totalHours || 0).toFixed(2)
            },
            total: {
                workDays: totalStats[0].totalWorkDays || 0
            }
        });
    } catch (error) {
        console.error('Stats fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

module.exports = router;