const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  conn.exec(`
    set -e
    set -x
    
    echo "Stopping postal-caddy as Nginx is already managing ports 80/443"
    docker stop postal-caddy || true
    docker rm postal-caddy || true
    
    echo "Creating Nginx config for Postal"
    cat << 'EOF' > /etc/nginx/sites-available/mail.mailer-us.com
server {
    server_name mail.mailer-us.com;

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
    
    echo "Obtaining SSL cert for mail.mailer-us.com"
    certbot --nginx -d mail.mailer-us.com --non-interactive --agree-tos -m admin@mailer-us.com || true
    
    echo "Restarting Nginx"
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
