const { options } = require('../routes/auth');

// config/cors.js
require('dotenv').config();

const isDeveloment = process.env.NODE_ENV !== 'production';

const getAllowedOrigins = () => {
  if (isDeveloment) {
    return [
        'http://localhost:3306',
        'http://localhost:5500',
        'http://localhost:59999',
        'http://127.0.0.1:3306',
        'http://127.0.0.1:5500',
        'http://127.0.0.1:59999',
        'null'
    ];
  } else {
    const origins = process.env.ALLOWED_ORIGINS || '';
    return origins.split(',').filter(Boolean);
    }
};

const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = getAllowedOrigins();

        if(isDeveloment) {
            callback(null, true);
        } else {
            if (!origin || allowedOrigins.indexOf(origin) !== -1) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        }    
    },
    Credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS',  'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Length', 'X-Requested-With'],
    maxAge:86400,
    optionsSuccessStatus: 200
};