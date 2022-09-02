const { Level } = require('level');
const { EntryStream } = require('level-read-stream');
const Path = require('path');
const logger = require('../lib/logger');

class Database {
  constructor() {
    // db collection names. Stub the DatabaseModel so there can be code completion.
    // will be overwritten below.
    // need to call init for these to work.
    this.collections = {
      CHANNEL: new DatabaseModel({ isStub: true }),
      CONFIG: new DatabaseModel({ isStub: true })
    };

    for (let collection in this.collections) {
      // create immutable property that returns a db-populated model
      Object.defineProperty(this.collections, collection, {
        get: () => new DatabaseModel({ name: collection.toLowerCase(), db: this.db }),
        configurable: false
      });
    }
  }

  async init({ path }) {
    if (this.db) {
      return;
    }
    const fullPath = Path.join(path, 'db');
    logger.log('Opening database in ' + fullPath, ['DB']);
    this.db = new Level(fullPath, { valueEncoding: 'json' });
    await new Promise(resolve => this.db.once('open', () => {
      resolve();
    }));
  }

  model(name) {
    if (!Object.values(this.collections).includes(name)) {
      throw new Error('Collection does not exist: ' + name);
    }
    return new DatabaseModel({ name, db: this.db });
  }
}

class DatabaseModel {
  constructor({ name, db, isStub }) {
    if (isStub) {
      return this;
    }
    if (!db) {
      throw new Error('Database is not initialized. Did you call `init`?');
    }
    this.name = name;
    this.db = db.sublevel(name, { valueEncoding: 'json' });
  }

  async get(key) {
    try {
      return await this.db.get(key);
    } catch (err) {
      if (err.status == 404) {
        return null;
      }
      throw err;
    }
  }

  getStream({ gt, gte, lt, lte, limit } = {}) {
    const query = {};
    if (gt) { query.gt = gt; }
    if (gte) { query.gte = gte; }
    if (lt) { query.lt = lt; }
    if (lte) { query.lte = lte; }
    if (limit) { query.limit = parseInt(limit); }

    const stream = new EntryStream(this.db, query);
    return stream;
  }

  async put(key, val) {
    return await this.db.put(key, val);
  }

  async del(key) {
    return await this.db.del(key);
  }
}

module.exports = new Database();
