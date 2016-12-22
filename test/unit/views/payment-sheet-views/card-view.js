'use strict';

var BaseView = require('../../../../src/views/base-view');
var classlist = require('../../../../src/lib/classlist');
var DropinModel = require('../../../../src/dropin-model');
var fake = require('../../../helpers/fake');
var hostedFields = require('braintree-web/hosted-fields');
var mainHTML = require('../../../../src/html/main.html');
var CardView = require('../../../../src/views/payment-sheet-views/card-view');
var strings = require('../../../../src/translations/en');

describe('CardView', function () {
  beforeEach(function () {
    this.div = document.createElement('div');

    this.div.innerHTML = mainHTML;
    document.body.appendChild(this.div);
    this.element = document.body.querySelector('.braintree-sheet.braintree-card');

    this.client = {
      getConfiguration: fake.configuration
    };
  });

  afterEach(function () {
    document.body.removeChild(this.div);
  });

  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(CardView.prototype, '_initialize');
    });

    it('calls _initialize', function () {
      new CardView({element: this.element}); // eslint-disable-line no-new

      expect(CardView.prototype._initialize).to.have.been.calledOnce;
    });

    it('inherits from BaseView', function () {
      expect(new CardView({element: this.element})).to.be.an.instanceOf(BaseView);
    });
  });

  describe('_initialize', function () {
    beforeEach(function () {
      this.hostedFieldsInstance = {
        on: this.sandbox.spy()
      };
      this.sandbox.stub(hostedFields, 'create').yields(null, this.hostedFieldsInstance);

      this.mainView = {
        componentId: 'component-id'
      };
      this.model = new DropinModel(fake.modelOptions());
    });

    it('has cvv if supplied in challenges', function () {
      this.client.getConfiguration = function () {
        return {
          gatewayConfiguration: {
            challenges: ['cvv'],
            creditCards: {
              supportedCardTypes: []
            }
          }
        };
      };

      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client
      });

      expect(this.element.querySelector('[data-braintree-id="cvv-container"]')).to.exist;
    });

    it('does not have cvv if not supplied in challenges', function () {
      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client
      });

      expect(this.element.querySelector('[data-braintree-id="cvv-container"]')).not.to.exist;
    });

    it('has postal code if supplied in challenges', function () {
      this.client.getConfiguration = function () {
        return {
          gatewayConfiguration: {
            challenges: ['postal_code'],
            creditCards: {
              supportedCardTypes: []
            }
          }
        };
      };

      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client
      });

      expect(this.element.querySelector('[data-braintree-id="postal-code-container"]')).to.exist;
    });

    it('does not have postal code if not supplied in challenges', function () {
      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client
      });

      expect(this.element.querySelector('[data-braintree-id="postal-code-container"]')).not.to.exist;
    });

    it('starts async dependency', function () {
      this.sandbox.spy(DropinModel.prototype, 'asyncDependencyStarting');

      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client
      });

      expect(DropinModel.prototype.asyncDependencyStarting).to.be.calledOnce;
    });

    it('notifies async dependency is ready when Hosted Fields is created', function () {
      this.sandbox.spy(DropinModel.prototype, 'asyncDependencyReady');

      hostedFields.create.callsArgWith(1, null, {on: function () {}});

      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client
      });

      expect(DropinModel.prototype.asyncDependencyReady).to.be.calledOnce;
    });

    it('creates Hosted Fields with number and expiration date', function () {
      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client
      });

      expect(hostedFields.create).to.be.calledWith(this.sandbox.match({
        client: this.client,
        fields: {
          number: {},
          expirationDate: {}
        }
      }), this.sandbox.match.func);
      expect(hostedFields.create.lastCall.args[0]).not.to.have.deep.property('fields.cvv');
      expect(hostedFields.create.lastCall.args[0]).not.to.have.deep.property('fields.postalCode');
    });

    it('creates Hosted Fields with cvv if included in challenges', function () {
      this.client.getConfiguration = function () {
        return {
          gatewayConfiguration: {
            challenges: ['cvv'],
            creditCards: {
              supportedCardTypes: []
            }
          }
        };
      };

      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        merchantConfiguration: {
          authorization: fake.clientToken
        }
      });

      expect(hostedFields.create.lastCall.args[0]).to.have.deep.property('fields.cvv');
    });

    it('creates Hosted Fields with postal code if included in challenges', function () {
      this.client.getConfiguration = function () {
        return {
          gatewayConfiguration: {
            challenges: ['postal_code'],
            creditCards: {
              supportedCardTypes: []
            }
          }
        };
      };

      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        merchantConfiguration: {
          authorization: fake.clientToken
        }
      });

      expect(hostedFields.create.lastCall.args[0]).to.have.deep.property('fields.postalCode');
    });

    it('reports an error to DropinModel when Hosted Fields creation fails', function () {
      var fakeError = {
        code: 'A_REAL_ERROR_CODE'
      };

      hostedFields.create.restore();
      this.sandbox.stub(hostedFields, 'create').yields(fakeError, null);
      this.sandbox.stub(this.model, 'reportError');

      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client
      });

      expect(this.model.reportError).to.be.calledWith(fakeError);
    });

    it('shows supported card icons', function () {
      var supportedCardTypes = ['american-express', 'discover', 'diners-club', 'jcb', 'master-card', 'visa'];

      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client
      });

      supportedCardTypes.forEach(function (cardType) {
        var cardIcon = this.element.querySelector('[data-braintree-id="' + cardType + '-card-icon"]');

        expect(cardIcon.classList.contains('braintree-hidden')).to.be.false;
      }.bind(this));
    });

    it('hides unsupported card icons', function () {
      var unsupportedCardTypes = ['maestro'];

      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client
      });

      unsupportedCardTypes.forEach(function (cardType) {
        var cardIcon = this.element.querySelector('[data-braintree-id="' + cardType + '-card-icon"]');

        expect(cardIcon.classList.contains('braintree-hidden')).to.be.true;
      }.bind(this));
    });

    it('does not show UnionPay icon even if it is supported', function () {
      var unionPayCardIcon;

      this.client.getConfiguration = function () {
        return {
          gatewayConfiguration: {
            challenges: [],
            creditCards: {
              supportedCardTypes: ['UnionPay']
            }
          }
        };
      };

      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client
      });

      unionPayCardIcon = this.element.querySelector('[data-braintree-id="unionpay-card-icon"]');

      expect(unionPayCardIcon.classList.contains('braintree-hidden')).to.be.true;
    });
  });

  describe('requestPaymentMethod', function () {
    beforeEach(function () {
      this.sandbox.stub(hostedFields, 'create').yields(null, fake.hostedFieldsInstance);

      this.mainView = {
        componentId: 'component-id'
      };
      this.model = new DropinModel(fake.modelOptions());
    });

    it('calls the callback with an error when tokenize fails', function (done) {
      var cardView = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client
      });

      this.sandbox.stub(cardView, 'tokenize').yields(new Error('foo'));

      cardView.requestPaymentMethod(function (err, payload) {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('foo');
        expect(payload).to.not.exist;
        done();
      });
    });

    it('calls the callback with the payload when tokenize is successful', function (done) {
      var cardView = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client
      });

      this.sandbox.stub(cardView, 'tokenize').yields(null, {foo: 'bar'});

      cardView.requestPaymentMethod(function (err, payload) {
        expect(err).to.not.exist;
        expect(payload.foo).to.equal('bar');
        done();
      });
    });
  });

  describe('Hosted Fields events', function () {
    beforeEach(function () {
      this.context = {
        element: this.element,
        _generateFieldSelector: CardView.prototype._generateFieldSelector,
        getElementById: BaseView.prototype.getElementById,
        hideInlineError: CardView.prototype.hideInlineError,
        showInlineError: CardView.prototype.showInlineError,
        mainView: {
          componentId: 'component-id'
        },
        model: new DropinModel(fake.modelOptions()),
        client: {
          getConfiguration: function () {
            return {
              gatewayConfiguration: {
                challenges: ['cvv'],
                creditCards: {
                  supportedCardTypes: []
                }
              }
            };
          }
        },
        strings: strings,
        tokenize: CardView.prototype.tokenize,
        _hideUnsupportedCardIcons: function () {},
        _onBlurEvent: function () {},
        _onCardTypeChangeEvent: function () {},
        _onFocusEvent: function () {},
        _onNotEmptyEvent: function () {},
        _onValidityChangeEvent: function () {}
      };

      this.mainView = {
        componentId: 'component-id'
      };
      this.model = new DropinModel(fake.modelOptions());
    });

    describe('onFocusEvent', function () {
      beforeEach(function () {
        this.context._onFocusEvent = CardView.prototype._onFocusEvent;
      });

      it('shows default card icon in number field when focused', function () {
        var cardNumberIcon;
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, {emittedBy: 'number'})
        };

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);

        CardView.prototype._initialize.call(this.context);
        cardNumberIcon = this.element.querySelector('[data-braintree-id="card-number-icon"]');

        expect(cardNumberIcon.classList.contains('braintree-hidden')).to.be.false;
        expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).to.equal('#iconCardFront');
      });

      it('shows default cvv icon in cvv field when focused', function () {
        var cvvIcon;
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, {emittedBy: 'cvv'})
        };

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);

        CardView.prototype._initialize.call(this.context);
        cvvIcon = this.element.querySelector('[data-braintree-id="cvv-icon"]');

        expect(cvvIcon.classList.contains('braintree-hidden')).to.be.false;
        expect(cvvIcon.querySelector('use').getAttribute('xlink:href')).to.equal('#iconCVVBack');
      });
    });

    describe('onBlurEvent', function () {
      beforeEach(function () {
        this.context._onBlurEvent = CardView.prototype._onBlurEvent;
      });

      it('hides the card number icon when the number field is blurred and empty', function () {
        var fakeEvent = {
          emittedBy: 'number',
          fields: {
            number: {isEmpty: true}
          }
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent)
        };
        var cardNumberIcon = this.element.querySelector('[data-braintree-id="card-number-icon"]');

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        classlist.remove(cardNumberIcon, 'braintree-hidden');

        CardView.prototype._initialize.call(this.context);

        expect(this.context.cardNumberIcon.classList.contains('braintree-hidden')).to.be.true;
      });

      it('does not hide the card number icon when the number field is blurred and not empty', function () {
        var fakeEvent = {
          emittedBy: 'number',
          fields: {
            number: {isEmpty: false}
          }
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent)
        };
        var cardNumberIcon = this.element.querySelector('[data-braintree-id="card-number-icon"]');

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        classlist.remove(cardNumberIcon, 'braintree-hidden');

        CardView.prototype._initialize.call(this.context);

        expect(this.context.cardNumberIcon.classList.contains('braintree-hidden')).to.be.false;
      });

      it('hides cvv icon in cvv field when blurred', function () {
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, {emittedBy: 'cvv'})
        };
        var cvvIcon = this.element.querySelector('[data-braintree-id="cvv-icon"]');

        classlist.remove(cvvIcon, 'braintree-hidden');
        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);

        CardView.prototype._initialize.call(this.context);

        expect(this.context.cvvIcon.classList.contains('braintree-hidden')).to.be.true;
      });
    });

    describe('onCardTypeChange event', function () {
      beforeEach(function () {
        this.context._onCardTypeChangeEvent = CardView.prototype._onCardTypeChangeEvent;
      });

      it('updates the card number icon to the card type if there is one possible card type', function () {
        var cardNumberIcon = this.element.querySelector('[data-braintree-id="card-number-icon"]');
        var fakeEvent = {
          cards: [{type: 'master-card'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setPlaceholder: function () {}
        };

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).to.equal('#icon-master-card');
      });

      it('updates the card number icon to the generic card if there are many possible card types', function () {
        var cardNumberIcon = this.element.querySelector('[data-braintree-id="card-number-icon"]');
        var fakeEvent = {
          cards: [{type: 'master-card'}, {type: 'foo-pay'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setPlaceholder: function () {}
        };

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).to.equal('#iconCardFront');
      });

      it('updates the card icon to the generic card if there no card types', function () {
        var cardNumberIcon = this.element.querySelector('[data-braintree-id="card-number-icon"]');
        var fakeEvent = {
          cards: [],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setPlaceholder: function () {}
        };

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).to.equal('#iconCardFront');
      });

      it('updates the cvv icon to back icon for non-amex cards', function () {
        var use = this.element.querySelector('[data-braintree-id="cvv-icon"]').querySelector('use');
        var fakeEvent = {
          cards: [{type: 'visa'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setPlaceholder: function () {}
        };

        use.setAttribute('xlink:href', '#iconCVVFront');
        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(use.getAttribute('xlink:href')).to.equal('#iconCVVBack');
      });

      it('updates the cvv icon to front icon for amex cards', function () {
        var use = this.element.querySelector('[data-braintree-id="cvv-icon"]').querySelector('use');
        var fakeEvent = {
          cards: [{type: 'american-express'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setPlaceholder: function () {}
        };

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(use.getAttribute('xlink:href')).to.equal('#iconCVVFront');
      });

      it('updates the cvv label descriptor to four digits when card type is amex', function () {
        var cvvLabelDescriptor = this.element.querySelector('[data-braintree-id="cvv-container"]').querySelector('.braintree-form__descriptor');
        var fakeEvent = {
          cards: [{type: 'american-express'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setPlaceholder: function () {}
        };

        cvvLabelDescriptor.textContent = 'some value';
        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(cvvLabelDescriptor.textContent).to.equal('(4 digits)');
      });

      it('updates the cvv label descriptor to three digits when card type is non-amex', function () {
        var cvvLabelDescriptor = this.element.querySelector('[data-braintree-id="cvv-container"]').querySelector('.braintree-form__descriptor');
        var fakeEvent = {
          cards: [{type: 'visa'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setPlaceholder: function () {}
        };

        cvvLabelDescriptor.textContent = 'some value';
        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(cvvLabelDescriptor.textContent).to.equal('(3 digits)');
      });

      it('updates the cvv label descriptor to three digits when multiple card types', function () {
        var cvvLabelDescriptor = this.element.querySelector('[data-braintree-id="cvv-container"]').querySelector('.braintree-form__descriptor');
        var fakeEvent = {
          cards: [{type: 'american-express'}, {type: 'visa'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setPlaceholder: function () {}
        };

        cvvLabelDescriptor.textContent = 'some value';
        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(cvvLabelDescriptor.textContent).to.equal('(3 digits)');
      });

      it('updates the cvv field placeholder when card type is amex', function () {
        var fakeEvent = {
          cards: [{type: 'american-express'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setPlaceholder: this.sandbox.spy()
        };

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(hostedFieldsInstance.setPlaceholder).to.have.been.calledWith('cvv', '••••');
      });

      it('updates the cvv field placeholder when card type is non-amex', function () {
        var fakeEvent = {
          cards: [{type: 'visa'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setPlaceholder: this.sandbox.spy()
        };

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(hostedFieldsInstance.setPlaceholder).to.have.been.calledWith('cvv', '•••');
      });

      it('updates the cvv field placeholder when multiple card types', function () {
        var fakeEvent = {
          cards: [{type: 'american-express'}, {type: 'visa'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setPlaceholder: this.sandbox.spy()
        };

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(hostedFieldsInstance.setPlaceholder).to.have.been.calledWith('cvv', '•••');
      });
    });

    describe('onValidityChangeEvent', function () {
      beforeEach(function () {
        this.context._onValidityChangeEvent = CardView.prototype._onValidityChangeEvent;
      });

      it('shows an inline error if a field is invalid', function () {
        var numberInlineError = this.element.querySelector('[data-braintree-id="number-inline-error"]');
        var fakeEvent = {
          emittedBy: 'number',
          fields: {
            number: {
              isValid: false,
              isPotentiallyValid: false
            }
          }
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent)
        };

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(numberInlineError.classList.contains('braintree-hidden')).to.be.false;
        expect(numberInlineError.textContent).to.equal('This card number is not valid.');
      });

      it('hides the inline error if a field is potentially valid', function () {
        var numberInlineError = this.element.querySelector('[data-braintree-id="number-inline-error"]');
        var fakeEvent = {
          emittedBy: 'number',
          fields: {
            number: {
              isValid: false,
              isPotentiallyValid: true
            }
          }
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent)
        };

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(numberInlineError.classList.contains('braintree-hidden')).to.be.true;
        expect(numberInlineError.textContent).to.equal('');
      });
    });

    describe('onNotEmptyEvent', function () {
      beforeEach(function () {
        this.context._onNotEmptyEvent = CardView.prototype._onNotEmptyEvent;
      });

      it('hides inline errors', function () {
        var numberInlineError = this.element.querySelector('[data-braintree-id="number-inline-error"]');
        var fakeEvent = {emittedBy: 'number'};
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent)
        };

        classlist.remove(numberInlineError, 'braintree-hidden');

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(numberInlineError.classList.contains('braintree-hidden')).to.be.true;
        expect(numberInlineError.textContent).to.equal('');
      });
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
      this.model = new DropinModel(fake.modelOptions());

      this.context = {
        element: this.element,
        getElementById: BaseView.prototype.getElementById,
        hostedFieldsInstance: this.fakeHostedFieldsInstance,
        inlineErrors: {},
        model: this.model,
        client: {
          getConfiguration: fake.configuration
        },
        merchantConfiguration: {
          authorization: fake.configuration().authorization
        },
        showInlineError: CardView.prototype.showInlineError,
        strings: strings
      };
    });

    it('throws an error if there is no valid card type', function (done) {
      this.context.hostedFieldsInstance.getState.returns({
        cards: [],
        fields: {
          number: {
            isValid: true
          },
          expirationDate: {
            isValid: false
          }
        }
      });

      CardView.prototype.tokenize.call(this.context, function (err, payload) {
        expect(err).to.exist;
        expect(payload).to.not.exist;
        expect(this.fakeHostedFieldsInstance.tokenize).to.not.be.called;
        done();
      }.bind(this));
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

      CardView.prototype.tokenize.call(this.context, function () {});

      expect(this.fakeHostedFieldsInstance.tokenize).to.not.be.called;
    });

    it('reports an error to DropinModel when Hosted Fields tokenization returns an error', function () {
      var fakeError = {
        code: 'A_REAL_ERROR_CODE'
      };

      this.context.hostedFieldsInstance.tokenize.yields(fakeError, null);
      this.sandbox.stub(this.context.model, 'reportError');

      CardView.prototype.tokenize.call(this.context, function () {});

      expect(this.context.model.reportError).to.be.calledWith(fakeError);
    });

    it('reports an error to DropinModel when Hosted Fields returns a tokenization failure error', function () {
      var fakeError = {
        code: 'HOSTED_FIELDS_FAILED_TOKENIZATION'
      };

      this.context.hostedFieldsInstance.tokenize.yields(fakeError, null);
      this.sandbox.stub(this.context.model, 'reportError');

      CardView.prototype.tokenize.call(this.context, function () {});

      expect(this.context.model.reportError).to.be.calledWith(fakeError);
    });

    it('reports an error to DropinModel when Hosted Fields returns a fields invalid error', function () {
      var fakeError = {
        code: 'HOSTED_FIELDS_FIELDS_INVALID'
      };

      this.context.hostedFieldsInstance.tokenize.yields(fakeError, null);
      this.sandbox.stub(this.context.model, 'reportError');

      CardView.prototype.tokenize.call(this.context, function () {});

      expect(this.context.model.reportError).to.be.calledWith(fakeError);
    });

    it('clears previous errors', function () {
      this.sandbox.stub(this.context.model, 'clearError');

      CardView.prototype.tokenize.call(this.context, function () {});

      expect(this.context.model.clearError).to.be.called;
    });

    it('shows unsupported card inline error when attempting to use an unsupported card', function () {
      var numberInlineError = this.element.querySelector('[data-braintree-id="number-inline-error"]');

      this.context.client.getConfiguration = function () {
        return {
          gatewayConfiguration: {
            creditCards: {
              supportedCardTypes: ['Foo Pay']
            }
          }
        };
      };

      CardView.prototype.tokenize.call(this.context, function () {});

      expect(numberInlineError.classList.contains('braintree-hidden')).to.be.false;
      expect(numberInlineError.textContent).to.equal('This card type is not supported. Please try another card.');
      expect(this.context.hostedFieldsInstance.tokenize).to.not.be.called;
    });

    it('shows empty inline error when attempting to sumbit an empty field', function () {
      var numberInlineError = this.element.querySelector('[data-braintree-id="number-inline-error"]');

      this.context.hostedFieldsInstance.getState.returns({
        cards: [{type: 'visa'}],
        fields: {
          number: {
            isEmpty: true,
            isValid: false
          },
          expirationDate: {
            isValid: true
          }
        }
      });

      CardView.prototype.tokenize.call(this.context, function () {});

      expect(numberInlineError.classList.contains('braintree-hidden')).to.be.false;
      expect(numberInlineError.textContent).to.equal('Please fill out a number.');
      expect(this.context.hostedFieldsInstance.tokenize).to.not.be.called;
    });

    it('shows invalid inline error when attempting to sumbit an invalid field', function () {
      var numberInlineError = this.element.querySelector('[data-braintree-id="number-inline-error"]');

      this.context.hostedFieldsInstance.getState.returns({
        cards: [{type: 'visa'}],
        fields: {
          number: {
            isValid: false
          },
          expirationDate: {
            isValid: true
          }
        }
      });

      CardView.prototype.tokenize.call(this.context, function () {});

      expect(numberInlineError.classList.contains('braintree-hidden')).to.be.false;
      expect(numberInlineError.textContent).to.equal('This card number is not valid.');
      expect(this.context.hostedFieldsInstance.tokenize).to.not.be.called;
    });

    it('calls beginLoading when form is valid', function () {
      this.context.model.beginLoading = this.sandbox.stub();

      CardView.prototype.tokenize.call(this.context, function () {});

      expect(this.context.model.beginLoading).to.have.been.calledOnce;
    });

    it('does not call beginLoading if form is invalid', function () {
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
      this.context.model.beginLoading = this.sandbox.stub();

      CardView.prototype.tokenize.call(this.context, function () {});

      expect(this.context.model.beginLoading).to.not.be.called;
    });

    it('vaults on tokenization if not using guest checkout', function () {
      var fakeClientToken = fake.configuration().gatewayConfiguration;

      fakeClientToken.authorizationFingerprint = 'auth_fingerprint&customer_id=abc123';
      fakeClientToken = btoa(JSON.stringify(fakeClientToken));
      this.context.merchantConfiguration.authorization = fakeClientToken;

      CardView.prototype.tokenize.call(this.context, function () {});

      expect(this.context.hostedFieldsInstance.tokenize).to.have.been.calledWith({vault: true}, this.sandbox.match.func);
    });

    it('does not vault on tokenization if using guest checkout', function () {
      this.context.merchantConfiguration.authorization = 'fake_tokenization_key';

      CardView.prototype.tokenize.call(this.context, function () {});

      expect(this.context.hostedFieldsInstance.tokenize).to.have.been.calledWith({vault: false}, this.sandbox.match.func);
    });

    it('clears fields after successful tokenization', function () {
      this.context.hostedFieldsInstance.tokenize.yields(null, {nonce: 'foo'});

      CardView.prototype.tokenize.call(this.context, function () {});

      expect(this.context.hostedFieldsInstance.clear).to.have.been.calledWith('number');
      expect(this.context.hostedFieldsInstance.clear).to.have.been.calledWith('expirationDate');
      expect(this.context.hostedFieldsInstance.clear).not.to.have.been.calledWith('cvv');
      expect(this.context.hostedFieldsInstance.clear).not.to.have.been.calledWith('postalCode');
    });

    it('calls endLoading after successful tokenization', function () {
      var stubPayload = {};

      this.sandbox.stub(this.context.model, 'endLoading');
      this.context.hostedFieldsInstance.tokenize = this.sandbox.stub().yields(null, stubPayload);

      CardView.prototype.tokenize.call(this.context, function () {});

      expect(this.context.model.endLoading).to.have.been.calledOnce;
    });

    it('calls endLoading after tokenization fails', function () {
      this.sandbox.stub(this.context.model, 'endLoading');
      this.context.hostedFieldsInstance.tokenize.yields(new Error('foo'));

      CardView.prototype.tokenize.call(this.context, function () {});

      expect(this.context.model.endLoading).to.have.been.calledOnce;
    });

    it('adds a new payment method when tokenize is successful', function () {
      var stubPayload = {};

      this.context.hostedFieldsInstance.tokenize = this.sandbox.stub().yields(null, stubPayload);
      this.sandbox.stub(this.model, 'addPaymentMethod');

      CardView.prototype.tokenize.call(this.context, function () {});

      expect(this.model.addPaymentMethod).to.have.been.calledWith(stubPayload);
    });

    it('does not update the active payment method when tokenize fails', function () {
      this.context.hostedFieldsInstance.tokenize = this.sandbox.stub().yields(new Error('bad happen'));
      this.sandbox.stub(this.model, 'addPaymentMethod');

      CardView.prototype.tokenize.call(this.context, function () {});

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
      CardView.prototype.teardown.call(this.context, function () {
        expect(this.context.hostedFieldsInstance.teardown).to.be.calledOnce;
        done();
      }.bind(this));
    });

    it('passes hosted fields teardown errors to callback', function (done) {
      var error = new Error('hosted fields teardown error');

      this.context.hostedFieldsInstance.teardown.yields(error);

      CardView.prototype.teardown.call(this.context, function (err) {
        expect(err).to.equal(error);
        done();
      });
    });
  });
});
