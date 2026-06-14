const nodemailer = require('nodemailer');

class RelayPool {
  constructor() {
    this.transports = [];
    this.currentIndex = 0;
    this.mode = 'brevo';
    this._init();
  }

  _init() {
    const host = process.env.BREVO_SMTP_HOST || process.env.AWS_SES_SMTP_HOST || 'smtp-relay.brevo.com';
    const port = Number.parseInt(process.env.BREVO_SMTP_PORT || process.env.AWS_SES_SMTP_PORT || '587', 10);
    const user = process.env.BREVO_SMTP_USER || process.env.AWS_SES_SMTP_USER;
    const pass = process.env.BREVO_SMTP_PASS || process.env.AWS_SES_SMTP_PASS;

    if (!user || !pass) {
      console.warn('WARNING: BREVO_SMTP_USER and BREVO_SMTP_PASS (or AWS_SES_SMTP counterparts) are not configured. Global Brevo fallback will not be available.');
      this.transports = [];
      return;
    }

    if (!Number.isInteger(port) || port <= 0) {
      throw new Error('BREVO_SMTP_PORT must be a positive integer');
    }

    this.transports = [
      nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // TLS on 465, STARTTLS on 587
        auth: { user, pass },
        pool: true,
        maxConnections: 5,
        maxMessages: 100
      })
    ];

    console.log(`RelayPool initialized with global Brevo SMTP (${host}:${port})`);
  }

  getRandom() {
    return this.transports[Math.floor(Math.random() * this.transports.length)];
  }

  getRoundRobin() {
    const transport = this.transports[this.currentIndex % this.transports.length];
    this.currentIndex += 1;
    return transport;
  }

  getByIndex(index) {
    return this.transports[index % this.transports.length];
  }

  get size() {
    return this.transports.length;
  }

  /**
   * Create a one-off nodemailer transport from a user's SMTP config.
   * Not pooled — created per-job and closed after use.
   * @param {{ smtpHost: string, smtpPort: number, smtpUser: string, smtpPass: string }} config
   * @returns {import('nodemailer').Transporter}
   */
  createTransportForUser(config) {
    const port = config.smtpPort || 587;
    return nodemailer.createTransport({
      host: config.smtpHost,
      port,
      secure: port === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass
      },
      pool: false,
      connectionTimeout: 15000,
      greetingTimeout: 15000
    });
  }
}

module.exports = new RelayPool();
