const { Resolver } = require('dns/promises');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

module.exports = { validateEmail, hasMxRecord, validateAndCheckMx, categorizeBounce };
