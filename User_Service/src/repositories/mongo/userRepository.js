const User = require('../../models/userModel');

class MongoUserRepository {
async create(userObj, includeSensitive = false) {
const user = new User(userObj);
const savedUser = await user.save();
if (includeSensitive) {
return savedUser;
}
// Return sanitized version by default
const sanitized = savedUser.toObject();
delete sanitized.passwordHash;
delete sanitized.totpSecret;
delete sanitized.totpTempSecret;
delete sanitized.salt;
delete sanitized.__v;
return sanitized;
}

async findByEmail(email, includeSensitive = false) {
if (includeSensitive) {
  return await User.findOne({ email }).select('+totpSecret +emailOtpTempCode +emailOtpTempExpiry +emailOtpLastSent').exec();
}
// Exclude sensitive fields by default
  return await User.findOne({ email }).select('-passwordHash -totpSecret -totpTempSecret -emailOtpTempCode -emailOtpTempExpiry -emailOtpLastSent -salt -__v').exec();
}

async findById(id, includeSensitive = false) {
if (includeSensitive) {
  return await User.findById(id).select('+totpSecret +emailOtpTempCode +emailOtpTempExpiry +emailOtpLastSent').exec();
}
// Exclude sensitive fields by default
  return await User.findById(id).select('-passwordHash -totpSecret -totpTempSecret -emailOtpTempCode -emailOtpTempExpiry -emailOtpLastSent -salt -__v').exec();
}

async updateById(id, update, includeSensitive = false) {
if (includeSensitive) {
  return await User.findByIdAndUpdate(id, update, { new: true }).select('+totpSecret +emailOtpTempCode +emailOtpTempExpiry +emailOtpLastSent').exec();
}
// Exclude sensitive fields by default
  return await User.findByIdAndUpdate(id, update, { new: true }).select('-passwordHash -totpSecret -totpTempSecret -emailOtpTempCode -emailOtpTempExpiry -emailOtpLastSent -salt -__v').exec();
}

async findAll(filter = {}, options = {}) {
return await User.find(filter).limit(options.limit || 50).exec();
}

  async countAll(filter = {}) {
    return await User.countDocuments(filter).exec();
  }

  async findInvites(status = 'pending', options = {}) {
    const base = { 'metadata.invited': true };
    const filter = status === 'accepted'
      ? { ...base, 'metadata.inviteAccepted': true }
      : { ...base, 'metadata.inviteAccepted': { $ne: true } };
    return await User.find(filter)
      .select('-passwordHash -totpSecret -totpTempSecret -emailOtpTempCode -emailOtpTempExpiry -salt -__v')
      .limit(options.limit || 100)
      .exec();
  }
}

module.exports = new MongoUserRepository();