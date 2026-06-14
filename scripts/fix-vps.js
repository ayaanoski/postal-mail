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
    
    # 2. Make sure Postal MariaDB is running
    docker rm -f postal-mariadb || true
    docker run -d --name postal-mariadb -p 127.0.0.1:3306:3306 --restart always -e MARIADB_ROOT_PASSWORD=postal_root_password -e MARIADB_DATABASE=postal -e MARIADB_USER=postal -e MARIADB_PASSWORD=postal_password mariadb:10.11
    
    # Wait for DB to boot
    sleep 5
    
    # 3. Clean up any broken Postal installation
    rm -rf /opt/postal/config/*
    
    # 4. Bootstrap Postal properly
    cd /opt/postal/install
    postal bootstrap mail.mailer-us.com
    
    # 5. Fix Postal passwords
    sed -i 's/password:.*/password: "postal_password"/' /opt/postal/config/postal.yml
    sed -i 's/username:.*/username: "postal"/' /opt/postal/config/postal.yml
    
    # 6. Initialize Postal Database
    postal initialize
    
    # 7. Start Postal
    postal start
    
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
