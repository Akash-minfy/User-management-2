/**

RBAC middleware to require at least one role from allowedRoles
*/
function requireRoles(allowedRoles = []) {
return (req, res, next) => {
if (!req.user || !req.user.roles) return res.status(401).json({ message: 'Unauthorized' });
const userRoles = req.user.roles || [];
const ok = userRoles.some(r => allowedRoles.includes(r));
if (!ok) return res.status(403).json({ message: 'Forbidden' });
next();
};
}

module.exports = { requireRoles };