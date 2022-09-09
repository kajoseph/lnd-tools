#!/usr/bin/env node

const { program } = require('commander');
const Path = require('path');
const os = require('os');
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
  { executableFile: Path.join(__dirname, './client/client.js') }
);

program.command(
  'serve',
  'Start the web server and LND interceptors',
  { executableFile: Path.join(__dirname, './server/server.js') }
);

program.command('keygen')
  .description('Generate a private/public key pair for authorizing to the web server. Writes to `auth.pub` and `auth.key` plaintext files')
  .option('-d, --datadir <dir>', 'The lnd-tools datadir to write the files to. Ignored if --print is given. (Default: "' + Path.join(os.homedir(), '.lnd-tools') + '" || $LND_TOOLS_DATADIR)')
  .option('-p, --print', 'Prints keys to stdout in plaintext instead of writing to files')
  .action(new KeyGenerator({ pubKey: '' }).generate);


if (process.env.MOCHA) {
  module.exports = {
    program
  };
} else {
  program.parse(process.argv);
}
