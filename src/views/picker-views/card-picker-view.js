'use strict';

var BasePickerView = require('./base-picker-view');
var PayWithCardView = require('../pay-with-card-view');
var classList = require('../../lib/classlist');

function CardPickerView() {
  BasePickerView.apply(this, arguments);
}

CardPickerView.isEnabled = function () {
  return true;
};

CardPickerView.prototype = Object.create(BasePickerView.prototype);
CardPickerView.prototype.constructor = CardPickerView;

CardPickerView.prototype._initialize = function () {
  var button = document.createElement('button');

  BasePickerView.prototype._initialize.apply(this, arguments);

  classList.add(this.element, 'braintree-dropin__pay-with-card-picker-view');

  this.element.addEventListener('click', function () {
    this.mainView.setActiveView(PayWithCardView.ID);
  }.bind(this), false);

  button.textContent = 'Pay with Card';
  button.type = 'button';
  this.element.appendChild(button);
};

module.exports = CardPickerView;
