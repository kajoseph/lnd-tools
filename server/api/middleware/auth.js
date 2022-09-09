const KeyGenerator = require('../../../keyGenerator');
const logger = require('../../logger');

module.exports = function(key) {
  if (typeof key === 'string') {
    key = new KeyGenerator({ pubKey: key });
  }

  return function(req, res, next) {
    try {
      const authHeader = Buffer.from(req.headers['x-auth'] || '', 'base64');
      let authStr = req.method + req.originalUrl;
      if (req.body) {
        authStr += JSON.stringify(req.body);
      }

      if (key.verify(authStr, authHeader)) {
        return next();
      }
    } catch (err) {
      logger.error('Error authorizing request: ', err, ['API']);
    }
    return res.status(406).send('Unauthorized.');
  };
};
