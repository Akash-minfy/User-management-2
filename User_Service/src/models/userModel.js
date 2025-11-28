const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
email: { type: String, required: true, unique: true, index: true },
name: { type: String },
passwordHash: { type: String, required: true },
salt: { type: String }, // optional if using argon2 internal salt
roles: { type: [String], default: ['client_user'] },
// TOTP
isTOTPEnabled: { type: Boolean, default: false },
totpSecret: { type: String, select: false },
totpTempSecret: { type: String},
// Email OTP
isEmailOTPEnabled: { type: Boolean, default: false },
emailOtpTempCode: { type: String, select: false },
emailOtpTempExpiry: { type: Date, select: false },
emailOtpLastSent: { type: Date, select: false },
createdAt: { type: Date, default: Date.now },
updatedAt: { type: Date, default: Date.now },
metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
});

// update timestamp
UserSchema.pre('save', function(next) {
this.updatedAt = Date.now();
next();
});

const User = mongoose.model('User', UserSchema);
module.exports = User;