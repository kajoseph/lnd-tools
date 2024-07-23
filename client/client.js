/* eslint-disable no-console */

const { program } = require('commander');
const ClientRequest = require('./request');


program
  .description('Calls the LND-Tools web server')
  .requiredOption('-k, --key <keyFile>',  'Private key for authorizing to the web server. Can be a file or raw hex')
  .option('-h, --host <host>', 'Host the web server is running on', 'localhost')
  .option('-p, --port <port>', 'Port the web server is running on', '8090')
  .option('-c, --cert <certFile>', 'TLS cert to the web server. Use this for self-signed certs');

const whitelist = program.command('whitelist').description('Manage the LND channels whitelist');

whitelist
  .command('add')
  .description('Add a public key to the whitelist')
  .argument('<pubKey>', 'Public key to be added')
  .action(async (pubKey, options) => {
    const clientOpts = program.opts();
    try {
      const req = await new ClientRequest(clientOpts).request({
        method: 'POST',
        path: '/channel/whitelist/' + pubKey
      });
      console.log(req);
    } catch (err) {
      console.log(err);
    }
  });

whitelist
  .command('rm')
  .description('Remove a public key from the whitelist')
  .argument('<pubKey>', 'Public key to be removed')
  .action(async (pubKey, options) => {
    const clientOpts = program.opts();
    try {
      const req = await new ClientRequest(clientOpts).request({
        method: 'DELETE',
        path: '/channel/whitelist/' + pubKey
      });
      console.log(req);
    } catch (err) {
      console.log(err);
    }
  });

whitelist
  .command('list')
  .description('Display all public keys in the whitelist')
  .action(async (options) => {
    const clientOpts = program.opts();
    try {
      await new ClientRequest(clientOpts).request({
        method: 'GET',
        path: '/channel/whitelist',
        displayOnReceive: true
      });
    } catch (err) {
      console.log(err);
    }
  });


const config = program.command('config').description('Set configurations for the LND-Tools service');

config
  .command('setRejectMessage')
  .description('Set the channel reject message')
  .argument('<message...>', 'Message string')
  .action(async (message, options) => {
    const clientOpts = program.opts();
    try {
      const req = await new ClientRequest(clientOpts).request({
        method: 'POST',
        path: '/channel/rejectMessage',
        body: { message: message.join(' ') }
      });
      console.log(req);
    } catch (err) {
      console.log(err);
    }
  });

config
  .command('rmRejectMessage')
  .description('Remove the channel reject message in the db. Channel rejects will use the system default message')
  .action(async (options) => {
    const clientOpts = program.opts();
    try {
      const req = await new ClientRequest(clientOpts).request({
        method: 'DELETE',
        path: '/channel/rejectMessage'
      });
      console.log(req);
    } catch (err) {
      console.log(err);
    }
  });

config
  .command('getRejectMessage')
  .description('Get the current channel reject message')
  .action(async (options) => {
    const clientOpts = program.opts();
    try {
      const req = await new ClientRequest(clientOpts).request({
        method: 'GET',
        path: '/channel/rejectMessage'
      });
      console.log(req);
    } catch (err) {
      console.log(err);
    }
  });


const logs = program.command('logs').description('Query lnd-tools DB logs');

logs
  .command('get')
  .description('Get lnd-tools DB logs')
  .option('-l, --limit <value>', 'Number of entries to return (default: 100)')
  .option('-s, --startDate <value>', 'Timestamp (UTC) start of logs (inclusive)')
  .option('-e, --endDate <value>', 'Timestamp (UTC) end of logs (exclusive)')
  .action(async (options) => {
    const clientOpts = program.opts();
    const query = Object.keys(options).length ? '?' + Object.entries(options).map(([key, val]) => `${key}=${val}`).join('&') : '';
    try {
      const req = await new ClientRequest(clientOpts).request({
        method: 'GET',
        path: '/log' + query
      });
      console.log(req);
    } catch (err) {
      console.log(err);
    }
  });


logs
  .command('rm')
  .description('Delete lnd-tools logs from the DB. USE CAREFULLY!')
  .option('-b, --before <value>', 'Delete all logs before this timestamp (UTC) (exclusive)')
  .option('-a, --after <value>', 'Delete all logs after this timestamp (UTC) (exclusive)')
  .option('--limit <value>', 'Max number of entries to delete')
  .option('--desc', 'Delete in descending date order. Only works when used with --limit param')
  .action(async (options) => {
    const clientOpts = program.opts();
    const query = Object.keys(options).length ? '?' + Object.entries(options).map(([key, val]) => `${key}=${val}`).join('&') : '';
    try {
      const req = await new ClientRequest(clientOpts).request({
        method: 'DELETE',
        path: '/log' + query
      });
      console.log(req);
    } catch (err) {
      console.log(err);
    }
  });


if (process.env.MOCHA) {
  module.exports = {
    program
  };
} else {
  program.parse(process.argv);
}
