/**
 * Utility functions for sanitizing user objects to prevent sensitive data leakage
 */

const SENSITIVE_FIELDS = [
  'passwordHash',
  'salt',
  'totpSecret',
  'totpTempSecret',
  'emailOtpTempCode',
  'emailOtpTempExpiry',
  'emailOtpLastSent',
  '__v' // MongoDB version key
];

/**
 * Safely sanitize a user object by removing sensitive fields
 * @param {Object} user - User object (can be mongoose document or plain object)
 * @param {Array} additionalFields - Additional fields to remove
 * @returns {Object} Sanitized user object
 */
function sanitizeUser(user, additionalFields = []) {
  if (!user) return null;

  // Convert mongoose document to plain object if needed
  const userObj = user.toObject ? user.toObject() : { ...user };
  
  // Remove sensitive fields
  const fieldsToRemove = [...SENSITIVE_FIELDS, ...additionalFields];
  fieldsToRemove.forEach(field => {
    delete userObj[field];
  });

  return userObj;
}

/**
 * Safely sanitize an array of user objects
 * @param {Array} users - Array of user objects
 * @param {Array} additionalFields - Additional fields to remove
 * @returns {Array} Array of sanitized user objects
 */
function sanitizeUsers(users, additionalFields = []) {
  if (!Array.isArray(users)) return [];
  return users.map(user => sanitizeUser(user, additionalFields));
}

/**
 * Check if a user object contains sensitive data
 * @param {Object} user - User object to check
 * @returns {boolean} True if sensitive data is present
 */
function hasSensitiveData(user) {
  if (!user) return false;
  return SENSITIVE_FIELDS.some(field => user[field] !== undefined);
}

/**
 * Log warning if sensitive data is detected in user object
 * @param {Object} user - User object to check
 * @param {string} context - Context where the check is happening
 */
function warnIfSensitiveData(user, context = 'unknown') {
  if (hasSensitiveData(user)) {
    console.warn(`⚠️  SECURITY WARNING: Sensitive data detected in user object at ${context}`);
    console.warn('Fields detected:', SENSITIVE_FIELDS.filter(field => user[field] !== undefined));
  }
}

module.exports = {
  sanitizeUser,
  sanitizeUsers,
  hasSensitiveData,
  warnIfSensitiveData,
  SENSITIVE_FIELDS
};

