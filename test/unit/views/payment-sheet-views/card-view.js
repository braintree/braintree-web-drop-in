'use strict';

var BaseView = require('../../../../src/views/base-view');
var CardView = require('../../../../src/views/payment-sheet-views/card-view');
var classlist = require('../../../../src/lib/classlist');
var DropinModel = require('../../../../src/dropin-model');
var fake = require('../../../helpers/fake');
var fs = require('fs');
var hostedFields = require('braintree-web/hosted-fields');
var strings = require('../../../../src/translations/en_US');
var transitionHelper = require('../../../../src/lib/transition-helper');

var mainHTML = fs.readFileSync(__dirname + '/../../../../src/html/main.html', 'utf8');

function throwIfResolves() {
  throw new Error('should not resolve.');
}

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
        client: this.client,
        strings: strings
      });

      expect(this.element.querySelector('[data-braintree-id="cvv-field-group"]')).to.exist;
    });

    it('does not have cvv if supplied in challenges, but hosted fields overrides sets cvv to null', function () {
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

      this.model.merchantConfiguration.card = {
        overrides: {
          fields: {
            cvv: null
          }
        }
      };

      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      expect(this.element.querySelector('[data-braintree-id="cvv-field-group"]')).not.to.exist;
    });

    it('does not have cvv if not supplied in challenges', function () {
      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      expect(this.element.querySelector('[data-braintree-id="cvv-field-group"]')).not.to.exist;
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
        client: this.client,
        strings: strings
      });

      expect(this.element.querySelector('[data-braintree-id="postal-code-field-group"]')).to.exist;
    });

    it('does not have postal code if supplied in challenges, but hosted fields overrides sets postal code to null', function () {
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

      this.model.merchantConfiguration.card = {
        overrides: {
          fields: {
            postalCode: null
          }
        }
      };

      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      expect(this.element.querySelector('[data-braintree-id="postal-code-field-group"]')).not.to.exist;
    });

    it('does not have postal code if not supplied in challenges', function () {
      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      expect(this.element.querySelector('[data-braintree-id="postal-code-field-group"]')).not.to.exist;
    });

    it('starts async dependency', function () {
      this.sandbox.spy(DropinModel.prototype, 'asyncDependencyStarting');

      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
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
        client: this.client,
        strings: strings
      });

      expect(DropinModel.prototype.asyncDependencyReady).to.be.calledOnce;
    });

    it('creates Hosted Fields with number and expiration date', function () {
      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
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
        strings: strings,
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
        strings: strings,
        merchantConfiguration: {
          authorization: fake.clientToken
        }
      });

      expect(hostedFields.create.lastCall.args[0]).to.have.deep.property('fields.postalCode');
    });

    it('calls asyncDependencyFailed with an error when Hosted Fields creation fails', function () {
      var fakeError = {
        code: 'A_REAL_ERROR_CODE'
      };

      hostedFields.create.yields(fakeError);
      this.sandbox.stub(this.model, 'asyncDependencyFailed');

      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      expect(this.model.asyncDependencyFailed).to.be.calledWith({
        view: 'card',
        error: fakeError
      });
    });

    it('shows supported card icons', function () {
      var supportedCardTypes = ['american-express', 'discover', 'diners-club', 'jcb', 'master-card', 'visa'];

      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
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
        client: this.client,
        strings: strings
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
        client: this.client,
        strings: strings
      });

      unionPayCardIcon = this.element.querySelector('[data-braintree-id="unionpay-card-icon"]');

      expect(unionPayCardIcon.classList.contains('braintree-hidden')).to.be.true;
    });

    it('sets field placeholders', function () {
      var hostedFieldsConfiguredFields;

      this.client.getConfiguration = function () {
        return {
          gatewayConfiguration: {
            challenges: ['cvv', 'postal_code'],
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
        strings: strings
      });

      hostedFieldsConfiguredFields = hostedFields.create.lastCall.args[0].fields;

      expect(hostedFieldsConfiguredFields.number.placeholder).to.equal('•••• •••• •••• ••••');
      expect(hostedFieldsConfiguredFields.expirationDate.placeholder).to.equal(strings.expirationDatePlaceholder);
      expect(hostedFieldsConfiguredFields.cvv.placeholder).to.equal('•••');
      expect(hostedFieldsConfiguredFields.postalCode.placeholder).to.not.exist;
    });

    it('allows overriding field options for hosted fields', function () {
      var hostedFieldsConfiguredFields;

      this.client.getConfiguration = function () {
        return {
          gatewayConfiguration: {
            challenges: ['cvv', 'postal_code'],
            creditCards: {
              supportedCardTypes: []
            }
          }
        };
      };
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

      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      hostedFieldsConfiguredFields = hostedFields.create.lastCall.args[0].fields;

      expect(hostedFieldsConfiguredFields.number.placeholder).to.equal('placeholder');
      expect(hostedFieldsConfiguredFields.cvv.maxlength).to.equal(2);
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

      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      hostedFieldsConfiguredFields = hostedFields.create.lastCall.args[0].fields;

      expect(hostedFieldsConfiguredFields.cvv).to.not.exist;
      expect(hostedFieldsConfiguredFields.postalCode).to.not.exist;
      expect(hostedFieldsConfiguredFields.expirationMonth).to.not.exist;
      expect(hostedFieldsConfiguredFields.expirationYear).to.not.exist;
    });

    it('ignores changes to selector in field options', function () {
      var hostedFieldsConfiguredFields;

      this.model.merchantConfiguration.card = {
        overrides: {
          fields: {
            number: {
              selector: '#some-selector'
            }
          }
        }
      };

      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      hostedFieldsConfiguredFields = hostedFields.create.lastCall.args[0].fields;

      expect(hostedFieldsConfiguredFields.number.selector).to.not.equal('#some-selector');
    });

    it('allows overriding styles options for hosted fields', function () {
      var hostedFieldsConfiguredStyles;

      this.model.merchantConfiguration.card = {
        overrides: {
          styles: {
            input: {
              background: 'blue',
              color: 'red'
            },
            ':focus': null
          }
        }
      };

      new CardView({ // eslint-disable-line no-new
        element: this.element,
        mainView: this.mainView,
        model: this.model,
        client: this.client,
        strings: strings
      });

      hostedFieldsConfiguredStyles = hostedFields.create.lastCall.args[0].styles;

      expect(hostedFieldsConfiguredStyles.input.color).to.equal('red');
      expect(hostedFieldsConfiguredStyles.input.background).to.equal('blue');
      expect(hostedFieldsConfiguredStyles.input['font-size']).to.equal('16px');
      expect(hostedFieldsConfiguredStyles[':focus']).to.not.exist;
      expect(hostedFieldsConfiguredStyles['input::-ms-clear']).to.deep.equal({
        color: 'transparent'
      });
    });
  });

  describe('requestPaymentMethod', function () {
    beforeEach(function () {
      this.sandbox.stub(hostedFields, 'create').yields(null, fake.hostedFieldsInstance);

      this.model = new DropinModel(fake.modelOptions());
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
      this.context = {
        element: this.element,
        _generateFieldSelector: CardView.prototype._generateFieldSelector,
        _generateHostedFieldsOptions: CardView.prototype._generateHostedFieldsOptions,
        _validateForm: this.sandbox.stub(),
        getElementById: BaseView.prototype.getElementById,
        hideFieldError: CardView.prototype.hideFieldError,
        showFieldError: CardView.prototype.showFieldError,
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
        _isCardTypeSupported: CardView.prototype._isCardTypeSupported,
        _onBlurEvent: function () {},
        _onCardTypeChangeEvent: function () {},
        _onFocusEvent: function () {},
        _onNotEmptyEvent: function () {},
        _onValidityChangeEvent: function () {}
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

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        classlist.remove(numberFieldGroup, 'braintree-form__field-group--is-focused');

        CardView.prototype._initialize.call(this.context);

        expect(numberFieldGroup.classList.contains('braintree-form__field-group--is-focused')).to.be.true;
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

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        classlist.add(numberFieldGroup, 'braintree-form__field-group--is-focused');

        CardView.prototype._initialize.call(this.context);

        expect(numberFieldGroup.classList.contains('braintree-form__field-group--is-focused')).to.be.false;
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

        this.context.client.getConfiguration = function () {
          return {
            gatewayConfiguration: {
              challenges: ['cvv'],
              creditCards: {
                supportedCardTypes: ['Visa']
              }
            }
          };
        };

        classlist.remove(numberFieldGroup, 'braintree-form__field-group--has-error');
        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);

        CardView.prototype._initialize.call(this.context);

        expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).to.be.true;
        expect(numberFieldError.textContent).to.equal('This card number is not valid.');
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

        this.context.client.getConfiguration = function () {
          return {
            authorization: fake.clientToken,
            authorizationType: 'CLIENT_TOKEN',
            gatewayConfiguration: {
              challenges: ['cvv'],
              creditCards: {
                supportedCardTypes: ['Visa']
              }
            }
          };
        };

        modelOptions.client.getConfiguration = this.context.client.getConfiguration;

        this.context.model = new DropinModel(modelOptions);

        classlist.remove(numberFieldGroup, 'braintree-form__field-group--has-error');
        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);

        CardView.prototype._initialize.call(this.context);

        expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).to.be.true;
        expect(numberFieldError.textContent).to.equal('Please fill out a card number.');
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

        this.context.client.getConfiguration = function () {
          return {
            authorization: fake.clientToken,
            authorizationType: 'CLIENT_TOKEN',
            gatewayConfiguration: {
              challenges: ['cvv'],
              creditCards: {
                supportedCardTypes: ['Visa']
              }
            }
          };
        };

        modelOptions.client.getConfiguration = this.context.client.getConfiguration;

        this.context.model = new DropinModel(modelOptions);

        classlist.remove(numberFieldGroup, 'braintree-form__field-group--has-error');
        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);

        CardView.prototype._initialize.call(this.context);

        expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).to.be.false;
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

        this.context.client.getConfiguration = function () {
          return {
            authorization: fake.clientToken,
            authorizationType: 'CLIENT_TOKEN',
            gatewayConfiguration: {
              challenges: ['cvv'],
              creditCards: {
                supportedCardTypes: ['Visa']
              }
            }
          };
        };

        modelOptions.client.getConfiguration = this.context.client.getConfiguration;

        this.context.model = new DropinModel(modelOptions);

        classlist.remove(numberFieldGroup, 'braintree-form__field-group--has-error');
        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);

        CardView.prototype._initialize.call(this.context);

        expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).to.be.false;
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

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(numberFieldGroup.classList.contains('braintree-form__field-group--card-type-known')).to.be.true;
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

        classlist.add(numberFieldGroup, 'braintree-form__field-group--card-type-known');

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(numberFieldGroup.classList.contains('braintree-form__field-group--card-type-known')).to.be.false;
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

        classlist.add(numberFieldGroup, 'braintree-form__field-group--card-type-known');

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(numberFieldGroup.classList.contains('braintree-form__field-group--card-type-known')).to.be.false;
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
          setAttribute: function () {}
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
          setAttribute: function () {}
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
          setAttribute: function () {}
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
          setAttribute: function () {}
        };

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(use.getAttribute('xlink:href')).to.equal('#iconCVVFront');
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
        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(cvvLabelDescriptor.textContent).to.equal('(4 digits)');
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
        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(cvvLabelDescriptor.textContent).to.equal('(3 digits)');
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
          setAttribute: this.sandbox.spy()
        };

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(hostedFieldsInstance.setAttribute).to.have.been.calledWith({field: 'cvv', attribute: 'placeholder', value: '••••'});
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

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(hostedFieldsInstance.setAttribute).to.have.been.calledWith({field: 'cvv', attribute: 'placeholder', value: '•••'});
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

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(hostedFieldsInstance.setAttribute).to.have.been.calledWith({field: 'cvv', attribute: 'placeholder', value: '•••'});
      });

      it('does not update the cvv field placeholder when cvv field does not exist', function () {
        var fakeEvent = {
          cards: [{type: 'american-express'}, {type: 'visa'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: this.sandbox.stub().callsArgWith(1, fakeEvent),
          setAttribute: this.sandbox.spy()
        };

        this.context.client.getConfiguration = function () {
          return {
            gatewayConfiguration: {
              challenges: [],
              creditCards: {
                supportedCardTypes: []
              }
            }
          };
        };

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(hostedFieldsInstance.setAttribute).to.not.have.been.called;
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

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(hostedFieldsInstance.setAttribute).not.to.have.been.called;
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

        classlist.add(numberFieldGroup, 'braintree-form__field-group--has-error');
        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);

        CardView.prototype._initialize.call(this.context);

        expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).to.be.false;
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

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(expirationElement.classList.contains('braintree-form__field--valid')).to.equal(true);
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

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(expirationElement.classList.contains('braintree-form__field--valid')).to.equal(false);
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

        this.context.client.getConfiguration = function () {
          return {
            gatewayConfiguration: {
              challenges: ['cvv'],
              creditCards: {
                supportedCardTypes: ['Visa']
              }
            }
          };
        };

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(numberElement.classList.contains('braintree-form__field--valid')).to.equal(true);
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

        this.context.client.getConfiguration = function () {
          return {
            gatewayConfiguration: {
              challenges: ['cvv'],
              creditCards: {
                supportedCardTypes: ['Visa']
              }
            }
          };
        };

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(numberElement.classList.contains('braintree-form__field--valid')).to.equal(false);
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

        this.context.client.getConfiguration = function () {
          return {
            gatewayConfiguration: {
              challenges: ['cvv'],
              creditCards: {
                supportedCardTypes: ['Visa']
              }
            }
          };
        };

        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);
        CardView.prototype._initialize.call(this.context);

        expect(numberElement.classList.contains('braintree-form__field--valid')).to.equal(false);
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

        classlist.add(numberFieldGroup, 'braintree-form__field-group--has-error');
        this.sandbox.stub(hostedFields, 'create').yields(null, hostedFieldsInstance);

        CardView.prototype._initialize.call(this.context);

        expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).to.be.false;
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
        removeAttribute: this.sandbox.stub(),
        setAttribute: this.sandbox.stub(),
        tokenize: this.sandbox.stub()
      };
      this.model = new DropinModel(fake.modelOptions());

      this.context = {
        element: this.element,
        getElementById: BaseView.prototype.getElementById,
        hostedFieldsInstance: this.fakeHostedFieldsInstance,
        fieldErrors: {},
        model: this.model,
        _validateForm: CardView.prototype._validateForm,
        client: {
          getConfiguration: fake.configuration
        },
        merchantConfiguration: {
          authorization: fake.configuration().authorization
        },
        showFieldError: CardView.prototype.showFieldError,
        strings: strings
      };
      this.sandbox.stub(transitionHelper, 'onTransitionEnd').yields();
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

    it('shows unsupported card field error when attempting to use an unsupported card and reports an error', function () {
      var numberFieldError = this.element.querySelector('[data-braintree-id="number-field-error"]');

      this.sandbox.stub(this.context.model, 'reportError');

      this.context.client.getConfiguration = function () {
        return {
          gatewayConfiguration: {
            creditCards: {
              supportedCardTypes: ['Foo Pay']
            }
          }
        };
      };

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

    it('sets the aria-invalid attribute when a field error is shown', function () {
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

      CardView.prototype.showFieldError.call(this.context, 'number');

      expect(this.context.hostedFieldsInstance.setAttribute).to.be.calledWith({
        field: 'number',
        attribute: 'aria-invalid',
        value: true
      });
    });

    it('removes the aria-invalid attribute when a field error is hidden', function () {
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

    it('sets isTokenizing to false on successful tokenization', function (done) {
      this.context.hostedFieldsInstance.tokenize.resolves({nonce: 'foo'});

      CardView.prototype.tokenize.call(this.context).then(function () {
        setTimeout(function () {
          expect(this.context._isTokenizing).to.equal(false);
          done();
        }.bind(this), 100);
      }.bind(this));
    });

    it('sets isTokenizing to false on unsuccessful tokenization', function () {
      this.context.hostedFieldsInstance.tokenize.rejects(new Error('Error'));

      return CardView.prototype.tokenize.call(this.context).then(throwIfResolves).catch(function () {
        expect(this.context._isTokenizing).to.equal(false);
      }.bind(this));
    });

    it('removes braintree-sheet--loading class after successful tokenization', function () {
      var stubPayload = {};

      this.sandbox.stub(classlist, 'remove');
      this.context.hostedFieldsInstance.tokenize.resolves(stubPayload);

      return CardView.prototype.tokenize.call(this.context).then(function () {
        expect(classlist.remove).to.have.been.calledWith(this.context.element, 'braintree-sheet--loading');
      }.bind(this));
    });

    it('removes braintree-sheet--loading class after tokenization fails', function () {
      this.sandbox.stub(classlist, 'remove');
      this.context.hostedFieldsInstance.tokenize.rejects(new Error('foo'));

      return CardView.prototype.tokenize.call(this.context).then(throwIfResolves).catch(function () {
        expect(classlist.remove).to.have.been.calledWith(this.context.element, 'braintree-sheet--loading');
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
      var view;

      this.sandbox.stub(CardView.prototype, '_initialize');

      view = new CardView({element: this.element});

      view.hostedFieldsInstance = {
        focus: this.sandbox.stub()
      };

      view.onSelection();

      expect(view.hostedFieldsInstance.focus).to.be.calledOnce;
      expect(view.hostedFieldsInstance.focus).to.be.calledWith('number');
    });

    it('noops if the hosted fields instance is not available', function () {
      var view;

      this.sandbox.stub(CardView.prototype, '_initialize');

      view = new CardView({element: this.element});

      delete view.hostedFieldsInstance;

      expect(function () {
        view.onSelection();
      }).to.not.throw();
    });
  });
});
