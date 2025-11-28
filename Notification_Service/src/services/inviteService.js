const mailer = require('../lib/mailer');
const { canAssignRole, normalizeRole } = require('../utils/roles');
const templates = require('../templates/invite');
const fetch = require('node-fetch');
const config = require('../lib/config');
const rabbit = require('../lib/rabbit');

function generateTempPassword() {
  const base = Math.random().toString(36).slice(-8);
  const suffix = Math.random().toString(36).slice(-4).toUpperCase();
  return `${base}${suffix}!`;
}

async function sendInvite({ inviterRoles, inviteeEmail, role, name, authToken }) {
  const normalizedRole = normalizeRole(role);
  if (!canAssignRole(inviterRoles, normalizedRole)) {
    throw { status: 403, message: 'Insufficient permission to assign this role' };
  }

  // Call User Service to upsert user and/or add role
  const tempPassword = generateTempPassword();
  const resp = await fetch((process.env.USER_SERVICE_URL || 'http://localhost:4000') + '/api/users/invite-upsert', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({ email: inviteeEmail, role: normalizedRole, tempPassword, name }),
  });
  if (!resp.ok) {
    const msg = await resp.text();
    throw { status: resp.status, message: msg || 'User Service error' };
  }
  const result = await resp.json();

  const { subject, html, text } = templates.build({ role: normalizedRole, tempPassword: result.created ? tempPassword : undefined });

  // Try to enqueue email job; if RabbitMQ unavailable, fall back to direct send
  try {
    await rabbit.publishEmailJob({ to: inviteeEmail, subject, html, text });
  } catch (err) {
    await mailer.sendMail({ to: inviteeEmail, subject, html, text });
  }
}

module.exports = { sendInvite };


