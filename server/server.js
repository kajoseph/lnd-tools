const { program } = require('commander');
const os = require('os');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const api = require('./api');
const LND = require('./lnd');
const KeyGenerator = require('../keyGenerator');

program
  .description('Start the web server and LND interceptors')
  .requiredOption('-k, --key <key>',    'Public key used to authorize web requests. Can be a file or raw hex')
  .option('-p, --port <port>',          '(optional) The port you want the web host to be on', '8090')
  .option('--cors <origins>',           '(optional) Comma delimited lists of CORS origins to allow', 'localhost')
  .option('--lnd <host[:port]>',        '(optional) The LND host[:port]', 'localhost:10009')
  .option('--macaroon <macaroon>',      '(optional) Path to macaroon file', path.join(os.homedir(), '.lnd/data/chain/bitcoin/mainnet/admin.macaroon'))
  .option('--cert <cert>',              '(optional) Path to cert file', path.join(os.homedir(), '.lnd/tls.cert'))
  .option('--datadir <dir>',            '(optional) Dir to put db in. You can also set this with the LND_TOOLS_DATADIR env var. (Default: "' + path.join(os.homedir(), '.lnd-tools') + '")')
  .parse(process.argv);

const {
  key,
  port,
  cors,
  lnd,
  macaroon,
  cert,
  datadir
} = program.opts();

const actualDataDir = datadir || process.env.LND_TOOLS_DATADIR || path.join(os.homedir(), '.lnd-tools');
if (!fs.existsSync(actualDataDir)) {
  fs.mkdirSync(actualDataDir, { recursive: true });
  // eslint-disable-next-line no-console
  console.log('Created dir: ' + actualDataDir);
}


let [lndHost = 'localhost', lndPort = '10009'] = lnd.split(':');
let origins = cors.split(',');

let hexKey;
if (fs.existsSync(key)) {
  hexKey = fs.readFileSync(key);
  hexKey = hexKey.toString('utf8');
} else {
  hexKey = key;
}

const keyGen = new KeyGenerator({ pubKey: hexKey });

// Initialize db
db.init({ path: datadir }).then(() => {
  // Initialize API
  api({ port, origins, key: keyGen, datadir });

  // Initialize LND hooks/listeners
  const lndService = new LND({
    host: lndHost,
    port: lndPort,
    macaroon,
    cert
  });

  lndService.channelInterceptor();
});
