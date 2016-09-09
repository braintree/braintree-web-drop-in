'use strict';

var PayPalPickerView = require('../../../../src/views/picker-views/paypal-picker-view');
var BasePickerView = require('../../../../src/views/picker-views/base-picker-view');
var fake = require('../../../helpers/fake');
var paypal = require('braintree-web/paypal');

describe('PayPalPickerView', function () {
  beforeEach(function () {
    this.fakePayPalPickerView = document.createElement('div');
    this.fakePayPalPickerView.id = 'paypal-picker-view';

    document.body.appendChild(this.fakePayPalPickerView);
  });

  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(PayPalPickerView.prototype, '_initialize');
    });

    it('calls _initialize', function () {
      new PayPalPickerView(); // eslint-disable-line no-new

      expect(PayPalPickerView.prototype._initialize).to.have.been.calledOnce;
    });

    it('inherits from BasePickerView', function () {
      expect(new PayPalPickerView()).to.be.an.instanceOf(BasePickerView);
    });
  });

  describe('_initialize', function () {
    beforeEach(function () {
      this.context = {
        element: this.fakePayPalPickerView,
        options: {
          client: {
            getConfiguration: fake.configuration,
            request: this.sandbox.spy()
          }
        },
        mainView: {
          componentId: 'component-id',
          asyncDependencyStarting: this.sandbox.stub(),
          asyncDependencyReady: this.sandbox.stub()
        }
      };

      this.sandbox.stub(paypal, 'create').yields(null, {});
    });

    it('starts async dependency', function () {
      PayPalPickerView.prototype._initialize.call(this.context);

      expect(this.context.mainView.asyncDependencyStarting).to.be.calledOnce;
    });

    it('notifies async dependency is ready when PayPal is created', function () {
      PayPalPickerView.prototype._initialize.call(this.context);

      expect(this.context.mainView.asyncDependencyReady).to.be.calledOnce;
    });

    it('creates PayPal', function () {
      PayPalPickerView.prototype._initialize.call(this.context);

      expect(paypal.create).to.be.calledWith(this.sandbox.match({
        client: this.context.options.client
      }), this.sandbox.match.func);
    });

    it('console errors with PayPal create error', function () {
      paypal.create.yields(new Error('create failed'));
      this.sandbox.stub(console, 'error');

      PayPalPickerView.prototype._initialize.call(this.context);

      expect(console.error).to.have.been.calledWith(new Error('create failed'));
    });

    it('appends PayPal picker html', function () {
      PayPalPickerView.prototype._initialize.call(this.context);

      expect(this.context.element.querySelector('.braintree-dropin__paypal-picker-view')).to.exist;
    });
  });

  describe('element after initialization', function () {
    beforeEach(function () {
      this.context = {
        element: this.fakePayPalPickerView,
        options: {
          paypal: {}
        },
        mainView: {
          asyncDependencyStarting: this.sandbox.stub(),
          asyncDependencyReady: this.sandbox.stub(),
          updateActivePaymentMethod: this.sandbox.stub()
        }
      };
    });

    it('calls tokenize when clicked', function () {
      var stubPaypalInstance = {
        tokenize: this.sandbox.stub()
      };

      this.sandbox.stub(paypal, 'create').callsArgWith(1, null, stubPaypalInstance);
      PayPalPickerView.prototype._initialize.call(this.context);

      this.context.element.click();

      expect(stubPaypalInstance.tokenize).to.be.calledWith(this.context.options.paypal);
    });

    it('calls updateActivePaymentMethod when tokenize is successful', function () {
      var stubTokenizePayload = {foo: 'bar'};
      var stubPaypalInstance = {
        tokenize: this.sandbox.stub().callsArgWith(1, null, stubTokenizePayload)
      };

      this.sandbox.stub(paypal, 'create').callsArgWith(1, null, stubPaypalInstance);
      PayPalPickerView.prototype._initialize.call(this.context);

      this.context.element.click();

      expect(this.context.mainView.updateActivePaymentMethod).to.be.calledWith(stubTokenizePayload);
    });

    it('does not call updateActivePaymentMethod when tokenize fails', function () {
      var stubPaypalInstance = {
        tokenize: this.sandbox.stub().callsArgWith(1, new Error('bad things'), null)
      };

      this.sandbox.stub(console, 'error');
      this.sandbox.stub(paypal, 'create').callsArgWith(1, null, stubPaypalInstance);
      PayPalPickerView.prototype._initialize.call(this.context);

      this.context.element.click();

      expect(this.context.mainView.updateActivePaymentMethod).to.not.have.been.called;
    });

    it('console errors when tokenize fails', function () {
      var stubPaypalInstance = {
        tokenize: this.sandbox.stub().callsArgWith(1, new Error('bad things'), null)
      };

      this.sandbox.stub(paypal, 'create').callsArgWith(1, null, stubPaypalInstance);
      this.sandbox.stub(console, 'error');

      PayPalPickerView.prototype._initialize.call(this.context);

      this.context.element.click();

      expect(console.error).to.have.been.calledWith(new Error('bad things'));
    });
  });

  describe('teardown', function () {
    beforeEach(function () {
      this.context = {
        paypalInstance: {
          teardown: this.sandbox.stub().yields()
        }
      };
    });

    it('tears down paypal instance', function (done) {
      PayPalPickerView.prototype.teardown.call(this.context, function () {
        expect(this.context.paypalInstance.teardown).to.be.calledOnce;
        done();
      }.bind(this));
    });

    it('passes paypal teardown errors to callback', function (done) {
      var error = new Error('paypal teardown error');

      this.context.paypalInstance.teardown.yields(error);

      PayPalPickerView.prototype.teardown.call(this.context, function (err) {
        expect(err).to.equal(error);
        done();
      });
    });
  });
});
