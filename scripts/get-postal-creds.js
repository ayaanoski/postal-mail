const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  conn.exec(`
    set -x
    
    echo "--- Checking Postal Credentials ---"
    docker exec postal-mariadb mysql -u postal -ppostal_password postal -e "SELECT s.name AS server, c.name, c.key, c.type FROM credentials c JOIN servers s ON c.server_id = s.id;"
    
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
