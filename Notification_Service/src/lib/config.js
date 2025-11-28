module.exports = {
  port: process.env.NOTIFICATION_PORT || 5001,
  appName: process.env.NOTIFICATION_APP_NAME || 'NotificationService',
  roleHierarchy: (process.env.ROLE_HIERARCHY || 'super_admin,site_admin,operator,client_admin,client_user').split(',').map(s => s.trim()),
  jwt: {
    secret: process.env.JWT_SECRET || 'replace_me',
    audience: process.env.JWT_AUD || undefined,
    issuer: process.env.JWT_ISS || undefined,
  },
  mail: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    from: process.env.MAIL_FROM || 'no-reply@socialens.io'
  },
  mq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost',
    emailQueue: process.env.EMAIL_QUEUE || 'email.invites'
  }
};


