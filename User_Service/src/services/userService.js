// userService.js (updated - OTP persistence & send fixes)

const repositories = require('../repositories');
const { hashPassword, verifyPassword } = require('../utils/hash');
const jwtUtil = require('../utils/jwt');
const totpUtil = require('../utils/totp');
const config = require('../config');
const { sanitizeUser, warnIfSensitiveData } = require('../utils/sanitize');

// Robust fetch handling: use global fetch if present, otherwise attempt to load node-fetch.
// This avoids "fetch is not a function" problems in Node environments.
let fetchFn = global.fetch;
if (!fetchFn) {
  try {
    // Try commonjs-compatible node-fetch v2 first (works with require)
    // If project uses v3 (ESM), the require will throw and we will dynamically import as fallback.
    // npm i node-fetch@2 will make the require succeed.
    // eslint-disable-next-line global-require
    const nf = require('node-fetch'); // works for v2
    fetchFn = nf;
  } catch (e) {
    // dynamic import for node-fetch v3 or other ESM-only installs
    (async () => {
      try {
        const mod = await import('node-fetch');
        fetchFn = mod.default || mod;
      } catch (err) {
        // leave fetchFn undefined; sendEmailOtp will log and skip sending
        console.warn('fetch not available and node-fetch import failed:', err);
      }
    })();
  }
}

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

async function getUserRaw(userId) {
  return repositories.userRepository.findById(userId, true); // include sensitive data like totpSecret
}

function canAssignRole(granterRoles = [], targetRole) {
  const targetIdx = roleIndex(targetRole);
  if (targetIdx === -1) return false;
  return granterRoles.some(r => roleIndex(r) !== -1 && roleIndex(r) < targetIdx);
}

// ------------------------ Auth & Signup/Login ------------------------

async function signup({ email, password, name }) {
  const existing = await repositories.userRepository.findByEmail(email);
  if (existing) throw { status: 409, message: 'Email already registered' };

  const passwordHash = await hashPassword(password);

  const user = await repositories.userRepository.create({
    email,
    name,
    passwordHash,
    roles: ['client_user'],
    isTOTPEnabled: false,
    totpSecret: null,
    totpTempSecret: null,
    isEmailOTPEnabled: false
  });

  return user;
}

async function login({ email, password }) {
  try {
    const user = await repositories.userRepository.findByEmail(email, true); // include sensitive data
    if (!user) throw { status: 401, message: 'Invalid credentials' };

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw { status: 401, message: 'Invalid credentials' };

    // If the user must change password, divert to password reset flow
    if (user.metadata && user.metadata.requirePasswordChange === true) {
      const tempToken = jwtUtil.sign({
        sub: user._id.toString(),
        email: user.email,
        roles: user.roles,
        stage: 'PASSWORD_RESET'
      }, '10m');
      return { message: 'PASSWORD_RESET_REQUIRED', tempToken, user };
    }

    // 2FA flow - TOTP or Email OTP
    if (user.isTOTPEnabled) {
      // If enabled but not configured yet, require setup (QR) on login
      if (!user.totpSecret) {
        const tempTokenSetup = jwtUtil.sign({
          sub: user._id.toString(),
          roles: user.roles,
          email: user.email,
          stage: 'TOTP_PENDING_SETUP'
        }, '10m');
        return { message: 'TOTP setup required', tempToken: tempTokenSetup, user, totpSetupRequired: true };
      }
      // If configured, require TOTP verification
      const tempTokenVerify = jwtUtil.sign({
        sub: user._id.toString(),
        roles: user.roles,
        email: user.email,
        stage: 'TOTP_PENDING'
      }, '5m');
      return { message: 'TOTP required', tempToken: tempTokenVerify, user, totpSetupRequired: false, twofaMethod: 'TOTP' };
    }

    if (user.isEmailOTPEnabled) {
      // Emit temporary token and send email OTP during login
      const tempTokenVerify = jwtUtil.sign({
        sub: user._id.toString(),
        roles: user.roles,
        email: user.email,
        stage: 'EMAIL_PENDING'
      }, '5m');

      // Generate OTP and email to user (issueLoginEmailOTP handles DB update + send)
      try {
        await issueLoginEmailOTP(user._id);
      } catch (err) {
        console.warn('Failed to send login email OTP', err);
      }
      return { message: 'EMAIL required', tempToken: tempTokenVerify, user, twofaMethod: 'EMAIL' };
    }

    // Not enabled: issue normal token
    // If the user was invited, mark invite as accepted on first successful auth
    if (user.metadata && user.metadata.invited && user.metadata.inviteAccepted !== true) {
      try {
        await repositories.userRepository.updateById(user._1d, {
          metadata: { ...(user.metadata || {}), inviteAccepted: true, inviteAcceptedAt: new Date() }
        }, true);
      } catch (_) {}
    }
    const accessToken = jwtUtil.sign({
      sub: user._id.toString(),
      roles: user.roles,
      email: user.email
    });

    // Generate refresh token
    const refreshTokenDays = config.jwtRefreshExpiresInDays || 7;
    const refreshTokenDoc = await repositories.refreshTokenRepository.create(user._id, refreshTokenDays);
    const refreshToken = jwtUtil.signRefresh({
      sub: user._id.toString(),
      roles: user.roles,
      email: user.email,
      tokenId: refreshTokenDoc.token
    });

    return { token: accessToken, refreshToken, user };
  } catch (err) {
    console.error(`Login service error for user=${email}`, err);
    throw err; // rethrow to be handled by controller
  }
}

// ------------------------ Profile ------------------------

async function getProfile(userId) {
  const user = await repositories.userRepository.findById(userId);
  if (!user) throw { status: 404, message: 'User not found' };

  return sanitizeUser(user);
}

async function updateProfile(userId, update) {
  delete update.passwordHash;
  delete update.totpSecret;
  delete update.totpTempSecret;

  const user = await repositories.userRepository.updateById(userId, update);
  if (!user) throw { status: 404, message: 'User not found' };

  return sanitizeUser(user);
}

// ------------------------ TOTP ------------------------

async function setupTOTP(userId, issuer = 'UserService') {
  const secretObj = totpUtil.generateSecret({ issuer, name: `user:${userId}` });

  // Save temporarily so we can verify later
  await repositories.userRepository.updateById(userId, {
    totpTempSecret: secretObj.base32
  }, true); // includeSensitive true so caller can inspect if needed

  return secretObj; // client still gets base32 + otpauth_url
}

async function verifyAndEnableTOTP(userId, token, base32Secret) {
  const ok = totpUtil.verifyToken({ token, secret: base32Secret });
  if (!ok) throw { status: 400, message: 'Invalid TOTP token' };

  // Move temp secret to permanent field
  const user = await repositories.userRepository.updateById(userId, {
    isTOTPEnabled: true,
    totpSecret: base32Secret,
    totpTempSecret: null
  }, true);

  if (!user) throw { status: 404, message: 'User not found' };
  return { success: true };
}

async function disableTOTP(userId) {
  await repositories.userRepository.updateById(userId, {
    isTOTPEnabled: false,
    totpSecret: null,
    totpTempSecret: null
  }, true);
  return { success: true, message: 'TOTP disabled' };
}

// ------------------------ Email OTP ------------------------

function generateOtpCode(length = 6) {
  const max = 10 ** length;
  const num = Math.floor(Math.random() * max);
  return String(num).padStart(length, '0');
}

const EMAIL_OTP_RESEND_WINDOW_MS = Number(process.env.EMAIL_OTP_RESEND_WINDOW_MS || 60000);

/**
 * Send OTP via notification service (centralized).
 * If fetch is not available, we log and return without throwing, so caller can retry.
 */
async function sendEmailOtp(toEmail, otp) {
  if (!toEmail) {
    console.warn('sendEmailOtp: no email provided');
    return;
  }
  const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5001';
  if (!fetchFn) {
    console.warn('sendEmailOtp: fetch not available; skipping send');
    return;
  }
  try {
    await fetchFn(notificationUrl + '/api/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: toEmail, otp })
    });
  } catch (err) {
    console.warn('Failed to call notification service', err);
  }
}

/**
 * Setup or resend an Email OTP for enabling Email-based 2FA
 * @param {string} userId
 * @param {Object} opts
 * @param {boolean} opts.isResend
 */
async function setupEmailOTP(userId, { isResend = false } = {}) {
  const user = await repositories.userRepository.findById(userId, true);
  if (!user) throw { status: 404, message: 'User not found' };

  if (isResend && user.emailOtpLastSent && (Date.now() - new Date(user.emailOtpLastSent).getTime()) < EMAIL_OTP_RESEND_WINDOW_MS) {
    throw { status: 429, message: `Too many OTP requests. Try again later.` };
  }

  const otp = generateOtpCode(6);
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // IMPORTANT: set includeSensitive = true so caller sees the persisted fields and for correct debug visibility
  const updated = await repositories.userRepository.updateById(userId, {
    emailOtpTempCode: otp,
    emailOtpTempExpiry: expiry,
    emailOtpLastSent: new Date()
  }, true);

  // Logging to help debug "not saved" reports
  if (!updated) {
    console.warn(`setupEmailOTP: updateById returned falsy for user=${userId}`);
  } else {
    console.log(`setupEmailOTP: saved OTP for user=${userId} (email=${user.email})`);
  }

  // send email (only once)
  try {
    await sendEmailOtp(user.email, otp);
  } catch (err) {
    console.warn('Failed to send email OTP during setup', err);
  }

  return { success: true };
}

async function verifyAndEnableEmailOTP(userId, code) {
  const user = await repositories.userRepository.findById(userId, true);
  if (!user) throw { status: 404, message: 'User not found' };
  if (!user.emailOtpTempCode || !user.emailOtpTempExpiry) {
    throw { status: 400, message: 'Email OTP setup not initiated' };
  }
  if (new Date() > new Date(user.emailOtpTempExpiry)) {
    throw { status: 400, message: 'Email OTP expired' };
  }
  if (String(code) !== String(user.emailOtpTempCode)) {
    throw { status: 401, message: 'Invalid email OTP' };
  }

  // Enable and clear temp fields - includeSensitive true so returned doc includes sensitive fields (if used)
  const updated = await repositories.userRepository.updateById(userId, {
    isEmailOTPEnabled: true,
    emailOtpTempCode: null,
    emailOtpTempExpiry: null
  }, true);

  return { success: true };
}

async function disableEmailOTP(userId) {
  await repositories.userRepository.updateById(userId, {
    isEmailOTPEnabled: false,
    emailOtpTempCode: null,
    emailOtpTempExpiry: null
  }, true);
  return { success: true, message: 'Email OTP disabled' };
}

async function issueLoginEmailOTP(userId) {
  const user = await repositories.userRepository.findById(userId, true);
  if (!user) throw { status: 404, message: 'User not found' };
  if (user.emailOtpLastSent && (Date.now() - new Date(user.emailOtpLastSent).getTime()) < EMAIL_OTP_RESEND_WINDOW_MS) {
    throw { status: 429, message: `Too many OTP requests. Try again later.` };
  }
  const otp = generateOtpCode(6);
  const expiry = new Date(Date.now() + 10 * 60 * 1000);

  const updated = await repositories.userRepository.updateById(userId, {
    emailOtpTempCode: otp,
    emailOtpTempExpiry: expiry,
    emailOtpLastSent: new Date()
  }, true);

  if (!updated) {
    console.warn(`issueLoginEmailOTP: updateById returned falsy for user=${userId}`);
  } else {
    console.log(`issueLoginEmailOTP: saved login OTP for user=${userId} (email=${user.email})`);
  }

  try {
    await sendEmailOtp(user.email, otp);
  } catch (err) {
    console.warn('Failed to send login OTP email', err);
  }
  return { success: true };
}

async function loginEmail({ token, tempToken }) {
  if (!token || !tempToken) throw { status: 400, message: 'token and tempToken required' };
  if (!/^\d{6}$/.test(token)) throw { status: 400, message: 'Email OTP token must be 6 digits' };
  const decoded = jwtUtil.verify(tempToken);
  if (!decoded || decoded.stage !== 'EMAIL_PENDING') throw { status: 401, message: 'Invalid or expired temp token' };
  const user = await repositories.userRepository.findById(decoded.sub, true);
  if (!user || !user.isEmailOTPEnabled) throw { status: 400, message: 'Email OTP not enabled for this user' };
  if (!user.emailOtpTempCode || !user.emailOtpTempExpiry) throw { status: 400, message: 'Email OTP not issued' };
  if (new Date() > new Date(user.emailOtpTempExpiry)) throw { status: 400, message: 'Email OTP expired' };
  if (String(token) !== String(user.emailOtpTempCode)) throw { status: 401, message: 'Invalid email OTP code' };

  // Issue final tokens
  const accessToken = jwtUtil.sign({ sub: user._id, email: user.email, roles: user.roles });
  const refreshTokenDays = config.jwtRefreshExpiresInDays || 7;
  const refreshTokenDoc = await require('../repositories').refreshTokenRepository.create(user._id, refreshTokenDays);
  const refreshToken = jwtUtil.signRefresh({ sub: user._id.toString(), roles: user.roles, email: user.email, tokenId: refreshTokenDoc.token });

  // Clear temp fields (includeSensitive true)
  await repositories.userRepository.updateById(user._id, { emailOtpTempCode: null, emailOtpTempExpiry: null, emailOtpLastSent: null }, true);

  return { token: accessToken, refreshToken, user };
}

// ------------------------ Roles, invites, exports (unchanged) ------------------------

async function assignRole(granterUser, targetUserId, roleToAssign) {
  if (!ROLE_HIERARCHY.includes(roleToAssign)) {
    throw { status: 400, message: 'Invalid role' };
  }

  if (!canAssignRole(granterUser.roles, roleToAssign)) {
    throw { status: 403, message: 'Insufficient permission to assign this role' };
  }

  const target = await repositories.userRepository.findById(targetUserId);
  if (!target) throw { status: 404, message: 'Target user not found' };

  const roles = Array.from(new Set([...(target.roles || []), roleToAssign]));
  const updated = await repositories.userRepository.updateById(targetUserId, { roles });

  return sanitizeUser(updated);
}

async function listUsers({ limit = 50 } = {}) {
  const visibilityFilter = { $or: [ { 'metadata.invited': { $ne: true } }, { 'metadata.inviteAccepted': true } ] };
  const users = await repositories.userRepository.findAll(visibilityFilter, { limit });
  return users.map(u => sanitizeUser(u));
}

async function getStats() {
  const visibleFilter = { $or: [ { 'metadata.invited': { $ne: true } }, { 'metadata.inviteAccepted': true } ] };
  const totalUsers = await repositories.userRepository.countAll(visibleFilter);
  const pendingInvites = await repositories.userRepository.countAll({ 'metadata.invited': true, 'metadata.inviteAccepted': { $ne: true } });
  const acceptedInvites = await repositories.userRepository.countAll({ 'metadata.inviteAccepted': true });
  return { totalUsers, pendingInvites, acceptedInvites };
}

async function inviteUpsert(granterUser, { email, role, tempPassword, name }) {
  if (!ROLE_HIERARCHY.includes(role)) {
    throw { status: 400, message: 'Invalid role' };
  }
  if (role === 'super_admin') {
    throw { status: 403, message: 'Cannot invite super_admin via email' };
  }
  if (!canAssignRole(granterUser.roles, role)) {
    throw { status: 403, message: 'Insufficient permission to assign this role' };
  }

  const existing = await repositories.userRepository.findByEmail(email, true);
  if (!existing) {
    if (!tempPassword) {
      throw { status: 400, message: 'tempPassword required for new user' };
    }
    const passwordHash = await hashPassword(tempPassword);
    const user = await repositories.userRepository.create({
      email,
      name,
      passwordHash,
      roles: [role],
      isTOTPEnabled: false,
      totpSecret: null,
      totpTempSecret: null,
      metadata: { invited: true, invitedAt: new Date(), invitedRole: role, inviteAccepted: false, requirePasswordChange: true }
    });
    return { created: true, user: sanitizeUser(user) };
  }

  const roles = Array.from(new Set([...(existing.roles || []), role]));
  const updated = await repositories.userRepository.updateById(existing._id, {
    roles,
    ...(name ? { name } : {}),
    metadata: { ...(existing.metadata || {}), invited: true, invitedAt: new Date(), invitedRole: role }
  });
  return { created: false, user: sanitizeUser(updated) };
}

async function listInvites(status = 'pending', { limit = 100 } = {}) {
  const users = await repositories.userRepository.findInvites(status, { limit });
  return users.map(u => sanitizeUser(u));
}

module.exports = {
  signup,
  login,
  getProfile,
  updateProfile,
  setupTOTP,
  verifyAndEnableTOTP,
  disableTOTP,
  // email OTP
  setupEmailOTP,
  resendSetupEmailOTP: setupEmailOTP,
  verifyAndEnableEmailOTP,
  disableEmailOTP,
  issueLoginEmailOTP,
  loginEmail,
  assignRole,
  listUsers,
  getStats,
  inviteUpsert,
  async changePassword(userId, newPassword) {
    if (!newPassword || newPassword.length < 6) {
      throw { status: 400, message: 'Password must be at least 6 characters' };
    }
    const user = await repositories.userRepository.findById(userId, true);
    if (!user) throw { status: 404, message: 'User not found' };

    const passwordHash = await hashPassword(newPassword);
    const updated = await repositories.userRepository.updateById(userId, {
      passwordHash,
      metadata: { ...(user.metadata || {}), requirePasswordChange: false }
    }, true);

    return sanitizeUser(updated);
  },
  listInvites,
  getUserRaw,
  ROLE_HIERARCHY
};
