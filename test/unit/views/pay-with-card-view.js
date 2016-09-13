'use strict';

var BaseView = require('../../../src/views/base-view');
var DropinModel = require('../../../src/dropin-model');
var fake = require('../../helpers/fake');
var hostedFields = require('braintree-web/hosted-fields');
var mainHTML = require('../../../src/html/main.html');
var PayWithCardView = require('../../../src/views/pay-with-card-view');

describe('PayWithCardView', function () {
  beforeEach(function () {
    this.div = document.createElement('div');

    this.div.innerHTML = mainHTML;
    document.body.appendChild(this.div);
    this.element = document.body.querySelector('.braintree-dropin__sheet.braintree-dropin__pay-with-card');
  });

  afterEach(function () {
    document.body.removeChild(this.div);
  });

  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(PayWithCardView.prototype, '_initialize');
    });

    it('calls _initialize', function () {
      new PayWithCardView({element: this.element}); // eslint-disable-line no-new

      expect(PayWithCardView.prototype._initialize).to.have.been.calledOnce;
    });

    it('inherits from BaseView', function () {
      expect(new PayWithCardView({element: this.element})).to.be.an.instanceOf(BaseView);
    });
  });

  describe('_initialize', function () {
    beforeEach(function () {
      this.context = {
        element: this.element,
        _generateFieldSelector: PayWithCardView.prototype._generateFieldSelector,
        getElementById: BaseView.prototype.getElementById,
        mainView: {
          componentId: 'component-id',
          asyncDependencyStarting: this.sandbox.stub(),
          asyncDependencyReady: this.sandbox.stub(),
          updateActivePaymentMethod: this.sandbox.stub()
        },
        options: {
          client: {
            getConfiguration: fake.configuration,
            request: this.sandbox.spy()
          }
        },
        tokenize: PayWithCardView.prototype.tokenize
      };
      this.sandbox.stub(hostedFields, 'create').yields(null, {});
    });

    it('has cvv if supplied in challenges', function () {
      this.context.options.client.getConfiguration = function () {
        return {
          gatewayConfiguration: {challenges: ['cvv']}
        };
      };
      PayWithCardView.prototype._initialize.call(this.context);

      expect(this.context.element.querySelector('[data-braintree-id="cvv-container"]')).to.exist;
    });

    it('does not have cvv if not supplied in challenges', function () {
      PayWithCardView.prototype._initialize.call(this.context);

      expect(this.context.element.querySelector('[data-braintree-id="cvv-container"]')).not.to.exist;
    });

    it('has postal code if supplied in challenges', function () {
      this.context.options.client.getConfiguration = function () {
        return {
          gatewayConfiguration: {challenges: ['postal_code']}
        };
      };
      PayWithCardView.prototype._initialize.call(this.context);

      expect(this.context.element.querySelector('[data-braintree-id="postal-code-container"]')).to.exist;
    });

    it('does not have postal code if not supplied in challenges', function () {
      PayWithCardView.prototype._initialize.call(this.context);

      expect(this.context.element.querySelector('[data-braintree-id="postal-code-container"]')).not.to.exist;
    });

    it('starts async dependency', function () {
      PayWithCardView.prototype._initialize.call(this.context);

      expect(this.context.mainView.asyncDependencyStarting).to.be.calledOnce;
    });

    it('notifies async dependency is ready when Hosted Fields is created', function () {
      hostedFields.create.callsArg(1);

      PayWithCardView.prototype._initialize.call(this.context);

      expect(this.context.mainView.asyncDependencyReady).to.be.calledOnce;
    });

    it('console errors with a Hosted Fields create error', function () {
      hostedFields.create.yields(new Error('create failed'));
      this.sandbox.stub(console, 'error');

      PayWithCardView.prototype._initialize.call(this.context);

      expect(console.error).to.be.calledWith(new Error('create failed'));
    });

    it('creates Hosted Fields with number and expiration date', function () {
      PayWithCardView.prototype._initialize.call(this.context);

      expect(hostedFields.create).to.be.calledWith(this.sandbox.match({
        client: this.context.options.client,
        fields: {
          number: {
          },
          expirationDate: {}
        }
      }), this.sandbox.match.func);
      expect(hostedFields.create.lastCall.args[0]).not.to.have.deep.property('fields.cvv');
      expect(hostedFields.create.lastCall.args[0]).not.to.have.deep.property('fields.postalCode');
    });

    it('creates Hosted Fields with cvv if included in challenges', function () {
      this.context.options.client.getConfiguration = function () {
        return {
          gatewayConfiguration: {challenges: ['cvv']}
        };
      };

      PayWithCardView.prototype._initialize.call(this.context);

      expect(hostedFields.create.lastCall.args[0]).to.have.deep.property('fields.cvv');
    });

    it('creates Hosted Fields with postal code if included in challenges', function () {
      this.context.options.client.getConfiguration = function () {
        return {
          gatewayConfiguration: {challenges: ['postal_code']}
        };
      };

      PayWithCardView.prototype._initialize.call(this.context);

      expect(hostedFields.create.lastCall.args[0]).to.have.deep.property('fields.postalCode');
    });
  });

  describe('tokenize', function () {
    beforeEach(function () {
      this.fakeHostedFieldsInstance = {
        clear: this.sandbox.stub(),
        getState: this.sandbox.stub().returns({
          cards: [{type: 'visa'}],
          fields: {
            number: {
              isValid: true
            },
            expirationDate: {
              isValid: true
            }
          }
        }),
        tokenize: this.sandbox.stub()
      };
      this.model = new DropinModel();

      this.context = {
        hostedFieldsInstance: this.fakeHostedFieldsInstance,
        model: this.model,
        options: {
          client: {
            getConfiguration: fake.configuration
          }
        }
      };
    });

    it('does not tokenize if form is not valid', function () {
      this.context.hostedFieldsInstance.getState.returns({
        cards: [{type: 'visa'}],
        fields: {
          number: {
            isValid: true
          },
          expirationDate: {
            isValid: false
          }
        }
      });

      PayWithCardView.prototype.tokenize.call(this.context);

      expect(this.fakeHostedFieldsInstance.tokenize).to.not.be.called;
    });

    it('console errors if card type is not supported', function () {
      this.context.options.client.getConfiguration = function () {
        return {
          gatewayConfiguration: {
            creditCards: {
              supportedCardTypes: ['Foo Pay']
            }
          }
        };
      };

      this.sandbox.stub(console, 'error');

      PayWithCardView.prototype.tokenize.call(this.context);

      expect(console.error).to.have.been.calledWith(new Error('Card type is unsupported.'));
      expect(this.context.hostedFieldsInstance.tokenize).to.not.be.called;
    });

    it('calls tokenize', function () {
      PayWithCardView.prototype.tokenize.call(this.context);

      expect(this.context.hostedFieldsInstance.tokenize).to.have.been.calledWith({vault: true}, this.sandbox.match.func);
    });

    it('clears fields after successful tokenization', function () {
      this.context.hostedFieldsInstance.tokenize.yields(null, {nonce: 'foo'});

      PayWithCardView.prototype.tokenize.call(this.context);

      expect(this.context.hostedFieldsInstance.clear).to.have.been.calledWith('number');
      expect(this.context.hostedFieldsInstance.clear).to.have.been.calledWith('expirationDate');
      expect(this.context.hostedFieldsInstance.clear).not.to.have.been.calledWith('cvv');
      expect(this.context.hostedFieldsInstance.clear).not.to.have.been.calledWith('postalCode');
    });

    it('console errors when tokenization fails', function () {
      this.context.hostedFieldsInstance.tokenize.yields(new Error('foo'));

      this.sandbox.stub(console, 'error');

      PayWithCardView.prototype.tokenize.call(this.context);

      expect(console.error).to.have.been.called;
    });

    it('adds a new payment method when tokenize is successful', function () {
      var stubPayload = {};

      this.context.hostedFieldsInstance.tokenize = this.sandbox.stub().yields(null, stubPayload);
      this.sandbox.stub(this.model, 'addPaymentMethod');

      PayWithCardView.prototype.tokenize.call(this.context);

      expect(this.model.addPaymentMethod).to.have.been.calledWith(stubPayload);
    });

    it('does not update the active payment method when tokenize fails', function () {
      this.context.hostedFieldsInstance.tokenize = this.sandbox.stub().yields(new Error('bad happen'));
      this.sandbox.stub(this.model, 'addPaymentMethod');

      PayWithCardView.prototype.tokenize.call(this.context);

      expect(this.model.addPaymentMethod).to.not.have.been.called;
    });
  });

  describe('teardown', function () {
    beforeEach(function () {
      this.context = {
        hostedFieldsInstance: {
          teardown: this.sandbox.stub().yields()
        }
      };
    });

    it('tears down hosted fields instance', function (done) {
      PayWithCardView.prototype.teardown.call(this.context, function () {
        expect(this.context.hostedFieldsInstance.teardown).to.be.calledOnce;
        done();
      }.bind(this));
    });

    it('passes hosted fields teardown errors to callback', function (done) {
      var error = new Error('hosted fields teardown error');

      this.context.hostedFieldsInstance.teardown.yields(error);

      PayWithCardView.prototype.teardown.call(this.context, function (err) {
        expect(err).to.equal(error);
        done();
      });
    });
  });
});
