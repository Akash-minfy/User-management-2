const express = require('express');
const router = express.Router();
const controller = require('../controllers/otpController');
// This public endpoint can be used by the User_Service to deliver OTPs
router.post('/send', controller.sendOtp);
module.exports = router;
