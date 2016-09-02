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
};

module.exports = BasePickerView;
