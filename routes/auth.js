const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// バリデーション関数
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePassword(password) {
    return password && password.length >= 6;
}

// ユーザー登録
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    // バリデーション
    if (!name || !email || !password) {
        return res.status(400).json({
            error: '全ての項目を入力してください'
        });
    }

    if (name.trim().length < 2) {
        return res.status(400).json({
            error: '氏名は2文字以上で入力してください'
        });
    }

    if (!validateEmail(email)) {
        return res.status(400).json({
            error: '有効なメールアドレスを入力してください'
        });
    }

    if (!validatePassword(password)) {
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

        console.log(`New user registered: ${email} (ID: ${result.insertId})`);

        res.status(201).json({
            success: true,
            message: 'ユーザー登録が完了しました',
            userId: result.insertId
        });
    } catch (error) {
        console.error('Registration error:', error);

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

// ログイン
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // バリデーション
    if (!email || !password) {
        return res.status(400).json({
            error: 'メールアドレスとパスワードを入力してください'
        });
    }

    if (!validateEmail(email)) {
        return res.status(400).json({
            error: '有効なメールアドレスを入力してください'
        });
    }

    try {
        // ユーザー検索
        const [users] = await db.query(
            'SELECT id, name, email, password FROM users WHERE email = ?',
            [email.toLowerCase()]
        );

        if (users.length === 0) {
            return res.status(401).json({
                error: 'メールアドレスまたはパスワードが正しくありません'
            });
        }

        const user = users[0];

        // パスワード検証
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                error: 'メールアドレスまたはパスワードが正しくありません'
            });
        }

        // JWTトークン生成
        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || '24h',
                issuer: 'attendance-system'
            }
        );

        console.log(`User logged in: ${email} (ID: ${user.id})`);

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
        console.error('Login error:', error);
        res.status(500).json({
            error: 'サーバーエラーが発生しました'
        });
    }
});

// トークン検証（オプション）
router.get('/verify', authMiddleware, async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, name, email FROM users WHERE id = ?',
            [req.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            valid: true,
            user: users[0]
        });
    } catch (error) {
        console.error('Verify error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// ログアウト（クライアント側でトークン削除）
router.post('/logout', authMiddleware, (req, res) => {
    console.log(`User logged out: ${req.userEmail} (ID: ${req.userId})`);
    res.json({
        success: true,
        message: 'ログアウトしました'
    });
});

// パスワードリセット（メール機能が必要）
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email || !validateEmail(email)) {
        return res.status(400).json({
            error: '有効なメールアドレスを入力してください'
        });
    }

    try {
        const [users] = await db.query(
            'SELECT id FROM users WHERE email = ?',
            [email.toLowerCase()]
        );

        // セキュリティのため、ユーザーが存在しなくても同じレスポンスを返す
        res.json({
            success: true,
            message: 'パスワードリセット用のメールを送信しました（実装予定）'
        });

        if (users.length > 0) {
            // TODO: メール送信処理を実装
            console.log(`Password reset requested for: ${email}`);
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

module.exports = router;