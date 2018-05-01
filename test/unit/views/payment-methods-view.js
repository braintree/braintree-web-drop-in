'use strict';

var BaseView = require('../../../src/views/base-view');
var PaymentMethodsView = require('../../../src/views/payment-methods-view');
var DropinModel = require('../../../src/dropin-model');
var classlist = require('../../../src/lib/classlist');
var fake = require('../../helpers/fake');
var fs = require('fs');
var strings = require('../../../src/translations/en_US');

var mainHTML = fs.readFileSync(__dirname + '/../../../src/html/main.html', 'utf8');

describe('PaymentMethodsView', function () {
  beforeEach(function () {
    this.element = document.createElement('div');
    this.element.innerHTML = mainHTML;
  });

  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(PaymentMethodsView.prototype, '_initialize');
    });

    it('inherits from BaseView', function () {
      expect(new PaymentMethodsView({})).to.be.an.instanceof(BaseView);
    });

    it('calls _initialize', function () {
      new PaymentMethodsView({}); // eslint-disable-line no-new

      expect(PaymentMethodsView.prototype._initialize).to.have.been.calledOnce;
    });
  });

  describe('_initialize', function () {
    it('adds supported vaulted payment methods', function () {
      var model, paymentMethodsViews;
      var modelOptions = fake.modelOptions();

      modelOptions.client.getConfiguration = function () {
        return {
          authorization: fake.clientTokenWithCustomerID,
          authorizationType: 'CLIENT_TOKEN',
          gatewayConfiguration: fake.configuration().gatewayConfiguration
        };
      };
      modelOptions.paymentMethods = [{type: 'CreditCard', details: {lastTwo: '11'}}, {type: 'PayPalAccount', details: {email: 'wow@example.com'}}, {type: 'UnsupportedPaymentMethod'}];
      modelOptions.merchantConfiguration.paypal = {flow: 'vault'};

      model = new DropinModel(modelOptions);

      return model.initialize().then(function () {
        paymentMethodsViews = new PaymentMethodsView({
          element: this.element,
          model: model,
          merchantConfiguration: {
            paypal: modelOptions.merchantConfiguration.paypal,
            authorization: fake.clientTokenWithCustomerID
          },
          strings: strings
        });

        expect(paymentMethodsViews.views.length).to.equal(2);
        expect(paymentMethodsViews.container.childElementCount).to.equal(2);
      }.bind(this));
    });

    it('puts default payment method as first item in list', function () {
      var firstChildLabel, model, paymentMethodsViews;
      var creditCard = {
        details: {cardType: 'Visa'},
        type: 'CreditCard'
      };
      var paypalAccount = {
        details: {email: 'wow@meow.com'},
        type: 'PayPalAccount'
      };
      var modelOptions = fake.modelOptions();

      modelOptions.client.getConfiguration = function () {
        return {
          authorization: fake.clientTokenWithCustomerID,
          authorizationType: 'CLIENT_TOKEN',
          gatewayConfiguration: fake.configuration().gatewayConfiguration
        };
      };
      modelOptions.paymentMethods = [paypalAccount, creditCard];
      modelOptions.merchantConfiguration.paypal = {flow: 'vault'};

      model = new DropinModel(modelOptions);

      return model.initialize().then(function () {
        paymentMethodsViews = new PaymentMethodsView({
          element: this.element,
          model: model,
          merchantConfiguration: modelOptions.merchantConfiguration,
          strings: strings
        });

        firstChildLabel = paymentMethodsViews.container.firstChild.querySelector('.braintree-method__label .braintree-method__label--small');

        expect(firstChildLabel.textContent).to.equal(strings.PayPal);
      }.bind(this));
    });

    it('does not add payment methods if there are none', function () {
      var model, methodsContainer, paymentMethodsViews;
      var modelOptions = fake.modelOptions();

      modelOptions.client.getConfiguration = function () {
        return {
          authorization: fake.clientTokenWithCustomerID,
          authorizationType: 'CLIENT_TOKEN',
          gatewayConfiguration: fake.configuration().gatewayConfiguration
        };
      };

      model = new DropinModel(modelOptions);

      return model.initialize().then(function () {
        methodsContainer = this.element.querySelector('[data-braintree-id="methods-container"]');
        paymentMethodsViews = new PaymentMethodsView({
          element: this.element,
          model: model,
          merchantConfiguration: {
            authorization: fake.clientTokenWithCustomerID
          },
          strings: strings
        });

        expect(paymentMethodsViews.views.length).to.equal(0);
        expect(methodsContainer.children.length).to.equal(0);
      }.bind(this));
    });

    it('changes the payment method view when the active payment method changes', function () {
      var model, paymentMethodsViews;
      var fakePaymentMethod = {baz: 'qux'};
      var modelOptions = fake.modelOptions();

      this.sandbox.useFakeTimers();

      modelOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;
      modelOptions.paymentMethods = [{foo: 'bar'}, fakePaymentMethod];
      model = new DropinModel(modelOptions);

      return model.initialize().then(function () {
        model.changeActivePaymentMethod({foo: 'bar'});

        paymentMethodsViews = new PaymentMethodsView({
          element: this.element,
          model: model,
          merchantConfiguration: {
            authorization: fake.clientTokenWithCustomerID
          },
          strings: strings
        });

        paymentMethodsViews._addPaymentMethod(fakePaymentMethod);

        model.changeActivePaymentMethod(fakePaymentMethod);

        expect(paymentMethodsViews.activeMethodView.paymentMethod).to.equal(fakePaymentMethod);
        this.sandbox.clock.tick(1001);
        expect(paymentMethodsViews.activeMethodView.element.className).to.contain('braintree-method--active');
        this.sandbox.clock.restore();
      }.bind(this));
    });

    it('updates the paying with label when the active payment method changes', function () {
      var model, paymentMethodsViews;
      var fakeCard = {type: 'CreditCard', details: {lastTwo: 22}};
      var fakePayPal = {type: 'PayPalAccount', details: {email: 'buyer@braintreepayments.com'}};
      var modelOptions = fake.modelOptions();

      modelOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;
      modelOptions.paymentMethods = [fakePayPal, fakeCard];
      model = new DropinModel(modelOptions);

      return model.initialize().then(function () {
        model.isGuestCheckout = false;

        paymentMethodsViews = new PaymentMethodsView({
          element: this.element,
          model: model,
          merchantConfiguration: {
            authorization: fake.clientTokenWithCustomerID
          },
          strings: strings
        });

        paymentMethodsViews._addPaymentMethod(fakePayPal);
        paymentMethodsViews._addPaymentMethod(fakeCard);

        model.changeActivePaymentMethod(fakeCard);
        expect(paymentMethodsViews.getElementById('methods-label').textContent).to.equal('Paying with Card');

        model.changeActivePaymentMethod(fakePayPal);
        expect(paymentMethodsViews.getElementById('methods-label').textContent).to.equal('Paying with PayPal');
      }.bind(this));
    });
  });

  describe('_addPaymentMethod', function () {
    beforeEach(function () {
      var div = document.createElement('div');

      div.innerHTML = mainHTML;
      this.element = div.querySelector('.braintree-dropin');
      this.fakePaymentMethod = {
        type: 'CreditCard',
        details: {lastTwo: '11'}
      };
    });

    it('does not remove other payment methods in non-guest checkout', function () {
      var model, paymentMethodsViews;
      var methodsContainer = this.element.querySelector('[data-braintree-id="methods-container"]');
      var modelOptions = fake.modelOptions();

      modelOptions.client.getConfiguration = function () {
        return {
          authorization: fake.clientTokenWithCustomerID,
          authorizationType: 'CLIENT_TOKEN',
          gatewayConfiguration: fake.configuration().gatewayConfiguration
        };
      };

      modelOptions.merchantConfiguration.authorization = fake.clientTokenWithCustomerID;
      modelOptions.paymentMethods = [this.fakePaymentMethod];
      model = new DropinModel(modelOptions);

      return model.initialize().then(function () {
        paymentMethodsViews = new PaymentMethodsView({
          element: this.element,
          model: model,
          merchantConfiguration: {
            authorization: fake.clientTokenWithCustomerID
          },
          strings: strings
        });

        model.addPaymentMethod({foo: 'bar'});

        expect(paymentMethodsViews.views.length).to.equal(2);
        expect(methodsContainer.childElementCount).to.equal(2);
      }.bind(this));
    });

    it('removes other payment methods in guest checkout', function () {
      var model, paymentMethodsViews;
      var methodsContainer = this.element.querySelector('[data-braintree-id="methods-container"]');
      var modelOptions = fake.modelOptions();

      modelOptions.merchantConfiguration.authorization = fake.clientToken;
      modelOptions.paymentMethods = [this.fakePaymentMethod];
      model = new DropinModel(modelOptions);

      return model.initialize().then(function () {
        paymentMethodsViews = new PaymentMethodsView({
          element: this.element,
          model: model,
          merchantConfiguration: {
            authorization: fake.clientToken
          },
          strings: strings
        });

        model.addPaymentMethod({foo: 'bar'});

        expect(paymentMethodsViews.views.length).to.equal(1);
        expect(methodsContainer.childElementCount).to.equal(1);
      }.bind(this));
    });

    it('does not try to remove a payment method if none exists in guest checkout', function () {
      var model, paymentMethodsViews;
      var methodsContainer = this.element.querySelector('[data-braintree-id="methods-container"]');
      var modelOptions = fake.modelOptions();

      modelOptions.merchantConfiguration.authorization = fake.clientToken;
      model = new DropinModel(modelOptions);

      return model.initialize().then(function () {
        paymentMethodsViews = new PaymentMethodsView({
          element: this.element,
          model: model,
          merchantConfiguration: {
            authorization: fake.clientToken
          },
          strings: strings
        });

        model.addPaymentMethod({foo: 'bar'});

        expect(paymentMethodsViews.views.length).to.equal(1);
        expect(methodsContainer.childElementCount).to.equal(1);
      }.bind(this));
    });
  });

  describe('removeActivePaymentMethod', function () {
    beforeEach(function () {
      var model;
      var modelOptions = fake.modelOptions();

      modelOptions.merchantConfiguration.authorization = fake.clientToken;
      model = new DropinModel(modelOptions);

      return model.initialize().then(function () {
        this.paymentMethodsViews = new PaymentMethodsView({
          element: this.element,
          model: model,
          merchantConfiguration: {
            authorization: fake.clientToken
          },
          strings: strings
        });
        this.activeMethodView = {
          setActive: this.sandbox.stub()
        };

        this.paymentMethodsViews.activeMethodView = this.activeMethodView;
        this.sandbox.stub(classlist, 'add');
      }.bind(this));
    });

    it('sets the active method view to not active', function () {
      this.paymentMethodsViews.removeActivePaymentMethod();

      expect(this.activeMethodView.setActive).to.be.calledOnce;
      expect(this.activeMethodView.setActive).to.be.calledWith(false);
    });

    it('removes active method view from instance', function () {
      this.paymentMethodsViews.removeActivePaymentMethod();

      expect(this.paymentMethodsViews.activeMethodView).to.not.exist;
    });

    it('applies class to heading label to hide it when no payment methods are selected', function () {
      this.paymentMethodsViews.removeActivePaymentMethod();

      expect(classlist.add).to.be.calledOnce;
      expect(classlist.add).to.be.calledWith(this.sandbox.match.any, 'braintree-no-payment-method-selected');
    });
  });

  describe('_removePaymentMethod', function () {
    beforeEach(function () {
      var div = document.createElement('div');

      div.innerHTML = mainHTML;
      this.element = div.querySelector('.braintree-dropin');
      this.element.id = 'fake-method';
      this.fakePaymentMethod = {
        type: 'CreditCard',
        details: {lastTwo: '11'}
      };

      this.model = new DropinModel(fake.modelOptions());

      return this.model.initialize().then(function () {
        this.paymentMethodsViews = new PaymentMethodsView({
          element: div,
          model: this.model,
          merchantConfiguration: {
            authorization: fake.clientTokenWithCustomerID
          },
          strings: strings
        });
        this.paymentMethodsViews.views.push({
          paymentMethod: this.fakePaymentMethod,
          element: this.element
        });
        this.paymentMethodsViews.container = {
          removeChild: this.sandbox.stub()
        };
        this.paymentMethodsViews._headingLabel = {
          innerHTML: 'Paying with'
        };
      }.bind(this));
    });

    it('removes specified payment method from views', function () {
      expect(this.paymentMethodsViews.views[0].paymentMethod).to.equal(this.fakePaymentMethod);

      this.paymentMethodsViews._removePaymentMethod(this.fakePaymentMethod);

      expect(this.paymentMethodsViews.views[0]).to.not.exist;
    });

    it('removes specified payment method div from DOM', function () {
      this.paymentMethodsViews._removePaymentMethod(this.fakePaymentMethod);

      expect(this.paymentMethodsViews.container.removeChild).to.be.calledOnce;
      expect(this.paymentMethodsViews.container.removeChild).to.be.calledWith(this.element);
    });

    it('ignores payment methods that are not the exact object', function () {
      var copy = JSON.parse(JSON.stringify(this.fakePaymentMethod));

      this.paymentMethodsViews._removePaymentMethod(copy);

      expect(this.paymentMethodsViews.views[0].paymentMethod).to.equal(this.fakePaymentMethod);
      expect(this.paymentMethodsViews.container.removeChild).to.not.be.called;
    });
  });

  describe('requestPaymentMethod', function () {
    it('resolves a promise with the active payment method from the active method view', function () {
      var paymentMethodsViews;
      var fakeActiveMethodView = {
        paymentMethod: {foo: 'bar'}
      };
      var element = document.createElement('div');
      var model = new DropinModel(fake.modelOptions());

      return model.initialize().then(function () {
        element.innerHTML = mainHTML;
        paymentMethodsViews = new PaymentMethodsView({
          element: element,
          model: model,
          merchantConfiguration: {
            authorization: fake.clientTokenWithCustomerID
          },
          strings: strings
        });

        paymentMethodsViews.activeMethodView = fakeActiveMethodView;

        return paymentMethodsViews.requestPaymentMethod();
      }).then(function (payload) {
        expect(payload).to.equal(fakeActiveMethodView.paymentMethod);
      });
    });
  });

  describe('enableEditMode', function () {
    it('calls enableEditMode on each payment method view', function () {
      var model, paymentMethodsViews;
      var modelOptions = fake.modelOptions();
      var element = document.createElement('div');

      element.innerHTML = mainHTML;

      modelOptions.client.getConfiguration = function () {
        return {
          authorization: fake.clientTokenWithCustomerID,
          authorizationType: 'CLIENT_TOKEN',
          gatewayConfiguration: fake.configuration().gatewayConfiguration
        };
      };
      modelOptions.paymentMethods = [{type: 'CreditCard', details: {lastTwo: '11'}}, {type: 'PayPalAccount', details: {email: 'wow@example.com'}}, {type: 'UnsupportedPaymentMethod'}];
      modelOptions.merchantConfiguration.paypal = {flow: 'vault'};

      model = new DropinModel(modelOptions);

      return model.initialize().then(function () {
        paymentMethodsViews = new PaymentMethodsView({
          element: element,
          model: model,
          merchantConfiguration: {
            paypal: modelOptions.merchantConfiguration.paypal,
            authorization: fake.clientTokenWithCustomerID
          },
          strings: strings
        });

        this.sandbox.stub(paymentMethodsViews.views[0], 'enableEditMode');
        this.sandbox.stub(paymentMethodsViews.views[1], 'enableEditMode');

        paymentMethodsViews.enableEditMode();

        expect(paymentMethodsViews.views[0].enableEditMode).to.be.calledOnce;
        expect(paymentMethodsViews.views[1].enableEditMode).to.be.calledOnce;
      }.bind(this));
    });
  });
});
