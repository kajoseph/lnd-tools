#!/usr/bin/env node

require('dotenv').config({ path: '.env' });

const Mocha = require('mocha');
const fs = require('fs');
const Path = require('path');
const iUtils = require('./integrationUtils');

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

iUtils.clearDB();

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

test.run((failures) => {
  iUtils.rmTestDb();
  process.exit(failures);
});
