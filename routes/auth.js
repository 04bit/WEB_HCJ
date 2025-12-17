const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

// ユーザー登録（ロギング付き）
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    const startTime = Date.now();

    logger.info('Registration attempt', { email, name });

    // バリデーション
    if (!name || !email || !password) {
        logger.warn('Registration failed: Missing fields', { email });
        return res.status(400).json({
            error: '全ての項目を入力してください'
        });
    }

    if (password.length < 6) {
        logger.warn('Registration failed: Weak password', { email });
        return res.status(400).json({
            error: 'パスワードは6文字以上で入力してください'
        });
    }

    try {
        // メールアドレスの重複チェック
        const [existing] = await db.query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            logger.warn('Registration failed: Email already exists', { email });
            return res.status(409).json({
                error: 'このメールアドレスは既に登録されています'
            });
        }

        // パスワードのハッシュ化
        const hashedPassword = await bcrypt.hash(password, 10);

        // ユーザー登録
        const [result] = await db.execute(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name.trim(), email.toLowerCase(), hashedPassword]
        );

        const duration = Date.now() - startTime;
        logger.info('User registered successfully', {
            userId: result.insertId,
            email: email.toLowerCase(),
            duration: `${duration}ms`
        });

        res.status(201).json({
            success: true,
            message: 'ユーザー登録が完了しました',
            userId: result.insertId
        });
    } catch (error) {
        logger.error('Registration error', {
            error: error.message,
            stack: error.stack,
            email
        });

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                error: 'このメールアドレスは既に登録されています'
            });
        }

        res.status(500).json({
            error: 'サーバーエラーが発生しました'
        });
    }
});

// ログイン（ロギング付き）
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const startTime = Date.now();
    const ip = req.ip;

    logger.info('Login attempt', { email, ip });

    try {
        const [users] = await db.query(
            'SELECT id, name, email, password FROM users WHERE email = ?',
            [email.toLowerCase()]
        );

        if (users.length === 0) {
            logger.warn('Login failed: User not found', { email, ip });
            return res.status(401).json({
                error: 'メールアドレスまたはパスワードが正しくありません'
            });
        }

        const user = users[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            logger.warn('Login failed: Invalid password', {
                userId: user.id,
                email,
                ip
            });
            return res.status(401).json({
                error: 'メールアドレスまたはパスワードが正しくありません'
            });
        }

        // JWTトークン生成
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        // 最終ログイン時刻を更新
        await db.query(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
        );

        const duration = Date.now() - startTime;
        logger.info('Login successful', {
            userId: user.id,
            email,
            ip,
            duration: `${duration}ms`
        });

        res.json({
            success: true,
            message: 'ログインに成功しました',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        logger.error('Login error', {
            error: error.message,
            stack: error.stack,
            email,
            ip
        });

        res.status(500).json({
            error: 'サーバーエラーが発生しました'
        });
    }
});

// ログアウト
router.post('/logout', authMiddleware, (req, res) => {
    logger.info('User logged out', {
        userId: req.userId,
        email: req.userEmail
    });

    res.json({
        success: true,
        message: 'ログアウトしました'
    });
});

module.exports = router;