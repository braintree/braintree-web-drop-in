'use strict';

var BaseView = require('../../../../src/views/base-view');
var mainHTML = require('../../../../src/html/main.html');
var PayPalView = require('../../../../src/views/payment-method-views/paypal-view');

describe('PayPalView', function () {
  beforeEach(function () {
    this.div = document.createElement('div');

    this.div.innerHTML = mainHTML;
    document.body.appendChild(this.div);
    this.element = document.body.querySelector('.braintree-dropin__sheet.braintree-dropin__paypal');
  });

  afterEach(function () {
    document.body.removeChild(this.div);
  });

  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(PayPalView.prototype, '_initialize');
    });

    it('calls _initialize', function () {
      new PayPalView({element: this.element}); // eslint-disable-line no-new

      expect(PayPalView.prototype._initialize).to.have.been.calledOnce;
    });

    it('inherits from BaseView', function () {
      expect(new PayPalView({element: this.element})).to.be.an.instanceOf(BaseView);
    });
  });

  describe('_initialize', function () {
    it('creates a paypal button', function () {
      var paypalButton;

      new PayPalView({ // eslint-disable-line no-new
        element: this.element
      });
      paypalButton = this.element.querySelector('[data-braintree-id="paypal-button"] script');

      expect(paypalButton.getAttribute('src')).to.equal('https://www.paypalobjects.com/api/button.js');
      expect(paypalButton.getAttribute('data-merchant')).to.equal('braintree');
      expect(paypalButton.getAttribute('data-button')).to.equal('checkout');
      expect(paypalButton.getAttribute('data-button_type')).to.equal('button');
      expect(paypalButton.getAttribute('data-color')).to.equal('gold');
    });
  });
});
