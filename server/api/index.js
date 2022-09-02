const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const Path = require('path');
const auth = require('./middleware/auth');
const logger = require('../../lib/logger');

module.exports = ({ port, origins, key, datadir }) => {
  const app = express();

  // CORS
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Request-Method', '*');
    res.header('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, PUT, DELETE');
    next();
  });
  app.use(cors({
    origin: origins
  }));

  // JSON body parse
  app.use(express.json());

  // Routes
  app.use('/channel', auth(key), require('./routes/channel'));


  const keyFile = Path.join(datadir, 'lnd-tools.key');
  const certFile = Path.join(datadir, 'lnd-tools.crt');
  if (!fs.existsSync(keyFile) || !fs.existsSync(certFile)) {
    logger.log('No TLS certs found. Try running tls.sh to generate one', ['API']);
    process.exit(1);
  }

  // Listening
  const server = https.createServer({
    key: fs.readFileSync(keyFile, 'utf8'),
    cert: fs.readFileSync(certFile, 'utf8')
  }, app);
  server.listen(port, function() {
    logger.log('Listening on HTTPS port ' + port, ['API']);
  });
  return server;
};
