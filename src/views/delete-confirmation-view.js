'use strict';

var BaseView = require('./base-view');

function DeleteConfirmationView() {
  BaseView.apply(this, arguments);

  this._initialize();
}

DeleteConfirmationView.prototype = Object.create(BaseView.prototype);
DeleteConfirmationView.prototype.constructor = DeleteConfirmationView;
DeleteConfirmationView.ID = DeleteConfirmationView.prototype.ID = 'delete-confirmation';

DeleteConfirmationView.prototype._initialize = function () {
};

DeleteConfirmationView.prototype.applyPaymentMethod = function () {
};

module.exports = DeleteConfirmationView;
