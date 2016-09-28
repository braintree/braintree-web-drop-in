'use strict';

function DropinModel(options) {
  this._listeners = {};
  this._paymentMethods = options && options.paymentMethods ? options.paymentMethods : [];
  this._activePaymentMethod = this._paymentMethods[0];
  this.dependenciesInitializing = 0;
}

DropinModel.prototype.on = function (event, handler) {
  var listeners = this._listeners[event];

  if (!listeners) {
    this._listeners[event] = [handler];
  } else {
    listeners.push(handler);
  }
};

DropinModel.prototype._emit = function (event) {
  var i;
  var args = arguments;
  var self = this;
  var listeners = this._listeners[event];

  if (!listeners) { return; }

  for (i = 0; i < listeners.length; i++) {
    listeners[i].apply(self, Array.prototype.slice.call(args, 1));
  }
};

DropinModel.prototype.addPaymentMethod = function (paymentMethod) {
  this._paymentMethods.push(paymentMethod);
  this._emit('addPaymentMethod', paymentMethod);
  this.changeActivePaymentMethod(paymentMethod);
};

DropinModel.prototype.changeActivePaymentMethod = function (paymentMethod) {
  this._activePaymentMethod = paymentMethod;
  this._emit('changeActivePaymentMethod', paymentMethod);
};

DropinModel.prototype.getPaymentMethods = function () {
  return this._paymentMethods;
};

DropinModel.prototype.getActivePaymentMethod = function () {
  return this._activePaymentMethod;
};

DropinModel.prototype.asyncDependencyStarting = function () {
  this.dependenciesInitializing++;
};

DropinModel.prototype.asyncDependencyReady = function () {
  this.dependenciesInitializing--;
  if (this.dependenciesInitializing === 0) {
    this._emit('asyncDependenciesReady');
  }
};

DropinModel.prototype.beginLoading = function () {
  this._emit('loadBegin');
};

DropinModel.prototype.endLoading = function () {
  this._emit('loadEnd');
};

module.exports = DropinModel;
