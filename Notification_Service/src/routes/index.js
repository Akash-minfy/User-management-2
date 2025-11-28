const express = require('express');
const invites = require('./invites');
const otp = require('./otp');

const router = express.Router();

router.use('/invites', invites);
router.use('/otp', otp);

module.exports = router;


