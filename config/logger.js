const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// ログディレクトリ
const logDir = 'logs';

// カスタムフォーマット
const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// コンソール用のカラーフォーマット
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
    })
);

// 日次ローテーションの設定
const dailyRotateFileTransport = new DailyRotateFile({
    filename: path.join(logDir, 'application-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    format: customFormat,
    level: 'info'
});

// エラーログ専用
const errorRotateFileTransport = new DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d',
    format: customFormat,
    level: 'error'
});

// Winstonロガーの作成
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: customFormat,
    transports: [
        dailyRotateFileTransport,
        errorRotateFileTransport
    ],
    exceptionHandlers: [
        new DailyRotateFile({
            filename: path.join(logDir, 'exceptions-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '30d'
        })
    ],
    rejectionHandlers: [
        new DailyRotateFile({
            filename: path.join(logDir, 'rejections-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '30d'
        })
    ]
});

// 開発環境ではコンソールにも出力
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat
    }));
}

// ログレベルの説明
// error: エラー（最優先）
// warn: 警告
// info: 情報（デフォルト）
// http: HTTPリクエスト
// verbose: 詳細情報
// debug: デバッグ情報
// silly: 最も詳細な情報

// 便利なヘルパーメソッド
logger.logRequest = (req, message = 'Request received') => {
    logger.http(message, {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: req.userId || 'anonymous'
    });
};

logger.logError = (error, context = {}) => {
    logger.error(error.message, {
        stack: error.stack,
        code: error.code,
        ...context
    });
};

logger.logAuth = (action, userId, email, success = true) => {
    const level = success ? 'info' : 'warn';
    logger.log(level, `Auth: ${action}`, {
        userId,
        email,
        success,
        timestamp: new Date().toISOString()
    });
};

logger.logDatabase = (action, details = {}) => {
    logger.info(`Database: ${action}`, details);
};

logger.logPerformance = (operation, duration, details = {}) => {
    logger.info(`Performance: ${operation}`, {
        duration: `${duration}ms`,
        ...details
    });
};

// ログディレクトリの作成確認
const fs = require('fs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    logger.info('Log directory created', { path: logDir });
}

logger.info('Logger initialized', {
    environment: process.env.NODE_ENV || 'development',
    level: logger.level
});

module.exports = logger;