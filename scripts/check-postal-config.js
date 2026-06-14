const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  conn.exec(`
    set -x
    
    cat /opt/postal/config/postal.yml | grep -A 3 -B 1 "username:"
    
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
