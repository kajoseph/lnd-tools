const https = require('https');
const secp = require('secp256k1');
const crypto = require('crypto');
const fs = require('fs');

class ClientRequest {
  constructor({ key, host, port, cert }) {
    if (fs.existsSync(key?.replace('~', '$HOME'))) {
      key = fs.readFileSync(key);
      key = key.toString('utf8');
    }
    if (fs.existsSync(cert?.replace('~', '$HOME'))) {
      cert = fs.readFileSync(cert);
      cert = cert.toString('utf8');
    }
    this.key = key;
    this.host = host;
    this.port = port;
    this.cert = cert;
    if (cert) {
      const pubkeyObj = crypto.createPublicKey(cert);
      if (pubkeyObj.asymmetricKeyType === 'ec') {
        this.ecdhCurve = pubkeyObj.asymmetricKeyDetails.namedCurve;
      }
    }
  }

  _buildXAuth({ method, path, body }) {
    let msg = method + path;
    if (body) {
      msg += JSON.stringify(body);
    } else {
      msg += '{}';
    }
    const msgHash = crypto.createHash('SHA256').update(msg).digest('hex');
    const sig = secp.ecdsaSign(Buffer.from(msgHash, 'hex'), Buffer.from(this.key, 'hex'));
    return Buffer.from(sig.signature).toString('base64');
  };

  request({ method, path, body, displayOnReceive }) {
    return new Promise((resolve, reject) => {
      const req = https.request({
        method,
        host: this.host,
        port: this.port,
        path,
        headers: {
          'x-auth': this._buildXAuth({ method, path, body }),
          'Content-Type': 'application/json'
        },
        ecdhCurve: this.ecdhCurve,
        ca: this.cert,
        rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED != '0' ?? true
      });

      req.on('response', (res) => {
        const dat = [];
        res.on('data', (chunk) => {
          if (displayOnReceive) {
            // eslint-disable-next-line no-console
            console.log(chunk.toString());
          } else {
            dat.push(...chunk);
          }
        });
        res.on('end', () => {
          resolve(Buffer.from(dat).toString());
        });
        res.on('error', (err) => {
          reject(err);
        });
      });

      req.on('error', (err) => {
        if (err.message === 'self-signed certificate') {
          return reject(new Error('Self-signed certificate. Provide the server\'s --cert (recommended) or set NODE_TLS_REJECT_UNAUTHORIZED=0 to bypass'));
        }
        reject(err);
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }
}

module.exports = ClientRequest;
