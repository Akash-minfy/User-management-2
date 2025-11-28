const inviteService = require('../services/inviteService');

async function sendInvite(req, res) {
  try {
    const { inviteeEmail, role, name } = req.body;
    const inviterRoles = Array.isArray(req.user?.roles) ? req.user.roles : [];

    if (!inviteeEmail || !role) {
      return res.status(400).json({ message: 'inviteeEmail and role are required' });
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    await inviteService.sendInvite({ inviterRoles, inviteeEmail, role, name, authToken: token });

    res.status(200).json({ message: 'Invitation email sent' });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Server Error' });
  }
}

module.exports = { sendInvite };


