/**

Hash utility - prefer Argon2id, fallback to bcrypt if needed.
*/
const argon2 = require('argon2');
const bcrypt = require('bcrypt');

const useArgon = true;

async function hashPassword(password) {
if (useArgon) {
// argon2id with default parameters
return await argon2.hash(password, { type: argon2.argon2id });
}
// fallback
const saltRounds = 10;
const hash = await bcrypt.hash(password, saltRounds);
return hash;
}

async function verifyPassword(password, hash) {
if (!hash) return false;
// try argon2 verify first
try {
const ok = await argon2.verify(hash, password);
if (ok) return true;
} catch (err) {
// not argon hash
}
// fallback bcrypt
try {
return await bcrypt.compare(password, hash);
} catch (err) {
return false;
}
}

module.exports = { hashPassword, verifyPassword };