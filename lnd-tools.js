#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const package = require('./package.json');
const KeyGenerator = require('./keyGenerator');

program
  .name('lnd-tools')
  .description('Advanced tooling for LND')
  .summary('LND-Tools v' + package.version)
  .version(package.version);

program.command(
  'client',
  'Call server API endpoints',
  { executableFile: path.join(__dirname, './client/client.js') }
);

program.command(
  'serve',
  'Start the web server and LND interceptors',
  { executableFile: path.join(__dirname, './server/server.js') }
);

program.command('keygen')
  .description('Generate a private/public key pair for authorizing to the web server')
  .option('-o, --out <outName>', 'Write keys to files <outName>.pub and <outName>.key in plaintext')
  .action(new KeyGenerator({ pubKey: '' }).generate);

program.parse(process.argv);
