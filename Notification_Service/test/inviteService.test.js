// tests/inviteService.test.js
const inviteService = require('../src/services/inviteService');
const mailer = require('../src/lib/mailer');
const rabbit = require('../src/lib/rabbit');
const fetch = require('node-fetch');
const rolesUtil = require('../src/utils/roles');
const templates = require('../src/templates/invite');

jest.mock('../src/lib/mailer');
jest.mock('../src/lib/rabbit');
jest.mock('node-fetch');
jest.mock('../src/utils/roles');
jest.mock('../src/templates/invite');

const { Response } = jest.requireActual('node-fetch');

describe('inviteService.sendInvite', () => {
  const defaultArgs = {
    inviterRoles: ['admin'],
    inviteeEmail: 'test@example.com',
    role: 'client_user',
    name: 'John Doe',
    authToken: 'mock-token',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    rolesUtil.canAssignRole.mockReturnValue(true);
    rolesUtil.normalizeRole.mockImplementation((r) => r);
    templates.build.mockReturnValue({ subject: 'Invite', html: '<p>Hello</p>', text: 'Hello' });
  });

  it('should call User Service and enqueue email', async () => {
    // Mock fetch to return success
    fetch.mockResolvedValue(
      new Response(JSON.stringify({ created: true }), { status: 200 })
    );

    await inviteService.sendInvite(defaultArgs);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/invite-upsert'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token',
        }),
        body: expect.stringContaining(defaultArgs.inviteeEmail),
      })
    );

    expect(rabbit.publishEmailJob).toHaveBeenCalledWith(
      expect.objectContaining({ to: defaultArgs.inviteeEmail })
    );
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  it('should fall back to mailer.sendMail if rabbit fails', async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({ created: true }), { status: 200 }));
    rabbit.publishEmailJob.mockRejectedValue(new Error('RabbitMQ down'));

    await inviteService.sendInvite(defaultArgs);

    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: defaultArgs.inviteeEmail })
    );
  });

  it('should throw 403 if inviter cannot assign role', async () => {
    rolesUtil.canAssignRole.mockReturnValue(false);

    await expect(inviteService.sendInvite(defaultArgs)).rejects.toEqual({
      status: 403,
      message: 'Insufficient permission to assign this role',
    });
  });

  it('should throw error if fetch returns non-ok', async () => {
    fetch.mockResolvedValue(new Response('User error', { status: 400 }));

    await expect(inviteService.sendInvite(defaultArgs)).rejects.toEqual({
      status: 400,
      message: 'User error',
    });
  });

  it('should handle tempPassword for existing user correctly', async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({ created: false }), { status: 200 }));

    await inviteService.sendInvite(defaultArgs);

    // Ensure templates.build gets tempPassword only if user created
    expect(templates.build).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'client_user', tempPassword: undefined })
    );
  });
});

 