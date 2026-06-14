const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  conn.exec(`
    set -x
    
    echo "--- Nginx Sites ---"
    grep -R proxy_pass /etc/nginx/sites-enabled/
    cat /etc/nginx/sites-enabled/default || true
    
    echo "--- Mailer Nginx ---"
    cat /etc/nginx/sites-enabled/mailer-us || true
    
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
