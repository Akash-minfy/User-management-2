const jwt = require('jsonwebtoken');
const config = require('../lib/config');

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing token' });
  }

  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.secret, {
      audience: config.jwt.audience,
      issuer: config.jwt.issuer,
    });
    // expected payload: { sub, email, roles: [...] }
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

module.exports = authMiddleware;


