const https = require('https');
const http = require('http');

class PostalClient {
  constructor({ serverUrl, apiKey }) {
    this.serverUrl = serverUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  buildMime(mailOptions) {
    const boundary = `----=_Part_${Math.random().toString(36).slice(2, 10)}`;
    const lines = [];

    lines.push(`From: ${mailOptions.from.name} <${mailOptions.from.address}>`);
    lines.push(`To: ${mailOptions.to.name ? `${mailOptions.to.name} <${mailOptions.to.address}>` : mailOptions.to.address}`);
    lines.push(`Subject: ${mailOptions.subject}`);
    lines.push('MIME-Version: 1.0');
    lines.push(`Message-ID: ${mailOptions.messageId || `<${Date.now()}@${mailOptions.from.address.split('@')[1]}>`}`);
    lines.push(`Date: ${new Date().toUTCString()}`);

    if (mailOptions.headers) {
      Object.entries(mailOptions.headers).forEach(([key, val]) => {
        if (val) lines.push(`${key}: ${val}`);
      });
    }

    lines.push('Content-Type: multipart/alternative;');
    lines.push(`\tboundary="${boundary}"`);
    lines.push('');

    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/plain; charset="UTF-8"');
    lines.push('Content-Transfer-Encoding: quoted-printable');
    lines.push('');
    lines.push(mailOptions.text || '');
    lines.push('');

    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/html; charset="UTF-8"');
    lines.push('Content-Transfer-Encoding: quoted-printable');
    lines.push('');
    lines.push(mailOptions.html || '');
    lines.push('');

    if (mailOptions.attachments && mailOptions.attachments.length > 0) {
      mailOptions.attachments.forEach((att) => {
        lines.push(`--${boundary}`);
        lines.push(`Content-Type: ${att.contentType || 'application/octet-stream'}`);
        lines.push('Content-Transfer-Encoding: base64');
        lines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
        lines.push('');
        lines.push(att.content || '');
        lines.push('');
      });
    }

    lines.push(`--${boundary}--`);

    return lines.join('\r\n');
  }

  sendMail(mailOptions) {
    return new Promise((resolve, reject) => {
      const mimeMessage = this.buildMime(mailOptions);
      const body = JSON.stringify({
        mail_from: mailOptions.from.address,
        rcpt_to: [mailOptions.to.address],
        data: Buffer.from(mimeMessage).toString('base64')
      });

      const url = new URL(`${this.serverUrl}/api/v1/send/raw`);
      const isHttps = url.protocol === 'https:';
      const transport = isHttps ? https : http;

      const req = transport.request(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'X-Server-API-Key': this.apiKey,
            'Accept': 'application/json'
          },
          rejectUnauthorized: false,
          timeout: 30000
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ messageId: mailOptions.messageId, status: 'sent', provider: 'postal-http' });
            } else {
              const err = new Error(`Postal API error (${res.statusCode}): ${data}`);
              err.statusCode = res.statusCode;
              reject(err);
            }
          });
        }
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Postal API request timed out'));
      });

      req.write(body);
      req.end();
    });
  }
}

const createPostalClient = (config) => new PostalClient(config);

module.exports = { PostalClient, createPostalClient };
