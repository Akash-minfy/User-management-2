const jwt = require('jsonwebtoken');
const config = require('../config');

function sign(payload, opts = {}) {
const secret = process.env.JWT_SECRET || config.jwtSecret;
const expiresIn = opts.expiresIn || process.env.JWT_EXPIRES_IN || config.jwtExpiresIn;
return jwt.sign(payload, secret, { expiresIn });
}

function signRefresh(payload) {
const secret = process.env.JWT_SECRET || config.jwtSecret;
const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d'; // Default 7 days for refresh tokens
return jwt.sign(payload, secret, { expiresIn });
}

function verify(token) {
const secret = process.env.JWT_SECRET || config.jwtSecret;
return jwt.verify(token, secret);
}

module.exports = { sign, signRefresh, verify };