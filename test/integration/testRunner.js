#!/usr/bin/env node
/* eslint-disable no-console */

require('dotenv').config({ path: '.env' });

const Mocha = require('mocha');
const fs = require('fs');
const Path = require('path');
const iUtils = require('./integrationUtils');
const ServerConfig = require('../../server/config');

process.env.MOCHA = 'true';
process.env.LND_TOOLS_DATADIR = Path.join(__dirname, 'data');
fs.mkdirSync(process.env.LND_TOOLS_DATADIR, { recursive: true });


if (fs.existsSync(process.env.LND_MACAROON)) {
  process.env.LND_MACAROON = fs.readFileSync(process.env.LND_MACAROON).toString('base64');
}
if (fs.existsSync(process.env.LND_CERT)) {
  process.env.LND_CERT = fs.readFileSync(process.env.LND_CERT).toString('base64');
}
if (fs.existsSync(process.env.LND_PEER_MACAROON)) {
  process.env.LND_PEER_MACAROON = fs.readFileSync(process.env.LND_PEER_MACAROON).toString('base64');
}
if (fs.existsSync(process.env.LND_PEER_CERT)) {
  process.env.LND_PEER_CERT = fs.readFileSync(process.env.LND_PEER_CERT).toString('base64');
}

const test = new Mocha();

const timeoutIdx = process.argv.findIndex(arg => arg === '--timeout');
if (timeoutIdx && !isNaN(process.argv[timeoutIdx + 1])) {
  test.timeout(process.argv[timeoutIdx + 1]);
}


function addFile(file) {
  if (fs.statSync(file).isDirectory()) {
    const dir = fs.readdirSync(file);
    for (let item of dir) {
      addFile(Path.join(file, item));
    }
  } else if (/^.*\.integration\.test\.js$/gmi.test(file)) {
    test.addFile(file);
  }
}

addFile('.');


ServerConfig.load({
  datadir: process.env.LND_TOOLS_DATADIR,
  pubkey: process.env.API_PUBKEY,
  useToolsCert: true,
  lnddir: Path.join(process.env.LND_TOOLS_DATADIR, 'lnd_main'),
  lndrpc: process.env.LND_RPC,
  lndmacaroon: process.env.LND_MACAROON,
  lndcert: process.env.LND_CERT,
  lndkey: process.env.LND_KEY
})
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .then(async () => {
    try {
      await iUtils.initDB();
      await iUtils.clearDB();
      test.run((failures) => {
        iUtils.rmTestDb();
        process.exit(failures);
      });
    } catch (err) {
      console.log(err);
      process.exit(1);
    }
  });
