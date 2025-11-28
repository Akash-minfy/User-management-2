const request = require('supertest');
const express = require('express');

// ---- Mock dependencies ----
jest.mock('../src/services/userService');
jest.mock('../src/utils/jwt');
jest.mock('../src/utils/totp');
jest.mock('qrcode');
jest.mock('../src/repositories');
jest.mock('../src/lib/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  inspect: jest.fn(),
}));

const userService = require('../src/services/userService');
const jwtUtil = require('../src/utils/jwt');
const totpUtil = require('../src/utils/totp');
const QRCode = require('qrcode');
const repositories = require('../src/repositories');

// Import controller
const userController = require('../src/controllers/userController');

// ---- Setup test Express app ----
const app = express();
app.use(express.json());

// Manually wire controller routes (simplified)
app.post('/signup', userController.signup);
app.post('/login', userController.login);
app.post('/login/totp', userController.loginTOTP);
app.post('/refresh', userController.refreshToken);
app.post('/logout', userController.logout);
app.get('/me', mockAuth, userController.me);
app.put('/me', mockAuth, userController.updateMe);
app.post('/totp/setup', mockAuth, userController.totpSetup);
app.post('/totp/verify', mockAuth, userController.totpVerify);
app.post('/totp/disable', mockAuth, userController.totpDisable);
app.post('/email/setup', mockAuth, userController.emailSetup);
app.post('/email/verify', mockAuth, userController.emailVerify);
app.post('/email/disable', mockAuth, userController.emailDisable);
app.post('/email/resend', mockAuth, userController.emailResend);
app.post('/login/email', userController.loginEmail);
app.post('/login/email/resend', userController.loginEmailResend);
app.post('/change-password', mockAuth, userController.changePassword);
app.post('/assign-role/:id', mockAuth, userController.assignRole);
app.post('/invite', mockAuth, userController.inviteUpsert);
app.get('/stats', userController.stats);
app.get('/invites', userController.listInvites);

// Mock authentication middleware
function mockAuth(req, res, next) {
  req.user = { sub: 'user123', email: 'test@example.com', roles: ['super_admin'] };
  next();
}

// ---- TESTS ----
describe('UserController', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to measure time
  async function measureTime(name, fn) {
    console.time(name);
    const result = await fn();
    console.timeEnd(name);
    return result;
  }

  // ---------- Signup ----------
  test('POST /signup - success', async () => {
    userService.signup.mockResolvedValue({ _id: 'u1', email: 'a@b.com', name: 'Test', roles: ['client_user'] });

    const res = await measureTime('POST /signup', () =>
      request(app).post('/signup').send({ email: 'a@b.com', password: '123456', name: 'Test' })
    );

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('a@b.com');
  });

  test('POST /signup - missing fields', async () => {
    const res = await measureTime('POST /signup - missing fields', () =>
      request(app).post('/signup').send({ email: 'a@b.com' })
    );
    expect(res.status).toBe(400);
  });

  // ---------- Login ----------
  test('POST /login - success with token and refreshToken', async () => {
    userService.login.mockResolvedValue({
      token: 'jwt-token',
      refreshToken: 'refresh-token',
      user: { _id: 'u1', email: 'a@b.com' },
    });

    const res = await measureTime('POST /login', () =>
      request(app).post('/login').send({ email: 'a@b.com', password: '123456' })
    );

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('jwt-token');
    expect(res.body.refreshToken).toBe('refresh-token');
  });

  test('POST /login - requires TOTP setup', async () => {
    userService.login.mockResolvedValue({
      message: 'TOTP setup required',
      tempToken: 'temp123',
      totpSetupRequired: true,
    });

    const res = await measureTime('POST /login - TOTP required', () =>
      request(app).post('/login').send({ email: 'a@b.com', password: '123456' })
    );

    expect(res.status).toBe(200);
    expect(res.body.totpSetupRequired).toBe(true);
  });

  // ---------- Login TOTP ----------
  test('POST /login/totp - success with refreshToken', async () => {
    jwtUtil.verify.mockReturnValue({ sub: 'u1', stage: 'TOTP_PENDING' });
    totpUtil.verifyToken.mockReturnValue(true);
    userService.getUserRaw.mockResolvedValue({ _id: 'u1', email: 'a@b.com', isTOTPEnabled: true, totpSecret: 'abc', roles: ['client_user'] });
    jwtUtil.sign.mockReturnValue('real-jwt');
    jwtUtil.signRefresh.mockReturnValue('refresh-jwt');
    repositories.refreshTokenRepository.create.mockResolvedValue({ token: 'db-token', userId: 'u1' });

    const res = await measureTime('POST /login/totp', () =>
      request(app).post('/login/totp').send({ token: '123456', tempToken: 'temp' })
    );

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('real-jwt');
    expect(res.body.refreshToken).toBe('refresh-jwt');
  });

  // ---------- Profile ----------
  test('GET /me - returns user', async () => {
    userService.getProfile.mockResolvedValue({ email: 'me@example.com' });

    const res = await measureTime('GET /me', () => request(app).get('/me'));
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@example.com');
  });

  test('PUT /me - updates profile', async () => {
    userService.updateProfile.mockResolvedValue({ email: 'me@updated.com' });

    const res = await measureTime('PUT /me', () =>
      request(app).put('/me').send({ name: 'Updated' })
    );

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@updated.com');
  });

  // ---------- TOTP Setup & Verify ----------
  test('POST /totp/setup - generates QR', async () => {
    userService.setupTOTP.mockResolvedValue({ base32: 'secret', otpauth_url: 'otpauth://...' });
    QRCode.toDataURL.mockResolvedValue('data:image/png;base64,...');

    const res = await measureTime('POST /totp/setup', () => request(app).post('/totp/setup'));
    expect(res.status).toBe(200);
    expect(res.body.secret).toBe('secret');
  });

  test('POST /totp/verify - success with refreshToken', async () => {
    userService.getUserRaw
      .mockResolvedValueOnce({ _id: 'u1', totpTempSecret: 'abc' })
      .mockResolvedValueOnce({ _id: 'u1', email: 'a@b.com', roles: ['client_user'] });
    userService.verifyAndEnableTOTP.mockResolvedValue({ success: true });
    jwtUtil.sign.mockReturnValue('new-jwt');
    jwtUtil.signRefresh.mockReturnValue('refresh-jwt');
    repositories.refreshTokenRepository.create.mockResolvedValue({ token: 'db-token', userId: 'u1' });

    const res = await measureTime('POST /totp/verify', () =>
      request(app).post('/totp/verify').send({ token: '123456' })
    );

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('new-jwt');
    expect(res.body.refreshToken).toBe('refresh-jwt');
  });

  // ---------- Email OTP Setup & Verify ----------
  test('POST /email/setup - sends OTP', async () => {
    userService.setupEmailOTP.mockResolvedValue({ success: true });

    const res = await measureTime('POST /email/setup', () => request(app).post('/email/setup').set('Authorization', 'Bearer token'));
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Email OTP sent');
  });

  test('POST /email/verify - enable email OTP', async () => {
    userService.verifyAndEnableEmailOTP.mockResolvedValue({ success: true });
    userService.getUserRaw.mockResolvedValueOnce({ _id: 'u1' }).mockResolvedValueOnce({ _id: 'u1', email: 'a@b.com', roles: ['client_user'] });
    jwtUtil.sign.mockReturnValue('new-jwt');
    jwtUtil.signRefresh.mockReturnValue('refresh-jwt');
    repositories.refreshTokenRepository.create.mockResolvedValue({ token: 'db-token', userId: 'u1' });

    const res = await measureTime('POST /email/verify', () => request(app).post('/email/verify').set('Authorization', 'Bearer token').send({ token: '123456' }));
    expect(res.status).toBe(200);
    expect(res.body.token).toBe('new-jwt');
  });

  test('POST /login/email - success with refreshToken', async () => {
    userService.loginEmail.mockResolvedValue({ token: 'jwt', refreshToken: 'refresh-jwt', user: { _id: 'u1', email: 'a@b.com' } });
    const res = await measureTime('POST /login/email', () => request(app).post('/login/email').send({ token: '123456', tempToken: 'temp' }));
    expect(res.status).toBe(200);
    expect(res.body.token).toBe('jwt');
  });

  test('POST /email/resend - rate limited when called too frequently', async () => {
    userService.setupEmailOTP
      .mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce({ status: 429, message: 'Too many OTP requests. Try again later.' });

    // first call sends successfully
    const res1 = await measureTime('POST /email/resend - first', () => request(app).post('/email/resend').set('Authorization', 'Bearer token'));
    expect(res1.status).toBe(200);

    // second call returns rate limit error
    const res2 = await measureTime('POST /email/resend - rate limited', () => request(app).post('/email/resend').set('Authorization', 'Bearer token'));
    expect(res2.status).toBe(429);
  });

  test('POST /login/email/resend - sends OTP on login flow', async () => {
    userService.issueLoginEmailOTP.mockResolvedValue({ success: true });
    const res = await measureTime('POST /login/email/resend', () => request(app).post('/login/email/resend').send({ tempToken: 'temp' }));
    expect(res.status).toBe(200);
  });

  // ---------- Role Assign ----------
  test('POST /assign-role/:id - success', async () => {
    userService.assignRole.mockResolvedValue({ email: 'b@c.com', roles: ['client_user', 'operator'] });

    const res = await measureTime('POST /assign-role/:id', () =>
      request(app).post('/assign-role/u2').send({ role: 'operator' })
    );

    expect(res.status).toBe(200);
    expect(res.body.user.roles).toContain('operator');
  });

  // ---------- Invite ----------
  test('POST /invite - success', async () => {
    userService.inviteUpsert.mockResolvedValue({ created: true, user: { email: 'invited@x.com' } });

    const res = await measureTime('POST /invite', () =>
      request(app).post('/invite').send({ email: 'invited@x.com', role: 'client_user', tempPassword: '123456' })
    );

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('invited@x.com');
  });

  // ---------- Stats ----------
  test('GET /stats - success', async () => {
    userService.getStats.mockResolvedValue({ totalUsers: 5, pendingInvites: 2 });

    const res = await measureTime('GET /stats', () => request(app).get('/stats'));
    expect(res.status).toBe(200);
    expect(res.body.totalUsers).toBe(5);
  });

  // ---------- Invites ----------
  test('GET /invites - success', async () => {
    userService.listInvites.mockResolvedValue([{ email: 'x@y.com' }]);

    const res = await measureTime('GET /invites', () =>
      request(app).get('/invites?status=pending')
    );

    expect(res.status).toBe(200);
    expect(res.body.invites[0].email).toBe('x@y.com');
  });

  // ---------- Refresh Token ----------
  test('POST /refresh - success', async () => {
    jwtUtil.verify.mockReturnValue({ sub: 'u1', tokenId: 'db-token', roles: ['client_user'], email: 'a@b.com' });
    repositories.refreshTokenRepository.findByToken.mockResolvedValue({ token: 'db-token', userId: 'u1' });
    userService.getUserRaw.mockResolvedValue({ _id: 'u1', email: 'a@b.com', roles: ['client_user'] });
    jwtUtil.sign.mockReturnValue('new-access-token');
    jwtUtil.signRefresh.mockReturnValue('new-refresh-token');
    repositories.refreshTokenRepository.create.mockResolvedValue({ token: 'new-db-token', userId: 'u1' });
    repositories.refreshTokenRepository.revokeToken.mockResolvedValue({ token: 'db-token', revokedAt: new Date() });

    const res = await measureTime('POST /refresh', () =>
      request(app).post('/refresh').send({ refreshToken: 'old-refresh-token' })
    );

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('new-access-token');
    expect(res.body.refreshToken).toBe('new-refresh-token');
    expect(repositories.refreshTokenRepository.revokeToken).toHaveBeenCalledWith('db-token');
  });

  test('POST /refresh - invalid token', async () => {
    jwtUtil.verify.mockImplementation(() => {
      throw new Error('Invalid token');
    });

    const res = await measureTime('POST /refresh - invalid', () =>
      request(app).post('/refresh').send({ refreshToken: 'invalid-token' })
    );

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Invalid or expired refresh token');
  });

  test('POST /refresh - missing tokenId', async () => {
    jwtUtil.verify.mockReturnValue({ sub: 'u1' }); // No tokenId

    const res = await measureTime('POST /refresh - missing tokenId', () =>
      request(app).post('/refresh').send({ refreshToken: 'token-without-id' })
    );

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid refresh token format');
  });

  test('POST /refresh - token not found in database', async () => {
    jwtUtil.verify.mockReturnValue({ sub: 'u1', tokenId: 'db-token' });
    repositories.refreshTokenRepository.findByToken.mockResolvedValue(null);

    const res = await measureTime('POST /refresh - not found', () =>
      request(app).post('/refresh').send({ refreshToken: 'token' })
    );

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Refresh token not found or revoked');
  });

  test('POST /refresh - missing refreshToken', async () => {
    const res = await measureTime('POST /refresh - missing', () =>
      request(app).post('/refresh').send({})
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('refreshToken required');
  });

  // ---------- Logout ----------
  test('POST /logout - success with refreshToken', async () => {
    jwtUtil.verify.mockReturnValue({ sub: 'u1', tokenId: 'db-token' });
    repositories.refreshTokenRepository.revokeToken.mockResolvedValue({ token: 'db-token', revokedAt: new Date() });

    const res = await measureTime('POST /logout', () =>
      request(app).post('/logout').send({ refreshToken: 'refresh-token' })
    );

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out successfully');
    expect(repositories.refreshTokenRepository.revokeToken).toHaveBeenCalledWith('db-token');
  });

  test('POST /logout - success without refreshToken (authenticated)', async () => {
    const res = await measureTime('POST /logout - authenticated', () =>
      request(app).post('/logout').set('Authorization', 'Bearer token')
    );

    // Since we're not using auth middleware in this test, it won't revoke all tokens
    // But the endpoint should still return success
    expect(res.status).toBe(200);
  });
});
