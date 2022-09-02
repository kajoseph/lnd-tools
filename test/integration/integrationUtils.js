const fs = require('fs');
const db = require('../../server/db');

class IntegrationUtils {
  async clearDB(collection) {
    const collections = collection ? [collection.toUpperCase()] : Object.keys(db.collections);
    for (let collection of collections) {
      const stream = db.collections[collection].getStream();
      await new Promise((resolve, reject) => {
        stream.on('data', async (doc) => {
          await db.collections[collection].del(doc.key);
        });
        stream.on('error', (err) => {
          reject(err);
        });
        stream.on('end', () => {
          resolve();
        });
      });
    }
  }

  async initDB() {
    await db.init({ path: process.env.LND_TOOLS_DATADIR });
  }

  async rmTestDb() {
    await db.db.close();
    if (
      fs.existsSync(process.env.LND_TOOLS_DATADIR + '/db') &&
      fs.statSync(process.env.LND_TOOLS_DATADIR + '/db').isDirectory()
    ) {
      fs.rmSync(process.env.LND_TOOLS_DATADIR + '/db', { recursive: true });
    }
  }

  async sleep(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new IntegrationUtils();
