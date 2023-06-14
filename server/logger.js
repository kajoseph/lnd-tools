/* eslint-disable no-console */

class Logger {
  _logIt(severity, msg, data, tags) {
    tags = tags || [];
    const now = new Date();
    const logString = `[${now.toISOString()}] :: ${severity.toUpperCase()} :: {${tags.join(',')}} :: ${msg}`;
    console[severity](logString);
    if (data) {
      console[severity]('\t' + (data.stack || JSON.stringify(data)));
    }

    const db = require('./db');
    const config = require('./config');

    if (db.db && config.dblogtimewindow > 0) {
      try {
        const ROLLING_LOG_WINDOW = config.dblogtimewindow;
        const s = severity.toLowerCase();

        db.collections.LOG.put(`${now.getTime()}_${s}`, {
          severity: s,
          timestamp: now.getTime(),
          log: logString + (data ? '\n\t' + (data.stack || JSON.stringify(data)) : '')
        })
          .then(() => db.collections.LOG.db.clear({ lt: now.getTime() - ROLLING_LOG_WINDOW }))
          .catch(console.error);
      } catch (e) {
        console.error(e);
      }
    }
  }

  log(msg, data, tags) {
    if (!tags && Array.isArray(data)) {
      tags = data;
      data = null;
    }
    this._logIt('log', msg, data, tags);
  }

  warn(msg, data, tags) {
    this._logIt('warn', msg, data, tags);
  }

  error(msg, data, tags) {
    this._logIt('error', msg, data, tags);
  }
}

module.exports = new Logger();
