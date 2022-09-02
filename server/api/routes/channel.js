const express = require('express');
const validatePubKey = require('../middleware/validatePubKey');
const db = require('../../db');
const constants = require('../../../lib/constants');
const logger = require('../../../lib/logger');

const app = express();

app.get('/whitelist', async (req, res) => {
  try {
    let error;
    const { limit } = req.query;
    const stream = db.collections.CHANNEL.getStream();

    let firstOneSent = false;
    let count = 0;
    stream.on('data', (entry) => {
      if (count === 0) {
        res.write('[');
      }

      if (entry.value.allowed) {
        res.write((firstOneSent ? ',' : '') + `"${entry.key}"`);
        firstOneSent = true;
        count++;
        if (count == limit) {
          stream.emit('end');
        }
      }
    });
    stream.on('end', () => {
      if (error) {
        return res.status(500).send(error.message || error);
      }
      if (!firstOneSent) {
        res.write('[');
      }
      res.write(']');
      return res.end();
    });
    stream.on('error', (err) => {
      error = err;
      logger.error('Error streaming whitelist request: ', err, ['API']);
    });
  } catch (err) {
    logger.error('Error getting whitelist', err, ['API']);
    return res.status(500).send(err.message);
  }
});

app.post('/whitelist/:pubKey', validatePubKey, async (req, res) => {
  try {
    const { pubKey } = req.params;
    const val = await db.collections.CHANNEL.get(pubKey);
    if (val && val.allowed) {
      return res.send();
    }
    await db.collections.CHANNEL.put(pubKey, { allowed: true });
    return res.send();
  } catch (err) {
    logger.error('Error adding pubkey to whitelist', err, ['API']);
    return res.status(500).send(err.message);
  }
});

app.delete('/whitelist/:pubKey', validatePubKey, async (req, res) => {
  try {
    const { pubKey } = req.params;
    const val = await db.collections.CHANNEL.get(pubKey);
    if (!val || !val.allowed) {
      return res.send();
    }
    val.allowed = false;
    await db.collections.CHANNEL.put(pubKey, val);
    return res.send();
  } catch (err) {
    logger.error('Error removing pubkey from whitelist', err, ['API']);
    return res.status(500).send(err.message);
  }
});

app.get('/rejectMessage', async (req, res) => {
  try {
    const msg = await db.collections.CONFIG.get(constants.LND.ChannelRejectMessageKey);
    return res.send(msg || constants.LND.ChannelRejectMessage);
  } catch (err) {
    logger.error('Error retreiving rejectMessage', err, ['API']);
    return res.status(500).send(err.message);
  }
});

app.post('/rejectMessage', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).send('Missing message');
    }
    await db.collections.CONFIG.put(constants.LND.ChannelRejectMessageKey, message);
    return res.send();
  } catch (err) {
    logger.error('Error updating rejectMessage', err, ['API']);
    return res.status(500).send(err.message);
  }
});

app.delete('/rejectMessage', async (req, res) => {
  try {
    await db.collections.CONFIG.del(constants.LND.ChannelRejectMessageKey);
    return res.send();
  } catch (err) {
    logger.error('Error removing rejectMessage', err, ['API']);
    return res.status(500).send(err.message);
  }
});

module.exports = app;
