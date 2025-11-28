
const userService = require('../services/userService');
const { sanitizeUser, warnIfSensitiveData } = require('../utils/sanitize');
const jwtUtil = require('../utils/jwt');
const totpUtil = require('../utils/totp');
const QRCode = require('qrcode');

// ---------- AUTH ----------

async function signup(req, res) {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password required' });
    }
    const user = await userService.signup({ email, password, name });

    const safeUser = sanitizeUser(user);
    res.status(201).json({ user: safeUser });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const result = await userService.login({ email, password });

    if (result.tempToken) {
      // One of: password reset, totp setup, totp verify
      return res.json({
        message: result.message,
        tempToken: result.tempToken,
        totpSetupRequired: !!result.totpSetupRequired
      });
    }

    // Normal login path (shouldn't happen now unless explicitly allowed)
    const safeUser = sanitizeUser(result.user);
    return res.json({ token: result.token, refreshToken: result.refreshToken, user: safeUser });
  } catch (err) {
    console.error('Login error', err);
    return res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
}

async function loginTOTP(req, res) {
  try {
    const { token, tempToken } = req.body;
    if (!token || !tempToken) {
      return res.status(400).json({ message: 'token and tempToken required' });
    }
    if (!/^\d{6}$/.test(token)) {
      return res.status(400).json({ message: 'TOTP token must be 6 digits' });
    }

    const decoded = jwtUtil.verify(tempToken);
    if (!decoded || decoded.stage !== 'TOTP_PENDING') {
      return res.status(401).json({ message: 'Invalid or expired temp token' });
    }

    const user = await userService.getUserRaw(decoded.sub);
    if (!user || !user.isTOTPEnabled) {
      return res.status(400).json({ message: 'TOTP not enabled for this user' });
    }

    const verified = totpUtil.verifyToken({ token, secret: user.totpSecret });
    if (!verified) {
      return res.status(401).json({ message: 'Invalid TOTP code' });
    }

    const accessToken = jwtUtil.sign({ sub: user._id, email: user.email, roles: user.roles });
    
    // Generate refresh token
    const config = require('../config');
    const refreshTokenDays = config.jwtRefreshExpiresInDays || 7;
    const refreshTokenDoc = await require('../repositories').refreshTokenRepository.create(user._id, refreshTokenDays);
    const refreshToken = jwtUtil.signRefresh({
      sub: user._id.toString(),
      roles: user.roles,
      email: user.email,
      tokenId: refreshTokenDoc.token
    });
    
    const safeUser = sanitizeUser(user);

    // Mark invite as accepted on successful TOTP verification
    try {
      if (user.metadata && user.metadata.invited && user.metadata.inviteAccepted !== true) {
        await userService.updateProfile(user._id, { metadata: { ...(user.metadata || {}), inviteAccepted: true, inviteAcceptedAt: new Date() } });
      }
    } catch (_) {}

    res.json({ token: accessToken, refreshToken, user: safeUser });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
}

// ---------- PROFILE ----------

async function me(req, res) {
  try {
    const userId = req.user.sub;
    const user = await userService.getProfile(userId); // already sanitized
    res.json({ user });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
}

async function updateMe(req, res) {
  try {
    const userId = req.user.sub;
    const updates = req.body;
    const user = await userService.updateProfile(userId, updates); // already sanitized
    res.json({ user });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
}

// ---------- TOTP ----------

async function totpSetup(req, res) {
  try {
    const userId = req.user.sub;
    const secretObj = await userService.setupTOTP(userId, process.env.APP_NAME || 'UserService');

    // Generate QR code from otpauth URL
    const qrCodeDataURL = await QRCode.toDataURL(secretObj.otpauth_url);

    res.json({
      secret: secretObj.base32,
      otpauth_url: secretObj.otpauth_url,
      qr: qrCodeDataURL,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
}

async function totpVerify(req, res) {
  try {
    const userId = req.user.sub;
    const { token } = req.body;

    if (!token) return res.status(400).json({ message: 'TOTP token is required' });
    if (!/^\d{6}$/.test(token)) {
      return res.status(400).json({ message: 'TOTP token must be 6 digits' });
    }

    const user = await userService.getUserRaw(userId);
    if (!user || !user.totpTempSecret) {
      return res.status(400).json({ message: 'TOTP setup not initiated' });
    }

    const verified = await userService.verifyAndEnableTOTP(userId, token, user.totpTempSecret);

    // After enabling TOTP, issue a real JWT and return sanitized user
    const freshUser = await userService.getUserRaw(userId);
    const accessToken = jwtUtil.sign({ sub: freshUser._id, email: freshUser.email, roles: freshUser.roles });
    
    // Generate refresh token
    const config = require('../config');
    const refreshTokenDays = config.jwtRefreshExpiresInDays || 7;
    const refreshTokenDoc = await require('../repositories').refreshTokenRepository.create(freshUser._id, refreshTokenDays);
    const refreshToken = jwtUtil.signRefresh({
      sub: freshUser._id.toString(),
      roles: freshUser.roles,
      email: freshUser.email,
      tokenId: refreshTokenDoc.token
    });
    
    const safeUser = sanitizeUser(freshUser);
    res.json({ message: 'TOTP verified and enabled successfully', verified, token: accessToken, refreshToken, user: safeUser });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
}

async function totpDisable(req, res) {
  try {
    const userId = req.user.sub;
    const result = await userService.disableTOTP(userId);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
}

// ---------- Email OTP ----------

async function emailSetup(req, res) {
  try {
    const userId = req.user.sub;
    // initial setup — bypass resend rate limit
    const result = await userService.setupEmailOTP(userId, { isResend: false });
    res.json({ message: 'Email OTP sent', ...result });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
}

async function emailResend(req, res) {
  try {
    const userId = req.user.sub;
    // explicit resend — apply resend rate limit
    const result = await userService.setupEmailOTP(userId, { isResend: true });
    res.json({ message: 'Email OTP resent', ...result });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
}

async function emailVerify(req, res) {
  try {
    const userId = req.user.sub;
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Email OTP is required' });
    const verified = await userService.verifyAndEnableEmailOTP(userId, token);

    // After enabling email OTP, issue a real JWT and return sanitized user
    const freshUser = await userService.getUserRaw(userId);
    const accessToken = jwtUtil.sign({ sub: freshUser._id, email: freshUser.email, roles: freshUser.roles });
    const refreshTokenDays = require('../config').jwtRefreshExpiresInDays || 7;
    const refreshTokenDoc = await require('../repositories').refreshTokenRepository.create(freshUser._id, refreshTokenDays);
    const refreshToken = jwtUtil.signRefresh({ sub: freshUser._id.toString(), roles: freshUser.roles, email: freshUser.email, tokenId: refreshTokenDoc.token });
    const safeUser = sanitizeUser(freshUser);
    res.json({ message: 'Email OTP verified and enabled successfully', verified, token: accessToken, refreshToken, user: safeUser });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
}

async function emailDisable(req, res) {
  try {
    const userId = req.user.sub;
    const result = await userService.disableEmailOTP(userId);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
}

async function loginEmail(req, res) {
  try {
    const { token, tempToken } = req.body;
    const result = await userService.loginEmail({ token, tempToken });
    if (result.refreshToken) {
      return res.json({ token: result.token, refreshToken: result.refreshToken, user: sanitizeUser(result.user) });
    }
    return res.json({ token: result.token, user: sanitizeUser(result.user) });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
}

async function loginEmailResend(req, res) {
  try {
    const { tempToken } = req.body;
    if (!tempToken) return res.status(400).json({ message: 'tempToken required' });
    const decoded = jwtUtil.verify(tempToken);
    if (!decoded || decoded.stage !== 'EMAIL_PENDING') return res.status(401).json({ message: 'Invalid or expired temp token' });
    const result = await userService.issueLoginEmailOTP(decoded.sub);
    res.json({ message: 'Login email OTP resent', ...result });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
}

async function changePassword(req, res) {
  try {
    const { newPassword, tempToken } = req.body;

    if (!newPassword) return res.status(400).json({ message: 'newPassword required' });

    let userId = null;

    if (tempToken) {
      // Verify temp token must be PASSWORD_RESET stage
      try {
        const decoded = jwtUtil.verify(tempToken);
        if (!decoded || decoded.stage !== 'PASSWORD_RESET') {
          return res.status(401).json({ message: 'Invalid or expired temp token' });
        }
        userId = decoded.sub;
      } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired temp token' });
      }
    } else {
      // fallback to authenticated user
      if (!req.user || !req.user.sub) return res.status(401).json({ message: 'Not authenticated' });
      userId = req.user.sub;
    }

    const user = await userService.changePassword(userId, newPassword);
    return res.json({ message: 'Password changed successfully', user });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
}

// ---------- ROLE MGMT ----------

async function assignRole(req, res) {
  try {
    const granter = req.user;
    const targetUserId = req.params.id;
    const { role } = req.body;

    if (!role) return res.status(400).json({ message: 'role required' });

    const updated = await userService.assignRole(
      { id: granter.sub, roles: granter.roles },
      targetUserId,
      role
    );

    const safeUser = sanitizeUser(updated);
    res.json({ user: safeUser });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
}

async function inviteUpsert(req, res) {
  try {
    const granter = req.user; // roles from JWT
    const { email, role, tempPassword, name } = req.body;
    if (!email || !role) {
      return res.status(400).json({ message: 'email and role required' });
    }

    const result = await userService.inviteUpsert(
      { id: granter.sub, roles: granter.roles },
      { email, role, tempPassword, name }
    );

    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
}

// ---------- STATS ----------

async function stats(req, res) {
  try {
    const s = await userService.getStats();
    return res.status(200).json(s);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
}

// ---------- REFRESH TOKEN ----------

async function refreshToken(req, res) {
  try {
    const { refreshToken: refreshTokenValue } = req.body;
    if (!refreshTokenValue) {
      return res.status(400).json({ message: 'refreshToken required' });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwtUtil.verify(refreshTokenValue);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    if (!decoded.tokenId) {
      return res.status(401).json({ message: 'Invalid refresh token format' });
    }

    // Check if refresh token exists in database and is not revoked
    const tokenDoc = await require('../repositories').refreshTokenRepository.findByToken(decoded.tokenId);
    if (!tokenDoc) {
      return res.status(401).json({ message: 'Refresh token not found or revoked' });
    }

    // Get user to ensure they still exist and get latest roles
    const user = await userService.getUserRaw(decoded.sub);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Generate new access token
    const accessToken = jwtUtil.sign({
      sub: user._id.toString(),
      roles: user.roles,
      email: user.email
    });

    // Optionally rotate refresh token (generate new one and revoke old)
    const config = require('../config');
    const refreshTokenDays = config.jwtRefreshExpiresInDays || 7;
    const refreshTokenDoc = await require('../repositories').refreshTokenRepository.create(user._id, refreshTokenDays);
    await require('../repositories').refreshTokenRepository.revokeToken(decoded.tokenId);
    
    const newRefreshToken = jwtUtil.signRefresh({
      sub: user._id.toString(),
      roles: user.roles,
      email: user.email,
      tokenId: refreshTokenDoc.token
    });

    res.json({ 
      token: accessToken, 
      refreshToken: newRefreshToken 
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
}

// ---------- LOGOUT ----------

async function logout(req, res) {
  try {
    const { refreshToken: refreshTokenValue } = req.body;
    
    if (refreshTokenValue) {
      // Verify and revoke the refresh token
      try {
        const decoded = jwtUtil.verify(refreshTokenValue);
        if (decoded.tokenId) {
          await require('../repositories').refreshTokenRepository.revokeToken(decoded.tokenId);
        }
      } catch (err) {
        // Token might be invalid, but we still return success
      }
    } else if (req.user && req.user.sub) {
      // If authenticated, revoke all tokens for this user
      await require('../repositories').refreshTokenRepository.revokeAllUserTokens(req.user.sub);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
}

// ---------- INVITES ----------

async function listInvites(req, res) {
  try {
    const status = (req.query.status || 'pending').toString();
    const invites = await userService.listInvites(status, { limit: Number(req.query.limit || 100) });
    return res.status(200).json({ invites });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
}

module.exports = {
  signup,
  login,
  loginTOTP,
  me,
  updateMe,
  totpSetup,
  totpVerify,
  totpDisable,
  emailSetup,
  emailVerify,
  emailResend,
  emailDisable,
  loginEmail,
  loginEmailResend,
  changePassword,
  assignRole,
  inviteUpsert,
  stats,
  listInvites,
  refreshToken,
  logout,
};

