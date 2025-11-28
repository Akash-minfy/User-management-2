/**

Auth middleware to verify JWT and attach user to request
*/
const jwtUtil = require('../utils/jwt');

function authMiddleware(req, res, next) {
const auth = req.headers.authorization;
if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'Missing token' });
const token = auth.slice(7);
try {
const payload = jwtUtil.verify(token);
// payload expected: { sub: userId, roles: [...], email }
req.user = payload;
next();
} catch (err) {
return res.status(401).json({ message: 'Invalid token' });
}
}

module.exports = authMiddleware;