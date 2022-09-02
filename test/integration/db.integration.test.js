const sinon = require('sinon');
const should = require('chai').should();
const iUtils = require('./integrationUtils');
const db = require('../../server/db');


describe('Database', () => {
  before(async () => {
    iUtils.clearDB();
    await iUtils.initDB();
  });

  afterEach(() => {
    sinon.restore();
  });

  after(() => {
    iUtils.clearDB();
  });

  it('should have channel collection', () => {
    db.collections.should.haveOwnProperty('CHANNEL');
    (typeof db.collections.CHANNEL).should.equal('object');
    db.collections.CHANNEL.constructor.name.should.equal('DatabaseModel');
  });

  it('should have config collection', () => {
    db.collections.should.haveOwnProperty('CONFIG');
    (typeof db.collections.CONFIG).should.equal('object');
    db.collections.CONFIG.constructor.name.should.equal('DatabaseModel');
  });

  it('should not have CRUD methods on exported member', () => {
    should.not.exist(db.get);
    should.not.exist(db.put);
    should.not.exist(db.del);
  });

  it('should have getStream on model', () => {
    should.exist(db.collections.CHANNEL.getStream);
  });

  describe('CRUD', () => {
    // Note: these tests are stacked...meaning they depend on each other.

    const objVal = { a: 1, b: '2', c: { d: 'inside ' } };
    const strVal = 'this is a string';
    const numVal = Number.MAX_SAFE_INTEGER;

    before(async () => {
      await iUtils.initDB();
    });

    describe('put', () => {
      it('should be able to add an object record', async () => {
        await db.collections.CHANNEL.put('val1', objVal);
      });

      it('should be able to add a  string record', async () => {
        await db.collections.CHANNEL.put('val2', strVal);
      });

      it('should be able to add a numeric record', async () => {
        await db.collections.CHANNEL.put('val3', numVal);
      });
    });

    describe('get', () => {
      it('should be able to get an object record', async () => {
        const val = await db.collections.CHANNEL.get('val1');
        val.should.deep.equal(objVal);
      });

      it('should be able to get a string record', async () => {
        const val = await db.collections.CHANNEL.get('val2');
        val.should.deep.equal(strVal);
      });

      it('should be able to get a numeric record', async () => {
        const val = await db.collections.CHANNEL.get('val3');
        val.should.deep.equal(numVal);
      });
    });

    describe('replace', () => {
      it('should completely replace the value', async () => {
        await db.collections.CHANNEL.put('val1', { a: 1 });
        const val = await db.collections.CHANNEL.get('val1');
        val.should.deep.equal({ a: 1 });
      });
    });

    describe('del', () => {
      it('should be able to delete an object record', async () => {
        await db.collections.CHANNEL.del('val1');
        const val = await db.collections.CHANNEL.get('val1');
        should.not.exist(val);
      });

      it('should be able to delete a string record', async () => {
        await db.collections.CHANNEL.del('val2');
        const val = await db.collections.CHANNEL.get('val2');
        should.not.exist(val);
      });

      it('should be able to delete a numeric record', async () => {
        await db.collections.CHANNEL.del('val3');
        const val = await db.collections.CHANNEL.get('val3');
        should.not.exist(val);
      });
    });
  });
});
