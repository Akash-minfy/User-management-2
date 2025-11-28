const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const inviteService = require('../src/services/inviteService');
const { sendInvite } = require('../src/controllers/inviteController');

// ------------------- Mock the inviteService -------------------
jest.mock('../src/services/inviteService');

describe('POST /api/invites/send', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(bodyParser.json());

    // Mock req.user for authMiddleware
    app.use((req, res, next) => {
      req.user = { roles: [] }; // can adjust roles per test if needed
      next();
    });

    app.post('/api/invites/send', sendInvite);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to measure time
  async function measureTime(name, fn) {
    console.time(name);
    const result = await fn();
    console.timeEnd(name);
    return result;
  }

  it('should return 400 if inviteeEmail or role is missing', async () => {
    await measureTime('POST /api/invites/send - missing fields', async () => {
      const response = await request(app)
        .post('/api/invites/send')
        .send({ name: 'John' }); // missing inviteeEmail and role

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('inviteeEmail and role are required');
    });
  });

  it('should successfully send an invite and return 200', async () => {
    inviteService.sendInvite.mockResolvedValue();

    const requestBody = {
      inviteeEmail: 'test@example.com',
      role: 'admin',
      name: 'John Doe',
    };

    await measureTime('POST /api/invites/send - success', async () => {
      const response = await request(app)
        .post('/api/invites/send')
        .set('Authorization', 'Bearer test-token')
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Invitation email sent');
      expect(inviteService.sendInvite).toHaveBeenCalledWith({
        inviterRoles: [],
        inviteeEmail: 'test@example.com',
        role: 'admin',
        name: 'John Doe',
        authToken: 'test-token',
      });
    });
  });

  it('should handle server errors correctly', async () => {
    inviteService.sendInvite.mockRejectedValue(new Error('Internal Server Error'));

    await measureTime('POST /api/invites/send - server error', async () => {
      const response = await request(app)
        .post('/api/invites/send')
        .send({
          inviteeEmail: 'test@example.com',
          role: 'admin',
          name: 'John Doe',
        });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal Server Error');
    });
  });

  it('should handle authorization errors correctly', async () => {
    // Mock auth missing token
    app.use((req, res, next) => {
      req.user = null; // simulate no user
      next();
    });

    await measureTime('POST /api/invites/send - auth error', async () => {
      const response = await request(app)
        .post('/api/invites/send')
        .send({
          inviteeEmail: 'test@example.com',
          role: 'admin',
          name: 'John Doe',
        });

      expect(response.status).toBe(500); // service throws error, caught as 500
    });
  });

  it('should return 400 if the inviteeEmail is invalid', async () => {
    inviteService.sendInvite.mockImplementation(() => {
      const error = new Error('Invalid email format');
      error.status = 400;
      throw error;
    });

    await measureTime('POST /api/invites/send - invalid email', async () => {
      const res = await request(app)
        .post('/api/invites/send')
        .send({
          inviteeEmail: 'invalid-email',
          role: 'admin',
          name: 'John Doe',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid email format');
    });
  });
});
