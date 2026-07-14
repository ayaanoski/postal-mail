const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(`
    set -x
    
    # 1. Stop and update Mailer-US to run on port 4000 instead of 5000
    sed -i 's/PORT=5000/PORT=4000/g' /opt/mailer-us/backend/.env
    cd /opt/mailer-us/backend
    pm2 stop mailer-api || true
    pm2 delete mailer-api || true
    PORT=4000 pm2 start src/server.js --name "mailer-api" --update-env
    pm2 save
    
    echo "VPS FIX SCRIPT COMPLETE"
  `, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '187.127.138.51',
  port: 22,
  username: 'root',
  password: "28pbZXWT9'M02xsz"
});
