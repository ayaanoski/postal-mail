require('dotenv').config();
const nodemailer = require('nodemailer');

const recipients = [
  'me@dropboxslideshow.com',
  'rajgoel8477@gmail.com',
  'rajanderson8477@gmail.com',
  'ajaygoel999@gmail.com',
  'rajwilson8477@gmail.com',
  'briansmith8477@gmail.com',
];

const transport = nodemailer.createTransport({
  host: process.env.SMTP2GO_HOST || 'mail.smtp2go.com',
  port: parseInt(process.env.SMTP2GO_PORT || '2525', 10),
  auth: {
    user: process.env.SMTP2GO_USER,
    pass: process.env.SMTP2GO_PASS,
  },
});

(async () => {
  console.log(`SMTP2GO: ${process.env.SMTP2GO_HOST}:${process.env.SMTP2GO_PORT}`);
  console.log(`User: ${process.env.SMTP2GO_USER}`);
  console.log(`Sending ${recipients.length} emails directly...\n`);

  try {
    await transport.verify();
    console.log('✓ SMTP2GO connection verified\n');
  } catch (e) {
    console.error('✗ SMTP2GO connection FAILED:', e.message);
    process.exit(1);
  }

  for (let i = 0; i < recipients.length; i++) {
    const to = recipients[i];
    try {
      const info = await transport.sendMail({
        from: { name: 'Joshua James', address: 'info@on-reply.online' },
        to,
        subject: `Direct SMTP2GO test #${i + 1}`,
        html: `<p>This is test email #${i + 1} sent directly via SMTP2GO (no worker/queue).</p>`,
      });
      console.log(`✓ Email ${i + 1}/${recipients.length} → ${to} — messageId: ${info.messageId}, response: ${info.response}`);
    } catch (err) {
      console.error(`✗ Email ${i + 1}/${recipients.length} → ${to} — FAILED: ${err.message}`);
    }
  }

  transport.close();
  console.log('\nDone!');
  process.exit(0);
})();
