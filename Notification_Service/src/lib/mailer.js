const nodemailer = require('nodemailer');
const config = require('./config');
const logger = require('./logger');

let transporter;
if (!config.mail.host) {
  transporter = {
    async sendMail(mailOptions) {
      logger.info(`DEV MAIL -> to: ${mailOptions.to}, subject: ${mailOptions.subject}`);
      return { messageId: 'dev-' + Date.now() };
    }
  };
} else {
  transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: config.mail.auth.user ? {
      user: config.mail.auth.user,
      pass: config.mail.auth.pass,
    } : undefined,
  });
}

async function sendMail({ to, subject, html, text }) {
  const mailOptions = {
    from: config.mail.from,
    to,
    subject,
    html,
    text,
  };

  const info = await transporter.sendMail(mailOptions);
  logger.info(`Email sent: ${info.messageId}`);
  return info;
}

module.exports = { sendMail };


