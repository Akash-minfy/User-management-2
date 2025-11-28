const config = require('../lib/config');

function build({ role, tempPassword }) {
  const company = 'Socialens PVT LTD';
  const assignedRole = role;
  const subject = `[${company}] Role assignment invitation: ${assignedRole}`;
  const passwordLineText = tempPassword ? `\nTemporary password: ${tempPassword}\n` : '';
  const text = `Hello,\n\nYou are being assigned ${assignedRole} role by ${company}.${passwordLineText}\nIf you expected this, please follow the instructions from your administrator to complete your access.\n\nRegards,\n${company}`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #222">
      <h2>${company}</h2>
      <p>Hello,</p>
      <p>You are being assigned <strong>${assignedRole}</strong> role by ${company}.</p>
      ${tempPassword ? `<p><strong>Temporary password:</strong> ${tempPassword}</p>` : ''}
      <p>If you expected this, please follow the instructions from your administrator to complete your access.</p>
      <p>Regards,<br/>${company}</p>
    </div>
  `;

  return { subject, text, html };
}

module.exports = { build };


