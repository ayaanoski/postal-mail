const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  conn.exec(`
    set -e
    set -x
    
    echo "Generating self-signed cert..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/ssl/private/mail-selfsigned.key -out /etc/ssl/certs/mail-selfsigned.crt -subj "/CN=mail.mailer-us.com"
    
    echo "Updating Nginx config for Postal with SSL"
    cat << 'EOF' > /etc/nginx/sites-available/mail.mailer-us.com
server {
    listen 80;
    server_name mail.mailer-us.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name mail.mailer-us.com;

    ssl_certificate /etc/ssl/certs/mail-selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/mail-selfsigned.key;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
    
    ln -sf /etc/nginx/sites-available/mail.mailer-us.com /etc/nginx/sites-enabled/
    
    systemctl restart nginx
    
  `, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      console.log(data.toString());
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data.toString());
    });
  });
}).connect({
  host: '187.127.138.51',
  port: 22,
  username: 'root',
  password: "28pbZXWT9'M02xsz"
});
