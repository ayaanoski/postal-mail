const nodemailer = require('nodemailer');

class RelayPool {
  constructor() {
    this.transports = [];
    this.providers = [];
    this.currentIndex = 0;
    this._init();
  }

  _init() {
    const providers = [];

    // Provider 1: Brevo (primary)
    const brevoHost = process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com';
    const brevoPort = Number.parseInt(process.env.BREVO_SMTP_PORT || '587', 10);
    const brevoUser = process.env.BREVO_SMTP_USER;
    const brevoPass = process.env.BREVO_SMTP_PASS;

    if (brevoUser && brevoPass) {
      providers.push({
        name: 'Brevo',
        transport: nodemailer.createTransport({
          host: brevoHost,
          port: brevoPort,
          secure: brevoPort === 465,
          auth: { user: brevoUser, pass: brevoPass },
          pool: true,
          maxConnections: 5,
          maxMessages: 100
        })
      });
      console.log(`RelayPool: Added Brevo SMTP (${brevoHost}:${brevoPort})`);
    }

    // Provider 2: AWS SES
    const sesHost = process.env.AWS_SES_SMTP_HOST;
    const sesPort = Number.parseInt(process.env.AWS_SES_SMTP_PORT || '587', 10);
    const sesUser = process.env.AWS_SES_SMTP_USER;
    const sesPass = process.env.AWS_SES_SMTP_PASS;

    if (sesHost && sesUser && sesPass) {
      providers.push({
        name: 'AWS SES',
        transport: nodemailer.createTransport({
          host: sesHost,
          port: sesPort,
          secure: sesPort === 465,
          auth: { user: sesUser, pass: sesPass },
          pool: true,
          maxConnections: 5,
          maxMessages: 100
        })
      });
      console.log(`RelayPool: Added AWS SES SMTP (${sesHost}:${sesPort})`);
    }

    // Provider 3: SendGrid (optional)
    const sgHost = process.env.SENDGRID_SMTP_HOST || 'smtp.sendgrid.net';
    const sgPort = Number.parseInt(process.env.SENDGRID_SMTP_PORT || '587', 10);
    const sgUser = process.env.SENDGRID_SMTP_USER || 'apikey';
    const sgPass = process.env.SENDGRID_SMTP_PASS;

    if (sgPass) {
      providers.push({
        name: 'SendGrid',
        transport: nodemailer.createTransport({
          host: sgHost,
          port: sgPort,
          secure: sgPort === 465,
          auth: { user: sgUser, pass: sgPass },
          pool: true,
          maxConnections: 5,
          maxMessages: 100
        })
      });
      console.log(`RelayPool: Added SendGrid SMTP (${sgHost}:${sgPort})`);
    }

    // Provider 4: Mailgun (optional)
    const mgHost = process.env.MAILGUN_SMTP_HOST || 'smtp.mailgun.org';
    const mgPort = Number.parseInt(process.env.MAILGUN_SMTP_PORT || '587', 10);
    const mgUser = process.env.MAILGUN_SMTP_USER;
    const mgPass = process.env.MAILGUN_SMTP_PASS;

    if (mgUser && mgPass) {
      providers.push({
        name: 'Mailgun',
        transport: nodemailer.createTransport({
          host: mgHost,
          port: mgPort,
          secure: mgPort === 465,
          auth: { user: mgUser, pass: mgPass },
          pool: true,
          maxConnections: 5,
          maxMessages: 100
        })
      });
      console.log(`RelayPool: Added Mailgun SMTP (${mgHost}:${mgPort})`);
    }

    // Provider 5: Postmark (optional)
    const pmHost = process.env.POSTMARK_SMTP_HOST || 'smtp.postmarkapp.com';
    const pmPort = Number.parseInt(process.env.POSTMARK_SMTP_PORT || '587', 10);
    const pmToken = process.env.POSTMARK_SMTP_TOKEN;

    if (pmToken) {
      providers.push({
        name: 'Postmark',
        transport: nodemailer.createTransport({
          host: pmHost,
          port: pmPort,
          secure: pmPort === 465,
          auth: { user: pmToken, pass: pmToken },
          pool: true,
          maxConnections: 5,
          maxMessages: 100
        })
      });
      console.log(`RelayPool: Added Postmark SMTP (${pmHost}:${pmPort})`);
    }

    // Provider 6: Postal 1
    const postal1Host = process.env.POSTAL1_SMTP_HOST;
    const postal1Port = Number.parseInt(process.env.POSTAL1_SMTP_PORT || '25', 10);
    const postal1User = process.env.POSTAL1_SMTP_USER;
    const postal1Pass = process.env.POSTAL1_SMTP_PASS;

    if (postal1Host && postal1User && postal1Pass) {
      providers.push({
        name: 'Postal 1',
        transport: nodemailer.createTransport({
          host: postal1Host,
          port: postal1Port,
          secure: postal1Port === 465,
          auth: { user: postal1User, pass: postal1Pass },
          pool: true,
          maxConnections: 5,
          maxMessages: 100,
          tls: {
            rejectUnauthorized: false
          }
        })
      });
      console.log(`RelayPool: Added Postal 1 SMTP (${postal1Host}:${postal1Port})`);
    }

    this.transports = providers.map((p) => p.transport);
    this.providers = providers;

    if (providers.length === 0) {
      console.warn('WARNING: No global SMTP providers configured. Add BREVO_SMTP_*, AWS_SES_SMTP_*, or SENDGRID_SMTP_* env vars.');
    } else {
      console.log(`RelayPool initialized with ${providers.length} global provider(s): ${providers.map((p) => p.name).join(', ')}`);
    }
  }

  getRandom() {
    if (this.transports.length === 0) return null;
    return this.transports[Math.floor(Math.random() * this.transports.length)];
  }

  getRoundRobin() {
    if (this.transports.length === 0) return null;
    const transport = this.transports[this.currentIndex % this.transports.length];
    this.currentIndex += 1;
    return transport;
  }

  getByProviderName(name) {
    const idx = this.providers.findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
    if (idx === -1) return this.getRandom();
    return this.transports[idx];
  }

  getByIndex(index) {
    if (this.transports.length === 0) return null;
    return this.transports[index % this.transports.length];
  }

  get size() {
    return this.transports.length;
  }

  getProviderNames() {
    return this.providers.map((p) => p.name);
  }

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
