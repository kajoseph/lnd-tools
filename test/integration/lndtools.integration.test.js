/* eslint-disable no-console */
const sinon = require('sinon');
const should = require('chai').should();
const Path = require('path');
const fs = require('fs');
const lndTools = require('../../lnd-tools');
const server = require('../../server/server');
const client = require('../../client/client');
const logger = require('../../server/logger');

describe.skip('Lnd-Tools', () => {
  beforeEach(() => {
    sinon.stub(console, 'info');
    sinon.stub(console, 'debug');
    sinon.stub(console, 'log');
    sinon.stub(console, 'warn');
    sinon.stub(console, 'error');
    sinon.stub(logger, 'log');
    sinon.stub(logger, 'warn');
    sinon.stub(logger, 'error');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should output help by default', async () => {
    try {
      // sinon.stub(process, 'exit');
      lndTools.program.parse(process.argv.slice(0, 2));
      throw new Error('should have thrown');
    } catch (err) {
      err.message.indexOf('Usage: lnd-tools [options] [command]').should.be.gt(-1);
    }
  });

  it('should output --help', async () => {
    // const output = execSync('./lnd-tools.js --help', { cwd: Path.join(__dirname, '../..') });
    lndTools.program.parse([...process.argv, '--help']);
    console.log.should
    // output.toString().indexOf('Usage: lnd-tools [options] [command]').should.be.gt(-1);
  });

  describe('keygen', () => {
    let tempDir = process.env.LND_TOOLS_DATADIR + '/temp';
    before(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
    });
    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
    });

    it('should output keygen with --print', () => {
      const output = execSync('./lnd-tools.js keygen --print', { cwd: Path.join(__dirname, '../..') });
      output.toString().indexOf('Key generated:\n---------------\nPrivate Key ').should.equal(0);
    });

    it('should output keygen to files', () => {
      const output = execSync('./lnd-tools.js keygen', {
        cwd: Path.join(__dirname, '../..'),
        env: { ...process.env, LND_TOOLS_DATADIR: tempDir }
      });
      output.toString().should.equal(`Creating new directory: ${tempDir}\n` +
        'Created:\n' +
        ` ${tempDir}/auth.key\n` +
        ` ${tempDir}/auth.pub\n`);
      fs.existsSync(tempDir + '/auth.key').should.be.true;
      fs.existsSync(tempDir + '/auth.pub').should.be.true;
    });
    it('should output keygen to files in specified datadir', () => {
      const rando = Math.round(Math.random() * 10000); // random dir
      const output = execSync(`./lnd-tools.js keygen -d ${tempDir}/${rando}`, {
        cwd: Path.join(__dirname, '../..'),
        env: { ...process.env, LND_TOOLS_DATADIR: tempDir }
      });
      output.toString().should.equal(`Creating new directory: ${tempDir}/${rando}\n` +
        'Created:\n' +
        ` ${tempDir}/${rando}/auth.key\n` +
        ` ${tempDir}/${rando}/auth.pub\n`);
      fs.existsSync(`${tempDir}/${rando}/auth.key`).should.be.true;
      fs.existsSync(`${tempDir}/${rando}/auth.pub`).should.be.true;
    });
  });

  describe('serve', () => {
    beforeEach(() => {
      sinon.spy(logger, 'log');
      sinon.spy(logger, 'warn');
      sinon.spy(logger, 'error');
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should serve using defaults', () => {
      try {
        const output = spawnSync('./lnd-tools.js', ['serve'], { cwd: Path.join(__dirname, '../..') });
        output.indexOf(` :: LOG :: {DB} :: Opening database in ${process.env.LND_TOOLS_DATADIR}/db`).should.be.gt(0);
      } catch (err) {
        err;
      }
    });

    it('should serve using defaults', () => {
      const output = execSync('./lnd-tools.js serve', { cwd: Path.join(__dirname, '../..') });
      output.indexOf(` :: LOG :: {DB} :: Opening database in ${process.env.LND_TOOLS_DATADIR}/db`).should.be.gt(0);
    });
  });
});
