const https = require('https');
const secp = require('secp256k1');
const crypto = require('crypto');
const fs = require('fs');

const privKey = 'c7165ae89173001a6d6b30ffe18e01be9891e0a99da0f7c1912dd750911c219b';

const opts = {
  method: 'GET',
  host: 'localhost',
  port: 8090,
  path: '/channel/whitelist?limit=20'
};

const getXAuth = () => {
  let msg = opts.method + opts.path;
  if (opts.body) {
    msg += JSON.stringify(opts.body);
  } else {
    msg += '{}';
  }
  const msgHash = crypto.createHash('SHA256').update(msg).digest();
  const sig = secp.ecdsaSign(Buffer.from(msgHash), Buffer.from(privKey, 'hex'));
  return Buffer.from(sig.signature).toString('base64');
};

const req = https.request({
  ...opts,
  headers: {
    'x-auth': getXAuth()
  },
  // key: fs.readFileSync(__dirname + '/lnd-tools.key', 'utf8'),
  // cert: fs.readFileSync(__dirname + '/lnd-tools.crt', 'utf8'),
  cert: fs.readFileSync('/home/kjoseph/temp/lnd-tools.crt', 'utf8'),
  rejectUnauthorized: false
});

req.on('response', (res) => {
  const dat = [];
  res.on('data', (chunk) => {
    dat.push(...chunk);
  });
  res.on('end', () => {
    console.log(Buffer.from(dat).toString());
    console.log('thats all folks!');
    process.exit();
  });
  res.on('error', (err) => {
    console.log(err);
  });
});

req.on('error', (err) => {
  console.log('Request error:', err);
});

if (opts.body) {
  req.write(JSON.stringify(opts.body));
}
req.end();
