'use strict';

var BaseView = require('../base-view');

function BasePickerView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

BasePickerView.prototype = Object.create(BaseView.prototype);
BasePickerView.prototype.constructor = BasePickerView;

BasePickerView.prototype._initialize = function () {
  this.element = document.createElement('div');

  this.element.className = 'braintree-dropin__picker-view';
  this.element.setAttribute('tabindex', '0');

  this.element.addEventListener('click', this._onSelect.bind(this), false);
  this.element.addEventListener('keydown', function (event) {
    if (event.which === 13) { this._onSelect(); }
  }.bind(this));
};

module.exports = BasePickerView;
