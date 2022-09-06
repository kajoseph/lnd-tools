/* eslint-disable no-console */

const crypto = require('crypto');
const secp = require('secp256k1');
const fs = require('fs');
const Path = require('path');
const os = require('os');

class KeyGenerator {
  constructor({ pubKey } = {}) {
    this.pubKey = Buffer.from(pubKey, 'hex');
  }

  generate({ print, datadir }) {
    const hash = crypto.createHash('sha256').update(Buffer.from('This key is valid')).digest();

    let privateKey;

    // Generate random number, make sure its within valid key space, if not then regen until we get a valid key
    do {
      privateKey = crypto.randomBytes(32);
    }
    while (!secp.privateKeyVerify(privateKey));

    const publicKey = secp.publicKeyCreate(privateKey);
    const sigObject = secp.ecdsaSign(hash, privateKey);
    const valid = secp.ecdsaVerify(sigObject.signature, hash, publicKey);

    if (!valid) {
      console.log('Key generated an invalid signature, please try again');
    } else if (print) {
      console.log('Key generated:');
      console.log('---------------');
      console.log('Private Key', Buffer.from(privateKey).toString('hex'));
      console.log('---------------');
      console.log('Public Key', Buffer.from(publicKey).toString('hex'));
      console.log('---------------');
    } else {
      const filename = 'auth';
      datadir = datadir || process.env.LND_TOOLS_DATADIR || Path.join(os.homedir(), '.lnd-tools');
      if (!fs.existsSync(datadir)) {
        console.log('Creating new directory: ' + datadir);
        fs.mkdirSync(datadir, { recursive: true });
      }
      const keyFile = Path.join(datadir, filename + '.key');
      const pubFile = Path.join(datadir, filename + '.pub');
      if (fs.existsSync(keyFile) || fs.existsSync(pubFile)) {
        console.log('Replacing existing keys in ' + datadir);
      }
      fs.writeFileSync(keyFile, Buffer.from(privateKey).toString('hex'));
      fs.writeFileSync(pubFile, Buffer.from(publicKey).toString('hex'));
      console.log('Created:');
      console.log(' ' + keyFile);
      console.log(' ' + pubFile);
    }
    process.exit();
  }

  verify(msg, sig) {
    try {
      if (typeof sig === 'string') {
        if (/^[a-f0-9]$/gm.test(sig)) {
          sig = Buffer.from(sig, 'hex');
        } else {
          sig = Buffer.from(sig, 'base64');
        }
      }
      const msgHash = crypto.createHash('SHA256').update(msg).digest();
      return secp.ecdsaVerify(sig, msgHash, this.pubKey);
    } catch (err) {
      return false;
    }
  }
}

module.exports = KeyGenerator;
