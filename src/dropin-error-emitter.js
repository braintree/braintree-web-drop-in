'use strict';

var EventEmitter = require('./lib/event-emitter');

function DropinErrorEmitter() {
  EventEmitter.call(this);
}

DropinErrorEmitter.prototype = Object.create(EventEmitter.prototype, {
  constructor: DropinErrorEmitter
});

DropinErrorEmitter.prototype.report = function (errorCode) {
  this._emit('errorOccurred', errorCode);
};

DropinErrorEmitter.prototype.clear = function () {
  this._emit('errorCleared');
};

module.exports = DropinErrorEmitter;
