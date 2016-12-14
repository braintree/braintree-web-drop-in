'use strict';

var BaseView = require('../../../../src/views/base-view');
var DropinModel = require('../../../../src/dropin-model');
var fake = require('../../../helpers/fake');
var mainHTML = require('../../../../src/html/main.html');
var PayPal = require('braintree-web/paypal');
var PayPalView = require('../../../../src/views/payment-sheet-views/paypal-view');

describe('PayPalView', function () {
  beforeEach(function () {
    this.div = document.createElement('div');

    this.div.innerHTML = mainHTML;
    document.body.appendChild(this.div);
    this.element = document.body.querySelector('.braintree-sheet.braintree-paypal');
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
    beforeEach(function () {
      this.model = new DropinModel();
      this.options = {
        client: {
          getConfiguration: fake.configuration,
          request: this.sandbox.spy()
        },
        paypal: {flow: 'vault'}
      };

      this.focusStub = this.sandbox.stub();
      this.closeStub = this.sandbox.stub();

      this.tokenizeStub = this.sandbox.stub().returns({
        focus: this.focusStub,
        close: this.closeStub
      });

      this.paypalInstance = {tokenize: this.tokenizeStub};

      this.sandbox.stub(PayPal, 'create').yields(null, this.paypalInstance);
    });

    it('starts async dependency', function () {
      var payPalView;

      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyStarting');

      payPalView = new PayPalView({
        element: this.element,
        model: this.model,
        options: this.options
      });

      expect(payPalView.model.asyncDependencyStarting).to.be.calledOnce;
    });

    it('notifies async dependency', function () {
      var payPalView;

      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyReady');

      payPalView = new PayPalView({
        element: this.element,
        model: this.model,
        options: this.options
      });

      expect(payPalView.model.asyncDependencyReady).to.be.calledOnce;
    });

    it('creates a PayPal component', function () {
      var payPalView = new PayPalView({
        element: this.element,
        model: this.model,
        options: this.options
      });

      expect(PayPal.create).to.be.calledWith(this.sandbox.match({
        client: this.options.client
      }), this.sandbox.match.func);

      expect(payPalView.paypalInstance).to.equal(this.paypalInstance);
    });

    it('creates a PayPal button', function () {
      var paypalButton;

      new PayPalView({ // eslint-disable-line no-new
        element: this.element,
        model: this.model,
        options: this.options
      });

      paypalButton = this.element.querySelector('[data-braintree-id="paypal-button"] script');

      expect(paypalButton.getAttribute('src')).to.equal('https://www.paypalobjects.com/api/button.js');
      expect(paypalButton.getAttribute('data-merchant')).to.equal('braintree');
      expect(paypalButton.getAttribute('data-button')).to.equal('checkout');
      expect(paypalButton.getAttribute('data-button_type')).to.equal('button');
      expect(paypalButton.getAttribute('data-color')).to.equal('gold');
    });

    it('tokenizes when PayPal button is selected', function () {
      var button = this.element.querySelector('[data-braintree-id="paypal-button"]');

      new PayPalView({ // eslint-disable-line no-new
        element: this.element,
        model: this.model,
        options: this.options
      });

      button.click();

      expect(this.paypalInstance.tokenize).to.be.calledWith(this.options.paypal);
    });

    it('sets a closeFrame function', function () {
      var button = this.element.querySelector('[data-braintree-id="paypal-button"]');

      var paypalView = new PayPalView({
        element: this.element,
        model: this.model,
        options: this.options
      });

      expect(paypalView.closeFrame).to.not.exist;

      button.click();

      expect(paypalView.closeFrame).to.equal(this.closeStub);
    });

    it('focuses the PayPal popup if the button is clicked after tokenization has started', function () {
      var button = this.element.querySelector('[data-braintree-id="paypal-button"]');

      new PayPalView({ // eslint-disable-line no-new
        element: this.element,
        model: this.model,
        options: this.options
      });

      button.click();

      expect(this.paypalInstance.tokenize).to.be.calledWith(this.options.paypal);

      button.click();

      expect(this.focusStub).to.have.been.called;
    });

    it('adds a new payment method when tokenize is successful', function () {
      var button = this.element.querySelector('[data-braintree-id="paypal-button"]');

      this.sandbox.stub(DropinModel.prototype, 'addPaymentMethod');
      this.tokenizeStub.yields(null, {foo: 'bar'});

      new PayPalView({ // eslint-disable-line no-new
        element: this.element,
        model: this.model,
        options: this.options
      });

      button.click();

      expect(this.model.addPaymentMethod).to.be.calledWith({foo: 'bar'});
    });

    it('sets _authInProgress appropriately', function () {
      var button = this.element.querySelector('[data-braintree-id="paypal-button"]');

      var paypalView = new PayPalView({
        element: this.element,
        model: this.model,
        options: this.options
      });

      expect(paypalView._authInProgress).to.be.false;

      button.click();

      expect(paypalView._authInProgress).to.be.true;

      this.tokenizeStub.yield(null, {foo: 'bar'});

      expect(paypalView._authInProgress).to.be.false;
    });
  });
});
