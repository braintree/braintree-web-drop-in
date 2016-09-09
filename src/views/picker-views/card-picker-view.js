'use strict';

var BasePickerView = require('./base-picker-view');
var cardHTML = require('../../html/card-picker.html');
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
  var div = document.createElement('div');
  var html = cardHTML;

  BasePickerView.prototype._initialize.apply(this, arguments);

  div.innerHTML = html;
  this.element.appendChild(div);

  this.element.addEventListener('click', function () {
    this.mainView.setActiveView(PayWithCardView.ID);
  }.bind(this), false);
};

module.exports = CardPickerView;
