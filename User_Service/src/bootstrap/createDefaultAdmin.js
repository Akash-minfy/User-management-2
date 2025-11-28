const repositories = require('../repositories');
const { hashPassword } = require('../utils/hash');
const logger = require('../lib/logger');

async function createDefaultAdmin() {
const email = process.env.DEFAULT_ADMIN_EMAIL || 'minfy@gmail.com';
const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
const name = process.env.DEFAULT_ADMIN_NAME || 'Super Admin';
const enable = String(process.env.ENABLE_DEFAULT_ADMIN || 'true').toLowerCase() === 'true';

if (!enable) {
return;
}

try {
const existing = await repositories.userRepository.findByEmail(email, true);
if (!existing) {
const passwordHash = await hashPassword(password);
await repositories.userRepository.create({
email,
name,
passwordHash,
roles: ['super_admin'],
isTOTPEnabled: false,
totpSecret: null,
totpTempSecret: null,
});
logger.info(`Default super_admin created for ${email}`);
return;
}

// Ensure role present
const roles = Array.from(new Set([...(existing.roles || []), 'super_admin']));
if (roles.length !== (existing.roles || []).length) {
await repositories.userRepository.updateById(existing._id, { roles }, true);
logger.info(`Default super_admin role ensured for ${email}`);
}
} catch (err) {
logger.error('Failed to create/ensure default super_admin', err);
}
}

module.exports = { createDefaultAdmin };

