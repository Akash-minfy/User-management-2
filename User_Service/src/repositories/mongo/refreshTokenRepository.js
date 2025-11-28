const RefreshToken = require('../../models/refreshTokenModel');
const crypto = require('crypto');

class MongoRefreshTokenRepository {
  async create(userId, expiresInDays = 7) {
    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const refreshToken = new RefreshToken({
      userId,
      token,
      expiresAt
    });

    await refreshToken.save();
    return refreshToken;
  }

  async findByToken(token) {
    return await RefreshToken.findOne({ 
      token, 
      revokedAt: null,
      expiresAt: { $gt: new Date() }
    }).exec();
  }

  async revokeToken(token) {
    return await RefreshToken.findOneAndUpdate(
      { token },
      { revokedAt: new Date() },
      { new: true }
    ).exec();
  }

  async revokeAllUserTokens(userId) {
    return await RefreshToken.updateMany(
      { userId, revokedAt: null },
      { revokedAt: new Date() }
    ).exec();
  }

  async deleteExpiredTokens() {
    return await RefreshToken.deleteMany({
      expiresAt: { $lt: new Date() }
    }).exec();
  }
}

module.exports = new MongoRefreshTokenRepository();

