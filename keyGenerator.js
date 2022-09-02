/* eslint-disable no-console */

const crypto = require('crypto');
const secp = require('secp256k1');
const fs = require('fs');

class KeyGenerator {
  constructor({ pubKey } = {}) {
    this.pubKey = Buffer.from(pubKey, 'hex');
  }

  generate({ out }) {
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
    } else if (out) {
      if (fs.existsSync(out)) {
        console.log('Replacing existing keys');
      }
      fs.writeFileSync(out + '.key', Buffer.from(privateKey).toString('hex'));
      fs.writeFileSync(out + '.pub', Buffer.from(publicKey).toString('hex'));
    } else {
      console.log('Key generated:');
      console.log('---------------');
      console.log('Private Key', Buffer.from(privateKey).toString('hex'));
      console.log('---------------');
      console.log('Public Key', Buffer.from(publicKey).toString('hex'));
      console.log('---------------');
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
