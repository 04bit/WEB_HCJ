const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const logger = require('./config/logger');
const { requestLogger, errorLogger, performanceLogger } = require('./middleware/logging');

const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const userRoutes = require('./routes/user');

const app = express();
const port = process.env.SERVER_PORT || 59999;

logger.info('Starting application', {
  nodeVersion: process.version,
  environment: process.env.NODE_ENV || 'development',
  port: port
});

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// CORS設定
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:59999', 'http://127.0.0.1:59999'];

    if (process.env.NODE_ENV === 'development' || !origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length'],
  maxAge: 86400
};

app.use(cors(corsOptions));

// ボディパーサー
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// セキュリティヘッダー
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// ロギングミドルウェア
app.use(requestLogger);
app.use(performanceLogger(2000)); // 2秒以上かかるリクエストを警告

// APIルート
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/user', userRoutes);

// ヘルスチェック
app.get('/health', (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    port: port,
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };

  logger.debug('Health check accessed', health);
  res.json(health);
});

// 静的ファイル配信
app.use(express.static('.', {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true
}));

// ルートパス
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 404エラー
app.use((req, res) => {
  logger.warn('404 Not Found', {
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// エラーロギング
app.use(errorLogger);

// グローバルエラーハンドリング
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.userId
  });

  // JWTエラー
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // バリデーションエラー
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  // データベースエラー
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Duplicate entry' });
  }

  // CORS エラー
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS policy violation' });
  }

  // デフォルトエラー
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// 未処理のPromiseリジェクション
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason,
    promise: promise
  });
});

// 未処理の例外
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

// サーバー起動
const server = app.listen(port, () => {
  const startupMessage = [
    '='.repeat(50),
    `🚀 ${process.env.APP_NAME || '勤怠管理システム'}`,
    `📡 Server running on port ${port}`,
    `🌍 Environment: ${process.env.NODE_ENV || 'development'}`,
    `🏥 Health check: http://localhost:${port}/health`,
    `🔌 API Base URL: http://localhost:${port}/api`,
    `📄 Main page: http://localhost:${port}`,
    `📝 Logs directory: ./logs/`,
    '='.repeat(50)
  ].join('\n');

  console.log(startupMessage);
  logger.info('Server started successfully', {
    port: port,
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = app;