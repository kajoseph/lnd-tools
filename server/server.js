const { program } = require('commander');
const os = require('os');
const Path = require('path');
const fs = require('fs');
const db = require('./db');
const api = require('./api');
const LND = require('./lnd');
const Config = require('./config');
const logger = require('../lib/logger');

program
  .description('Start the web server and LND interceptors')
  .option('-d, --datadir <dir>',        'Working dir for lnd-tools. You can also set this with the LND_TOOLS_DATADIR env var. (Default: "' + Path.join(os.homedir(), '.lnd-tools') + '")')
  .option('-c, --config <file>',        'Config file. (Default: <datadir>/lnd-tools.conf)')
  .option('-k, --pubkey <key>',         'Public key used to authorize web requests. Can be a file or raw hex')
  .option('-p, --port <port>',          'The port you want the web host to be on', '8090')
  .option('--cors <origins>',           'Comma delimited lists of CORS origins to allow', 'localhost')
  .option('--lnddir <dir>',             'Data directory for LND. ', Path.join(os.homedir(), '.lnd'))
  .option('--lndconfig <config>',       'Config file for LND. (Default: "lnd.conf" in --datadir)')
  .option('--lndnetwork <network>',      'The network LND is running on.', 'mainnet')
  .option('--lndrpc <host[:port]>',     'The LND host[:port] (Default: "localhost:10009")')
  .option('--lndmacaroon <macaroon>',   'Path to LND macaroon file. (Default: "admin.macaroon" in --lnddir)')
  .option('--lndcert <cert>',           'Path to LND cert file. (Default: "tls.cert" in --lnddir)')
  .option('--lndkey <key>',             'Path to LND key file. (Default: "tls.key" in --lnddir)')
  .parse(process.argv);

const {
  datadir,
  config,
  pubkey,
  port,
  cors,
  lnddir,
  lndconfig,
  lndnetwork,
  lndrpc,
  lndmacaroon,
  lndcert
} = program.opts();

const actualDataDir = datadir || process.env.LND_TOOLS_DATADIR || Path.join(os.homedir(), '.lnd-tools');
if (!fs.existsSync(actualDataDir)) {
  fs.mkdirSync(actualDataDir, { recursive: true });
  // eslint-disable-next-line no-console
  console.log('Created dir: ' + actualDataDir);
}


// Initialize db
db.init({ path: actualDataDir })
  .catch((err) => {
    logger.error('Error initializing db', err, ['server']);
    process.exit(1);
  })
  .then(async () => {
    try {
      await Config.load({
        datadir,
        config,
        pubkey,
        port,
        cors,
        lnddir,
        lndconfig,
        lndnetwork,
        lndrpc,
        lndmacaroon,
        lndcert
      });
    } catch (err) {
      logger.error('Error loading config.', err, ['server']);
      process.exit(1);
    }

    // Initialize API
    api();

    // Initialize LND hooks/listeners
    const lndService = new LND();
    lndService.channelInterceptor();
  });
