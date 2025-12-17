const logger = require('../config/logger');

// HTTPリクエストのロギング
const requestLogger = (req, res, next) => {
    const startTime = Date.now();

    // レスポンス終了時にログ記録
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logData = {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent'),
            userId: req.userId || null,
            query: Object.keys(req.query).length > 0 ? req.query : undefined,
            body: req.method !== 'GET' && req.body ? sanitizeBody(req.body) : undefined
        };

        // ステータスコードに応じてログレベルを変更
        if (res.statusCode >= 500) {
            logger.error('Server Error', logData);
        } else if (res.statusCode >= 400) {
            logger.warn('Client Error', logData);
        } else {
            logger.http('Request completed', logData);
        }
    });

    next();
};

// エラーログミドルウェア
const errorLogger = (err, req, res, next) => {
    logger.error('Request Error', {
        error: err.message,
        stack: err.stack,
        method: req.method,
        path: req.path,
        userId: req.userId,
        body: sanitizeBody(req.body),
        query: req.query
    });

    next(err);
};

// 機密情報をサニタイズ
function sanitizeBody(body) {
    if (!body) return undefined;

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'currentPassword', 'newPassword'];

    sensitiveFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    });

    return sanitized;
}

// パフォーマンス監視ミドルウェア
const performanceLogger = (threshold = 1000) => {
    return (req, res, next) => {
        const startTime = Date.now();

        res.on('finish', () => {
            const duration = Date.now() - startTime;

            if (duration > threshold) {
                logger.warn('Slow Request Detected', {
                    method: req.method,
                    path: req.path,
                    duration: `${duration}ms`,
                    threshold: `${threshold}ms`,
                    userId: req.userId
                });
            }
        });

        next();
    };
};

// データベースクエリのロギング（オプション）
const logDatabaseQuery = (query, params, duration) => {
    logger.debug('Database Query', {
        query: query.substring(0, 200), // 長いクエリは切り詰める
        params: params ? sanitizeBody(params) : undefined,
        duration: `${duration}ms`
    });
};

module.exports = {
    requestLogger,
    errorLogger,
    performanceLogger,
    logDatabaseQuery
};