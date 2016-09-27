'use strict';

var DropinErrorEmitter = require('../../src/dropin-error-emitter');
var EventEmitter = require('../../src/lib/event-emitter');

describe('DropinErrorEmitter', function () {
  describe('Constructor', function () {
    it('inherits from EventEmitter', function () {
      expect(new DropinErrorEmitter()).to.be.an.instanceof(EventEmitter);
    });
  });

  describe('report', function () {
    it('emits an errorOccurred event with the error code', function (done) {
      var dropinErrorState = new DropinErrorEmitter();

      dropinErrorState.on('errorOccurred', function (errorCode) {
        expect(errorCode).to.equal('SOME_ERROR_CODE');
        done();
      });

      dropinErrorState.report('SOME_ERROR_CODE');
    });
  });

  describe('clear', function () {
    it('emits an errorCleared event', function (done) {
      var dropinErrorState = new DropinErrorEmitter();

      dropinErrorState.on('errorCleared', function () {
        done();
      });

      dropinErrorState.clear();
    });
  });
});
