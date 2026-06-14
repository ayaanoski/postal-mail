const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  conn.exec(`
    set -x
    
    echo "--- Docker PS ---"
    docker ps -a | grep postal
    
    echo "--- Postal Web Logs ---"
    docker logs --tail 50 postal-web-1
    
    echo "--- Postal Worker Logs ---"
    docker logs --tail 50 postal-worker-1
    
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
