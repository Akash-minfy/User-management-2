const otpService = require('../services/otpService');

async function sendOtp(req, res) {
  try {
    const { to, otp } = req.body;
    if (!to || !otp) {
      return res.status(400).json({ message: 'to and otp are required' });
    }
    await otpService.sendOtp({ toEmail: to, otp });
    return res.json({ message: 'OTP email queued' });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
}

module.exports = { sendOtp };
