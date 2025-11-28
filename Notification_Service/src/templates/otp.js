const config = require('../lib/config');

function build({ otp, toEmail }) {
  const company = config.companyName || 'MyApp';
  const subject = `[${company}] Your verification code`;
  const text = `Hello,\n\nYour verification code is ${otp}. It will expire in 10 minutes.\n\nIf you did not request this, please contact support.\n\nRegards,\n${company}`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #222">
      <h2>${company}</h2>
      <p>Hello,</p>
      <p>Your verification code is <strong>${otp}</strong>.</p>
      <p>This code will expire in 10 minutes. If you didn't request this, please contact support.</p>
      <p>Regards,<br/>${company}</p>
    </div>
  `;
  return { subject, text, html };
}

module.exports = { build };
