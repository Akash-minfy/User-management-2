/**

TOTP utils using speakeasy
*/
const speakeasy = require('speakeasy');

function generateSecret({ name, issuer } = {}) {
const secret = speakeasy.generateSecret({ name, issuer });
// secret.base32 used to show QR or store.
return secret;
}

function generateOTPToken(secret) {
return speakeasy.totp({
secret: secret,
encoding: 'base32'
});
}

function verifyToken({ token, secret }) {
return speakeasy.totp.verify({
secret,
encoding: 'base32',
token,
window: 2 // allow 2 time windows (60 seconds) for better user experience
});
}

module.exports = { generateSecret, generateOTPToken, verifyToken };