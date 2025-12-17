const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

const authMiddleware = (req, res, next) => {
    try {
        // Extract the token from the Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.warn('Unauthorized access attempt', {
                path: req.path,
                ip: req.ip,
                reason: 'Missing or invalid Authorization header'
            });
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach the user ID and email to the request
        req.userId = decoded.userId;
        req.userEmail = decoded.email;

        logger.debug('Auth successful', {
            userId: decoded.userId,
            email: decoded.email,
            path: req.path
        });

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            logger.warn('Invalid token', {
                path: req.path,
                ip: req.ip,
                error: error.message
            });
            return res.status(401).json({ error: 'Invalid token' });
        }
        if (error.name === 'TokenExpiredError') {
            logger.warn('Expired token', {
                path: req.path,
                ip: req.ip,
                expiredAt: error.expiredAt
            });
            return res.status(401).json({ error: 'Token has expired' });
        }

        logger.error('Auth middleware error', {
            error: error.message,
            stack: error.stack,
            path: req.path
        });
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = authMiddleware;