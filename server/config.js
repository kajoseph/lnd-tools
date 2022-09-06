const Path = require('path');
const fs = require('fs');
const os = require('os');
const readline = require('readline');
const KeyGenerator = require('../keyGenerator');

class Config {
  async load({
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
    lndcert,
    lndkey
  }) {
    // Load config file first
    this._loadConfigFile({ datadir, config });

    // Read from lnddir
    lnddir = lnddir || this.lnddir;
    if (lnddir) {
      await this._loadLndFromDir({ lnddir, lndconfig, lndnetwork, lndrpc, lndmacaroon, lndcert, lndkey });
    }

    // Finally, prioritize any explicitly set flags
    this.datadir = datadir || this.datadir || Path.join(os.homedir(), '.lnd-tools');
    this.authkey = pubkey || this.pubkey;
    this.port = port || this.port || '8090';
    this.corsOrigins = (cors || this.cors || '').split(',');
    this.lnddir = lnddir || this.lnddir;
    this.lndconfig = lndconfig || this.lndconfig;
    this.lndnetwork = lndnetwork || this.lndnetwork;
    this.lndrpc = lndrpc || this.lndrpc;
    this.lndmacaroon = lndmacaroon || this.lndmacaroon;
    this.lndcert = lndcert || this.lndcert;
    this.lndkey = lndkey || this.lndkey;

    // Transform any values that need transforming
    if (fs.existsSync(this.authkey)) {
      this.authkey = fs.readFileSync(this.authkey).toString('utf8');
      this.authkey = new KeyGenerator({ pubKey: this.authkey });
    }

    if (this.lndrpc.indexOf(':') === -1) {
      this.lndrpc += ':10009';
    }
  }

  async _loadConfigFile({ datadir, config }) {
    const configFile = Path.join(datadir, config || 'lnd-tools.conf');
    if (config && !fs.existsSync(configFile)) {
      throw new Error('Provided config file does not exist: ' + configFile);
    }

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
  }

  async _loadLndFromDir({ lnddir, lndconfig, lndnetwork, lndrpc, lndmacaroon, lndcert, lndkey }) {
    if (!fs.existsSync(lnddir)) {
      throw new Error('Provided lnddir does not exist: ' + lnddir);
    }

    if (lndconfig) {
      await this._readLndConfig({ lnddir, lndconfig });
    }

    this.lndrpc = lndrpc || this.lndrpc || 'localhost:10009';
    this.lndnetwork = lndnetwork || this.lndnetwork || 'mainnet';

    if (!lndcert && fs.existsSync(Path.join(lnddir, 'tls.cert'))) {
      this.lndcert = fs.readFileSync(Path.join(lnddir, 'tls.cert')).toString('base64');
    }
    if (!lndkey && fs.existsSync(Path.join(lnddir, 'tls.key'))) {
      this.lndkey = fs.readFileSync(Path.join(lnddir, 'tls.key')).toString('base64');
    }

    if (!lndmacaroon && fs.existsSync(Path.join(lnddir, 'data/chain/bitcoin', this.lndnetwork, 'admin.macaroon'))) {
      this.lndmacaroon = fs.readFileSync(Path.join(lnddir, 'data/chain/bitcoin', this.lndnetwork, 'admin.macaroon')).toString('base64');
    }
  }

  async _readLndConfig({ lnddir, lndconfig }) {
    const rl = readline.createInterface({
      input: fs.createReadStream(Path.join(lnddir, lndconfig))
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
          this.lndconnect = value;
          break;
      }
    }
  }
};

module.exports = new Config();
