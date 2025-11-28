const config = require('../lib/config');

const ROLE_HIERARCHY = config.roleHierarchy || [
  'super_admin',
  'site_admin',
  'operator',
  'client_admin',
  'client_user'
];

function roleIndex(role) {
  return ROLE_HIERARCHY.indexOf(role);
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function canAssignRole(inviterRoles = [], targetRole) {
  const targetIdx = roleIndex(targetRole);
  if (targetIdx === -1) return false;
  return inviterRoles.some(r => {
    const idx = roleIndex(normalizeRole(r));
    return idx !== -1 && idx < targetIdx;
  });
}

module.exports = { ROLE_HIERARCHY, roleIndex, canAssignRole, normalizeRole };


