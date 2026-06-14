const { Resolver } = require('dns/promises');
const net = require('net');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_BASED_PATTERNS = [
  /^admin/i,
  /^info/i,
  /^support/i,
  /^sales/i,
  /^contact/i,
  /^help/i,
  /^enquiries?/i,
  /^inquiries?/i,
  /^marketing/i,
  /^billing/i,
  /^accounts/i,
  /^finance/i,
  /^hr/i,
  /^jobs/i,
  /^careers/i,
  /^recruitment/i,
  /^newsletter/i,
  /^no-?reply/i,
  /^noreply/i,
  /^donotreply/i,
  /^mailer-?daemon/i,
  /^postmaster/i,
  /^hostmaster/i,
  /^webmaster/i,
  /^abuse/i,
  /^test/i,
  /^dev/i,
  /^team/i,
  /^hello/i,
  /^hi/i,
  /^feedback/i,
  /^service/i,
  /^services/i,
  /^office/i,
  /^mail/i,
  /^registrations?/i,
  /^password/i,
  /^reset/i
];

const HONEYPOT_PATTERNS = [
  /^spam/i,
  /^trap/i,
  /^honeypot/i,
  /^abuse/i,
  /^nospam/i,
  /^mailer-?daemon/i,
  /^return-?path/i,
  /^bounce/i,
  /^complaint/i,
  /^fbl/i,
  /^feedback/i,
  /^unsubscribe/i,
  /^opt-?out/i,
  /^remove/i,
  /^u\d{7,}/i,
  /^\d{8,}/i,
  /^test[a-z0-9]{8,}/i
];

const CATCH_ALL_TEST_EMAIL = 'catchalldetect@';

const isRoleBasedEmail = (email) => {
  const localPart = email.split('@')[0];
  if (!localPart) return false;
  return ROLE_BASED_PATTERNS.some((pattern) => pattern.test(localPart));
};

const isHoneypotEmail = (email) => {
  const localPart = email.split('@')[0];
  if (!localPart) return false;
  return HONEYPOT_PATTERNS.some((pattern) => pattern.test(localPart));
};

const isCatchAllDomain = async (domain) => {
  try {
    const resolver = new Resolver();
    resolver.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
    const mxRecords = await resolver.resolveMx(domain);
    if (mxRecords.length === 0) return false;

    const primaryMx = mxRecords.sort((a, b) => a.priority - b.priority)[0];
    const mxHost = primaryMx.exchange;

    const testEmail = `${CATCH_ALL_TEST_EMAIL}${Date.now()}@${domain}`;

    const result = await new Promise((resolve) => {
      const socket = new net.Socket();
      let response = '';

      socket.setTimeout(10000);

      socket.on('data', (data) => {
        response += data.toString();
        const lines = response.split('\r\n');

        if (lines.length >= 1 && lines[0].startsWith('220')) {
          socket.write(`EHLO mailer-us.com\r\n`);
        } else if (response.includes('250')) {
          socket.write(`MAIL FROM:<check@mailer-us.com>\r\n`);
        } else if (lines.some((l) => l.startsWith('250 '))) {
          socket.write(`RCPT TO:<${testEmail}>\r\n`);
        } else if (response.includes('RCPT TO')) {
          if (response.includes('250') || response.includes('251')) {
            resolve(true);
          } else {
            resolve(false);
          }
          socket.destroy();
        }
      });

      socket.on('error', () => resolve(false));
      socket.on('timeout', () => { socket.destroy(); resolve(false); });

      socket.connect(25, mxHost);
    });

    return result;
  } catch {
    return false;
  }
};

const HONEYPOT_DOMAINS = new Set(
  (process.env.HONEYPOT_DOMAINS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

const isHoneypotDomain = (domain) => {
  if (!domain) return false;
  return HONEYPOT_DOMAINS.has(domain.toLowerCase());
};

const validateEmail = (email) => {
  if (!EMAIL_REGEX.test(email)) return false;
  return true;
};

const hasMxRecord = async (domain) => {
  try {
    const resolver = new Resolver();
    resolver.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
    const records = await resolver.resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
};

const validateAndCheckMx = async (email) => {
  if (!validateEmail(email)) return { valid: false, reason: 'invalid_format', mxExists: false };
  const domain = email.split('@')[1];
  const mxExists = await hasMxRecord(domain);
  if (!mxExists) return { valid: true, reason: 'no_mx', mxExists: false };
  return { valid: true, reason: 'ok', mxExists: true };
};

const categorizeBounce = (dsn, diagnostic) => {
  const dsnCode = dsn || '';
  const diag = (diagnostic || '').toLowerCase();

  const hardBouncePatterns = [
    'user unknown', 'no such user', 'mailbox not found',
    'invalid recipient', 'address rejected', 'does not exist',
    'invalid address', '550 5.1.1', '550 5.1.0',
    '552 5.2.2', 'mailbox full', 'quota exceeded',
    '550 5.2.1', 'mailbox disabled'
  ];

  if (dsnCode.startsWith('5.')) {
    if (dsnCode.includes('1.1') || dsnCode.includes('1.0') ||
      dsnCode.includes('2.1') || dsnCode.includes('2.2')) {
      return 'hard';
    }
    return 'hard';
  }

  if (dsnCode.startsWith('4.')) return 'soft';

  for (const pattern of hardBouncePatterns) {
    if (diag.includes(pattern)) return 'hard';
  }

  if (diag.includes('tempor') || diag.includes('try again') ||
    diag.includes('timeout') || diag.includes('congestion')) {
    return 'soft';
  }

  return 'hard';
};

module.exports = {
  validateEmail,
  hasMxRecord,
  validateAndCheckMx,
  categorizeBounce,
  isRoleBasedEmail,
  isHoneypotEmail,
  isHoneypotDomain,
  isCatchAllDomain
};
