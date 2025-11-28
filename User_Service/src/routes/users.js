const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/userController');
const auth = require('../middlewares/auth');
const rbac = require('../middlewares/rbac');

// Auth routes
router.post('/auth/signup', ctrl.signup);
router.post('/auth/login/totp', ctrl.loginTOTP);
router.post('/auth/login/email', ctrl.loginEmail);
router.post('/auth/login/email/resend', ctrl.loginEmailResend);
router.post('/auth/login', ctrl.login);
router.post('/auth/refresh', ctrl.refreshToken);
router.post('/auth/logout', ctrl.logout);

// Change password: can be called with tempToken (first-login) or as authenticated user
router.post('/auth/change-password', ctrl.changePassword);


// TOTP routes (require auth)
router.post('/auth/totp/setup', auth, ctrl.totpSetup);
router.post('/auth/totp/verify', auth, ctrl.totpVerify);
router.post('/auth/totp/disable', auth, ctrl.totpDisable);

// Email OTP routes (require auth for setup/disable, login requires temp token)
router.post('/auth/email/setup', auth, ctrl.emailSetup);
router.post('/auth/email/verify', auth, ctrl.emailVerify);
router.post('/auth/email/disable', auth, ctrl.emailDisable);
router.post('/auth/email/resend', auth, ctrl.emailResend);

// Profile
router.get('/users/me', auth, ctrl.me);
router.patch('/users/me', auth, ctrl.updateMe);

// Role assignment (only higher roles should be able; also enforce in service)
router.post('/users/assign-role/:id', auth, ctrl.assignRole);

// Invite upsert: create user with temp password or add role to existing
router.post('/users/invite-upsert', auth, ctrl.inviteUpsert);



// Optionally: admin-only list
router.get('/users', auth, rbac.requireRoles(['super_admin','site_admin']), async (req, res) => {
  try {
    const limit = Number(req.query.limit || 50);
    const users = await require('../services/userService').listUsers({ limit });
    res.status(200).json({ users });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
});

// Stats
router.get('/users/stats', auth, rbac.requireRoles(['super_admin','site_admin']), ctrl.stats);
router.get('/users/invites', auth, rbac.requireRoles(['super_admin','site_admin','operator','client_admin']), ctrl.listInvites);

module.exports = router;