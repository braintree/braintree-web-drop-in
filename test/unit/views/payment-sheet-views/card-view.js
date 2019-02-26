'use strict';

var BaseView = require('../../../../src/views/base-view');
var CardView = require('../../../../src/views/payment-sheet-views/card-view');
var classList = require('@braintree/class-list');
var DropinModel = require('../../../../src/dropin-model');
var fake = require('../../../helpers/fake');
var fs = require('fs');
var hostedFields = require('braintree-web/hosted-fields');
var strings = require('../../../../src/translations/en_US');
var transitionHelper = require('../../../../src/lib/transition-helper');

var mainHTML = fs.readFileSync(__dirname + '/../../../../src/html/main.html', 'utf8');
var CHANGE_ACTIVE_PAYMENT_METHOD_TIMEOUT = require('../../../../src/constants').CHANGE_ACTIVE_PAYMENT_METHOD_TIMEOUT;

function throwIfResolves() {
  throw new Error('should not resolve.');
}

describe('CardView', function () {
  beforeEach(function () {
    this.div = document.createElement('div');

    this.div.innerHTML = mainHTML;
    document.body.appendChild(this.div);
    this.element = document.body.querySelector('.braintree-sheet.braintree-card');

    this.client = fake.client();
  });

  describe('Constructor', function () {
    it('inherits from BaseView', function () {
      expect(new CardView({element: this.element})).to.be.an.instanceOf(BaseView);
    });
  });

  describe('initialize', function () {
    beforeEach(function () {
      this.hostedFieldsInstance = {
        on: this.sandbox.spy()
      };
      this.sandbox.stub(hostedFields, 'create').resolves(this.hostedFieldsInstance);

      this.model = fake.model();

      return this.model.initialize();
    });

    it('has cvv if supplied in challenges', function () {
      this.client.getConfiguration.returns({
        gatewayConfiguration: {
          challenges: ['cvv'],
          creditCards: {
            supportedCardTypes: []
          }
        }
      });

      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        expect(this.element.querySelector('[data-braintree-id="cvv-field-group"]')).to.exist;
      }.bind(this));
    });

    it('does not have cvv if supplied in challenges, but hosted fields overrides sets cvv to null', function () {
      this.client.getConfiguration.returns({
        gatewayConfiguration: {
          challenges: ['cvv'],
          creditCards: {
            supportedCardTypes: []
          }
        }
      });

      this.model.merchantConfiguration.card = {
        overrides: {
          fields: {
            cvv: null
          }
        }
      };

      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        expect(this.element.querySelector('[data-braintree-id="cvv-field-group"]')).not.to.exist;
      }.bind(this));
    });

    it('does not have cvv if not supplied in challenges', function () {
      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        expect(this.element.querySelector('[data-braintree-id="cvv-field-group"]')).not.to.exist;
      }.bind(this));
    });

    it('has postal code if supplied in challenges', function () {
      this.client.getConfiguration.returns({
        gatewayConfiguration: {
          challenges: ['postal_code'],
          creditCards: {
            supportedCardTypes: []
          }
        }
      });

      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        expect(this.element.querySelector('[data-braintree-id="postal-code-field-group"]')).to.exist;
      }.bind(this));
    });

    it('does not have postal code if supplied in challenges, but hosted fields overrides sets postal code to null', function () {
      this.client.getConfiguration.returns({
        gatewayConfiguration: {
          challenges: ['postal_code'],
          creditCards: {
            supportedCardTypes: []
          }
        }
      });

      this.model.merchantConfiguration.card = {
        overrides: {
          fields: {
            postalCode: null
          }
        }
      };

      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        expect(this.element.querySelector('[data-braintree-id="postal-code-field-group"]')).not.to.exist;
      }.bind(this));
    });

    it('does not have postal code if not supplied in challenges', function () {
      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        expect(this.element.querySelector('[data-braintree-id="postal-code-field-group"]')).not.to.exist;
      }.bind(this));
    });

    it('has cardholderName if provided in merchant configuration', function () {
      this.model.merchantConfiguration.card = {
        cardholderName: true
      };

      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        expect(this.element.querySelector('[data-braintree-id="cardholder-name-field-group"]')).to.exist;
      }.bind(this));
    });

    it('does not include cardholderName if not provided in merchant configuration', function () {
      this.model.merchantConfiguration.card = {};

      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        expect(this.element.querySelector('[data-braintree-id="cardholder-name-field-group"]')).to.not.exist;
      }.bind(this));
    });

    it('removes hidden class from save card input if configured', function () {
      this.model.merchantConfiguration.card = {
        vault: {
          showSaveCardToggle: true
        }
      };
      this.model.isGuestCheckout = false;

      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        expect(this.element.querySelector('[data-braintree-id="save-card-field-group"]').className).to.not.include('braintree-hidden');
      }.bind(this));
    });

    it('does not remove hidden class from save card input if not configured', function () {
      this.model.merchantConfiguration.card = {};
      this.model.isGuestCheckout = false;

      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        expect(this.element.querySelector('[data-braintree-id="save-card-field-group"]').className).to.include('braintree-hidden');
      }.bind(this));
    });

    it('sets checked value for save card input', function () {
      this.model.merchantConfiguration.card = {
        vault: {
          defaultValueForVaulting: false
        }
      };

      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        expect(this.view.saveCardInput.checked).to.equal(false);
      }.bind(this));
    });

    it('defaults checked value for save card input to true', function () {
      this.model.merchantConfiguration.card = {};

      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        expect(this.view.saveCardInput.checked).to.equal(true);
      }.bind(this));
    });

    it('starts async dependency', function () {
      this.sandbox.spy(DropinModel.prototype, 'asyncDependencyStarting');

      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        expect(DropinModel.prototype.asyncDependencyStarting).to.be.calledOnce;
      });
    });

    it('notifies async dependency is ready when Hosted Fields is created', function () {
      this.sandbox.spy(DropinModel.prototype, 'asyncDependencyReady');

      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        expect(DropinModel.prototype.asyncDependencyReady).to.be.calledOnce;
      });
    });

    it('creates Hosted Fields with number and expiration date', function () {
      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        expect(hostedFields.create).to.be.calledWith(this.sandbox.match({
          client: this.client,
          fields: {
            number: {},
            expirationDate: {}
          }
        }));
        expect(hostedFields.create.lastCall.args[0]).not.to.have.deep.property('fields.cvv');
        expect(hostedFields.create.lastCall.args[0]).not.to.have.deep.property('fields.postalCode');
      }.bind(this));
    });

    it('creates Hosted Fields with cvv if included in challenges', function () {
      this.client.getConfiguration.returns({
        gatewayConfiguration: {
          challenges: ['cvv'],
          creditCards: {
            supportedCardTypes: []
          }
        }
      });

      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings,
        merchantConfiguration: {
          authorization: fake.clientToken
        }
      });

      return this.view.initialize().then(function () {
        expect(hostedFields.create.lastCall.args[0].fields).to.have.property('cvv');
      });
    });

    it('creates Hosted Fields with postal code if included in challenges', function () {
      this.client.getConfiguration.returns({
        gatewayConfiguration: {
          challenges: ['postal_code'],
          creditCards: {
            supportedCardTypes: []
          }
        }
      });

      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings,
        merchantConfiguration: {
          authorization: fake.clientToken
        }
      });

      return this.view.initialize().then(function () {
        expect(hostedFields.create.lastCall.args[0].fields).to.have.property('postalCode');
      });
    });

    it('calls asyncDependencyFailed with an error when Hosted Fields creation fails', function () {
      var fakeError = {
        code: 'A_REAL_ERROR_CODE'
      };

      hostedFields.create.rejects(fakeError);
      this.sandbox.stub(this.model, 'asyncDependencyFailed');

      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        expect(this.model.asyncDependencyFailed).to.be.calledWith({
          view: 'card',
          error: fakeError
        });
      }.bind(this));
    });

    it('shows supported card icons', function () {
      var supportedCardTypes = ['american-express', 'discover', 'jcb', 'master-card', 'visa'];

      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        supportedCardTypes.forEach(function (cardType) {
          var cardIcon = this.element.querySelector('[data-braintree-id="' + cardType + '-card-icon"]');

          expect(cardIcon.classList.contains('braintree-hidden')).to.be.false;
        }.bind(this));
      }.bind(this));
    });

    it('hides unsupported card icons', function () {
      var unsupportedCardTypes = ['maestro', 'diners-club'];

      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        unsupportedCardTypes.forEach(function (cardType) {
          var cardIcon = this.element.querySelector('[data-braintree-id="' + cardType + '-card-icon"]');

          expect(cardIcon.classList.contains('braintree-hidden')).to.be.true;
        }.bind(this));
      }.bind(this));
    });

    it('does not show UnionPay icon even if it is supported', function () {
      var unionPayCardIcon;

      this.client.getConfiguration.returns({
        gatewayConfiguration: {
          challenges: [],
          creditCards: {
            supportedCardTypes: ['UnionPay']
          }
        }
      });

      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        unionPayCardIcon = this.element.querySelector('[data-braintree-id="unionpay-card-icon"]');

        expect(unionPayCardIcon.classList.contains('braintree-hidden')).to.be.true;
      }.bind(this));
    });

    it('sets field placeholders', function () {
      var hostedFieldsConfiguredFields;

      this.client.getConfiguration.returns({
        gatewayConfiguration: {
          challenges: ['cvv', 'postal_code'],
          creditCards: {
            supportedCardTypes: []
          }
        }
      });

      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        hostedFieldsConfiguredFields = hostedFields.create.lastCall.args[0].fields;

        expect(hostedFieldsConfiguredFields.number.placeholder).to.equal('•••• •••• •••• ••••');
        expect(hostedFieldsConfiguredFields.expirationDate.placeholder).to.equal(strings.expirationDatePlaceholder);
        expect(hostedFieldsConfiguredFields.cvv.placeholder).to.equal('•••');
        expect(hostedFieldsConfiguredFields.postalCode.placeholder).to.not.exist;
      });
    });

    it('allows overriding field options for hosted fields', function () {
      var hostedFieldsConfiguredFields;

      this.client.getConfiguration.returns({
        gatewayConfiguration: {
          challenges: ['cvv', 'postal_code'],
          creditCards: {
            supportedCardTypes: []
          }
        }
      });
      this.model.merchantConfiguration.card = {
        overrides: {
          fields: {
            number: {
              placeholder: 'placeholder'
            },
            cvv: {
              maxlength: 2
            }
          }
        }
      };

      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        hostedFieldsConfiguredFields = hostedFields.create.lastCall.args[0].fields;

        expect(hostedFieldsConfiguredFields.number.placeholder).to.equal('placeholder');
        expect(hostedFieldsConfiguredFields.cvv.maxlength).to.equal(2);
      });
    });

    it('does not add hosted fields elements for fields that are not present', function () {
      var hostedFieldsConfiguredFields;

      this.model.merchantConfiguration.card = {
        overrides: {
          fields: {
            postalCode: {
              selector: '#postal-code'
            },
            cvv: {
              selector: '#cvv'
            },
            expirationMonth: {
              selector: '#month'
            },
            expirationYear: {
              selector: '#year'
            }
          }
        }
      };

      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        hostedFieldsConfiguredFields = hostedFields.create.lastCall.args[0].fields;

        expect(hostedFieldsConfiguredFields.cvv).to.not.exist;
        expect(hostedFieldsConfiguredFields.postalCode).to.not.exist;
        expect(hostedFieldsConfiguredFields.expirationMonth).to.not.exist;
        expect(hostedFieldsConfiguredFields.expirationYear).to.not.exist;
      });
    });

    it('ignores changes to selector in field options', function () {
      this.model.merchantConfiguration.card = {
        overrides: {
          fields: {
            number: {
              selector: '#some-selector'
            }
          }
        }
      };

      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        var hostedFieldsConfiguredFields = hostedFields.create.lastCall.args[0].fields;

        expect(hostedFieldsConfiguredFields.number.selector).to.not.equal('#some-selector');
      });
    });

    it('allows overriding styles options for hosted fields', function () {
      var hostedFieldsConfiguredStyles;

      this.model.merchantConfiguration.card = {
        overrides: {
          styles: {
            input: {
              background: 'blue',
              color: 'red',
              fontFamily: 'fantasy'
            },
            ':focus': null
          }
        }
      };

      this.view = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      return this.view.initialize().then(function () {
        hostedFieldsConfiguredStyles = hostedFields.create.lastCall.args[0].styles;

        expect(hostedFieldsConfiguredStyles.input.color).to.equal('red');
        expect(hostedFieldsConfiguredStyles.input.background).to.equal('blue');
        expect(hostedFieldsConfiguredStyles.input['font-size']).to.equal('16px');
        expect(hostedFieldsConfiguredStyles.input['font-family']).to.equal('fantasy');
        expect(hostedFieldsConfiguredStyles[':focus']).to.not.exist;
        expect(hostedFieldsConfiguredStyles['input::-ms-clear']).to.deep.equal({
          color: 'transparent'
        });
      });
    });
  });

  describe('isEnabled', function () {
    beforeEach(function () {
      this.fakeOptions = {
        client: this.client
      };
    });

    it('resovles with true when there is at least one supported card type', function () {
      var configuration = fake.configuration();

      configuration.gatewayConfiguration.creditCards.supportedCardTypes = ['visa'];

      this.client.getConfiguration.returns(configuration);

      return CardView.isEnabled(this.fakeOptions).then(function (result) {
        expect(result).to.equal(true);
      });
    });

    it('resovles with false when there are no supported card types', function () {
      var configuration = fake.configuration();

      configuration.gatewayConfiguration.creditCards.supportedCardTypes = [];

      this.client.getConfiguration.returns(configuration);

      return CardView.isEnabled(this.fakeOptions).then(function (result) {
        expect(result).to.equal(false);
      });
    });
  });

  describe('requestPaymentMethod', function () {
    beforeEach(function () {
      this.sandbox.stub(hostedFields, 'create').resolves(fake.hostedFieldsInstance);

      this.model = fake.model();

      return this.model.initialize();
    });

    it('calls the callback with an error when tokenize fails', function () {
      var cardView = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      this.sandbox.stub(cardView, 'tokenize').rejects(new Error('foo'));

      return cardView.requestPaymentMethod().then(throwIfResolves).catch(function (err) {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('foo');
      });
    });

    it('calls the callback with the payload when tokenize is successful', function () {
      var cardView = new CardView({
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      this.sandbox.stub(cardView, 'tokenize').resolves({foo: 'bar'});

      return cardView.requestPaymentMethod().then(function (payload) {
        expect(payload.foo).to.equal('bar');
      });
    });
  });

  describe('Hosted Fields events', function () {
    beforeEach(function () {
      var self = this;
      var model = fake.model();

      return model.initialize().then(function () {
        self.context = {
          element: self.element,
          _generateFieldSelector: CardView.prototype._generateFieldSelector,
          _generateHostedFieldsOptions: CardView.prototype._generateHostedFieldsOptions,
          _validateForm: self.sandbox.stub(),
          _sendRequestableEvent: CardView.prototype._sendRequestableEvent,
          getElementById: BaseView.prototype.getElementById,
          hideFieldError: CardView.prototype.hideFieldError,
          showFieldError: CardView.prototype.showFieldError,
          model: model,
          client: fake.client({
            gatewayConfiguration: {
              challenges: ['cvv'],
              creditCards: {
                supportedCardTypes: []
              }
            }
          }),
          _shouldVault: CardView.prototype._shouldVault,
          saveCardInput: {
            checked: true
          },
          strings: strings,
          tokenize: CardView.prototype.tokenize,
          _hideUnsupportedCardIcons: function () {},
          _isCardTypeSupported: CardView.prototype._isCardTypeSupported,
          _onBlurEvent: function () {},
          _onCardTypeChangeEvent: function () {},
          _onFocusEvent: function () {},
          _onNotEmptyEvent: function () {},
          _onValidityChangeEvent: function () {},
          _setupExtraInput: function () {},
          _removeExtraInput: function () {}
        };
      });
    });

    describe('onFocusEvent', function () {
      beforeEach(function () {
        this.context._onFocusEvent = CardView.prototype._onFocusEvent;
      });

      it('shows default card icon in number field when focused', function () {
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, {emittedBy: 'number'})
        };

        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          var cardNumberIcon = this.element.querySelector('[data-braintree-id="card-number-icon"]');

          expect(cardNumberIcon.classList.contains('braintree-hidden')).to.be.false;
          expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).to.equal('#iconCardFront');
        }.bind(this));
      });

      it('shows default cvv icon in cvv field when focused', function () {
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, {emittedBy: 'cvv'})
        };

        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          var cvvIcon = this.element.querySelector('[data-braintree-id="cvv-icon"]');

          expect(cvvIcon.classList.contains('braintree-hidden')).to.be.false;
          expect(cvvIcon.querySelector('use').getAttribute('xlink:href')).to.equal('#iconCVVBack');
        }.bind(this));
      });

      it('adds braintree-form__field-group--is-focused', function () {
        var fakeEvent = {
          emittedBy: 'number',
          fields: {
            number: {isEmpty: true}
          }
        };
        var hostedFieldsInstance = {
          on: function (event, callback) {
            if (event === 'focus') {
              callback(fakeEvent);
            }
          }
        };
        var numberFieldGroup = this.element.querySelector('[data-braintree-id="number-field-group"]');

        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);
        classList.remove(numberFieldGroup, 'braintree-form__field-group--is-focused');

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--is-focused')).to.be.true;
        });
      });
    });

    describe('onBlurEvent', function () {
      beforeEach(function () {
        this.context._onBlurEvent = CardView.prototype._onBlurEvent;
      });

      it('removes braintree-form__field-group--is-focused class when blurred', function () {
        var fakeEvent = {
          cards: [{type: 'visa'}],
          emittedBy: 'number',
          fields: {
            number: {isEmpty: true}
          }
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setAttribute: this.sandbox.stub()
        };
        var numberFieldGroup = this.element.querySelector('[data-braintree-id="number-field-group"]');

        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);
        classList.add(numberFieldGroup, 'braintree-form__field-group--is-focused');

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--is-focused')).to.be.false;
        });
      });

      it('applies error class if field is not valid', function () {
        var fakeEvent = {
          emittedBy: 'number',
          fields: {
            number: {
              isEmpty: false,
              isValid: false
            }
          }
        };
        var hostedFieldsInstance = {
          on: function (event, callback) {
            if (event === 'blur') {
              callback(fakeEvent);
            }
          },
          setAttribute: this.sandbox.stub()
        };
        var numberFieldError = this.element.querySelector('[data-braintree-id="number-field-error"]');
        var numberFieldGroup = this.element.querySelector('[data-braintree-id="number-field-group"]');

        this.context.client.getConfiguration.returns({
          gatewayConfiguration: {
            challenges: ['cvv'],
            creditCards: {
              supportedCardTypes: ['Visa']
            }
          }
        });

        classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');
        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).to.be.true;
          expect(numberFieldError.textContent).to.equal('This card number is not valid.');
        });
      });

      it('does apply error class if field is empty when focusing another hosted field', function () {
        var fakeHostedField = document.createElement('iframe');
        var fakeEvent = {
          cards: [{type: 'visa'}],
          emittedBy: 'number',
          fields: {
            number: {
              isEmpty: true,
              isValid: false
            }
          }
        };
        var modelOptions = fake.modelOptions();
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setAttribute: this.sandbox.stub()
        };
        var numberFieldGroup = this.element.querySelector('[data-braintree-id="number-field-group"]');
        var numberFieldError = this.element.querySelector('[data-braintree-id="number-field-error"]');

        fakeHostedField.id = 'braintree-hosted-field-foo';
        document.body.appendChild(fakeHostedField);
        fakeHostedField.focus();

        this.context.client.getConfiguration.returns({
          authorization: fake.clientToken,
          authorizationType: 'CLIENT_TOKEN',
          gatewayConfiguration: {
            challenges: ['cvv'],
            creditCards: {
              supportedCardTypes: ['Visa']
            }
          }
        });

        modelOptions.client.getConfiguration = this.context.client.getConfiguration;

        this.context.model = fake.model(modelOptions);

        classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');
        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).to.be.true;
          expect(numberFieldError.textContent).to.equal('Please fill out a card number.');
        });
      });

      it('sets the empty error when programatically focussing a hosted field (requires a setTimeout)', function (done) {
        var fakeElement = document.createElement('div');
        var fakeHostedField = document.createElement('iframe');
        var fakeEvent = {
          cards: [{type: 'visa'}],
          emittedBy: 'number',
          fields: {
            number: {
              isEmpty: true,
              isValid: false
            }
          }
        };
        var modelOptions = fake.modelOptions();
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setAttribute: this.sandbox.stub(),
          setMessage: this.sandbox.stub()
        };
        var numberFieldGroup = this.element.querySelector('[data-braintree-id="number-field-group"]');

        fakeHostedField.id = 'braintree-hosted-field-foo';
        document.body.appendChild(fakeElement);
        document.body.appendChild(fakeHostedField);
        fakeElement.focus();

        this.context.client.getConfiguration.returns({
          authorization: fake.clientToken,
          authorizationType: 'CLIENT_TOKEN',
          gatewayConfiguration: {
            challenges: ['cvv'],
            creditCards: {
              supportedCardTypes: ['Visa']
            }
          }
        });

        modelOptions.client.getConfiguration = this.context.client.getConfiguration;

        this.context.model = fake.model(modelOptions);

        classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');
        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        CardView.prototype.initialize.call(this.context).then(function () {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).to.equal(false);

          fakeHostedField.focus();

          setTimeout(function () {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).to.equal(true);
            done();
          }, 300);
        });
      });

      it('does not apply error class if field is empty and not focusing hosted fields', function () {
        var fakeElement = document.createElement('iframe');
        var fakeEvent = {
          cards: [{type: 'visa'}],
          emittedBy: 'number',
          fields: {
            number: {
              isEmpty: true,
              isValid: false
            }
          }
        };
        var modelOptions = fake.modelOptions();
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent)
        };
        var numberFieldGroup = this.element.querySelector('[data-braintree-id="number-field-group"]');

        document.body.appendChild(fakeElement);
        fakeElement.focus();

        this.context.client.getConfiguration.returns({
          authorization: fake.clientToken,
          authorizationType: 'CLIENT_TOKEN',
          gatewayConfiguration: {
            challenges: ['cvv'],
            creditCards: {
              supportedCardTypes: ['Visa']
            }
          }
        });

        modelOptions.client.getConfiguration = this.context.client.getConfiguration;

        this.context.model = fake.model(modelOptions);

        classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');
        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).to.be.false;
        });
      });

      it('does not apply error class if field is empty and the active element is not an iframe', function () {
        var fakeElement = document.createElement('div');
        var fakeEvent = {
          cards: [{type: 'visa'}],
          emittedBy: 'number',
          fields: {
            number: {
              isEmpty: true,
              isValid: false
            }
          }
        };
        var modelOptions = fake.modelOptions();
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent)
        };
        var numberFieldGroup = this.element.querySelector('[data-braintree-id="number-field-group"]');

        document.body.appendChild(fakeElement);
        fakeElement.focus();

        this.context.client.getConfiguration.returns({
          authorization: fake.clientToken,
          authorizationType: 'CLIENT_TOKEN',
          gatewayConfiguration: {
            challenges: ['cvv'],
            creditCards: {
              supportedCardTypes: ['Visa']
            }
          }
        });

        modelOptions.client.getConfiguration = this.context.client.getConfiguration;

        this.context.model = fake.model(modelOptions);

        classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');
        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).to.be.false;
        });
      });
    });

    describe('onCardTypeChange event', function () {
      beforeEach(function () {
        this.context._onCardTypeChangeEvent = CardView.prototype._onCardTypeChangeEvent;
      });

      it('adds the card-type-known class when there is one possible card type', function () {
        var numberFieldGroup = this.element.querySelector('[data-braintree-id="number-field-group"]');
        var fakeEvent = {
          cards: [{type: 'master-card'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setAttribute: function () {}
        };

        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--card-type-known')).to.be.true;
        });
      });

      it('removes the card-type-known class when there is no possible card type', function () {
        var numberFieldGroup = this.element.querySelector('[data-braintree-id="number-field-group"]');
        var fakeEvent = {
          cards: [],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setAttribute: function () {}
        };

        classList.add(numberFieldGroup, 'braintree-form__field-group--card-type-known');

        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--card-type-known')).to.be.false;
        });
      });

      it('removes the card-type-known class when there are many possible card types', function () {
        var numberFieldGroup = this.element.querySelector('[data-braintree-id="number-field-group"]');
        var fakeEvent = {
          cards: [{type: 'master-card'}, {type: 'foo-pay'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setAttribute: function () {}
        };

        classList.add(numberFieldGroup, 'braintree-form__field-group--card-type-known');

        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--card-type-known')).to.be.false;
        });
      });

      it('updates the card number icon to the card type if there is one possible card type', function () {
        var cardNumberIcon = this.element.querySelector('[data-braintree-id="card-number-icon"]');
        var fakeEvent = {
          cards: [{type: 'master-card'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setAttribute: function () {}
        };

        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).to.equal('#icon-master-card');
        });
      });

      it('updates the card number icon to the generic card if there are many possible card types', function () {
        var cardNumberIcon = this.element.querySelector('[data-braintree-id="card-number-icon"]');
        var fakeEvent = {
          cards: [{type: 'master-card'}, {type: 'foo-pay'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setAttribute: function () {}
        };

        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).to.equal('#iconCardFront');
        });
      });

      it('updates the card icon to the generic card if there no card types', function () {
        var cardNumberIcon = this.element.querySelector('[data-braintree-id="card-number-icon"]');
        var fakeEvent = {
          cards: [],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setAttribute: function () {}
        };

        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).to.equal('#iconCardFront');
        });
      });

      it('updates the cvv icon to back icon for non-amex cards', function () {
        var use = this.element.querySelector('[data-braintree-id="cvv-icon"]').querySelector('use');
        var fakeEvent = {
          cards: [{type: 'visa'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setAttribute: function () {}
        };

        use.setAttribute('xlink:href', '#iconCVVFront');
        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(use.getAttribute('xlink:href')).to.equal('#iconCVVBack');
        });
      });

      it('updates the cvv icon to front icon for amex cards', function () {
        var use = this.element.querySelector('[data-braintree-id="cvv-icon"]').querySelector('use');
        var fakeEvent = {
          cards: [{type: 'american-express'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setAttribute: function () {}
        };

        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(use.getAttribute('xlink:href')).to.equal('#iconCVVFront');
        });
      });

      it('updates the cvv label descriptor to four digits when card type is amex', function () {
        var cvvLabelDescriptor = this.element.querySelector('[data-braintree-id="cvv-field-group"]').querySelector('.braintree-form__descriptor');
        var fakeEvent = {
          cards: [{type: 'american-express'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setAttribute: function () {}
        };

        cvvLabelDescriptor.textContent = 'some value';
        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(cvvLabelDescriptor.textContent).to.equal('(4 digits)');
        });
      });

      it('updates the cvv label descriptor to three digits when card type is non-amex', function () {
        var cvvLabelDescriptor = this.element.querySelector('[data-braintree-id="cvv-field-group"]').querySelector('.braintree-form__descriptor');
        var fakeEvent = {
          cards: [{type: 'visa'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setAttribute: function () {}
        };

        cvvLabelDescriptor.textContent = 'some value';
        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(cvvLabelDescriptor.textContent).to.equal('(3 digits)');
        });
      });

      it('updates the cvv label descriptor to three digits when multiple card types', function () {
        var cvvLabelDescriptor = this.element.querySelector('[data-braintree-id="cvv-field-group"]').querySelector('.braintree-form__descriptor');
        var fakeEvent = {
          cards: [{type: 'american-express'}, {type: 'visa'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setAttribute: function () {}
        };

        cvvLabelDescriptor.textContent = 'some value';
        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(cvvLabelDescriptor.textContent).to.equal('(3 digits)');
        });
      });

      it('updates the cvv field placeholder when card type is amex', function () {
        var fakeEvent = {
          cards: [{type: 'american-express'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setAttribute: this.sandbox.spy()
        };

        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(hostedFieldsInstance.setAttribute).to.have.been.calledWith({field: 'cvv', attribute: 'placeholder', value: '••••'});
        });
      });

      it('updates the cvv field placeholder when card type is non-amex', function () {
        var fakeEvent = {
          cards: [{type: 'visa'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setAttribute: this.sandbox.spy()
        };

        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(hostedFieldsInstance.setAttribute).to.have.been.calledWith({field: 'cvv', attribute: 'placeholder', value: '•••'});
        });
      });

      it('updates the cvv field placeholder when multiple card types', function () {
        var fakeEvent = {
          cards: [{type: 'american-express'}, {type: 'visa'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setAttribute: this.sandbox.spy()
        };

        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(hostedFieldsInstance.setAttribute).to.have.been.calledWith({field: 'cvv', attribute: 'placeholder', value: '•••'});
        });
      });

      it('does not update the cvv field placeholder when there is no cvv challenge', function () {
        var fakeEvent = {
          cards: [{type: 'american-express'}, {type: 'visa'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setAttribute: this.sandbox.spy()
        };

        this.context.client.getConfiguration.returns({
          gatewayConfiguration: {
            challenges: [],
            creditCards: {
              supportedCardTypes: []
            }
          }
        });

        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(hostedFieldsInstance.setAttribute).to.not.have.been.called;
        });
      });

      it('does not update the cvv field placeholder when it is removed with an override', function () {
        var fakeEvent = {
          cards: [{type: 'american-express'}, {type: 'visa'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setAttribute: this.sandbox.spy()
        };

        this.context.model.merchantConfiguration.card = {
          overrides: {
            fields: {
              cvv: null
            }
          }
        };

        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(hostedFieldsInstance.setAttribute).to.not.have.been.called;
        });
      });

      it('does not update the cvv field placeholder when using a custom CVV placeholder', function () {
        var fakeEvent = {
          cards: [{type: 'american-express'}, {type: 'visa'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setAttribute: this.sandbox.spy()
        };

        this.context.model.merchantConfiguration.card = {
          overrides: {
            fields: {
              cvv: {
                placeholder: 'cool custom placeholder'
              }
            }
          }
        };

        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(hostedFieldsInstance.setAttribute).not.to.have.been.called;
        });
      });
    });

    describe('onValidityChangeEvent', function () {
      beforeEach(function () {
        this.context._onValidityChangeEvent = CardView.prototype._onValidityChangeEvent;
      });

      it('removes the braintree-form__field-group--has-error class if a field is potentially valid', function () {
        var fakeEvent = {
          emittedBy: 'number',
          cards: [{type: 'visa'}],
          fields: {
            number: {
              container: document.createElement('div'),
              isEmpty: false,
              isValid: false,
              isPotentiallyValid: true
            }
          }
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          removeAttribute: this.sandbox.stub()
        };
        var numberFieldGroup = this.element.querySelector('[data-braintree-id="number-field-group"]');

        classList.add(numberFieldGroup, 'braintree-form__field-group--has-error');
        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).to.be.false;
        });
      });

      it('adds braintree-form__field--valid class to valid expiration date field', function () {
        var expirationElement = this.element.querySelector('.braintree-form-expiration');
        var fakeEvent = {
          cards: [{type: 'visa'}],
          emittedBy: 'expirationDate',
          fields: {
            expirationDate: {
              container: expirationElement,
              isValid: true,
              isPotentiallyValid: true
            }
          }
        };
        var hostedFieldsInstance = {
          on: function (event, callback) {
            if (event === 'validityChange') {
              callback(fakeEvent);
            }
          },
          removeAttribute: this.sandbox.stub()
        };

        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(expirationElement.classList.contains('braintree-form__field--valid')).to.equal(true);
        });
      });

      it('removes braintree-form__field--valid class to invalid expiration date field', function () {
        var expirationElement = this.element.querySelector('.braintree-form-expiration');
        var fakeEvent = {
          cards: [{type: 'visa'}],
          emittedBy: 'expirationDate',
          fields: {
            expirationDate: {
              container: expirationElement,
              isValid: false,
              isPotentiallyValid: true
            }
          }
        };
        var hostedFieldsInstance = {
          on: function (event, callback) {
            if (event === 'validityChange') {
              callback(fakeEvent);
            }
          },
          removeAttribute: this.sandbox.stub()
        };

        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(expirationElement.classList.contains('braintree-form__field--valid')).to.equal(false);
        });
      });

      it('adds braintree-form__field--valid class to valid number with card type supported', function () {
        var numberElement = this.element.querySelector('.braintree-form-number');
        var fakeEvent = {
          cards: [{type: 'visa'}],
          emittedBy: 'number',
          fields: {
            number: {
              container: numberElement,
              isValid: true,
              isPotentiallyValid: true
            }
          }
        };
        var hostedFieldsInstance = {
          on: function (event, callback) {
            if (event === 'validityChange') {
              callback(fakeEvent);
            }
          },
          removeAttribute: this.sandbox.stub()
        };

        this.context.client.getConfiguration.returns({
          gatewayConfiguration: {
            challenges: ['cvv'],
            creditCards: {
              supportedCardTypes: ['Visa']
            }
          }
        });

        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(numberElement.classList.contains('braintree-form__field--valid')).to.equal(true);
        });
      });

      it('removes braintree-form__field--valid class to valid number without card type supported', function () {
        var numberElement = this.element.querySelector('.braintree-form-number');
        var fakeEvent = {
          cards: [{type: 'foo'}],
          emittedBy: 'number',
          fields: {
            number: {
              container: numberElement,
              isValid: true,
              isPotentiallyValid: true
            }
          }
        };
        var hostedFieldsInstance = {
          on: function (event, callback) {
            if (event === 'validityChange') {
              callback(fakeEvent);
            }
          },
          removeAttribute: this.sandbox.stub()
        };

        this.context.client.getConfiguration.returns({
          gatewayConfiguration: {
            challenges: ['cvv'],
            creditCards: {
              supportedCardTypes: ['Visa']
            }
          }
        });

        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(numberElement.classList.contains('braintree-form__field--valid')).to.equal(false);
        });
      });

      it('removes braintree-form__field--valid class to not valid number with card type supported', function () {
        var numberElement = this.element.querySelector('.braintree-form-number');
        var fakeEvent = {
          cards: [{type: 'visa'}],
          emittedBy: 'number',
          fields: {
            number: {
              container: numberElement,
              isValid: false,
              isPotentiallyValid: true
            }
          }
        };
        var hostedFieldsInstance = {
          on: function (event, callback) {
            if (event === 'validityChange') {
              callback(fakeEvent);
            }
          },
          removeAttribute: this.sandbox.stub()
        };

        this.context.client.getConfiguration.returns({
          gatewayConfiguration: {
            challenges: ['cvv'],
            creditCards: {
              supportedCardTypes: ['Visa']
            }
          }
        });

        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(numberElement.classList.contains('braintree-form__field--valid')).to.equal(false);
        });
      });

      it('calls model.setPaymentMethodRequestable with isRequestable true if form is valid', function () {
        var numberElement = this.element.querySelector('.braintree-form-number');
        var fakeEvent = {
          cards: [{type: 'visa'}],
          emittedBy: 'number',
          fields: {
            number: {
              container: numberElement,
              isValid: false,
              isPotentiallyValid: true
            }
          }
        };

        this.sandbox.stub(this.context, 'hideFieldError');
        this.sandbox.stub(this.context.model, 'setPaymentMethodRequestable');
        this.context._validateForm.returns(true);

        CardView.prototype._onValidityChangeEvent.call(this.context, fakeEvent);

        expect(this.context.model.setPaymentMethodRequestable).to.be.calledOnce;
        expect(this.context.model.setPaymentMethodRequestable).to.be.calledWith({
          isRequestable: true,
          type: 'CreditCard'
        });
      });

      it('calls model.setPaymentMethodRequestable with isRequestable false if form is invalid', function () {
        var numberElement = this.element.querySelector('.braintree-form-number');
        var fakeEvent = {
          cards: [{type: 'visa'}],
          emittedBy: 'number',
          fields: {
            number: {
              container: numberElement,
              isValid: false,
              isPotentiallyValid: true
            }
          }
        };

        this.sandbox.stub(this.context, 'hideFieldError');
        this.sandbox.stub(this.context.model, 'setPaymentMethodRequestable');
        this.context._validateForm.returns(false);

        CardView.prototype._onValidityChangeEvent.call(this.context, fakeEvent);

        expect(this.context.model.setPaymentMethodRequestable).to.be.calledOnce;
        expect(this.context.model.setPaymentMethodRequestable).to.be.calledWith({
          isRequestable: false,
          type: 'CreditCard'
        });
      });

      it('does not call model.setPaymentMethodRequestable if tokenization is in progress', function () {
        var numberElement = this.element.querySelector('.braintree-form-number');
        var fakeEvent = {
          cards: [{type: 'visa'}],
          emittedBy: 'number',
          fields: {
            number: {
              container: numberElement,
              isValid: false,
              isPotentiallyValid: true
            }
          }
        };

        this.context._isTokenizing = true;

        this.sandbox.stub(this.context, 'hideFieldError');
        this.sandbox.stub(this.context.model, 'setPaymentMethodRequestable');
        this.context._validateForm.returns(false);

        CardView.prototype._onValidityChangeEvent.call(this.context, fakeEvent);

        expect(this.context.model.setPaymentMethodRequestable).to.not.be.called;
      });
    });

    describe('onNotEmptyEvent', function () {
      beforeEach(function () {
        this.context._onNotEmptyEvent = CardView.prototype._onNotEmptyEvent;
      });

      it('removes the braintree-form__field-group--has-error class', function () {
        var fakeEvent = {
          emittedBy: 'number',
          cards: [{type: 'visa'}],
          fields: {
            number: {
              container: document.createElement('div'),
              isEmpty: false,
              isValid: false,
              isPotentiallyValid: true
            }
          }
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          removeAttribute: this.sandbox.stub()
        };
        var numberFieldGroup = this.element.querySelector('[data-braintree-id="number-field-group"]');

        classList.add(numberFieldGroup, 'braintree-form__field-group--has-error');
        this.sandbox.stub(hostedFields, 'create').resolves(hostedFieldsInstance);

        return CardView.prototype.initialize.call(this.context).then(function () {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).to.be.false;
        });
      });
    });
  });

  describe('tokenize', function () {
    beforeEach(function () {
      var self = this;

      self.fakeHostedFieldsInstance = {
        clear: self.sandbox.stub(),
        getState: self.sandbox.stub().returns({
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
        removeAttribute: self.sandbox.stub(),
        setAttribute: self.sandbox.stub(),
        setMessage: self.sandbox.stub(),
        tokenize: self.sandbox.stub().resolves({})
      };
      self.model = fake.model();

      return self.model.initialize().then(function () {
        self.context = {
          element: self.element,
          _shouldVault: CardView.prototype._shouldVault,
          saveCardInput: {
            checked: true
          },
          getElementById: BaseView.prototype.getElementById,
          hostedFieldsInstance: self.fakeHostedFieldsInstance,
          fieldErrors: {},
          model: self.model,
          preventUserAction: BaseView.prototype.preventUserAction,
          allowUserAction: BaseView.prototype.allowUserAction,
          _validateForm: CardView.prototype._validateForm,
          _validateExtraInput: CardView.prototype._validateExtraInput,
          _sendRequestableEvent: CardView.prototype._sendRequestableEvent,
          _setupCardholderName: self.sandbox.stub(),
          client: fake.client(),
          merchantConfiguration: {
            authorization: fake.configuration().authorization,
            card: {}
          },
          hasCardholderName: false,
          showFieldError: CardView.prototype.showFieldError,
          strings: strings
        };
        self.sandbox.stub(transitionHelper, 'onTransitionEnd').yields();
      });
    });

    it('clears the error on the model', function () {
      this.sandbox.stub(this.model, 'clearError');
      this.context.hostedFieldsInstance.getState.returns({
        cards: [{type: 'Card'}],
        fields: {
          number: {
            isValid: true
          },
          expirationDate: {
            isValid: false
          }
        }
      });

      return CardView.prototype.tokenize.call(this.context).then(throwIfResolves).catch(function () {
        expect(this.model.clearError).to.be.called;
      }.bind(this));
    });

    it('throws an error if there is no valid card type', function () {
      this.context.hostedFieldsInstance.getState.returns({
        cards: [{type: 'Card'}],
        fields: {
          number: {
            isValid: true
          },
          expirationDate: {
            isValid: false
          }
        }
      });

      return CardView.prototype.tokenize.call(this.context).then(throwIfResolves).catch(function (err) {
        expect(err).to.exist;
        expect(this.fakeHostedFieldsInstance.tokenize).to.not.be.called;
      }.bind(this));
    });

    it('calls callback with error and reports error to DropinModel if form is not valid', function () {
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

      this.sandbox.stub(this.context.model, 'reportError');

      return CardView.prototype.tokenize.call(this.context).then(throwIfResolves).catch(function (err) {
        expect(this.fakeHostedFieldsInstance.tokenize).to.not.be.called;
        expect(this.context.model.reportError).to.be.calledWith('hostedFieldsFieldsInvalidError');
        expect(err.message).to.equal('No payment method is available.');
      }.bind(this));
    });

    it('calls callback with error when cardholder name is required and the input is empty', function () {
      this.context.hostedFieldsInstance.getState.returns({
        cards: [{type: 'visa'}],
        fields: {
          number: {
            isValid: true
          },
          expirationDate: {
            isValid: true
          }
        }
      });
      this.context.cardholderNameInput = {value: ''};
      this.context.extraInputs = [{
        fieldName: 'cardholderName',
        enabled: true,
        required: true,
        validations: [{
          isValid: function (input) { return input.length > 0; },
          error: strings.fieldEmptyForCardholderName
        }]
      }];

      this.sandbox.stub(this.context.model, 'reportError');

      return CardView.prototype.tokenize.call(this.context).then(throwIfResolves).catch(function (err) {
        expect(this.fakeHostedFieldsInstance.tokenize).to.not.be.called;
        expect(this.context.model.reportError).to.be.calledWith('hostedFieldsFieldsInvalidError');
        expect(err.message).to.equal('No payment method is available.');
      }.bind(this));
    });

    it('does not error if cardholder name is empty, but not required', function () {
      this.context.hostedFieldsInstance.getState.returns({
        cards: [{type: 'visa'}],
        fields: {
          number: {
            isValid: true
          },
          expirationDate: {
            isValid: true
          }
        }
      });
      this.context.hasCardholderName = true;
      this.context.model.merchantConfiguration.card = {
        cardholderName: {
          required: false
        }
      };
      this.context.cardholderNameInput = {value: ''};

      this.sandbox.stub(this.context.model, 'reportError');

      return CardView.prototype.tokenize.call(this.context).then(function () {
        expect(this.context.model.reportError).to.not.be.called;
        expect(this.fakeHostedFieldsInstance.tokenize).to.be.calledOnce;
      }.bind(this));
    });

    it('does not error if cardholder name is not included', function () {
      this.context.hostedFieldsInstance.getState.returns({
        cards: [{type: 'visa'}],
        fields: {
          number: {
            isValid: true
          },
          expirationDate: {
            isValid: true
          }
        }
      });
      this.context.hasCardholderName = false;
      this.sandbox.stub(this.context.model, 'reportError');

      return CardView.prototype.tokenize.call(this.context).then(function () {
        expect(this.context.model.reportError).to.not.be.called;
        expect(this.fakeHostedFieldsInstance.tokenize).to.be.calledOnce;
      }.bind(this));
    });

    it('calls callback with error when cardholder name length is over 255 characters', function () {
      var overLengthValue = Array(256).join('a');

      this.context.hostedFieldsInstance.getState.returns({
        cards: [{type: 'visa'}],
        fields: {
          number: {
            isValid: true
          },
          expirationDate: {
            isValid: true
          }
        }
      });
      this.context.hasCardholderName = true;
      this.context.model.merchantConfiguration.card = {
        cardholderName: true
      };
      this.context.cardholderNameInput = {
        value: overLengthValue
      };
      this.context.extraInputs = [{
        fieldName: 'cardholderName',
        enabled: true,
        required: true,
        validations: [{
          isValid: function (input) { return input.length > 0; },
          error: strings.fieldEmptyForCardholderName
        }, {
          isValid: function (input) { return input.length < 256; },
          error: strings.fieldTooLongForCardholderName
        }]
      }];

      this.sandbox.stub(this.context.model, 'reportError');

      return CardView.prototype.tokenize.call(this.context).then(throwIfResolves).catch(function (err) {
        expect(this.fakeHostedFieldsInstance.tokenize).to.not.be.called;
        expect(this.context.model.reportError).to.be.calledWith('hostedFieldsFieldsInvalidError');
        expect(err.message).to.equal('No payment method is available.');
      }.bind(this));
    });

    it('reports an error to DropinModel when Hosted Fields tokenization returns an error', function () {
      var fakeError = {
        code: 'A_REAL_ERROR_CODE'
      };

      this.context.hostedFieldsInstance.tokenize.rejects(fakeError);
      this.sandbox.stub(this.context.model, 'reportError');

      return CardView.prototype.tokenize.call(this.context).then(throwIfResolves).catch(function () {
        expect(this.context.model.reportError).to.be.calledWith(fakeError);
      }.bind(this));
    });

    it('reports a duplicate card error to DropinModel when tokenization returns an error', function () {
      var fakeError = {code: 'HOSTED_FIELDS_TOKENIZATION_FAIL_ON_DUPLICATE'};

      this.context.hostedFieldsInstance.tokenize.rejects(fakeError);
      this.sandbox.stub(this.context.model, 'reportError');

      return CardView.prototype.tokenize.call(this.context).then(throwIfResolves).catch(function () {
        expect(this.context.model.reportError).to.be.calledWith(fakeError);
      }.bind(this));
    });

    it('shows unsupported card field error when attempting to use an unsupported card and reports an error', function () {
      var numberFieldError = this.element.querySelector('[data-braintree-id="number-field-error"]');

      this.sandbox.stub(this.context.model, 'reportError');

      this.context.client.getConfiguration.returns({
        gatewayConfiguration: {
          creditCards: {
            supportedCardTypes: ['Foo Pay']
          }
        }
      });

      return CardView.prototype.tokenize.call(this.context).then(throwIfResolves).catch(function () {
        expect(numberFieldError.classList.contains('braintree-hidden')).to.be.false;
        expect(numberFieldError.textContent).to.equal('This card type is not supported. Please try another card.');
        expect(this.context.model.reportError).to.be.calledWith('hostedFieldsFieldsInvalidError');
        expect(this.context.hostedFieldsInstance.tokenize).to.not.be.called;
      }.bind(this));
    });

    it('shows empty field error when attempting to sumbit an empty field', function () {
      var numberFieldError = this.element.querySelector('[data-braintree-id="number-field-error"]');

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

      return CardView.prototype.tokenize.call(this.context).then(throwIfResolves).catch(function () {
        expect(numberFieldError.classList.contains('braintree-hidden')).to.be.false;
        expect(numberFieldError.textContent).to.equal('Please fill out a card number.');
        expect(this.context.hostedFieldsInstance.tokenize).to.not.be.called;
      }.bind(this));
    });

    it('shows invalid field error when attempting to submit an invalid field', function () {
      var numberFieldError = this.element.querySelector('[data-braintree-id="number-field-error"]');

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

      return CardView.prototype.tokenize.call(this.context).then(throwIfResolves).catch(function () {
        expect(numberFieldError.classList.contains('braintree-hidden')).to.be.false;
        expect(numberFieldError.textContent).to.equal('This card number is not valid.');
        expect(this.context.hostedFieldsInstance.tokenize).to.not.be.called;
      }.bind(this));
    });

    it('sets the aria-invalid attribute and set message when a field error is shown', function () {
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

      CardView.prototype.showFieldError.call(this.context, 'number', 'Example error message');

      expect(this.context.hostedFieldsInstance.setAttribute).to.be.calledWith({
        field: 'number',
        attribute: 'aria-invalid',
        value: true
      });
      expect(this.context.hostedFieldsInstance.setMessage).to.be.calledWith({
        field: 'number',
        message: 'Example error message'
      });
    });

    it('sets the aria-invalid attribute on an input when a field error is hidden', function () {
      var input = {
        id: {
          indexOf: function () {
            return 1;
          }
        },
        setAttribute: this.sandbox.stub()
      };
      var fieldGroup = {
        querySelector: function () {
          return input;
        }
      };

      this.context.getElementById = this.sandbox.stub().returns(fieldGroup);
      this.sandbox.stub(classList, 'add');

      CardView.prototype.showFieldError.call(this.context, 'foo');

      expect(input.setAttribute).to.be.calledWith('aria-invalid', true);
    });

    it('removes the aria-invalid attribute and message when a field error is hidden', function () {
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

      CardView.prototype.hideFieldError.call(this.context, 'number');

      expect(this.context.hostedFieldsInstance.removeAttribute).to.be.calledWith({
        field: 'number',
        attribute: 'aria-invalid'
      });
      expect(this.context.hostedFieldsInstance.setMessage).to.be.calledWith({
        field: 'number',
        message: ''
      });
    });

    it('removes the aria-invalid attribute on an input when a field error is hidden', function () {
      var input = {
        id: {
          indexOf: function () {
            return 1;
          }
        },
        removeAttribute: this.sandbox.stub()
      };
      var fieldGroup = {
        querySelector: function () {
          return input;
        }
      };

      this.context.getElementById = this.sandbox.stub().returns(fieldGroup);
      this.sandbox.stub(classList, 'remove');

      CardView.prototype.hideFieldError.call(this.context, 'foo');

      expect(input.removeAttribute).to.be.calledWith('aria-invalid');
    });

    it('calls hostedFieldsInstance.tokenize when form is valid', function () {
      return CardView.prototype.tokenize.call(this.context).then(function () {
        expect(this.context.hostedFieldsInstance.tokenize).to.have.been.calledOnce;
      }.bind(this));
    });

    it('includes `vaulted: true` in tokenization payload if not guest checkout', function () {
      this.context.model.isGuestCheckout = false;

      return CardView.prototype.tokenize.call(this.context).then(function (payload) {
        expect(payload.vaulted).to.equal(true);
      });
    });

    it('does not include `vaulted: true` in tokenization payload if save card input is not checked', function () {
      this.context.model.isGuestCheckout = false;
      this.context.saveCardInput.checked = false;

      return CardView.prototype.tokenize.call(this.context).then(function (payload) {
        expect(payload.vaulted).to.not.exist;
      });
    });

    it('does not include `vaulted: true` in tokenization payload if guest checkout', function () {
      this.context.model.isGuestCheckout = true;

      return CardView.prototype.tokenize.call(this.context).then(function (payload) {
        expect(payload.vaulted).to.not.exist;
      });
    });

    it('sets isTokenizing to true', function () {
      CardView.prototype.tokenize.call(this.context);

      expect(this.context._isTokenizing).to.equal(true);
    });

    it('does not call hostedFieldsInstance.tokenize if form is invalid', function () {
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

      return CardView.prototype.tokenize.call(this.context).then(throwIfResolves).catch(function () {
        expect(this.context.hostedFieldsInstance.tokenize).to.not.be.called;
      }.bind(this));
    });

    it('vaults on tokenization if not using guest checkout', function () {
      this.context.model.isGuestCheckout = false;

      return CardView.prototype.tokenize.call(this.context).then(function () {
        expect(this.context.hostedFieldsInstance.tokenize).to.have.been.calledWith({vault: true});
      }.bind(this));
    });

    it('does not vault on tokenization if save card input is not checked', function () {
      this.context.model.isGuestCheckout = false;
      this.context.saveCardInput.checked = false;

      return CardView.prototype.tokenize.call(this.context).then(function () {
        expect(this.context.hostedFieldsInstance.tokenize).to.have.been.calledWith({vault: false});
      }.bind(this));
    });

    it('does not vault on tokenization if using guest checkout', function () {
      this.context.model.isGuestCheckout = true;

      return CardView.prototype.tokenize.call(this.context).then(function () {
        expect(this.context.hostedFieldsInstance.tokenize).to.have.been.calledWith({vault: false});
      }.bind(this));
    });

    it('clears fields after successful tokenization', function () {
      this.context.hostedFieldsInstance.tokenize.resolves({nonce: 'foo'});

      return CardView.prototype.tokenize.call(this.context).then(function () {
        expect(this.context.hostedFieldsInstance.clear).to.have.been.calledWith('number');
        expect(this.context.hostedFieldsInstance.clear).to.have.been.calledWith('expirationDate');
        expect(this.context.hostedFieldsInstance.clear).not.to.have.been.calledWith('cvv');
        expect(this.context.hostedFieldsInstance.clear).not.to.have.been.calledWith('postalCode');
      }.bind(this));
    });

    it('clears cardholder name field if it exists after successful tokenization', function () {
      this.context.hostedFieldsInstance.tokenize.resolves({nonce: 'foo'});
      this.context.hasCardholderName = true;
      this.context.cardholderNameInput = {
        value: 'Some value'
      };

      return CardView.prototype.tokenize.call(this.context).then(function () {
        expect(this.context.cardholderNameInput.value).to.equal('');
      }.bind(this));
    });

    it('does not clear fields after successful tokenization if merchant configuration includes clearFieldsAfterTokenization as false', function () {
      this.context.merchantConfiguration = {
        clearFieldsAfterTokenization: false
      };
      this.context.hostedFieldsInstance.tokenize.resolves({nonce: 'foo'});

      return CardView.prototype.tokenize.call(this.context).then(function () {
        expect(this.context.hostedFieldsInstance.clear).to.not.be.called;
      }.bind(this));
    });

    it('does not clear cardholder name field after successful tokenization if merchant configuration includes clearFieldsAfterTokenization as false', function () {
      this.context.merchantConfiguration = {
        clearFieldsAfterTokenization: false
      };
      this.context.hasCardholderName = true;
      this.context.cardholderNameInput = {
        value: 'Some value'
      };
      this.context.hostedFieldsInstance.tokenize.resolves({nonce: 'foo'});

      return CardView.prototype.tokenize.call(this.context).then(function () {
        expect(this.context.cardholderNameInput.value).to.equal('Some value');
      }.bind(this));
    });

    it('sets isTokenizing to false on successful tokenization', function (done) {
      this.context.hostedFieldsInstance.tokenize.resolves({nonce: 'foo'});

      CardView.prototype.tokenize.call(this.context).then(function () {
        setTimeout(function () {
          expect(this.context._isTokenizing).to.equal(false);
          done();
        }.bind(this), 300);
      }.bind(this));
    });

    it('sets isTokenizing to false on unsuccessful tokenization', function () {
      this.context.hostedFieldsInstance.tokenize.rejects(new Error('Error'));

      return CardView.prototype.tokenize.call(this.context).then(throwIfResolves).catch(function () {
        expect(this.context._isTokenizing).to.equal(false);
      }.bind(this));
    });

    it('removes braintree-sheet--loading class after successful tokenization', function (done) {
      var stubPayload = {};

      this.sandbox.stub(classList, 'remove');
      this.context.hostedFieldsInstance.tokenize.resolves(stubPayload);

      CardView.prototype.tokenize.call(this.context).then(function () {
        setTimeout(function () {
          expect(classList.remove).to.have.been.calledWith(this.context.element, 'braintree-sheet--loading');
          done();
        }.bind(this), CHANGE_ACTIVE_PAYMENT_METHOD_TIMEOUT);
      }.bind(this));
    });

    it('removes braintree-sheet--loading class after tokenization fails', function () {
      this.sandbox.stub(classList, 'remove');
      this.context.hostedFieldsInstance.tokenize.rejects(new Error('foo'));

      return CardView.prototype.tokenize.call(this.context).then(throwIfResolves).catch(function () {
        expect(classList.remove).to.have.been.calledWith(this.context.element, 'braintree-sheet--loading');
      }.bind(this));
    });

    it('adds a new payment method when tokenize is successful and transition ends', function () {
      var stubPayload = {};

      this.context.hostedFieldsInstance.tokenize.resolves(stubPayload);
      this.sandbox.stub(this.model, 'addPaymentMethod');

      return CardView.prototype.tokenize.call(this.context).then(function () {
        expect(this.model.addPaymentMethod).to.have.been.calledWith(stubPayload);
      }.bind(this));
    });

    it('does not update the active payment method when tokenize fails', function () {
      this.context.hostedFieldsInstance.tokenize.rejects(new Error('bad happen'));
      this.sandbox.stub(this.model, 'addPaymentMethod');

      return CardView.prototype.tokenize.call(this.context).then(throwIfResolves).catch(function () {
        expect(this.model.addPaymentMethod).to.not.have.been.called;
      }.bind(this));
    });
  });

  describe('field errors', function () {
    beforeEach(function () {
      this.context = {
        fieldErrors: {
          hasOwnProperty: this.sandbox.stub().returns(false)
        },
        hostedFieldsInstance: {
          setAttribute: this.sandbox.stub(),
          removeAttribute: this.sandbox.stub(),
          setMessage: this.sandbox.stub()
        },
        getElementById: this.sandbox.stub().returns({})
      };

      this.sandbox.stub(classList, 'add');
    });

    describe('showFieldError', function () {
      it('sets hosted fields attributes on hosted fields', function () {
        var fakeGroup = document.createElement('div');
        var fakeHostedField = document.createElement('iframe');

        fakeHostedField.id = 'braintree-hosted-field-foo';
        fakeGroup.appendChild(fakeHostedField);

        this.context.getElementById = this.sandbox.stub().returns(fakeGroup);

        CardView.prototype.showFieldError.call(this.context, 'foo', 'errorMessage');

        expect(this.context.hostedFieldsInstance.setAttribute).to.have.been.calledWith({
          field: 'foo',
          attribute: 'aria-invalid',
          value: true
        });
      });

      it('does not set hosted fields attributes on non hosted fields', function () {
        var fakeInput = document.createElement('input');
        var fakeGroup = document.createElement('div');

        fakeGroup.setAttribute('data-braintree-id', 'foo-field-group');
        fakeInput.id = 'braintree__card-view-input';
        fakeGroup.appendChild(fakeInput);

        this.context.getElementById = this.sandbox.stub().returns(fakeGroup);

        CardView.prototype.showFieldError.call(this.context, 'foo', 'errorMessage');

        expect(this.context.hostedFieldsInstance.setAttribute).to.not.have.been.called;
      });
    });

    describe('hideFieldError', function () {
      it('removes hosted fields attributes on hosted fields', function () {
        var fakeGroup = document.createElement('div');
        var fakeHostedField = document.createElement('iframe');

        fakeHostedField.id = 'braintree-hosted-field-foo';
        fakeGroup.appendChild(fakeHostedField);

        this.context.getElementById = this.sandbox.stub().returns(fakeGroup);

        CardView.prototype.hideFieldError.call(this.context, 'foo', 'errorMessage');

        expect(this.context.hostedFieldsInstance.removeAttribute).to.have.been.calledWith({
          field: 'foo',
          attribute: 'aria-invalid'
        });
      });

      it('does not remove hosted fields attributes on non hosted fields', function () {
        var fakeInput = document.createElement('input');
        var fakeGroup = document.createElement('div');

        fakeGroup.setAttribute('data-braintree-id', 'foo-field-group');
        fakeInput.id = 'braintree__card-view-input';
        fakeGroup.appendChild(fakeInput);

        this.context.getElementById = this.sandbox.stub().returns(fakeGroup);

        CardView.prototype.hideFieldError.call(this.context, 'foo', 'errorMessage');

        expect(this.context.hostedFieldsInstance.removeAttribute).to.not.have.been.called;
      });
    });
  });

  describe('teardown', function () {
    beforeEach(function () {
      this.context = {
        hostedFieldsInstance: {
          teardown: this.sandbox.stub().resolves()
        }
      };
    });

    it('tears down hosted fields instance', function () {
      return CardView.prototype.teardown.call(this.context).then(function () {
        expect(this.context.hostedFieldsInstance.teardown).to.be.calledOnce;
      }.bind(this));
    });

    it('passes hosted fields teardown errors to callback', function () {
      var error = new Error('hosted fields teardown error');

      this.context.hostedFieldsInstance.teardown.rejects(error);

      return CardView.prototype.teardown.call(this.context).then(function () {
        throw new Error('should not resolve');
      }).then(throwIfResolves).catch(function (err) {
        expect(err).to.equal(error);
      });
    });
  });

  describe('getPaymentMethod', function () {
    beforeEach(function () {
      this.context = {
        _validateForm: this.sandbox.stub()
      };
    });

    it('returns undefined if form is invalid', function () {
      this.context._validateForm.returns(false);
      expect(CardView.prototype.getPaymentMethod.call(this.context)).to.equal(undefined); // eslint-disable-line no-undefined
    });

    it('returns a card payment method object if form is valid', function () {
      this.context._validateForm.returns(true);
      expect(CardView.prototype.getPaymentMethod.call(this.context)).to.deep.equal({
        type: 'CreditCard'
      });
    });
  });

  describe('onSelection', function () {
    it('focuses on the number field', function () {
      var view = new CardView({element: this.element});

      view.hostedFieldsInstance = {
        focus: this.sandbox.stub()
      };

      view.onSelection();

      expect(view.hostedFieldsInstance.focus).to.be.calledOnce;
      expect(view.hostedFieldsInstance.focus).to.be.calledWith('number');
    });

    it('noops if the hosted fields instance is not available', function () {
      var view = new CardView({element: this.element});

      delete view.hostedFieldsInstance;

      expect(function () {
        view.onSelection();
      }).to.not.throw();
    });
  });
});
