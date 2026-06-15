const crypto = require('crypto');
const { Resolver } = require('dns/promises');

const COMMON_DKIM_SELECTORS = [
  'default', 'google', 's1', 's2', 'k1',
  'selector1', 'selector2', 'mail', 'dkim',
  'mandrill', 'smtp', 'resend', 'sendgrid',
  'ses', 'mesmtp', 'cm', 'protonmail', 'zoho'
];

const getRootDomain = (domain) => {
  const parts = domain.split('.');
  if (parts.length <= 2) return domain;
  
  const ccTlds = ['co', 'com', 'org', 'net', 'edu', 'gov'];
  const tld2 = parts[parts.length - 2];
  const tld1 = parts[parts.length - 1];
  
  if (ccTlds.includes(tld2) && tld1.length === 2) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
};

const getResolverForDomain = async (domain) => {
  const resolver = new Resolver();
  resolver.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  
  try {
    const rootDomain = getRootDomain(domain);
    const nsRecords = await resolver.resolveNs(rootDomain);
    if (nsRecords && nsRecords.length > 0) {
      const nsHost = nsRecords[0];
      const ips = await resolver.resolve4(nsHost);
      if (ips && ips.length > 0) {
        const authResolver = new Resolver();
        authResolver.setServers([ips[0]]);
        return authResolver;
      }
    }
  } catch (err) {
    console.warn(`Could not resolve authoritative nameserver for ${domain}, falling back to public DNS:`, err.message);
  }
  return resolver;
};

const checkMX = async (resolver, domain) => {
  try {
    const records = await resolver.resolveMx(domain);
    return { exists: records.length > 0, records: records.map((r) => r.exchange) };
  } catch {
    return { exists: false, records: [] };
  }
};

const checkSPF = async (resolver, domain) => {
  try {
    const records = await resolver.resolveTxt(domain);
    const spf = records.map((r) => r.join('')).find((r) => r.startsWith('v=spf1'));
    return { exists: !!spf, record: spf || null };
  } catch {
    return { exists: false, record: null };
  }
};

const checkDKIM = async (resolver, domain, customSelector, expectedPublicKey) => {
  const selectors = customSelector
    ? [customSelector, ...COMMON_DKIM_SELECTORS]
    : COMMON_DKIM_SELECTORS;

  for (const selector of selectors) {
    try {
      const records = await resolver.resolveTxt(`${selector}._domainkey.${domain}`);
      const dkim = records.map((r) => r.join('')).find((r) => r.startsWith('v=DKIM1'));
      if (dkim) {
        const matches = expectedPublicKey ? dkim.includes(expectedPublicKey) : true;
        return { exists: true, selector, record: dkim, matches };
      }
    } catch {
      // Continue to next selector
    }
  }
  return { exists: false, selector: null, record: null, matches: false };
};

const checkDMARC = async (resolver, domain) => {
  try {
    const records = await resolver.resolveTxt(`_dmarc.${domain}`);
    const dmarc = records.map((r) => r.join('')).find((r) => r.startsWith('v=DMARC1'));
    return { exists: !!dmarc, record: dmarc || null };
  } catch {
    return { exists: false, record: null };
  }
};

const verifyDomain = async (domain, customSelector, expectedPublicKey) => {
  const activeResolver = await getResolverForDomain(domain);

  const [mx, spf, dkim, dmarc] = await Promise.all([
    checkMX(activeResolver, domain),
    checkSPF(activeResolver, domain),
    checkDKIM(activeResolver, domain, customSelector, expectedPublicKey),
    checkDMARC(activeResolver, domain)
  ]);

  let passed = false;
  let score = '0/1';

  if (expectedPublicKey) {
    passed = dkim.exists && dkim.matches;
    score = passed ? '1/1' : '0/1';
  } else {
    const checksPassed = [mx.exists, spf.exists, dkim.exists];
    const passedCount = checksPassed.filter(Boolean).length;
    passed = passedCount >= 2;
    score = `${passedCount}/3`;
  }

  return {
    mx,
    spf,
    dkim,
    dmarc,
    score,
    passed,
    timestamp: new Date().toISOString()
  };
};

const generateDkimKeys = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  const base64Key = publicKey
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s+/g, '');

  return { publicKey, privateKey, base64Key };
};

const buildDkimDnsRecord = (selector, base64Key) => {
  return `v=DKIM1; k=rsa; p=${base64Key}`;
};

const buildSpfDnsRecord = (domain, ips, provider) => {
  if (provider === 'vps') {
    return `v=spf1 a mx include:spf.mail.mailer-us.com ~all`;
  } else if (provider === 'sparkpost') {
    return `v=spf1 include:sparkpostmail.com ~all`;
  } else if (provider === 'brevo') {
    return `v=spf1 include:spf.brevo.com ~all`;
  } else if (provider === 'azure') {
    return `v=spf1 include:spf.smtp2go.com ~all`;
  } else {
    return `v=spf1 a mx ~all`;
  }
};

const buildDmarcDnsRecord = (domain) => {
  return `v=DMARC1; p=none; rua=mailto:dmarc@${domain}; pct=100`;
};

module.exports = {
  verifyDomain,
  checkMX,
  checkSPF,
  checkDKIM,
  checkDMARC,
  generateDkimKeys,
  buildDkimDnsRecord,
  buildSpfDnsRecord,
  buildDmarcDnsRecord
};
