const { program } = require('commander');
const os = require('os');
const Path = require('path');
const db = require('./db');
const api = require('./api');
const LND = require('./lnd');
const Config = require('./config');
const logger = require('./logger');

program
  .description('Start the web server and LND interceptors')
  .option('-d, --datadir <dir>',        'Working dir for lnd-tools. You can also set this with the LND_TOOLS_DATADIR env var. (Default: "' + Path.join(os.homedir(), '.lnd-tools') + '")')
  .option('-c, --config <file>',        'LND-Tools config file. (Default: "<datadir>/lnd-tools.conf")')
  .option('-k, --pubkey <key>',         'Public key used to authorize web requests. Can be a file or raw hex. (Default: "<datadir>/auth.pub")')
  .option('-p, --port <port>',          'The port you want the HTTP server to listen on', '8090')
  .option('--cors <origins>',           'Comma delimited lists of CORS origins to allow', 'localhost')
  .option('--useToolsCert',             'If provided, will look for lnd-tools.crt and lnd-tools.key in --datadir. Otherwise, uses LND cert. Use tls.sh to generate a cert.')
  .option('--lnddir <dir>',             'Data directory for LND. (Default: "' + Path.join(os.homedir(), '.lnd') + '")')
  .option('--lndconfig <config>',       'Config file for LND. (Default: "<lnddir>/lnd.conf")')
  .option('--lndnetwork <network>',     'The network LND is running on. (Default: "mainnet" or --lndconfig value)')
  .option('--lndrpc <host[:port]>',     'The LND host[:port] (Default: "localhost:10009" or rpclisten in --lndconfig)')
  .option('--lndmacaroon <macaroon>',   'Path to LND macaroon file. (Default: "<lnddir>/.../admin.macaroon")')
  .option('--lndcert <cert>',           'Path to LND cert file. (Default: "<lnddir>/tls.cert")')
  .option('--lndkey <key>',             'Path to LND key file. (Default: "<lnddir>/tls.key")');

const main = function() {
  const {
    datadir,
    config,
    pubkey,
    port,
    cors,
    useToolsCert,
    lnddir,
    lndconfig,
    lndnetwork,
    lndrpc,
    lndmacaroon,
    lndcert
  } = program.opts();

  Config.load({
    datadir,
    config,
    pubkey,
    port,
    cors,
    useToolsCert,
    lnddir,
    lndconfig,
    lndnetwork,
    lndrpc,
    lndmacaroon,
    lndcert
  }).catch((err) => {
    logger.error('Error loading config', err, ['server']);
    process.exit(1);
  }).then(async (config) => {
    try {
      // Initialize db
      await db.init({ path: config.datadir });
    } catch (err) {
      logger.error('Error initializing db. Is it in use?', err, ['server']);
      process.exit(1);
    }

    try {
      // Initialize API
      api();
    } catch (err) {
      logger.error('Error starting API', err, ['server']);
      process.exit(1);
    }

    try {
      // Initialize LND hooks/listeners
      const lndService = new LND();
      lndService.channelInterceptor();
    } catch (err) {
      logger.error('Error initializing LND service', err, ['server']);
      process.exit(1);
    }
  });
};

if (process.env.MOCHA) {
  module.exports = {
    program,
    main
  };
} else {
  program.parse(process.argv);
  main();
}
