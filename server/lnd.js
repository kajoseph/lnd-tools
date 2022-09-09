const lightning = require('lightning');
const fs = require('fs');
const config = require('./config');
const constants = require('./constants');
const db = require('./db');
const logger = require('./logger');

class Lnd {
  constructor({ lndrpc, lndmacaroon, lndcert } = {}) {
    let socket = lndrpc || config.lndrpc;
    let macaroon = lndmacaroon || config.lndmacaroon;
    let cert = lndcert || config.lndcert;
    if (fs.existsSync(macaroon)) {
      macaroon = fs.readFileSync(macaroon).toString('base64');
    }
    if (fs.existsSync(cert)) {
      cert = fs.readFileSync(cert).toString('base64');
    }
    const { lnd } = lightning.authenticatedLndGrpc({
      socket,
      macaroon,
      cert
    });
    this.lnd = lnd;
    this.subs = {};
    this.unsubscribing = false;
  }

  unsubscribeAll() {
    this.unsubscribing = true;
    for (let [name, sub] of Object.entries(this.subs)) {
      clearTimeout(sub.restartTimeout);
      sub.removeAllListeners();
      delete this.subs[name];
    }
    this.unsubscribing = false;
  }

  channelInterceptor(isRestart = false) {
    if (isRestart && (this.unsubscribing || !this.subs.channelInterceptor)) { return; }

    logger.log('Subscribing to channel open requests', ['LND']);
    const sub = lightning.subscribeToOpenRequests({ lnd: this.lnd });
    this.subs.channelInterceptor = sub;
    sub.on('channel_request', async (channel) => {
      try {
        const dbEntry = await db.collections.CHANNEL.get(channel.partner_public_key);
        if (!dbEntry || !dbEntry.allowed) {
          const chnlMsg = await db.collections.CONFIG.get(constants.LND.ChannelRejectMessageKey);
          logger.log('Rejecting channel request from ' + channel.partner_public_key, ['LND']);
          return channel.reject({ reason: chnlMsg || config.rejectchannelmessage || constants.LND.ChannelRejectMessage });
        }
        logger.log('Accepting channel request from ' + channel.partner_public_key, ['LND']);
        return channel.accept();
      } catch (err) {
        logger.warn('Unexpected error handling channel request', err, ['LND']);
        return channel.reject({ reason: 'Unknown error occurred. Please report this error by emailing lightning@bitpay.com' });
      }
    });
    sub.on('error', (err) => {
      logger.warn('Channel Interceptor disconnected from LND', err, ['LND']);
      sub.removeAllListeners();
      // Retries subscription every 1 second until connection re-established
      if (this.unsubscribing) { return; }
      sub.restartTimeout = setTimeout(() => this.channelInterceptor(true), constants.LND.ReconnectTimeout);
    });
  }
}

module.exports = Lnd;
