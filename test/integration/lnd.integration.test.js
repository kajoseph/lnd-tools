const sinon = require('sinon');
const should = require('chai').should();
const lightning = require('lightning');
const EventEmitter = require('events');
const { CryptoRpc } = require('crypto-rpc');
const Lnd = require('../../server/lnd');
const logger = require('../../lib/logger');
const constants = require('../../lib/constants');
const db = require('../../server/db');
const iUtils = require('./integrationUtils');


describe('LND', function() {
  let lnd;
  let main;
  let mainInfo;
  let peer;
  let peerInfo;
  let btcRpc;
  let btcAddress;

  async function generateBlocks(num) {
    if (!btcAddress) {
      const result = await new Promise((r, e) => btcRpc.rpc.getNewAddress((err, res) => err ? e(err) : r(res)));
      btcAddress = result.result;
    }
    let mainBlksRecieved = 0;
    let peerBlksRecieved = 0;
    const mainSub = new Promise(resolve => lightning.subscribeToBlocks({ lnd: main }).on('block', (blk) => { mainBlksRecieved++; if (mainBlksRecieved >= num) { return resolve(); }  }));
    const peerSub = new Promise(resolve => lightning.subscribeToBlocks({ lnd: peer }).on('block', (blk) => { peerBlksRecieved++; if (peerBlksRecieved >= num) { return resolve(); }  }));
    await new Promise((r, e) => btcRpc.rpc.generateToAddress(num, btcAddress, (err, res) => err ? e(err) : r(res)));
    await Promise.all([mainSub, peerSub]);
    await waitForLndToBeSettled();
  };

  async function waitForLndToBeSettled() {
    await new Promise(async (resolve) => {
      while (true) {
        const mainInfo = await lightning.getWalletInfo({ lnd: main });
        const peerInfo = await lightning.getWalletInfo({ lnd: peer });
        if (mainInfo.is_synced_to_chain && peerInfo.is_synced_to_chain) {
          return resolve();
        }
        await iUtils.sleep(500);
      }
    });
  }

  before(function(done) {
    this.timeout(10000);
    try {
      ({ lnd: main } = lightning.authenticatedLndGrpc({
        socket: process.env.LND_RPC,
        cert: process.env.LND_CERT,
        macaroon: process.env.LND_MACAROON
      }));
      ({ lnd: peer } = lightning.authenticatedLndGrpc({
        socket: process.env.LND_PEER_RPC,
        cert: process.env.LND_PEER_CERT,
        macaroon: process.env.LND_PEER_MACAROON
      }));

      new Promise(async (rs, rj) => { setTimeout(() => rj(new Error('LND not connected: main')), 2000); const res = await lightning.getWalletInfo({ lnd: main }); return rs(res); })
        .catch(done)
        .then((mainWalletInfo) => {
          mainInfo = mainWalletInfo;
          new Promise(async (rs, rj) => { setTimeout(() => rj(new Error('LND not connected: peer')), 2000); const res = await lightning.getWalletInfo({ lnd: peer }); return rs(res); })
            .catch(done)
            .then((peerWalletInfo) => {
              peerInfo = peerWalletInfo;
              btcRpc = new CryptoRpc({
                chain: 'BTC',
                host: process.env.BTC_HOST,
                rpcPort: process.env.BTC_PORT,
                rpcUser: process.env.BTC_USER,
                rpcPass: process.env.BTC_PASS,
                protocol: process.env.BTC_PROTOCOL
              }).get('BTC');

              // eslint-disable-next-line no-console
              console.log('generating 101 blocks');
              generateBlocks(101)
                .catch(done)
                .then(async () => {
                  try {
                    const lndAddr = await lightning.createChainAddress({ lnd: main, format: 'p2wpkh' });
                    const peerAddr = await lightning.createChainAddress({ lnd: peer, format: 'p2wpkh' });
                    btcRpc.rpc.sendToAddress(lndAddr.address, 2, (err, result) => {
                      if (err) { return done(err); }
                      btcRpc.rpc.sendToAddress(peerAddr.address, 2, (err, result) => {
                        if (err) { return done(err); }
                        return done();
                      });
                    });
                  } catch (err) {
                    return done(err);
                  }
                });
            });
        });
    } catch (err) {
      return done(err);
    }
  });

  beforeEach(() => {
    lnd = new Lnd();
    // Prevents spamming the test output w/ a bunch of logs
    sinon.stub(console, 'log');
    sinon.stub(console, 'warn');
    sinon.stub(console, 'error');
  });

  afterEach(() => {
    lnd.unsubscribeAll();
    sinon.restore();
  });

  describe('channelInterceptor', () => {
    it('should listen for channels requests', function() {
      sinon.spy(EventEmitter.prototype, 'on');
      lnd.channelInterceptor();
      EventEmitter.prototype.on.args.length.should.be.gte(2);
      should.exist(EventEmitter.prototype.on.args.find(arg => arg[0] === 'channel_request'));
      should.exist(EventEmitter.prototype.on.args.find(arg => arg[0] === 'error'));
    });

    it('should try to reconnect if connection is lost', async function() {
      this.timeout(Math.max(this.test._timeout, constants.LND.ReconnectTimeout + 2000));
      sinon.spy(logger, 'warn');

      const noLnd = new Lnd({
        lndrpc: '256.256.256.256:10000',
        lndcert: 'some cert',
        lndmacaroon: 'some mac'
      });

      noLnd.channelInterceptor();

      sinon.spy(Lnd.prototype, 'channelInterceptor'); // spy after we've called channelIntercepter above.
      await new Promise(resolve => setTimeout(resolve, constants.LND.ReconnectTimeout + 1000));
      noLnd.unsubscribeAll();
      logger.warn.callCount.should.be.gte(1);
      logger.warn.args.find(arg => arg[0] === 'Channel Interceptor disconnected from LND');
      logger.warn.args.find(arg => Array.isArray(arg[2]) && arg[2].includes('LND'));
      Lnd.prototype.channelInterceptor.callCount.should.be.gte(1);
    });

    describe('Accept', () => {
      before(async () => {
        lnd.channelInterceptor();
        await db.collections.CHANNEL.put(peerInfo.public_key, { allowed: true });
      });

      afterEach(async () => {
        await generateBlocks(6); // finalize any channels opened
      });

      after(async () => {
        const { channels } = await lightning.getChannels({ lnd: peer });
        await Promise.all(channels.map(ch => lightning.closeChannel({ lnd: peer, id: ch.id })));
        await generateBlocks(3); // finalize close channels
        await iUtils.clearDB();
        lnd.unsubscribeAll();
      });

      it('should accept channel request for whitelisted pub key', async function() {
        const result = await lightning.openChannel({ lnd: peer, partner_public_key: mainInfo.public_key, local_tokens: 100000 });
        should.exist(result);
      });
    });

    describe('Reject', () => {
      before(async () => {
        lnd.channelInterceptor();
        await iUtils.clearDB();
      });

      after(async () => {
        lnd.unsubscribeAll();
        await iUtils.clearDB();
      });

      it('should reject channel request for non-whitelisted pub key with default message', async function() {
        try {
          await lightning.openChannel({ lnd: peer, partner_public_key: mainInfo.public_key, local_tokens: 100000 });
          throw new Error('should have thrown');
        } catch (err) {
          if (!err[2]) { throw err; }
          Array.isArray(err).should.be.true;
          should.exist(err[2].err.split(' err=')[1]);
          err[2].err.split(' err=')[1].should.equal(constants.LND.ChannelRejectMessage);
        }
      });

      it('should reject channel request for non-whitelisted pub key with custom message', async function() {
        let customMsg = 'this is a super duper custom message';
        try {
          await db.collections.CONFIG.put(constants.LND.ChannelRejectMessageKey, customMsg);
          await lightning.openChannel({ lnd: peer, partner_public_key: mainInfo.public_key, local_tokens: 100000 });
          throw new Error('should have thrown');
        } catch (err) {
          if (!err[2]) { throw err; }
          Array.isArray(err).should.be.true;
          should.exist(err[2].err.split(' err=')[1]);
          err[2].err.split(' err=')[1].should.equal(customMsg);
        }
      });
    });
  });
});
