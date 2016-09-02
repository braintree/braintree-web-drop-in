'use strict';

var assign = require('../lib/assign').assign;

function BaseView(options) {
  options = options || {};

  assign(this, options);
}

BaseView.prototype.teardown = function (cb) {
  cb();
};

module.exports = BaseView;
