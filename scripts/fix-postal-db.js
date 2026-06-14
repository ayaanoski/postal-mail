const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  conn.exec(`
    set -x
    
    # Update postal.yml to use root for database access so it can create new databases
    sed -i 's/username: "postal"/username: "root"/' /opt/postal/config/postal.yml
    sed -i 's/password: "postal_password"/password: "postal_root_password"/' /opt/postal/config/postal.yml
    
    # Restart postal workers to apply new config
    postal stop
    postal start
    
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
