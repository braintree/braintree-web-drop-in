'use strict';

var sinon = require('sinon');
var chai = require('chai');

require('sinon-as-promised');
chai.use(require('sinon-chai'));

global.expect = chai.expect;

beforeEach(function () {
  this.sandbox = sinon.sandbox.create();
});

afterEach(function () {
  this.sandbox.restore();
});
