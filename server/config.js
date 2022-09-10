const Path = require('path');
const fs = require('fs');
const os = require('os');
const readline = require('readline');
const KeyGenerator = require('../keyGenerator');
const logger = require('./logger');

class Config {
  async load({
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
    lndcert,
    lndkey
  }) {
    datadir = datadir || process.env.LND_TOOLS_DATADIR || Path.join(os.homedir(), '.lnd-tools');
    if (!fs.existsSync(datadir)) {
      fs.mkdirSync(datadir, { recursive: true });
      logger.log('Created LND-Tools data directory: ' + datadir, ['config']);
    } else {
      logger.log('Using LND-Tools data directory: ' + datadir, ['config']);
    }

    // Load config file first
    await this._loadConfigFile({ datadir, config, useToolsCert });

    // Read from lnddir
    if (lnddir || this.lnddir) {
      await this._loadLndFromDir({ lnddir, lndconfig, lndnetwork, lndrpc, lndmacaroon, lndcert, lndkey });
    } else if (lndconfig || this.lndconfig) {
      await this._readLndConfig({ lndconfig });
    }

    // Finally, prioritize any explicitly set flags
    this.datadir = datadir; // already been defaulted above.
    this.authkey = pubkey || this.pubkey || Path.join(this.datadir, 'auth.pub');
    this.port = port || this.port || '8090';
    this.corsOrigins = (cors || this.cors || '').split(',');
    this.useToolsCert = useToolsCert != null ? !!useToolsCert : !!this.useToolsCert;
    this.lnddir = lnddir || this.lnddir;
    this.lndconfig = lndconfig || this.lndconfig;
    this.lndnetwork = lndnetwork || this.lndnetwork || 'mainnet';
    this.lndrpc = lndrpc || this.lndrpc;
    this.lndmacaroon = lndmacaroon || this.lndmacaroon;
    this.lndcert = lndcert || this.lndcert;
    this.lndkey = lndkey || this.lndkey;

    logger.log('Using LND network: ' + this.lndnetwork, ['config']);

    this.apicertkey = this.lndkey;
    this.apicert = this.lndcert;
    if (this.useToolsCert) {
      this._loadApiCert({ datadir });
    }

    // Transform any values that need transforming

    if (fs.existsSync(this.authkey)) {
      logger.log('Using API Auth key: ' + this.authkey, ['config']);
      this.authkey = fs.readFileSync(this.authkey).toString('utf8');
      this.authkey = new KeyGenerator({ pubKey: this.authkey });
    }

    if (this.lndrpc.indexOf(':') === -1) {
      this.lndrpc += ':10009';
    }
    logger.log('Using LND RPC: ' + this.lndrpc, ['config']);

    if (fs.existsSync(this.lndmacaroon)) {
      logger.log('Using LND macaroon: ' + this.lndmacaroon, ['config']);
      this.lndmacaroon = fs.readFileSync(this.lndmacaroon).toString('base64');
    }
    if (fs.existsSync(this.lndcert)) {
      logger.log('Using LND cert: ' + this.lndcert, ['config']);
      this.lndcert = fs.readFileSync(this.lndcert).toString('base64');
    }
    if (fs.existsSync(this.lndkey)) {
      logger.log('Using LND cert key: ' + this.lndkey, ['config']);
      this.lndkey = fs.readFileSync(this.lndkey).toString('base64');
    }

    if (fs.existsSync(this.apicert)) {
      logger.log('Using API cert: ' + this.apicert, ['config']);
      this.apicert = fs.readFileSync(this.apicert).toString('base64');
    }
    if (fs.existsSync(this.apicertkey)) {
      logger.log('Using API cert key: ' + this.apicertkey, ['config']);
      this.apicertkey = fs.readFileSync(this.apicertkey).toString('base64');
    }

    return this;
  }

  async _loadConfigFile({ datadir, config }) {
    const configFile = Path.join(datadir, config || 'lnd-tools.conf');
    if (!fs.existsSync(configFile)) {
      if (config) {
        throw new Error('Specified config file does not exist: ' + configFile);
      }
      logger.log('No default LND-Tools config found', ['config']);
      return; // default config also doesn't exist.
    }

    logger.log(`Loading ${!config ? 'default ' : ''}lnd-tools config: ${configFile}`, ['config']);

    const rl = readline.createInterface({
      input: fs.createReadStream(configFile)
    });

    for await (const line of rl) {
      if (!line || line[0] === '[' || line[0] === '#') {
        continue;
      }
      const [key, value] = line.split('=');
      this[key] = value;
    }
    if (this.rejectchannelmessage) {
      logger.log('Using configured reject channel message: "' + this.rejectchannelmessage + '"', ['config']);
    }
  }

  async _loadLndFromDir({ lnddir, lndconfig, lndnetwork, lndrpc, lndmacaroon, lndcert, lndkey }) {
    lnddir = lnddir || this.lnddir || Path.join(os.homedir(), '.lnd');
    if (!fs.existsSync(lnddir)) {
      logger.warn('Provided lnddir does not exist: ' + lnddir);
      return false;
    }
    logger.log('Using LND dir: ' + lnddir, ['config']);

    await this._readLndConfig({ lnddir, lndconfig });

    this.lndrpc = lndrpc || this.lndrpc || 'localhost:10009';
    this.lndnetwork = lndnetwork || this.lndnetwork || 'mainnet';

    if (!lndcert && fs.existsSync(Path.join(lnddir, 'tls.cert'))) {
      this.lndcert = Path.join(lnddir, 'tls.cert');
    }
    if (!lndkey && fs.existsSync(Path.join(lnddir, 'tls.key'))) {
      this.lndkey = Path.join(lnddir, 'tls.key');
    }

    if (!lndmacaroon && fs.existsSync(Path.join(lnddir, 'data/chain/bitcoin', this.lndnetwork, 'admin.macaroon'))) {
      this.lndmacaroon = Path.join(lnddir, 'data/chain/bitcoin', this.lndnetwork, 'admin.macaroon');
    }
    return true;
  }

  async _readLndConfig({ lnddir, lndconfig }) {
    lnddir = lnddir || this.lnddir || '';
    lndconfig = lndconfig || this.lndconfig || 'lnd.conf';

    const lndFullConfigPath = Path.join(lnddir, lndconfig);
    if (!fs.existsSync(lndFullConfigPath)) {
      logger.log('No LND config found', ['config']);
      return;
    }
    logger.log('Reading LND config: ' + lndFullConfigPath, ['config']);

    const rl = readline.createInterface({
      input: fs.createReadStream(lndFullConfigPath)
    });

    for await (const line of rl) {
      if (!line || line[0] === '[' || line[0] === '#') {
        continue;
      }
      const [key, value] = line.split('=');
      switch (key) {
        case 'bitcoin.regtest':
          this.lndnetwork = (value == true || value == 1) ? 'regtest' : null;
          break;
        case 'bitcoin.testnet':
          this.lndnetwork = (value == true || value == 1) ? 'testnet' : null;
          break;
        case 'bitcoin.mainnet':
          this.lndnetwork = (value == true || value == 1) ? 'mainnet' : null;
          break;
        case 'rpclisten':
          this.lndrpc = value.replace('0.0.0.0', '127.0.0.1');
          break;
      }
    }
  }

  async _loadApiCert({ datadir }) {
    const keyFile = Path.join(datadir, 'lnd-tools.key');
    const certFile = Path.join(datadir, 'lnd-tools.crt');
    if (!fs.existsSync(keyFile)) {
      throw new Error('TLS key file not found. Expected ' + keyFile);
    }
    if (!fs.existsSync(certFile)) {
      throw new Error('TLS cert file not found. Expected ' + certFile);
    }

    this.apicertkey = keyFile;
    this.apicert = certFile;
  }
};

module.exports = new Config();
