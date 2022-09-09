const sinon = require('sinon');
const should = require('chai').should();
const supertest = require('supertest');
const Path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const secp = require('secp256k1');
const Api = require('../../server/api');
const iUtils = require('./integrationUtils');
const db = require('../../server/db');
const constants = require('../../lib/constants');
const logger = require('../../lib/logger');
const config = require('../../server/config');

describe('API', () => {
  const privKey = process.env.API_PRIVKEY;
  const pubKey = process.env.API_PUBKEY;
  const cert = Buffer.from(config.lndcert, 'base64').toString('utf8');
  let apiServer;

  function getAuthHeader({ method, path, body }) {
    let msg = method + path;
    if (body) {
      msg += JSON.stringify(body);
    } else {
      msg += '{}';
    }
    const msgHash = crypto.createHash('SHA256').update(msg).digest('hex');
    const sig = secp.ecdsaSign(Buffer.from(msgHash, 'hex'), Buffer.from(privKey, 'hex'));
    return Buffer.from(sig.signature).toString('base64');
  };


  before(async () => {
    await iUtils.initDB();
    apiServer = Api();
  });

  beforeEach(() => {
    sinon.stub(logger, 'log');
    sinon.stub(logger, 'warn');
    sinon.stub(logger, 'error');
  });

  afterEach(() => {
    sinon.restore();
  });

  after(async () => {
    await iUtils.clearDB();
  });

  describe('Auth', () => {
    it('should reject with no x-auth header', async () => {
      const response = await supertest(apiServer)
        .get('/channel/whitelist')
        .cert(fs.readFileSync(Path.join(process.env.LND_TOOLS_DATADIR, 'lnd-tools.crt')))
        .trustLocalhost(true)
        .send();

      response.status.should.equal(406);
      response.text.should.equal('Unauthorized.');
    });

    it('should reject with a junk x-auth header', async () => {
      const response = await supertest(apiServer)
        .get('/channel/whitelist')
        .set('x-auth', 'this is some junky text')
        .trustLocalhost(true)
        .send();

      response.status.should.equal(406);
      response.text.should.equal('Unauthorized.');
    });

    // it('should reject with with no cert', async () => {
    //   const response = await supertest(apiServer)
    //     .get('/channel/whitelist')
    //     .set('x-auth', getAuthHeader({ method: 'GET', path: '/channel/whitelist' }))
    //     // .cert(fs.readFileSync(Path.join(process.env.LND_TOOLS_DATADIR, 'lnd-tools.crt')))
    //     .trustLocalhost(true)
    //     .send();

    //   response.status.should.equal(406);
    //   response.text.should.equal('Unauthorized.');
    // });
  });

  describe('/Channel', () => {
    describe('/Whitelist', () => {
      beforeEach(async () => {
        await iUtils.clearDB();
      });
      afterEach(async () => {
        sinon.restore();
      });

      describe('GET', () => {
        it('should return and log error if something throws', async () => {
          sinon.stub(db.collections.CHANNEL.__proto__, 'getStream').throws(new Error('wut?'));

          const response = await supertest(apiServer)
            .get('/channel/whitelist')
            .set('x-auth', getAuthHeader({ method: 'GET', path: '/channel/whitelist' }))
            .trustLocalhost(true)
            .send();

          response.status.should.equal(500);
          response.text.should.equal('wut?');
          logger.error.callCount.should.be.gte(1);
          logger.error.args.find(arg => arg[0] === 'Error getting whitelist');
        });

        it('should succeed if there are no entries', async () => {
          const response = await supertest(apiServer)
            .get('/channel/whitelist')
            .set('x-auth', getAuthHeader({ method: 'GET', path: '/channel/whitelist' }))
            .trustLocalhost(true)
            .send();

          response.status.should.equal(200);
          response.text.should.equal('[]');
        });

        it('should return list of allowed pub keys', async () => {
          await db.collections.CHANNEL.put('pubkey1', { allowed: true });
          await db.collections.CHANNEL.put('pubkey2', { allowed: false }); // should exclude this one
          await db.collections.CHANNEL.put('pubkey3', { allowed: true });
          await db.collections.CHANNEL.put('pubkey4', { allowed: true });

          const response = await supertest(apiServer)
            .get('/channel/whitelist')
            .set('x-auth', getAuthHeader({ method: 'GET', path: '/channel/whitelist' }))
            .trustLocalhost(true)
            .send();

          response.status.should.equal(200);
          JSON.parse(response.text).should.deep.equal(['pubkey1', 'pubkey3', 'pubkey4']);
        });

        it('should return list of allowed pub keys with limit', async () => {
          await db.collections.CHANNEL.put('pubkey1', { allowed: true });
          await db.collections.CHANNEL.put('pubkey2', { allowed: false }); // should exclude this one
          await db.collections.CHANNEL.put('pubkey3', { allowed: true });
          await db.collections.CHANNEL.put('pubkey4', { allowed: true });

          const response = await supertest(apiServer)
            .get('/channel/whitelist?limit=2')
            .set('x-auth', getAuthHeader({ method: 'GET', path: '/channel/whitelist?limit=2' }))
            .trustLocalhost(true)
            .send();

          response.status.should.equal(200);
          JSON.parse(response.text).should.deep.equal(['pubkey1', 'pubkey3']);
        });
      });

      describe('POST', () => {
        it('should return and log error if something throws', async () => {
          sinon.stub(db.collections.CHANNEL.__proto__, 'get').throws(new Error('wut?'));

          const response = await supertest(apiServer)
            .post(`/channel/whitelist/${pubKey}`)
            .set('x-auth', getAuthHeader({ method: 'POST', path: `/channel/whitelist/${pubKey}` }))
            .trustLocalhost(true)
            .send();

          response.status.should.equal(500);
          response.text.should.equal('wut?');
          logger.error.callCount.should.be.gte(1);
          logger.error.args.find(arg => arg[0] === 'Error getting whitelist');
        });

        it('should post a valid pub key', async () => {
          const pubKey = '03343e946135c262657c04f2154219af71295e80664ba0a88a35e5b3c7bdd6c4c0';
          const response = await supertest(apiServer)
            .post(`/channel/whitelist/${pubKey}`)
            .set('x-auth', getAuthHeader({ method: 'POST', path: `/channel/whitelist/${pubKey}` }))
            .trustLocalhost(true)
            .send();

          response.status.should.equal(200);
          response.text.should.equal('');
          const val = await db.collections.CHANNEL.get(pubKey);
          should.exist(val);
          val.allowed.should.be.true;
        });

        it('should reject an invalid pub key', async () => {
          // pubkey has non-hex value
          const pubKey = 'g3343e946135c262657c04f2154219af71295e80664ba0a88a35e5b3c7bdd6c4c0';
          const response = await supertest(apiServer)
            .post(`/channel/whitelist/${pubKey}`)
            .set('x-auth', getAuthHeader({ method: 'POST', path: `/channel/whitelist/${pubKey}` }))
            .trustLocalhost(true)
            .send();

          response.status.should.equal(400);
          response.text.should.equal('Invalid pubKey');
          const val = await db.collections.CHANNEL.get(pubKey);
          should.not.exist(val);
        });

        it('should reject a pub key with 0x prefix', async () => {
          const pubKey = '0x03343e946135c262657c04f2154219af71295e80664ba0a88a35e5b3c7bdd6c4c0';
          const response = await supertest(apiServer)
            .post(`/channel/whitelist/${pubKey}`)
            .set('x-auth', getAuthHeader({ method: 'POST', path: `/channel/whitelist/${pubKey}` }))
            .trustLocalhost(true)
            .send();

          response.status.should.equal(400);
          response.text.should.equal('Invalid pubKey');
          const val = await db.collections.CHANNEL.get(pubKey);
          should.not.exist(val);
        });
      });

      describe('DELETE', () => {
        const pubKey = '03343e946135c262657c04f2154219af71295e80664ba0a88a35e5b3c7bdd6c4c0';

        it('should return and log error if something throws', async () => {
          sinon.stub(db.collections.CHANNEL.__proto__, 'get').throws(new Error('wut?'));

          const response = await supertest(apiServer)
            .delete(`/channel/whitelist/${pubKey}`)
            .set('x-auth', getAuthHeader({ method: 'DELETE', path: `/channel/whitelist/${pubKey}` }))
            .trustLocalhost(true)
            .send();

          response.status.should.equal(500);
          response.text.should.equal('wut?');
          logger.error.callCount.should.be.gte(1);
          logger.error.args.find(arg => arg[0] === 'Error getting whitelist');
        });

        it('should remove an existing pub key', async () => {
          await db.collections.CHANNEL.put(pubKey, { allowed: true });

          const response = await supertest(apiServer)
            .delete(`/channel/whitelist/${pubKey}`)
            .set('x-auth', getAuthHeader({ method: 'DELETE', path: `/channel/whitelist/${pubKey}` }))
            .trustLocalhost(true)
            .send();

          response.status.should.equal(200);
          response.text.should.equal('');
          const val = await db.collections.CHANNEL.get(pubKey);
          should.exist(val);
          val.allowed.should.be.false;
        });

        it('should not change an existing disallowed pub key', async () => {
          await db.collections.CHANNEL.put(pubKey, { allowed: false });
          sinon.spy(db.collections.CHANNEL.__proto__, 'put');

          const response = await supertest(apiServer)
            .delete(`/channel/whitelist/${pubKey}`)
            .set('x-auth', getAuthHeader({ method: 'DELETE', path: `/channel/whitelist/${pubKey}` }))
            .trustLocalhost(true)
            .send();

          response.status.should.equal(200);
          response.text.should.equal('');
          const val = await db.collections.CHANNEL.get(pubKey);
          should.exist(val);
          val.allowed.should.be.false;
          db.collections.CHANNEL.put.callCount.should.equal(0);
        });

        it('should do nothing for a non-existing pub key', async () => {
          await db.collections.CHANNEL.del(pubKey);
          sinon.spy(db.collections.CHANNEL.__proto__, 'put');

          const response = await supertest(apiServer)
            .delete(`/channel/whitelist/${pubKey}`)
            .set('x-auth', getAuthHeader({ method: 'DELETE', path: `/channel/whitelist/${pubKey}` }))
            .trustLocalhost(true)
            .send();

          response.status.should.equal(200);
          response.text.should.equal('');
          const val = await db.collections.CHANNEL.get(pubKey);
          should.not.exist(val);
          db.collections.CHANNEL.put.callCount.should.equal(0);
        });
      });
    });

    describe('/rejectMessage', () => {
      before(async () => {
        await iUtils.clearDB();
      });

      afterEach(async () => {
        await iUtils.clearDB();
      });

      describe('GET', () => {
        it('should return and log error if something throws', async () => {
          sinon.stub(db.collections.CONFIG.__proto__, 'get').throws(new Error('wut?'));

          const response = await supertest(apiServer)
            .get('/channel/rejectmessage')
            .set('x-auth', getAuthHeader({ method: 'GET', path: '/channel/rejectmessage' }))
            .trustLocalhost(true)
            .send();

          response.status.should.equal(500);
          response.text.should.equal('wut?');
          logger.error.callCount.should.be.gte(1);
          logger.error.args.find(arg => arg[0] === 'Error getting whitelist');
        });

        it('should get the default message', async () => {
          const val = await db.collections.CONFIG.get(constants.LND.ChannelRejectMessageKey);
          should.not.exist(val);

          const response = await supertest(apiServer)
            .get('/channel/rejectmessage')
            .set('x-auth', getAuthHeader({ method: 'GET', path: '/channel/rejectmessage' }))
            .trustLocalhost(true)
            .send();

          response.status.should.equal(200);
          response.text.should.equal(constants.LND.ChannelRejectMessage);
        });

        it('should get the custom message', async () => {
          const customMsg = 'the Atlanta Falcons are gonna win it all this year';
          await db.collections.CONFIG.put(constants.LND.ChannelRejectMessageKey, customMsg);

          const response = await supertest(apiServer)
            .get('/channel/rejectmessage')
            .set('x-auth', getAuthHeader({ method: 'GET', path: '/channel/rejectmessage' }))
            .trustLocalhost(true)
            .send();

          response.status.should.equal(200);
          response.text.should.equal(customMsg);
        });
      });

      describe('POST', () => {
        it('should return and log error if something throws', async () => {
          const customMsg = 'the Atlanta Hawks are gonna win it all this year';
          sinon.stub(db.collections.CONFIG.__proto__, 'put').throws(new Error('wut?'));

          const response = await supertest(apiServer)
            .post('/channel/rejectmessage')
            .set('x-auth', getAuthHeader({ method: 'POST', path: '/channel/rejectmessage', body: { message: customMsg } }))
            .trustLocalhost(true)
            .send({ message: customMsg });

          response.status.should.equal(500);
          response.text.should.equal('wut?');
          logger.error.callCount.should.be.gte(1);
          logger.error.args.find(arg => arg[0] === 'Error getting whitelist');
        });

        it('should set a brand new custom message', async () => {
          const customMsg = 'the Atlanta Hawks are gonna win it all this year';
          let val = await db.collections.CONFIG.get(constants.LND.ChannelRejectMessageKey);
          should.not.exist(val);

          const response = await supertest(apiServer)
            .post('/channel/rejectmessage')
            .set('x-auth', getAuthHeader({ method: 'POST', path: '/channel/rejectmessage', body: { message: customMsg } }))
            .trustLocalhost(true)
            .send({ message: customMsg });

          response.status.should.equal(200);
          response.text.should.equal('');
          val = await db.collections.CONFIG.get(constants.LND.ChannelRejectMessageKey);
          val.should.equal(customMsg);
        });

        it('should replace a custom message', async () => {
          const oldCustomMsg = 'the Atlanta Hawks are gonna win it all this year';
          const newCustomMsg = 'the New York Nicks are Trae Youngs biotch';
          await db.collections.CONFIG.put(constants.LND.ChannelRejectMessageKey, oldCustomMsg);

          const response = await supertest(apiServer)
            .post('/channel/rejectmessage')
            .set('x-auth', getAuthHeader({ method: 'POST', path: '/channel/rejectmessage', body: { message: newCustomMsg } }))
            .trustLocalhost(true)
            .send({ message: newCustomMsg });

          response.status.should.equal(200);
          response.text.should.equal('');
          const val = await db.collections.CONFIG.get(constants.LND.ChannelRejectMessageKey);
          val.should.equal(newCustomMsg);
        });

        it('should reject if message is missing', async () => {
          const customMsg = 'the Atlanta Hawks are gonna win it all this year';
          await db.collections.CONFIG.put(constants.LND.ChannelRejectMessageKey, customMsg);

          const response = await supertest(apiServer)
            .post('/channel/rejectmessage')
            .set('x-auth', getAuthHeader({ method: 'POST', path: '/channel/rejectmessage', body: { message: null } }))
            .trustLocalhost(true)
            .send({ message: null });

          response.status.should.equal(400);
          response.text.should.equal('Missing message');
          const val = await db.collections.CONFIG.get(constants.LND.ChannelRejectMessageKey);
          val.should.equal(customMsg);
        });
      });

      describe('DELETE', () => {
        it('should return and log error if something throws', async () => {
          sinon.stub(db.collections.CONFIG.__proto__, 'del').throws(new Error('wut?'));

          const response = await supertest(apiServer)
            .delete('/channel/rejectmessage')
            .set('x-auth', getAuthHeader({ method: 'DELETE', path: '/channel/rejectmessage' }))
            .trustLocalhost(true)
            .send();

          response.status.should.equal(500);
          response.text.should.equal('wut?');
          logger.error.callCount.should.be.gte(1);
          logger.error.args.find(arg => arg[0] === 'Error getting whitelist');
        });

        it('should remove a custom message', async () => {
          const customMsg = 'the Atlanta Hawks are gonna win it all this year';
          await db.collections.CONFIG.put(constants.LND.ChannelRejectMessageKey, customMsg);

          const response = await supertest(apiServer)
            .delete('/channel/rejectmessage')
            .set('x-auth', getAuthHeader({ method: 'DELETE', path: '/channel/rejectmessage' }))
            .trustLocalhost(true)
            .send();

          response.status.should.equal(200);
          response.text.should.equal('');
          const val = await db.collections.CONFIG.get(constants.LND.ChannelRejectMessageKey);
          should.not.exist(val);
        });

        it('should not error if there is no custom message set', async () => {
          const val = await db.collections.CONFIG.get(constants.LND.ChannelRejectMessageKey);
          should.not.exist(val);

          const response = await supertest(apiServer)
            .delete('/channel/rejectmessage')
            .set('x-auth', getAuthHeader({ method: 'DELETE', path: '/channel/rejectmessage' }))
            .trustLocalhost(true)
            .send();

          response.status.should.equal(200);
          response.text.should.equal('');
        });
      });
    });
  });
});
