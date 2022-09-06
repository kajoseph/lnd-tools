const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const auth = require('./middleware/auth');
const config = require('../config');
const logger = require('../../lib/logger');

module.exports = () => {
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
    origin: config.corsOrigins
  }));

  // JSON body parse
  app.use(express.json());

  // Routes
  app.use('/channel', auth(config.authkey), require('./routes/channel'));

  if (!fs.existsSync(config.lndkey) || !fs.existsSync(config.lndcert)) {
    logger.log('No TLS certs found. Try running tls.sh to generate one', ['API']);
    process.exit(1);
  }

  // Listening
  const server = https.createServer({
    key: fs.readFileSync(config.lndkey, 'utf8'),
    cert: fs.readFileSync(config.lndcert, 'utf8')
  }, app);
  server.listen(config.port, function() {
    logger.log('Listening on HTTPS port ' + config.port, ['API']);
  });
  return server;
};
