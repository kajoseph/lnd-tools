module.exports = function(req, res, next) {
  const { pubKey } = req.params;

  if (typeof pubKey !== 'string') {
    return res.status(400).send('Invalid pubKey');
  }

  if (Buffer.from(pubKey, 'hex').length !== 33) {
    return res.status(400).send('Invalid pubKey');
  }
  return next();
};
