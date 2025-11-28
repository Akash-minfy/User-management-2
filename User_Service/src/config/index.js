// Helper to convert time string (e.g., '7d', '30d') to days
function parseDaysFromTimeString(timeString) {
  if (!timeString) return 7; // default 7 days
  const match = timeString.match(/^(\d+)([dhms])$/);
  if (!match) return 7;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 'd': return value;
    case 'h': return Math.ceil(value / 24);
    case 'm': return Math.ceil(value / (24 * 60));
    case 's': return Math.ceil(value / (24 * 60 * 60));
    default: return 7;
  }
}

module.exports = {
port: process.env.PORT || 4000,
appName: process.env.APP_NAME || 'UserService',
mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/user_service',
jwtSecret: process.env.JWT_SECRET || 'replace_me',
jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
jwtRefreshExpiresInDays: parseDaysFromTimeString(process.env.JWT_REFRESH_EXPIRES_IN || '7d'),
rateLimit: {
windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
max: Number(process.env.RATE_LIMIT_MAX || 100),
},
roleHierarchy: ['super_admin','site_admin','operator','client_admin','client_user'],
};