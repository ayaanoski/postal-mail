const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  conn.exec(`
    set -x
    
    echo "--- Netstat Port 443 ---"
    netstat -tulpn | grep 443
    
    echo "--- Caddy logs ---"
    docker logs --tail 20 postal-caddy
    
    echo "--- Caddyfile ---"
    cat /opt/postal/config/Caddyfile
    
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
