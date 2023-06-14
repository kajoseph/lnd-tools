const express = require('express');
const db = require('../../db');
const logger = require('../../logger');

const app = express();

app.get('/', async (req, res) => {
  let error;
  const { limit, startDate, endDate } = req.query;
  const streamQuery = { limit };

  if (startDate) {
    streamQuery.gte = new Date(startDate).getTime(); // Invalid Date.getTime() == NaN
    if (isNaN(streamQuery.gte)) {
      return res.status(400).send('Invalid startDate');
    }
  }

  if (endDate) {
    streamQuery.lt = new Date(endDate).getTime(); // Invalid Date.getTime() == NaN
    if (isNaN(streamQuery.lt)) {
      return res.status(400).send('Invalid endDate');
    }
  }

  const stream = db.collections.LOG.getStream(streamQuery);

  let firstOneSent = false;
  stream.on('data', (entry) => {
    if (!firstOneSent) {
      res.write('[');
    }

    res.write((firstOneSent ? ',' : '') + JSON.stringify(entry.value));
    firstOneSent = true;
  });
  stream.on('close', () => {
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
    logger.error('Error streaming whitelist request: ', err, ['API', 'log']);
  });
});


app.delete('/', async (req, res) => {
  try {
    const { before, after, limit, desc } = req.query;
    const query = {};

    if (!after && !before) {
      return res.status(400).send('Must provide at least one of before or after dates');
    }

    if (after) {
      query.gt = new Date(after).getTime(); // Invalid Date.getTime() == NaN
      if (isNaN(query.gt)) {
        return res.status(400).send('Invalid date for after param');
      }
    }

    if (before) {
      query.lt = new Date(before).getTime(); // Invalid Date.getTime() == NaN
      if (isNaN(query.lt)) {
        return res.status(400).send('Invalid date for before param');
      }
    }

    if (limit) {
      query.limit = limit;
      if (desc?.toLowerCase() === 'true' || desc == 1) {
        query.reverse = true;
      }
    }

    await db.collections.LOG.db.clear(query);
    return res.send();
  } catch (err) {
    logger.error('Error removing logs from db', err, ['API', 'log']);
    return res.status(500).send(err.message);
  }
});

module.exports = app;
