/* eslint-disable no-console */

class Logger {
  _logIt(severity, msg, data, tags) {
    tags = tags || [];
    const now = new Date();
    console[severity](`[${now.toISOString()}] :: ${severity.toUpperCase()} :: {${tags.join(',')}} :: ${msg}`);
    if (data) {
      console[severity]('\t' + (data.stack || JSON.stringify(data)));
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
