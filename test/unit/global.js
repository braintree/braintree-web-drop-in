'use strict';

var sinon = require('sinon');
var chai = require('chai');

chai.use(require('sinon-chai'));

global.expect = chai.expect;
global.Promise = require('../../src/lib/promise');

beforeEach(function () {
  this.sandbox = sinon.createSandbox();
  this._innerHTML = document.body.innerHTML;
});

afterEach(function () {
  this.sandbox.restore();
  document.body.innerHTML = this._innerHTML;
});
