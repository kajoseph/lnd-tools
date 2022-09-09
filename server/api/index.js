const express = require('express');
const cors = require('cors');
const https = require('https');
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

  // TLS config
  if (!config.lndkey) {
    logger.error('No TLS cert key found.', null, ['API']);
    process.exit(1);
  }
  if (!config.lndcert) {
    logger.error('No TLS cert found.', null, ['API']);
    process.exit(1);
  }

  const server = https.createServer({
    ecdhCurve: config.apicertkey.length > 2000 ? undefined : 'secp256k1',
    key: Buffer.from(config.apicertkey, 'base64'),
    cert: Buffer.from(config.apicert, 'base64')
  }, app);

  // Listen
  server.listen(config.port, function() {
    logger.log('Listening on HTTPS port ' + config.port, ['API']);
  });
  return server;
};
