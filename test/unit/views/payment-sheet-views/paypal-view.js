'use strict';

var BaseView = require('../../../../src/views/base-view');
var DropinModel = require('../../../../src/dropin-model');
var fake = require('../../../helpers/fake');
var fs = require('fs');
var PayPal = require('braintree-web/paypal');
var PayPalView = require('../../../../src/views/payment-sheet-views/paypal-view');

var mainHTML = fs.readFileSync(__dirname + '/../../../../src/html/main.html', 'utf8');

describe('PayPalView', function () {
  beforeEach(function () {
    var model = new DropinModel(fake.modelOptions());

    this.div = document.createElement('div');
    this.div.innerHTML = mainHTML;
    document.body.appendChild(this.div);
    this.element = document.body.querySelector('.braintree-sheet.braintree-paypal');

    model.supportedPaymentOptions = ['card', 'paypal'];
    model.merchantConfiguration.paypal = {flow: 'vault'};

    this.paypalViewOptions = {
      element: this.element,
      model: model,
      client: {
        getConfiguration: fake.configuration
      }
    };
  });

  afterEach(function () {
    document.body.removeChild(this.div);
  });

  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(PayPalView.prototype, '_initialize');
    });

    it('calls _initialize', function () {
      new PayPalView(); // eslint-disable-line no-new

      expect(PayPalView.prototype._initialize).to.have.been.calledOnce;
    });

    it('inherits from BaseView', function () {
      expect(new PayPalView()).to.be.an.instanceOf(BaseView);
    });
  });

  describe('_initialize', function () {
    beforeEach(function () {
      this.model = new DropinModel(fake.modelOptions());
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

      payPalView = new PayPalView(this.paypalViewOptions);

      expect(payPalView.model.asyncDependencyStarting).to.be.calledOnce;
    });

    it('notifies async dependency', function () {
      var payPalView;

      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyReady');

      payPalView = new PayPalView(this.paypalViewOptions);

      expect(payPalView.model.asyncDependencyReady).to.be.calledOnce;
    });

    it('creates a PayPal component', function () {
      var payPalView = new PayPalView(this.paypalViewOptions);

      expect(PayPal.create).to.be.calledWith(this.sandbox.match({
        client: this.paypalViewOptions.client
      }), this.sandbox.match.func);

      expect(payPalView.paypalInstance).to.equal(this.paypalInstance);
    });

    it('console errors when PayPal component creation fails', function () {
      var paypalView;
      var fakeError = {type: 'MERCHANT'};

      this.sandbox.stub(DropinModel.prototype, 'asyncDependencyStarting');
      PayPal.create.yields(fakeError);
      this.sandbox.stub(console, 'error');

      paypalView = new PayPalView(this.paypalViewOptions);

      expect(console.error).to.be.calledWith(fakeError);
      expect(paypalView.model.asyncDependencyStarting).to.be.calledOnce;
    });

    it('creates a PayPal button', function () {
      var paypalButton;

      new PayPalView(this.paypalViewOptions); // eslint-disable-line no-new

      paypalButton = this.element.querySelector('[data-braintree-id="paypal-button"] script');

      expect(paypalButton.getAttribute('src')).to.equal('https://www.paypalobjects.com/api/button.js');
      expect(paypalButton.getAttribute('data-merchant')).to.equal('braintree');
      expect(paypalButton.getAttribute('data-button')).to.equal('checkout');
      expect(paypalButton.getAttribute('data-button_type')).to.equal('button');
      expect(paypalButton.getAttribute('data-color')).to.equal('gold');
    });

    it('tokenizes when PayPal button is selected', function () {
      var button = this.element.querySelector('[data-braintree-id="paypal-button"]');

      new PayPalView(this.paypalViewOptions); // eslint-disable-line no-new

      button.click();

      expect(this.paypalInstance.tokenize).to.be.calledWith(this.options.paypal);
    });

    it('sets a closeFrame function', function () {
      var button = this.element.querySelector('[data-braintree-id="paypal-button"]');

      var paypalView = new PayPalView(this.paypalViewOptions);

      expect(paypalView.closeFrame).to.not.exist;

      button.click();

      expect(paypalView.closeFrame).to.equal(this.closeStub);
    });

    it('focuses the PayPal popup if the button is clicked after tokenization has started', function () {
      var button = this.element.querySelector('[data-braintree-id="paypal-button"]');

      new PayPalView(this.paypalViewOptions); // eslint-disable-line no-new

      button.click();

      expect(this.paypalInstance.tokenize).to.be.calledWith(this.options.paypal);

      button.click();

      expect(this.focusStub).to.have.been.called;
    });

    it('adds a new payment method when tokenize is successful', function () {
      var button = this.element.querySelector('[data-braintree-id="paypal-button"]');

      this.sandbox.stub(DropinModel.prototype, 'addPaymentMethod');
      this.tokenizeStub.yields(null, {foo: 'bar'});

      new PayPalView(this.paypalViewOptions); // eslint-disable-line no-new

      button.click();

      expect(this.model.addPaymentMethod).to.be.calledWith({foo: 'bar'});
    });

    it('sets _authInProgress appropriately', function () {
      var button = this.element.querySelector('[data-braintree-id="paypal-button"]');

      var paypalView = new PayPalView(this.paypalViewOptions);

      expect(paypalView._authInProgress).to.be.false;

      button.click();

      expect(paypalView._authInProgress).to.be.true;

      this.tokenizeStub.yield(null, {foo: 'bar'});

      expect(paypalView._authInProgress).to.be.false;
    });

    it('reports MERCHANT errors without error payload and console errors', function () {
      var button = this.element.querySelector('[data-braintree-id="paypal-button"]');
      var fakeError = {type: 'MERCHANT'};
      var paypalView = new PayPalView(this.paypalViewOptions);

      this.sandbox.stub(paypalView.model, 'reportError');
      this.sandbox.stub(console, 'error');
      this.paypalInstance.tokenize.yields(fakeError);

      button.click();

      expect(paypalView.model.reportError).to.be.calledWith(null);
      expect(console.error).to.be.calledWith(fakeError);
    });

    it('reports non-MERCHANT errors with error payload', function () {
      var button = this.element.querySelector('[data-braintree-id="paypal-button"]');
      var fakeError = {
        code: 'PAYPAL_FAKE_ERROR_CODE',
        message: 'Sorry friend',
        type: 'NETWORK'
      };
      var paypalView = new PayPalView(this.paypalViewOptions);

      this.sandbox.stub(paypalView.model, 'reportError');
      this.sandbox.stub(console, 'error');
      this.paypalInstance.tokenize.yields(fakeError);

      button.click();

      expect(paypalView.model.reportError).to.be.calledWith(fakeError);
      expect(console.error).to.not.be.called;
    });

    it('does not report PAYPAL_POPUP_CLOSED errors', function () {
      var button = this.element.querySelector('[data-braintree-id="paypal-button"]');
      var fakeError = {
        code: 'PAYPAL_POPUP_CLOSED',
        message: 'Sorry friend',
        type: 'CUSTOMER'
      };
      var paypalView = new PayPalView(this.paypalViewOptions);

      this.sandbox.stub(paypalView.model, 'reportError');
      this.sandbox.stub(console, 'error');
      this.paypalInstance.tokenize.yields(fakeError);

      button.click();

      expect(paypalView.model.reportError).to.be.not.be.called;
      expect(console.error).to.not.be.called;
    });
  });
});
