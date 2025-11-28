const express = require('express');
const controller = require('../controllers/inviteController');
const auth = require('../middlewares/auth');

const router = express.Router();

// POST /api/invites/send
router.post('/send', auth, controller.sendInvite);

module.exports = router;


