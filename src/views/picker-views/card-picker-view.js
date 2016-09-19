'use strict';

var BasePickerView = require('./base-picker-view');
var cardHTML = require('../../html/card-picker.html');
var cardIconHTML = require('../../html/card-icons.html');
var hideUnsupportedCardIcons = require('../../lib/hide-unsupported-card-icons');
var PayWithCardView = require('../pay-with-card-view');

function CardPickerView() {
  BasePickerView.apply(this, arguments);
}

CardPickerView.isEnabled = function () {
  return true;
};

CardPickerView.prototype = Object.create(BasePickerView.prototype);
CardPickerView.prototype.constructor = CardPickerView;

CardPickerView.prototype._initialize = function () {
  var cardIcons;
  var supportedCardTypes = this.options.client.getConfiguration().gatewayConfiguration.creditCards.supportedCardTypes;

  BasePickerView.prototype._initialize.apply(this, arguments);

  this.element.innerHTML = cardHTML;

  cardIcons = this.getElementById('card-picker-icons');
  cardIcons.innerHTML = cardIconHTML;
  hideUnsupportedCardIcons(this.element, supportedCardTypes);

  this.element.addEventListener('click', function () {
    this.mainView.setActiveView(PayWithCardView.ID);
  }.bind(this), false);
};

module.exports = CardPickerView;
