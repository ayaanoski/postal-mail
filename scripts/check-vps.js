const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  conn.exec(`
    set -x
    
    echo "--- PM2 Status ---"
    pm2 ls
    
    echo "--- Docker PS ---"
    docker ps -a
    
    echo "--- Netstat Port 5000 ---"
    netstat -tulpn | grep 5000
    
    echo "--- Netstat Port 4000 ---"
    netstat -tulpn | grep 4000
    
    echo "--- Caddy Status ---"
    curl -s http://127.0.0.1:5000/health
    echo ""
    curl -s http://127.0.0.1:4000/health
    
    echo "--- Env File ---"
    cat /opt/mailer-us/backend/.env | grep PORT
    
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
