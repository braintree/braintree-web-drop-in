'use strict';

var BasePickerView = require('./base-picker-view');
var classList = require('../../lib/classlist');
var events = require('../../constants').events;

function CompletedPickerView() {
  BasePickerView.apply(this, arguments);
}

CompletedPickerView.isEnabled = function () {
  return true;
};

CompletedPickerView.prototype = Object.create(BasePickerView.prototype);
CompletedPickerView.prototype.constructor = CompletedPickerView;

CompletedPickerView.prototype._initialize = function () {
  var a = document.createElement('a');

  BasePickerView.prototype._initialize.apply(this, arguments);

  classList.add(this.element, 'braintree-dropin__completed-picker-view');

  this.element.addEventListener('click', function () {
    this.mainView.updateCompletedView(this.paymentMethod, true);
    this.mainView.emit(events.PAYMENT_METHOD_REQUESTABLE);
  }.bind(this));

  a.textContent = this.paymentMethod.type;
  a.href = '#';
  this.element.appendChild(a);
};

module.exports = CompletedPickerView;
