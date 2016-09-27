'use strict';

var DropinErrorState = require('../../src/dropin-error-state');
var EventEmitter = require('../../src/lib/event-emitter');

describe('DropinErrorState', function () {
  describe('Constructor', function () {
    it('inherits from EventEmitter', function () {
      expect(new DropinErrorState()).to.be.an.instanceof(EventEmitter);
    });
  });

  describe('report', function () {
    it('emits an errorOccurred event with the error code', function (done) {
      var dropinErrorState = new DropinErrorState();

      dropinErrorState.on('errorOccurred', function (errorCode) {
        expect(errorCode).to.equal('SOME_ERROR_CODE');
        done();
      });

      dropinErrorState.report('SOME_ERROR_CODE');
    });
  });

  describe('clear', function () {
    it('emits an errorCleared event', function (done) {
      var dropinErrorState = new DropinErrorState();

      dropinErrorState.on('errorCleared', function () {
        done();
      });

      dropinErrorState.clear();
    });
  });
});
