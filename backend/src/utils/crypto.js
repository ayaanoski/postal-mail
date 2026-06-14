const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

const getKey = () => {
  const hex = process.env.SMTP_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'SMTP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, 'hex');
};

/**
 * Encrypt a plaintext SMTP password.
 * @param {string} plaintext
 * @returns {{ encrypted: string, iv: string, tag: string }}
 */
const encryptSmtpPassword = (plaintext) => {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag
  };
};

/**
 * Decrypt an SMTP password.
 * @param {string} encrypted  Hex-encoded ciphertext
 * @param {string} iv         Hex-encoded IV
 * @param {string} tag        Hex-encoded auth tag
 * @returns {string} Plaintext password
 */
const decryptSmtpPassword = (encrypted, iv, tag) => {
  const key = getKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tag, 'hex'));

  let plaintext = decipher.update(encrypted, 'hex', 'utf8');
  plaintext += decipher.final('utf8');
  return plaintext;
};

module.exports = {
  encryptSmtpPassword,
  decryptSmtpPassword
};
