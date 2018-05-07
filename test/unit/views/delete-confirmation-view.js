'use strict';

var BaseView = require('../../../src/views/base-view');
var DeleteConfirmationView = require('../../../src/views/delete-confirmation-view');
var DropinModel = require('../../../src/dropin-model');
var fake = require('../../helpers/fake');
var fs = require('fs');
var strings = require('../../../src/translations/en_US');

var mainHTML = fs.readFileSync(__dirname + '/../../../src/html/main.html', 'utf8');

describe('DeleteConfirmationView', function () {
  beforeEach(function () {
    this.element = document.createElement('div');
    this.element.innerHTML = mainHTML;
  });

  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(PaymentMethodsView.prototype, '_initialize');
    });

    it('inherits from BaseView', function () {
      expect(new DeleteConfirmationView({})).to.be.an.instanceof(BaseView);
    });

    it('calls _initialize', function () {
      new DeleteConfirmationView({}); // eslint-disable-line no-new

      expect(DeleteConfirmationView.prototype._initialize).to.have.been.calledOnce;
    });
  });

  describe('_initialize', function () {
  });

  describe('applyPaymentMethod', function () {
  });
});
