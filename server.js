const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');

const app = express();
const port = process.env.SERVER_PORT || 3000;

// シンプルなCORS設定（開発環境向け）
app.use(cors({
  origin: true, // 全てのオリジンを許可（開発環境）
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ミドルウェア
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// リクエストログ
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// APIルート
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    port: port
  });
});

// 静的ファイル配信
app.use(express.static('.'));

// 404エラー
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path
  });
});

// エラーハンドリング
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// サーバー起動
app.listen(port, () => {
  console.log('='.repeat(50));
  console.log(`🚀 Server is running on port ${port}`);
  console.log(`🏥 Health check: http://localhost:${port}/health`);
  console.log(`🔌 API Base URL: http://localhost:${port}/api`);
  console.log(`📄 Main page: http://localhost:${port}/index.html`);
  console.log('='.repeat(50));
});