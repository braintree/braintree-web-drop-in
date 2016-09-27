'use strict';

var EventEmitter = require('./lib/event-emitter');

function DropinErrorState() {
  EventEmitter.call(this);
}

DropinErrorState.prototype = Object.create(EventEmitter.prototype, {
  constructor: DropinErrorState
});

DropinErrorState.prototype.report = function (errorCode) {
  this._emit('errorOccurred', errorCode);
};

DropinErrorState.prototype.clear = function () {
  this._emit('errorCleared');
};

module.exports = DropinErrorState;
