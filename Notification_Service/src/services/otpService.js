const mailer = require('../lib/mailer');
const templates = require('../templates/otp');
const rabbit = require('../lib/rabbit');

async function sendOtp({ toEmail, otp }) {
  const { subject, html, text } = templates.build({ otp, toEmail });
  try {
    await rabbit.publishEmailJob({ to: toEmail, subject, html, text });
  } catch (err) {
    await mailer.sendMail({ to: toEmail, subject, html, text });
  }
}

module.exports = { sendOtp };
