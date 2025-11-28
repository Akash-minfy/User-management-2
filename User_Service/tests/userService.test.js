/**
 * @fileoverview Unit tests for userService.js
 * These tests mock database operations (Mongo) and JWT completely.
 */

const hashUtil = require('../src/utils/hash');
const jwtUtil = require('../src/utils/jwt');
const userService = require('../src/services/userService');

// ------------------- MOCK SETUP -------------------

const mockFindByEmail = jest.fn();
const mockFindById = jest.fn();
const mockCreate = jest.fn();
const mockUpdateById = jest.fn();
const mockRefreshTokenCreate = jest.fn();

jest.mock('../src/repositories', () => ({
  userRepository: {
    findByEmail: (...args) => mockFindByEmail(...args),
    findById: (...args) => mockFindById(...args),
    create: (...args) => mockCreate(...args),
    updateById: (...args) => mockUpdateById(...args),
    findAll: jest.fn(),
    countAll: jest.fn(),
    findInvites: jest.fn(),
  },
  refreshTokenRepository: {
    create: (...args) => mockRefreshTokenCreate(...args),
    findByToken: jest.fn(),
    revokeToken: jest.fn(),
    revokeAllUserTokens: jest.fn(),
    deleteExpiredTokens: jest.fn(),
  },
}));

jest.mock('../src/utils/hash', () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
}));

jest.mock('../src/utils/jwt', () => ({
  sign: jest.fn(),
  signRefresh: jest.fn(),
  verify: jest.fn(),
}));

// ------------------- TEST SUITE -------------------

describe('User Service Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------- signup ----------
  describe('signup()', () => {
    it('should create a new user successfully', async () => {
      mockFindByEmail.mockResolvedValue(null);
      hashUtil.hashPassword.mockResolvedValue('hashed-password');
      mockCreate.mockResolvedValue({ _id: 'user123', email: 'test@example.com' });

      const result = await userService.signup({
        email: 'test@example.com',
        password: '123456',
        name: 'Test User'
      });

      expect(result.email).toBe('test@example.com');
      expect(mockFindByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should throw error if email already exists', async () => {
      mockFindByEmail.mockResolvedValue({ email: 'test@example.com' });

      await expect(
        userService.signup({ email: 'test@example.com', password: '123456', name: 'Test' })
      ).rejects.toEqual(expect.objectContaining({ status: 409, message: 'Email already registered' }));
    });
  });

  // ---------- login ----------
  describe('login()', () => {
    it('should return token and refreshToken for valid credentials', async () => {
      const user = { _id: 'user123', email: 'test@example.com', passwordHash: 'hashed-pass', roles: ['client_user'], metadata: {} };
      mockFindByEmail.mockResolvedValue(user);
      hashUtil.verifyPassword.mockResolvedValue(true);
      jwtUtil.sign.mockReturnValue('mocked-jwt-token');
      jwtUtil.signRefresh.mockReturnValue('mocked-refresh-token');
      mockUpdateById.mockResolvedValue(user);
      mockRefreshTokenCreate.mockResolvedValue({ token: 'db-refresh-token', userId: 'user123' });

      const result = await userService.login({ email: 'test@example.com', password: '123456' });

      expect(result.token).toBe('mocked-jwt-token');
      expect(result.refreshToken).toBe('mocked-refresh-token');
      expect(mockFindByEmail).toHaveBeenCalledWith('test@example.com', true);
      expect(hashUtil.verifyPassword).toHaveBeenCalledWith('123456', 'hashed-pass');
      expect(mockRefreshTokenCreate).toHaveBeenCalledWith('user123', 7);
    });

    it('should throw error if user not found', async () => {
      mockFindByEmail.mockResolvedValue(null);

      await expect(
        userService.login({ email: 'unknown@example.com', password: '123' })
      ).rejects.toEqual(expect.objectContaining({ status: 401, message: 'Invalid credentials' }));
    });

    it('should throw error if password is invalid', async () => {
      const user = { _id: 'user123', email: 'test@example.com', passwordHash: 'hashed-pass', roles: ['client_user'], metadata: {} };
      mockFindByEmail.mockResolvedValue(user);
      hashUtil.verifyPassword.mockResolvedValue(false);

      await expect(
        userService.login({ email: 'test@example.com', password: 'wrongpass' })
      ).rejects.toEqual(expect.objectContaining({ status: 401, message: 'Invalid credentials' }));
    });
  });

  // ---------- getProfile ----------
  describe('getProfile()', () => {
    it('should return user profile when found', async () => {
      const user = { _id: 'user123', email: 'test@example.com' };
      mockFindById.mockResolvedValue(user);

      const result = await userService.getProfile('user123');

      expect(result.email).toBe('test@example.com');
      expect(mockFindById).toHaveBeenCalledWith('user123');
    });

    it('should throw error if user not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(userService.getProfile('badid')).rejects.toEqual(expect.objectContaining({ status: 404, message: 'User not found' }));
    });
  });

  // ---------- updateProfile ----------
  describe('updateProfile()', () => {
    it('should update profile successfully', async () => {
      const updatedUser = { _id: 'user123', email: 'test@example.com', name: 'Updated Name' };
      mockUpdateById.mockResolvedValue(updatedUser);

      const result = await userService.updateProfile('user123', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(mockUpdateById).toHaveBeenCalledWith('user123', { name: 'Updated Name' });
    });

    it('should throw error if user not found', async () => {
      mockUpdateById.mockResolvedValue(null);

      await expect(userService.updateProfile('badid', { name: 'Test' })).rejects.toEqual(expect.objectContaining({ status: 404, message: 'User not found' }));
    });
  });
});

 
 