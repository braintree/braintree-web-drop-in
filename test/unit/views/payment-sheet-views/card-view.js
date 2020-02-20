'use strict';

var BaseView = require('../../../../src/views/base-view');
var CardView = require('../../../../src/views/payment-sheet-views/card-view');
var classList = require('@braintree/class-list');
var DropinModel = require('../../../../src/dropin-model');
var fake = require('../../../helpers/fake');
var throwIfResolves = require('../../../helpers/throw-if-resolves');
var fs = require('fs');
var hostedFields = require('braintree-web/hosted-fields');
var strings = require('../../../../src/translations/en_US');
var transitionHelper = require('../../../../src/lib/transition-helper');
var {
  yields
} = require('../../../helpers/yields');

var mainHTML = fs.readFileSync(__dirname + '/../../../../src/html/main.html', 'utf8');
var CHANGE_ACTIVE_PAYMENT_METHOD_TIMEOUT = require('../../../../src/constants').CHANGE_ACTIVE_PAYMENT_METHOD_TIMEOUT;

function throwIfmockResolvedValue() {
  throw new Error('should not resolve.');
}

describe('CardView', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
    testContext.div = document.createElement('div');

    testContext.div.innerHTML = mainHTML;
    document.body.appendChild(testContext.div);
    testContext.element = document.body.querySelector('.braintree-sheet.braintree-card');

    testContext.client = fake.client();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Constructor', () => {
    test('inherits from BaseView', () => {
      expect(new CardView({element: testContext.element})).toBeInstanceOf(BaseView);
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      testContext.hostedFieldsInstance = {
        on: jest.fn()
      };
      jest.spyOn(hostedFields, 'create').mockResolvedValue(testContext.hostedFieldsInstance);

      testContext.model = fake.model();

      return testContext.model.initialize();
    });

    test('has cvv if supplied in challenges', () => {
      testContext.client.getConfiguration.mockReturnValue({
        gatewayConfiguration: {
          challenges: ['cvv'],
          creditCards: {
            supportedCardTypes: []
          }
        }
      });

      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      return testContext.view.initialize().then(function () {
        expect(testContext.element.querySelector('[data-braintree-id="cvv-field-group"]')).toBeDefined();
      });
    });

    test(
      'does not have cvv if supplied in challenges, but hosted fields overrides sets cvv to null',
      () => {
        testContext.client.getConfiguration.mockReturnValue({
          gatewayConfiguration: {
            challenges: ['cvv'],
            creditCards: {
              supportedCardTypes: []
            }
          }
        });

        testContext.model.merchantConfiguration.card = {
          overrides: {
            fields: {
              cvv: null
            }
          }
        };

        testContext.view = new CardView({
          element: testContext.element,
          mainView: testContext.mainView,
          model: testContext.model,
          client: testContext.client,
          strings: strings
        });

        return testContext.view.initialize().then(function () {
          expect(testContext.element.querySelector('[data-braintree-id="cvv-field-group"]')).toBeFalsy();
        });
      }
    );

    test('does not have cvv if not supplied in challenges', () => {
      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      return testContext.view.initialize().then(function () {
        expect(testContext.element.querySelector('[data-braintree-id="cvv-field-group"]')).toBeFalsy();
      });
    });

    test('has postal code if supplied in challenges', () => {
      testContext.client.getConfiguration.mockReturnValue({
        gatewayConfiguration: {
          challenges: ['postal_code'],
          creditCards: {
            supportedCardTypes: []
          }
        }
      });

      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      return testContext.view.initialize().then(function () {
        expect(testContext.element.querySelector('[data-braintree-id="postal-code-field-group"]')).toBeDefined();
      });
    });

    test(
      'does not have postal code if supplied in challenges, but hosted fields overrides sets postal code to null',
      () => {
        testContext.client.getConfiguration.mockReturnValue({
          gatewayConfiguration: {
            challenges: ['postal_code'],
            creditCards: {
              supportedCardTypes: []
            }
          }
        });

        testContext.model.merchantConfiguration.card = {
          overrides: {
            fields: {
              postalCode: null
            }
          }
        };

        testContext.view = new CardView({
          element: testContext.element,
          mainView: testContext.mainView,
          model: testContext.model,
          client: testContext.client,
          strings: strings
        });

        return testContext.view.initialize().then(function () {
          expect(testContext.element.querySelector('[data-braintree-id="postal-code-field-group"]')).toBeFalsy();
        });
      }
    );

    test('does not have postal code if not supplied in challenges', () => {
      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      return testContext.view.initialize().then(function () {
        expect(testContext.element.querySelector('[data-braintree-id="postal-code-field-group"]')).toBeFalsy();
      });
    });

    test('has cardholderName if provided in merchant configuration', () => {
      testContext.model.merchantConfiguration.card = {
        cardholderName: true
      };

      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      return testContext.view.initialize().then(function () {
        expect(testContext.element.querySelector('[data-braintree-id="cardholder-name-field-group"]')).toBeDefined();
      });
    });

    test(
      'does not include cardholderName if not provided in merchant configuration',
      () => {
        testContext.model.merchantConfiguration.card = {};

        testContext.view = new CardView({
          element: testContext.element,
          mainView: testContext.mainView,
          model: testContext.model,
          client: testContext.client,
          strings: strings
        });

        return testContext.view.initialize().then(function () {
          expect(testContext.element.querySelector('[data-braintree-id="cardholder-name-field-group"]')).toBeFalsy();
        });
      }
    );

    test('removes hidden class from save card input if configured', () => {
      testContext.model.merchantConfiguration.card = {
        vault: {
          allowVaultCardOverride: true
        }
      };
      testContext.model.isGuestCheckout = false;

      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      return testContext.view.initialize().then(function () {
        expect(
          testContext.element.querySelector('[data-braintree-id="save-card-field-group"]').className
        ).not.toMatch('braintree-hidden');
      });
    });

    test(
      'does not remove hidden class from save card input if not configured',
      () => {
        testContext.model.merchantConfiguration.card = {};
        testContext.model.isGuestCheckout = false;

        testContext.view = new CardView({
          element: testContext.element,
          mainView: testContext.mainView,
          model: testContext.model,
          client: testContext.client,
          strings: strings
        });

        return testContext.view.initialize().then(function () {
          expect(
            testContext.element.querySelector('[data-braintree-id="save-card-field-group"]').className
          ).toMatch('braintree-hidden');
        });
      }
    );

    test('sets checked value for save card input', () => {
      testContext.model.merchantConfiguration.card = {
        vault: {
          vaultCard: false
        }
      };

      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      return testContext.view.initialize().then(function () {
        expect(testContext.view.saveCardInput.checked).toBe(false);
      });
    });

    test('defaults checked value for save card input to true', () => {
      testContext.model.merchantConfiguration.card = {};

      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      return testContext.view.initialize().then(function () {
        expect(testContext.view.saveCardInput.checked).toBe(true);
      });
    });

    test('starts async dependency', () => {
      jest.spyOn(DropinModel.prototype, 'asyncDependencyStarting');

      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      return testContext.view.initialize().then(function () {
        expect(DropinModel.prototype.asyncDependencyStarting).toBeCalledTimes(1);
      });
    });

    test(
      'notifies async dependency is ready when Hosted Fields is created',
      () => {
        jest.spyOn(DropinModel.prototype, 'asyncDependencyReady');

        testContext.view = new CardView({
          element: testContext.element,
          mainView: testContext.mainView,
          model: testContext.model,
          client: testContext.client,
          strings: strings
        });

        return testContext.view.initialize().then(function () {
          expect(DropinModel.prototype.asyncDependencyReady).toBeCalledTimes(1);
        });
      }
    );

    test('creates Hosted Fields with number and expiration date', () => {
      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      return testContext.view.initialize().then(function () {
        expect(hostedFields.create).toBeCalledWith(expect.objectContaining({
          client: testContext.client,
          fields: {
            number: expect.any(Object),
            expirationDate: expect.any(Object)
          }
        }));
        expect(hostedFields.create.mock.calls[0][0]).not.toHaveProperty('fields.cvv');
        expect(hostedFields.create.mock.calls[0][0]).not.toHaveProperty('fields.postalCode');
      });
    });

    test('creates Hosted Fields with cvv if included in challenges', () => {
      testContext.client.getConfiguration.mockReturnValue({
        gatewayConfiguration: {
          challenges: ['cvv'],
          creditCards: {
            supportedCardTypes: []
          }
        }
      });

      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings,
        merchantConfiguration: {
          authorization: fake.clientToken
        }
      });

      return testContext.view.initialize().then(function () {
        expect(hostedFields.create.mock.calls[0][0].fields).toHaveProperty('cvv');
      });
    });

    test(
      'creates Hosted Fields with postal code if included in challenges',
      () => {
        testContext.client.getConfiguration.mockReturnValue({
          gatewayConfiguration: {
            challenges: ['postal_code'],
            creditCards: {
              supportedCardTypes: []
            }
          }
        });

        testContext.view = new CardView({
          element: testContext.element,
          mainView: testContext.mainView,
          model: testContext.model,
          client: testContext.client,
          strings: strings,
          merchantConfiguration: {
            authorization: fake.clientToken
          }
        });

        return testContext.view.initialize().then(function () {
          expect(hostedFields.create.mock.calls[0][0].fields).toHaveProperty('postalCode');
        });
      }
    );

    test(
      'calls asyncDependencyFailed with an error when Hosted Fields creation fails',
      () => {
        var fakeError = {
          code: 'A_REAL_ERROR_CODE'
        };

        hostedFields.create.mockRejectedValue(fakeError);
        jest.spyOn(testContext.model, 'asyncDependencyFailed').mockImplementation();

        testContext.view = new CardView({
          element: testContext.element,
          mainView: testContext.mainView,
          model: testContext.model,
          client: testContext.client,
          strings: strings
        });

        return testContext.view.initialize().then(function () {
          expect(testContext.model.asyncDependencyFailed).toBeCalledWith({
            view: 'card',
            error: fakeError
          });
        });
      }
    );

    test('shows supported card icons', () => {
      var supportedCardTypes = ['american-express', 'discover', 'jcb', 'master-card', 'visa'];

      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      return testContext.view.initialize().then(function () {
        supportedCardTypes.forEach(function (cardType) {
          var cardIcon = testContext.element.querySelector('[data-braintree-id="' + cardType + '-card-icon"]');

          expect(cardIcon.classList.contains('braintree-hidden')).toBe(false);
        });
      });
    });

    test('hides unsupported card icons', () => {
      var unsupportedCardTypes = ['maestro', 'diners-club'];

      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      return testContext.view.initialize().then(function () {
        unsupportedCardTypes.forEach(function (cardType) {
          var cardIcon = testContext.element.querySelector('[data-braintree-id="' + cardType + '-card-icon"]');

          expect(cardIcon.classList.contains('braintree-hidden')).toBe(true);
        });
      });
    });

    test('does not show UnionPay icon even if it is supported', () => {
      var unionPayCardIcon;

      testContext.client.getConfiguration.mockReturnValue({
        gatewayConfiguration: {
          challenges: [],
          creditCards: {
            supportedCardTypes: ['UnionPay']
          }
        }
      });

      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      return testContext.view.initialize().then(function () {
        unionPayCardIcon = testContext.element.querySelector('[data-braintree-id="unionpay-card-icon"]');

        expect(unionPayCardIcon.classList.contains('braintree-hidden')).toBe(true);
      });
    });

    test('sets field placeholders', () => {
      var hostedFieldsConfiguredFields;

      testContext.client.getConfiguration.mockReturnValue({
        gatewayConfiguration: {
          challenges: ['cvv', 'postal_code'],
          creditCards: {
            supportedCardTypes: []
          }
        }
      });

      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      return testContext.view.initialize().then(function () {
        hostedFieldsConfiguredFields = hostedFields.create.mock.calls[0][0].fields;

        expect(hostedFieldsConfiguredFields.number.placeholder).toBe('•••• •••• •••• ••••');
        expect(hostedFieldsConfiguredFields.expirationDate.placeholder).toBe(strings.expirationDatePlaceholder);
        expect(hostedFieldsConfiguredFields.cvv.placeholder).toBe('•••');
        expect(hostedFieldsConfiguredFields.postalCode.placeholder).toBeFalsy();
      });
    });

    test('allows overriding field options for hosted fields', () => {
      var hostedFieldsConfiguredFields;

      testContext.client.getConfiguration.mockReturnValue({
        gatewayConfiguration: {
          challenges: ['cvv', 'postal_code'],
          creditCards: {
            supportedCardTypes: []
          }
        }
      });
      testContext.model.merchantConfiguration.card = {
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

      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      return testContext.view.initialize().then(function () {
        hostedFieldsConfiguredFields = hostedFields.create.mock.calls[0][0].fields;

        expect(hostedFieldsConfiguredFields.number.placeholder).toBe('placeholder');
        expect(hostedFieldsConfiguredFields.cvv.maxlength).toBe(2);
      });
    });

    test(
      'does not add hosted fields elements for fields that are not present',
      () => {
        var hostedFieldsConfiguredFields;

        testContext.model.merchantConfiguration.card = {
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

        testContext.view = new CardView({
          element: testContext.element,
          mainView: testContext.mainView,
          model: testContext.model,
          client: testContext.client,
          strings: strings
        });

        return testContext.view.initialize().then(function () {
          hostedFieldsConfiguredFields = hostedFields.create.mock.calls[0][0].fields;

          expect(hostedFieldsConfiguredFields.cvv).toBeFalsy();
          expect(hostedFieldsConfiguredFields.postalCode).toBeFalsy();
          expect(hostedFieldsConfiguredFields.expirationMonth).toBeFalsy();
          expect(hostedFieldsConfiguredFields.expirationYear).toBeFalsy();
        });
      }
    );

    test('ignores changes to selector in field options', () => {
      testContext.model.merchantConfiguration.card = {
        overrides: {
          fields: {
            number: {
              selector: '#some-selector'
            }
          }
        }
      };

      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      return testContext.view.initialize().then(function () {
        var hostedFieldsConfiguredFields = hostedFields.create.mock.calls[0][0].fields;

        expect(hostedFieldsConfiguredFields.number.selector).not.toBe('#some-selector');
      });
    });

    test('allows overriding styles options for hosted fields', () => {
      var hostedFieldsConfiguredStyles;

      testContext.model.merchantConfiguration.card = {
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

      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      return testContext.view.initialize().then(function () {
        hostedFieldsConfiguredStyles = hostedFields.create.mock.calls[0][0].styles;

        expect(hostedFieldsConfiguredStyles.input.color).toBe('red');
        expect(hostedFieldsConfiguredStyles.input.background).toBe('blue');
        expect(hostedFieldsConfiguredStyles.input['font-size']).toBe('16px');
        expect(hostedFieldsConfiguredStyles.input['font-family']).toBe('fantasy');
        expect(hostedFieldsConfiguredStyles[':focus']).toBeFalsy();
        expect(hostedFieldsConfiguredStyles['input::-ms-clear']).toEqual({
          color: 'transparent'
        });
      });
    });

    test(
      'allows overriding styles options with class name for hosted fields',
      () => {
        var hostedFieldsConfiguredStyles;

        testContext.model.merchantConfiguration.card = {
          overrides: {
            styles: {
              input: 'class-name',
              ':focus': 'focus-class'
            }
          }
        };

        testContext.view = new CardView({
          element: testContext.element,
          mainView: testContext.mainView,
          model: testContext.model,
          client: testContext.client,
          strings: strings
        });

        return testContext.view.initialize().then(function () {
          hostedFieldsConfiguredStyles = hostedFields.create.mock.calls[0][0].styles;

          expect(hostedFieldsConfiguredStyles.input).toBe('class-name');
          expect(hostedFieldsConfiguredStyles[':focus']).toBe('focus-class');
          expect(hostedFieldsConfiguredStyles['input::-ms-clear']).toEqual({
            color: 'transparent'
          });
        });
      }
    );
  });

  describe('isEnabled', () => {
    beforeEach(() => {
      testContext.fakeOptions = {
        client: testContext.client,
        merchantConfiguration: {}
      };
    });

    test(
      'resovles with true when there is at least one supported card type',
      () => {
        var configuration = fake.configuration();

        configuration.gatewayConfiguration.creditCards.supportedCardTypes = ['visa'];

        testContext.client.getConfiguration.mockReturnValue(configuration);

        return CardView.isEnabled(testContext.fakeOptions).then(function (result) {
          expect(result).toBe(true);
        });
      }
    );

    test(
      'resovles with false when merchant configuration sets card to false',
      () => {
        var configuration = fake.configuration();

        configuration.gatewayConfiguration.creditCards.supportedCardTypes = ['visa'];

        testContext.client.getConfiguration.mockReturnValue(configuration);
        testContext.fakeOptions.merchantConfiguration.card = false;

        return CardView.isEnabled(testContext.fakeOptions).then(function (result) {
          expect(result).toBe(false);
        });
      }
    );

    test(
      'resovles with false when there are no supported card types',
      () => {
        var configuration = fake.configuration();

        configuration.gatewayConfiguration.creditCards.supportedCardTypes = [];

        testContext.client.getConfiguration.mockReturnValue(configuration);

        return CardView.isEnabled(testContext.fakeOptions).then(function (result) {
          expect(result).toBe(false);
        });
      }
    );
  });

  describe('requestPaymentMethod', () => {
    beforeEach(() => {
      jest.spyOn(hostedFields, 'create').mockResolvedValue(fake.hostedFieldsInstance);

      testContext.model = fake.model();

      return testContext.model.initialize();
    });

    test('calls the callback with an error when tokenize fails', () => {
      var cardView = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      jest.spyOn(cardView, 'tokenize').mockRejectedValue(new Error('foo'));

      return cardView.requestPaymentMethod().then(throwIfResolves).catch(function (err) {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('foo');
      });
    });

    test(
      'calls the callback with the payload when tokenize is successful',
      () => {
        var cardView = new CardView({
          element: testContext.element,
          mainView: testContext.mainView,
          model: testContext.model,
          client: testContext.client,
          strings: strings
        });

        jest.spyOn(cardView, 'tokenize').mockResolvedValue({foo: 'bar'});

        return cardView.requestPaymentMethod().then(function (payload) {
          expect(payload.foo).toBe('bar');
        });
      }
    );
  });

  describe('Hosted Fields events', () => {
    beforeEach(() => {
      var model = fake.model();

      return model.initialize().then(function () {
        testContext.context = {
          element: testContext.element,
          _generateFieldSelector: CardView.prototype._generateFieldSelector,
          _generateHostedFieldsOptions: CardView.prototype._generateHostedFieldsOptions,
          _validateForm: jest.fn(),
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

    describe('onFocusEvent', () => {
      beforeEach(() => {
        testContext.context._onFocusEvent = CardView.prototype._onFocusEvent;
      });

      test('shows default card icon in number field when focused', () => {
        var hostedFieldsInstance = {
          on: jest.fn().mockImplementation(yields({emittedBy: 'number'}))
        };

        jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

        return CardView.prototype.initialize.call(testContext.context).then(function () {
          var cardNumberIcon = testContext.element.querySelector('[data-braintree-id="card-number-icon"]');

          expect(cardNumberIcon.classList.contains('braintree-hidden')).toBe(false);
          expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).toBe('#iconCardFront');
        });
      });

      test('shows default cvv icon in cvv field when focused', () => {
        var hostedFieldsInstance = {
          on: jest.fn().mockImplementation(yields({emittedBy: 'cvv'}))
        };

        jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

        return CardView.prototype.initialize.call(testContext.context).then(function () {
          var cvvIcon = testContext.element.querySelector('[data-braintree-id="cvv-icon"]');

          expect(cvvIcon.classList.contains('braintree-hidden')).toBe(false);
          expect(cvvIcon.querySelector('use').getAttribute('xlink:href')).toBe('#iconCVVBack');
        });
      });

      test('adds braintree-form__field-group--is-focused', () => {
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
        var numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');

        jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);
        classList.remove(numberFieldGroup, 'braintree-form__field-group--is-focused');

        return CardView.prototype.initialize.call(testContext.context).then(function () {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--is-focused')).toBe(true);
        });
      });
    });

    describe('onBlurEvent', () => {
      beforeEach(() => {
        testContext.context._onBlurEvent = CardView.prototype._onBlurEvent;
      });

      test(
        'removes braintree-form__field-group--is-focused class when blurred',
        () => {
          var fakeEvent = {
            cards: [{type: 'visa'}],
            emittedBy: 'number',
            fields: {
              number: {isEmpty: true}
            }
          };
          var hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: jest.fn()
          };
          var numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);
          classList.add(numberFieldGroup, 'braintree-form__field-group--is-focused');

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--is-focused')).toBe(false);
          });
        }
      );

      test('applies error class if field is not valid', () => {
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
          setAttribute: jest.fn()
        };
        var numberFieldError = testContext.element.querySelector('[data-braintree-id="number-field-error"]');
        var numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');

        testContext.context.client.getConfiguration.mockReturnValue({
          gatewayConfiguration: {
            challenges: ['cvv'],
            creditCards: {
              supportedCardTypes: ['Visa']
            }
          }
        });

        classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');
        jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

        return CardView.prototype.initialize.call(testContext.context).then(function () {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(true);
          expect(numberFieldError.textContent).toBe('This card number is not valid.');
        });
      });

      test(
        'does apply error class if field is empty when focusing another hosted field',
        () => {
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
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: jest.fn()
          };
          var numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');
          var numberFieldError = testContext.element.querySelector('[data-braintree-id="number-field-error"]');

          fakeHostedField.id = 'braintree-hosted-field-foo';
          document.body.appendChild(fakeHostedField);
          fakeHostedField.focus();

          testContext.context.client.getConfiguration.mockReturnValue({
            authorization: fake.clientToken,
            authorizationType: 'CLIENT_TOKEN',
            gatewayConfiguration: {
              challenges: ['cvv'],
              creditCards: {
                supportedCardTypes: ['Visa']
              }
            }
          });

          modelOptions.client.getConfiguration = testContext.context.client.getConfiguration;

          testContext.context.model = fake.model(modelOptions);

          classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');
          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(true);
            expect(numberFieldError.textContent).toBe('Please fill out a card number.');
          });
        }
      );

      test(
        'sets the empty error when programatically focussing a hosted field (requires a setTimeout)',
        done => {
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
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: jest.fn(),
            setMessage: jest.fn()
          };
          var numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');

          fakeHostedField.id = 'braintree-hosted-field-foo';
          document.body.appendChild(fakeElement);
          document.body.appendChild(fakeHostedField);
          fakeElement.focus();

          testContext.context.client.getConfiguration.mockReturnValue({
            authorization: fake.clientToken,
            authorizationType: 'CLIENT_TOKEN',
            gatewayConfiguration: {
              challenges: ['cvv'],
              creditCards: {
                supportedCardTypes: ['Visa']
              }
            }
          });

          modelOptions.client.getConfiguration = testContext.context.client.getConfiguration;

          testContext.context.model = fake.model(modelOptions);

          classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');
          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(false);

            fakeHostedField.focus();

            setTimeout(function () {
              expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(true);
              done();
            }, 300);
          });
        }
      );

      test(
        'does not apply error class if field is empty and not focusing hosted fields',
        () => {
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
            on: jest.fn().mockImplementation(yields(fakeEvent))
          };
          var numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');

          document.body.appendChild(fakeElement);
          fakeElement.focus();

          testContext.context.client.getConfiguration.mockReturnValue({
            authorization: fake.clientToken,
            authorizationType: 'CLIENT_TOKEN',
            gatewayConfiguration: {
              challenges: ['cvv'],
              creditCards: {
                supportedCardTypes: ['Visa']
              }
            }
          });

          modelOptions.client.getConfiguration = testContext.context.client.getConfiguration;

          testContext.context.model = fake.model(modelOptions);

          classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');
          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(false);
          });
        }
      );

      test(
        'does not apply error class if field is empty and the active element is not an iframe',
        () => {
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
            on: jest.fn().mockImplementation(yields(fakeEvent))
          };
          var numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');

          document.body.appendChild(fakeElement);
          fakeElement.focus();

          testContext.context.client.getConfiguration.mockReturnValue({
            authorization: fake.clientToken,
            authorizationType: 'CLIENT_TOKEN',
            gatewayConfiguration: {
              challenges: ['cvv'],
              creditCards: {
                supportedCardTypes: ['Visa']
              }
            }
          });

          modelOptions.client.getConfiguration = testContext.context.client.getConfiguration;

          testContext.context.model = fake.model(modelOptions);

          classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');
          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(false);
          });
        }
      );
    });

    describe('onCardTypeChange event', () => {
      beforeEach(() => {
        testContext.context._onCardTypeChangeEvent = CardView.prototype._onCardTypeChangeEvent;
      });

      test(
        'adds the card-type-known class when there is one possible card type',
        () => {
          var numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');
          var fakeEvent = {
            cards: [{type: 'master-card'}],
            emittedBy: 'number'
          };
          var hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: function () {}
          };

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--card-type-known')).toBe(true);
          });
        }
      );

      test(
        'removes the card-type-known class when there is no possible card type',
        () => {
          var numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');
          var fakeEvent = {
            cards: [],
            emittedBy: 'number'
          };
          var hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: function () {}
          };

          classList.add(numberFieldGroup, 'braintree-form__field-group--card-type-known');

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--card-type-known')).toBe(false);
          });
        }
      );

      test(
        'removes the card-type-known class when there are many possible card types',
        () => {
          var numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');
          var fakeEvent = {
            cards: [{type: 'master-card'}, {type: 'foo-pay'}],
            emittedBy: 'number'
          };
          var hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: function () {}
          };

          classList.add(numberFieldGroup, 'braintree-form__field-group--card-type-known');

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--card-type-known')).toBe(false);
          });
        }
      );

      test(
        'updates the card number icon to the card type if there is one possible card type',
        () => {
          var cardNumberIcon = testContext.element.querySelector('[data-braintree-id="card-number-icon"]');
          var fakeEvent = {
            cards: [{type: 'master-card'}],
            emittedBy: 'number'
          };
          var hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: function () {}
          };

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).toBe('#icon-master-card');
          });
        }
      );

      test(
        'updates the card number icon to the generic card if there are many possible card types',
        () => {
          var cardNumberIcon = testContext.element.querySelector('[data-braintree-id="card-number-icon"]');
          var fakeEvent = {
            cards: [{type: 'master-card'}, {type: 'foo-pay'}],
            emittedBy: 'number'
          };
          var hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: function () {}
          };

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).toBe('#iconCardFront');
          });
        }
      );

      test(
        'updates the card icon to the generic card if there no card types',
        () => {
          var cardNumberIcon = testContext.element.querySelector('[data-braintree-id="card-number-icon"]');
          var fakeEvent = {
            cards: [],
            emittedBy: 'number'
          };
          var hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: function () {}
          };

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).toBe('#iconCardFront');
          });
        }
      );

      test('updates the cvv icon to back icon for non-amex cards', () => {
        var use = testContext.element.querySelector('[data-braintree-id="cvv-icon"]').querySelector('use');
        var fakeEvent = {
          cards: [{type: 'visa'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: jest.fn().mockImplementation(yields(fakeEvent)),
          setAttribute: function () {}
        };

        use.setAttribute('xlink:href', '#iconCVVFront');
        jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

        return CardView.prototype.initialize.call(testContext.context).then(function () {
          expect(use.getAttribute('xlink:href')).toBe('#iconCVVBack');
        });
      });

      test('updates the cvv icon to front icon for amex cards', () => {
        var use = testContext.element.querySelector('[data-braintree-id="cvv-icon"]').querySelector('use');
        var fakeEvent = {
          cards: [{type: 'american-express'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: jest.fn().mockImplementation(yields(fakeEvent)),
          setAttribute: function () {}
        };

        jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

        return CardView.prototype.initialize.call(testContext.context).then(function () {
          expect(use.getAttribute('xlink:href')).toBe('#iconCVVFront');
        });
      });

      test(
        'updates the cvv label descriptor to four digits when card type is amex',
        () => {
          var cvvLabelDescriptor = testContext.element.querySelector('[data-braintree-id="cvv-field-group"]').querySelector('.braintree-form__descriptor');
          var fakeEvent = {
            cards: [{type: 'american-express'}],
            emittedBy: 'number'
          };
          var hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: function () {}
          };

          cvvLabelDescriptor.textContent = 'some value';
          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(cvvLabelDescriptor.textContent).toBe('(4 digits)');
          });
        }
      );

      test(
        'updates the cvv label descriptor to three digits when card type is non-amex',
        () => {
          var cvvLabelDescriptor = testContext.element.querySelector('[data-braintree-id="cvv-field-group"]').querySelector('.braintree-form__descriptor');
          var fakeEvent = {
            cards: [{type: 'visa'}],
            emittedBy: 'number'
          };
          var hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: function () {}
          };

          cvvLabelDescriptor.textContent = 'some value';
          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(cvvLabelDescriptor.textContent).toBe('(3 digits)');
          });
        }
      );

      test(
        'updates the cvv label descriptor to three digits when multiple card types',
        () => {
          var cvvLabelDescriptor = testContext.element.querySelector('[data-braintree-id="cvv-field-group"]').querySelector('.braintree-form__descriptor');
          var fakeEvent = {
            cards: [{type: 'american-express'}, {type: 'visa'}],
            emittedBy: 'number'
          };
          var hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: function () {}
          };

          cvvLabelDescriptor.textContent = 'some value';
          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(cvvLabelDescriptor.textContent).toBe('(3 digits)');
          });
        }
      );

      test('updates the cvv field placeholder when card type is amex', () => {
        var fakeEvent = {
          cards: [{type: 'american-express'}],
          emittedBy: 'number'
        };
        var hostedFieldsInstance = {
          on: jest.fn().mockImplementation(yields(fakeEvent)),
          setAttribute: jest.fn()
        };

        jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

        return CardView.prototype.initialize.call(testContext.context).then(function () {
          expect(hostedFieldsInstance.setAttribute).toBeCalledWith({field: 'cvv', attribute: 'placeholder', value: '••••'});
        });
      });

      test(
        'updates the cvv field placeholder when card type is non-amex',
        () => {
          var fakeEvent = {
            cards: [{type: 'visa'}],
            emittedBy: 'number'
          };
          var hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: jest.fn()
          };

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(hostedFieldsInstance.setAttribute).toBeCalledWith({field: 'cvv', attribute: 'placeholder', value: '•••'});
          });
        }
      );

      test(
        'updates the cvv field placeholder when multiple card types',
        () => {
          var fakeEvent = {
            cards: [{type: 'american-express'}, {type: 'visa'}],
            emittedBy: 'number'
          };
          var hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: jest.fn()
          };

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(hostedFieldsInstance.setAttribute).toBeCalledWith({field: 'cvv', attribute: 'placeholder', value: '•••'});
          });
        }
      );

      test(
        'does not update the cvv field placeholder when there is no cvv challenge',
        () => {
          var fakeEvent = {
            cards: [{type: 'american-express'}, {type: 'visa'}],
            emittedBy: 'number'
          };
          var hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: jest.fn()
          };

          testContext.context.client.getConfiguration.mockReturnValue({
            gatewayConfiguration: {
              challenges: [],
              creditCards: {
                supportedCardTypes: []
              }
            }
          });

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(hostedFieldsInstance.setAttribute).not.toBeCalled();
          });
        }
      );

      test(
        'does not update the cvv field placeholder when it is removed with an override',
        () => {
          var fakeEvent = {
            cards: [{type: 'american-express'}, {type: 'visa'}],
            emittedBy: 'number'
          };
          var hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: jest.fn()
          };

          testContext.context.model.merchantConfiguration.card = {
            overrides: {
              fields: {
                cvv: null
              }
            }
          };

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(hostedFieldsInstance.setAttribute).not.toBeCalled();
          });
        }
      );

      test(
        'does not update the cvv field placeholder when using a custom CVV placeholder',
        () => {
          var fakeEvent = {
            cards: [{type: 'american-express'}, {type: 'visa'}],
            emittedBy: 'number'
          };
          var hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: jest.fn()
          };

          testContext.context.model.merchantConfiguration.card = {
            overrides: {
              fields: {
                cvv: {
                  placeholder: 'cool custom placeholder'
                }
              }
            }
          };

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(hostedFieldsInstance.setAttribute).not.toBeCalled();
          });
        }
      );
    });

    describe('onValidityChangeEvent', () => {
      beforeEach(() => {
        testContext.context._onValidityChangeEvent = CardView.prototype._onValidityChangeEvent;
      });

      test(
        'removes the braintree-form__field-group--has-error class if a field is potentially valid',
        () => {
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
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            removeAttribute: jest.fn()
          };
          var numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');

          classList.add(numberFieldGroup, 'braintree-form__field-group--has-error');
          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(false);
          });
        }
      );

      test(
        'adds braintree-form__field--valid class to valid expiration date field',
        () => {
          var expirationElement = testContext.element.querySelector('.braintree-form-expiration');
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
            removeAttribute: jest.fn()
          };

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(expirationElement.classList.contains('braintree-form__field--valid')).toBe(true);
          });
        }
      );

      test(
        'removes braintree-form__field--valid class to invalid expiration date field',
        () => {
          var expirationElement = testContext.element.querySelector('.braintree-form-expiration');
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
            removeAttribute: jest.fn()
          };

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(expirationElement.classList.contains('braintree-form__field--valid')).toBe(false);
          });
        }
      );

      test(
        'adds braintree-form__field--valid class to valid number with card type supported',
        () => {
          var numberElement = testContext.element.querySelector('.braintree-form-number');
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
            removeAttribute: jest.fn()
          };

          testContext.context.client.getConfiguration.mockReturnValue({
            gatewayConfiguration: {
              challenges: ['cvv'],
              creditCards: {
                supportedCardTypes: ['Visa']
              }
            }
          });

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(numberElement.classList.contains('braintree-form__field--valid')).toBe(true);
          });
        }
      );

      test(
        'removes braintree-form__field--valid class to valid number without card type supported',
        () => {
          var numberElement = testContext.element.querySelector('.braintree-form-number');
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
            removeAttribute: jest.fn()
          };

          testContext.context.client.getConfiguration.mockReturnValue({
            gatewayConfiguration: {
              challenges: ['cvv'],
              creditCards: {
                supportedCardTypes: ['Visa']
              }
            }
          });

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(numberElement.classList.contains('braintree-form__field--valid')).toBe(false);
          });
        }
      );

      test(
        'removes braintree-form__field--valid class to not valid number with card type supported',
        () => {
          var numberElement = testContext.element.querySelector('.braintree-form-number');
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
            removeAttribute: jest.fn()
          };

          testContext.context.client.getConfiguration.mockReturnValue({
            gatewayConfiguration: {
              challenges: ['cvv'],
              creditCards: {
                supportedCardTypes: ['Visa']
              }
            }
          });

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(function () {
            expect(numberElement.classList.contains('braintree-form__field--valid')).toBe(false);
          });
        }
      );

      test(
        'calls model.setPaymentMethodRequestable with isRequestable true if form is valid',
        () => {
          var numberElement = testContext.element.querySelector('.braintree-form-number');
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

          jest.spyOn(testContext.context, 'hideFieldError').mockImplementation();
          jest.spyOn(testContext.context.model, 'setPaymentMethodRequestable').mockImplementation();
          testContext.context._validateForm.mockReturnValue(true);

          CardView.prototype._onValidityChangeEvent.call(testContext.context, fakeEvent);

          expect(testContext.context.model.setPaymentMethodRequestable).toBeCalledTimes(1);
          expect(testContext.context.model.setPaymentMethodRequestable).toBeCalledWith({
            isRequestable: true,
            type: 'CreditCard'
          });
        }
      );

      test(
        'calls model.setPaymentMethodRequestable with isRequestable false if form is invalid',
        () => {
          var numberElement = testContext.element.querySelector('.braintree-form-number');
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

          jest.spyOn(testContext.context, 'hideFieldError').mockImplementation();
          jest.spyOn(testContext.context.model, 'setPaymentMethodRequestable').mockImplementation();
          testContext.context._validateForm.mockReturnValue(false);

          CardView.prototype._onValidityChangeEvent.call(testContext.context, fakeEvent);

          expect(testContext.context.model.setPaymentMethodRequestable).toBeCalledTimes(1);
          expect(testContext.context.model.setPaymentMethodRequestable).toBeCalledWith({
            isRequestable: false,
            type: 'CreditCard'
          });
        }
      );

      test(
        'does not call model.setPaymentMethodRequestable if tokenization is in progress',
        () => {
          var numberElement = testContext.element.querySelector('.braintree-form-number');
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

          testContext.context._isTokenizing = true;

          jest.spyOn(testContext.context, 'hideFieldError').mockImplementation();
          jest.spyOn(testContext.context.model, 'setPaymentMethodRequestable').mockImplementation();
          testContext.context._validateForm.mockReturnValue(false);

          CardView.prototype._onValidityChangeEvent.call(testContext.context, fakeEvent);

          expect(testContext.context.model.setPaymentMethodRequestable).not.toBeCalled();
        }
      );
    });

    describe('onNotEmptyEvent', () => {
      beforeEach(() => {
        testContext.context._onNotEmptyEvent = CardView.prototype._onNotEmptyEvent;
      });

      test('removes the braintree-form__field-group--has-error class', () => {
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
          on: jest.fn().mockImplementation(yields(fakeEvent)),
          removeAttribute: jest.fn()
        };
        var numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');

        classList.add(numberFieldGroup, 'braintree-form__field-group--has-error');
        jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

        return CardView.prototype.initialize.call(testContext.context).then(function () {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(false);
        });
      });
    });
  });

  describe('tokenize', () => {
    beforeEach(() => {
      testContext.fakeHostedFieldsInstance = {
        clear: jest.fn(),
        getState: jest.fn().mockReturnValue({
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
        removeAttribute: jest.fn(),
        setAttribute: jest.fn(),
        setMessage: jest.fn(),
        tokenize: jest.fn().mockResolvedValue({})
      };
      testContext.model = fake.model();

      return testContext.model.initialize().then(function () {
        testContext.context = {
          element: testContext.element,
          _shouldVault: CardView.prototype._shouldVault,
          saveCardInput: {
            checked: true
          },
          getElementById: BaseView.prototype.getElementById,
          hostedFieldsInstance: testContext.fakeHostedFieldsInstance,
          fieldErrors: {},
          model: testContext.model,
          preventUserAction: BaseView.prototype.preventUserAction,
          allowUserAction: BaseView.prototype.allowUserAction,
          _validateForm: CardView.prototype._validateForm,
          _validateExtraInput: CardView.prototype._validateExtraInput,
          _sendRequestableEvent: CardView.prototype._sendRequestableEvent,
          _setupCardholderName: jest.fn(),
          client: fake.client(),
          merchantConfiguration: {
            authorization: fake.configuration().authorization,
            card: {}
          },
          hasCardholderName: false,
          showFieldError: CardView.prototype.showFieldError,
          strings: strings
        };
        jest.spyOn(transitionHelper, 'onTransitionEnd').mockImplementation(yields());
      });
    });

    test('clears the error on the model', () => {
      jest.spyOn(testContext.model, 'clearError').mockImplementation();
      testContext.context.hostedFieldsInstance.getState.mockReturnValue({
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

      return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(function () {
        expect(testContext.model.clearError).toBeCalled();
      });
    });

    test('throws an error if there is no valid card type', () => {
      testContext.context.hostedFieldsInstance.getState.mockReturnValue({
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

      return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(function (err) {
        expect(err).toBeDefined();
        expect(testContext.fakeHostedFieldsInstance.tokenize).not.toBeCalled();
      });
    });

    test(
      'calls callback with error and reports error to DropinModel if form is not valid',
      () => {
        testContext.context.hostedFieldsInstance.getState.mockReturnValue({
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

        jest.spyOn(testContext.context.model, 'reportError').mockImplementation();

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(function (err) {
          expect(testContext.fakeHostedFieldsInstance.tokenize).not.toBeCalled();
          expect(testContext.context.model.reportError).toBeCalledWith('hostedFieldsFieldsInvalidError');
          expect(err.message).toBe('No payment method is available.');
        });
      }
    );

    test(
      'calls callback with error when cardholder name is required and the input is empty',
      () => {
        testContext.context.hostedFieldsInstance.getState.mockReturnValue({
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
        testContext.context.cardholderNameInput = {value: ''};
        testContext.context.extraInputs = [{
          fieldName: 'cardholderName',
          enabled: true,
          required: true,
          validations: [{
            isValid: function (input) { return input.length > 0; },
            error: strings.fieldEmptyForCardholderName
          }]
        }];

        jest.spyOn(testContext.context.model, 'reportError').mockImplementation();

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(function (err) {
          expect(testContext.fakeHostedFieldsInstance.tokenize).not.toBeCalled();
          expect(testContext.context.model.reportError).toBeCalledWith('hostedFieldsFieldsInvalidError');
          expect(err.message).toBe('No payment method is available.');
        });
      }
    );

    test(
      'does not error if cardholder name is empty, but not required',
      () => {
        testContext.context.hostedFieldsInstance.getState.mockReturnValue({
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
        testContext.context.hasCardholderName = true;
        testContext.context.model.merchantConfiguration.card = {
          cardholderName: {
            required: false
          }
        };
        testContext.context.cardholderNameInput = {value: ''};

        jest.spyOn(testContext.context.model, 'reportError').mockImplementation();

        return CardView.prototype.tokenize.call(testContext.context).then(function () {
          expect(testContext.context.model.reportError).not.toBeCalled();
          expect(testContext.fakeHostedFieldsInstance.tokenize).toBeCalledTimes(1);
        });
      }
    );

    test('does not error if cardholder name is not included', () => {
      testContext.context.hostedFieldsInstance.getState.mockReturnValue({
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
      testContext.context.hasCardholderName = false;
      jest.spyOn(testContext.context.model, 'reportError').mockImplementation();

      return CardView.prototype.tokenize.call(testContext.context).then(function () {
        expect(testContext.context.model.reportError).not.toBeCalled();
        expect(testContext.fakeHostedFieldsInstance.tokenize).toBeCalledTimes(1);
      });
    });

    test(
      'calls callback with error when cardholder name length is over 255 characters',
      () => {
        var overLengthValue = Array(256).join('a');

        testContext.context.hostedFieldsInstance.getState.mockReturnValue({
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
        testContext.context.hasCardholderName = true;
        testContext.context.model.merchantConfiguration.card = {
          cardholderName: true
        };
        testContext.context.cardholderNameInput = {
          value: overLengthValue
        };
        testContext.context.extraInputs = [{
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

        jest.spyOn(testContext.context.model, 'reportError').mockImplementation();

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(function (err) {
          expect(testContext.fakeHostedFieldsInstance.tokenize).not.toBeCalled();
          expect(testContext.context.model.reportError).toBeCalledWith('hostedFieldsFieldsInvalidError');
          expect(err.message).toBe('No payment method is available.');
        });
      }
    );

    test(
      'reports an error to DropinModel when Hosted Fields tokenization returns an error',
      () => {
        var fakeError = {
          code: 'A_REAL_ERROR_CODE'
        };

        testContext.context.hostedFieldsInstance.tokenize.mockRejectedValue(fakeError);
        jest.spyOn(testContext.context.model, 'reportError').mockImplementation();

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(function () {
          expect(testContext.context.model.reportError).toBeCalledWith(fakeError);
        });
      }
    );

    test(
      'reports a duplicate card error to DropinModel when tokenization returns an error',
      () => {
        var fakeError = {code: 'HOSTED_FIELDS_TOKENIZATION_FAIL_ON_DUPLICATE'};

        testContext.context.hostedFieldsInstance.tokenize.mockRejectedValue(fakeError);
        jest.spyOn(testContext.context.model, 'reportError').mockImplementation();

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(function () {
          expect(testContext.context.model.reportError).toBeCalledWith(fakeError);
        });
      }
    );

    test(
      'shows unsupported card field error when attempting to use an unsupported card and reports an error',
      () => {
        var numberFieldError = testContext.element.querySelector('[data-braintree-id="number-field-error"]');

        jest.spyOn(testContext.context.model, 'reportError').mockImplementation();

        testContext.context.client.getConfiguration.mockReturnValue({
          gatewayConfiguration: {
            creditCards: {
              supportedCardTypes: ['Foo Pay']
            }
          }
        });

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(function () {
          expect(numberFieldError.classList.contains('braintree-hidden')).toBe(false);
          expect(numberFieldError.textContent).toBe('This card type is not supported. Please try another card.');
          expect(testContext.context.model.reportError).toBeCalledWith('hostedFieldsFieldsInvalidError');
          expect(testContext.context.hostedFieldsInstance.tokenize).not.toBeCalled();
        });
      }
    );

    test(
      'shows empty field error when attempting to sumbit an empty field',
      () => {
        var numberFieldError = testContext.element.querySelector('[data-braintree-id="number-field-error"]');

        testContext.context.hostedFieldsInstance.getState.mockReturnValue({
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

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(function () {
          expect(numberFieldError.classList.contains('braintree-hidden')).toBe(false);
          expect(numberFieldError.textContent).toBe('Please fill out a card number.');
          expect(testContext.context.hostedFieldsInstance.tokenize).not.toBeCalled();
        });
      }
    );

    test(
      'shows invalid field error when attempting to submit an invalid field',
      () => {
        var numberFieldError = testContext.element.querySelector('[data-braintree-id="number-field-error"]');

        testContext.context.hostedFieldsInstance.getState.mockReturnValue({
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

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(function () {
          expect(numberFieldError.classList.contains('braintree-hidden')).toBe(false);
          expect(numberFieldError.textContent).toBe('This card number is not valid.');
          expect(testContext.context.hostedFieldsInstance.tokenize).not.toBeCalled();
        });
      }
    );

    test(
      'sets the aria-invalid attribute and set message when a field error is shown',
      () => {
        testContext.context.hostedFieldsInstance.getState.mockReturnValue({
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

        CardView.prototype.showFieldError.call(testContext.context, 'number', 'Example error message');

        expect(testContext.context.hostedFieldsInstance.setAttribute).toBeCalledWith({
          field: 'number',
          attribute: 'aria-invalid',
          value: true
        });
        expect(testContext.context.hostedFieldsInstance.setMessage).toBeCalledWith({
          field: 'number',
          message: 'Example error message'
        });
      }
    );

    test(
      'sets the aria-invalid attribute on an input when a field error is hidden',
      () => {
        var input = {
          id: {
            indexOf: function () {
              return 1;
            }
          },
          setAttribute: jest.fn()
        };
        var fieldGroup = {
          querySelector: function () {
            return input;
          }
        };

        testContext.context.getElementById = jest.fn().mockReturnValue(fieldGroup);
        jest.spyOn(classList, 'add').mockImplementation();

        CardView.prototype.showFieldError.call(testContext.context, 'foo');

        expect(input.setAttribute).toBeCalledWith('aria-invalid', true);
      }
    );

    test(
      'removes the aria-invalid attribute and message when a field error is hidden',
      () => {
        testContext.context.hostedFieldsInstance.getState.mockReturnValue({
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

        CardView.prototype.hideFieldError.call(testContext.context, 'number');

        expect(testContext.context.hostedFieldsInstance.removeAttribute).toBeCalledWith({
          field: 'number',
          attribute: 'aria-invalid'
        });
        expect(testContext.context.hostedFieldsInstance.setMessage).toBeCalledWith({
          field: 'number',
          message: ''
        });
      }
    );

    test(
      'removes the aria-invalid attribute on an input when a field error is hidden',
      () => {
        var input = {
          id: {
            indexOf: function () {
              return 1;
            }
          },
          removeAttribute: jest.fn()
        };
        var fieldGroup = {
          querySelector: function () {
            return input;
          }
        };

        testContext.context.getElementById = jest.fn().mockReturnValue(fieldGroup);
        jest.spyOn(classList, 'remove').mockImplementation();

        CardView.prototype.hideFieldError.call(testContext.context, 'foo');

        expect(input.removeAttribute).toBeCalledWith('aria-invalid');
      }
    );

    test('calls hostedFieldsInstance.tokenize when form is valid', () => {
      return CardView.prototype.tokenize.call(testContext.context).then(function () {
        expect(testContext.context.hostedFieldsInstance.tokenize).toBeCalledTimes(1);
      });
    });

    test(
      'includes `vaulted: true` in tokenization payload if not guest checkout',
      () => {
        testContext.context.model.isGuestCheckout = false;

        return CardView.prototype.tokenize.call(testContext.context).then(function (payload) {
          expect(payload.vaulted).toBe(true);
        });
      }
    );

    test(
      'does not include `vaulted: true` in tokenization payload if save card input is not checked',
      () => {
        testContext.context.model.isGuestCheckout = false;
        testContext.context.saveCardInput.checked = false;

        return CardView.prototype.tokenize.call(testContext.context).then(function (payload) {
          expect(payload.vaulted).toBeFalsy();
        });
      }
    );

    test(
      'does not include `vaulted: true` in tokenization payload if guest checkout',
      () => {
        testContext.context.model.isGuestCheckout = true;

        return CardView.prototype.tokenize.call(testContext.context).then(function (payload) {
          expect(payload.vaulted).toBeFalsy();
        });
      }
    );

    test('sets isTokenizing to true', () => {
      CardView.prototype.tokenize.call(testContext.context);

      expect(testContext.context._isTokenizing).toBe(true);
    });

    test(
      'does not call hostedFieldsInstance.tokenize if form is invalid',
      () => {
        testContext.context.hostedFieldsInstance.getState.mockReturnValue({
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

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(function () {
          expect(testContext.context.hostedFieldsInstance.tokenize).not.toBeCalled();
        });
      }
    );

    test(
      'does not call hostedFieldsInstance.tokenize if form is valid, but card type is not supported',
      () => {
        testContext.context.hostedFieldsInstance.getState.mockReturnValue({
          cards: [{type: 'foo'}],
          fields: {
            number: {
              isValid: true
            },
            expirationDate: {
              isValid: true
            }
          }
        });

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(function () {
          expect(testContext.context.hostedFieldsInstance.tokenize).not.toBeCalled();
        });
      }
    );

    test(
      'does not call hostedFieldsInstance.tokenize if form is valid, but no card is available in state',
      () => {
        testContext.context.hostedFieldsInstance.getState.mockReturnValue({
          cards: [],
          fields: {
            number: {
              isValid: true
            },
            expirationDate: {
              isValid: true
            }
          }
        });

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(function () {
          expect(testContext.context.hostedFieldsInstance.tokenize).not.toBeCalled();
        });
      }
    );

    test('vaults on tokenization if not using guest checkout', () => {
      testContext.context.model.isGuestCheckout = false;

      return CardView.prototype.tokenize.call(testContext.context).then(function () {
        expect(testContext.context.hostedFieldsInstance.tokenize).toBeCalledWith({vault: true});
      });
    });

    test(
      'does not vault on tokenization if save card input is not checked',
      () => {
        testContext.context.model.isGuestCheckout = false;
        testContext.context.saveCardInput.checked = false;

        return CardView.prototype.tokenize.call(testContext.context).then(function () {
          expect(testContext.context.hostedFieldsInstance.tokenize).toBeCalledWith({vault: false});
        });
      }
    );

    test('does not vault on tokenization if using guest checkout', () => {
      testContext.context.model.isGuestCheckout = true;

      return CardView.prototype.tokenize.call(testContext.context).then(function () {
        expect(testContext.context.hostedFieldsInstance.tokenize).toBeCalledWith({vault: false});
      });
    });

    test('clears fields after successful tokenization', () => {
      testContext.context.hostedFieldsInstance.tokenize.mockResolvedValue({nonce: 'foo'});

      return CardView.prototype.tokenize.call(testContext.context).then(function () {
        expect(testContext.context.hostedFieldsInstance.clear).toBeCalledWith('number');
        expect(testContext.context.hostedFieldsInstance.clear).toBeCalledWith('expirationDate');
        expect(testContext.context.hostedFieldsInstance.clear).not.toBeCalledWith('cvv');
        expect(testContext.context.hostedFieldsInstance.clear).not.toBeCalledWith('postalCode');
      });
    });

    test(
      'clears cardholder name field if it exists after successful tokenization',
      () => {
        testContext.context.hostedFieldsInstance.tokenize.mockResolvedValue({nonce: 'foo'});
        testContext.context.hasCardholderName = true;
        testContext.context.cardholderNameInput = {
          value: 'Some value'
        };

        return CardView.prototype.tokenize.call(testContext.context).then(function () {
          expect(testContext.context.cardholderNameInput.value).toBe('');
        });
      }
    );

    test(
      'does not clear fields after successful tokenization if merchant configuration includes clearFieldsAfterTokenization as false',
      () => {
        testContext.context.merchantConfiguration = {
          clearFieldsAfterTokenization: false
        };
        testContext.context.hostedFieldsInstance.tokenize.mockResolvedValue({nonce: 'foo'});

        return CardView.prototype.tokenize.call(testContext.context).then(function () {
          expect(testContext.context.hostedFieldsInstance.clear).not.toBeCalled();
        });
      }
    );

    test(
      'does not clear cardholder name field after successful tokenization if merchant configuration includes clearFieldsAfterTokenization as false',
      () => {
        testContext.context.merchantConfiguration = {
          clearFieldsAfterTokenization: false
        };
        testContext.context.hasCardholderName = true;
        testContext.context.cardholderNameInput = {
          value: 'Some value'
        };
        testContext.context.hostedFieldsInstance.tokenize.mockResolvedValue({nonce: 'foo'});

        return CardView.prototype.tokenize.call(testContext.context).then(function () {
          expect(testContext.context.cardholderNameInput.value).toBe('Some value');
        });
      }
    );

    test('sets isTokenizing to false on successful tokenization', done => {
      testContext.context.hostedFieldsInstance.tokenize.mockResolvedValue({nonce: 'foo'});

      CardView.prototype.tokenize.call(testContext.context).then(function () {
        setTimeout(function () {
          expect(testContext.context._isTokenizing).toBe(false);
          done();
        }, 300);
      });
    });

    test('sets isTokenizing to false on unsuccessful tokenization', () => {
      testContext.context.hostedFieldsInstance.tokenize.mockRejectedValue(new Error('Error'));

      return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(function () {
        expect(testContext.context._isTokenizing).toBe(false);
      });
    });

    test(
      'removes braintree-sheet--loading class after successful tokenization',
      done => {
        var stubPayload = {};

        jest.spyOn(classList, 'remove').mockImplementation();
        testContext.context.hostedFieldsInstance.tokenize.mockResolvedValue(stubPayload);

        CardView.prototype.tokenize.call(testContext.context).then(function () {
          setTimeout(function () {
            expect(classList.remove).toBeCalledWith(testContext.context.element, 'braintree-sheet--loading');
            done();
          }, CHANGE_ACTIVE_PAYMENT_METHOD_TIMEOUT);
        });
      }
    );

    test(
      'removes braintree-sheet--loading class after tokenization fails',
      () => {
        jest.spyOn(classList, 'remove').mockImplementation();
        testContext.context.hostedFieldsInstance.tokenize.mockRejectedValue(new Error('foo'));

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(function () {
          expect(classList.remove).toBeCalledWith(testContext.context.element, 'braintree-sheet--loading');
        });
      }
    );

    test(
      'adds a new payment method when tokenize is successful and transition ends',
      () => {
        var stubPayload = {};

        testContext.context.hostedFieldsInstance.tokenize.mockResolvedValue(stubPayload);
        jest.spyOn(testContext.model, 'addPaymentMethod').mockImplementation();

        return CardView.prototype.tokenize.call(testContext.context).then(function () {
          expect(testContext.model.addPaymentMethod).toBeCalledWith(stubPayload);
        });
      }
    );

    test(
      'does not update the active payment method when tokenize fails',
      () => {
        testContext.context.hostedFieldsInstance.tokenize.mockRejectedValue(new Error('bad happen'));
        jest.spyOn(testContext.model, 'addPaymentMethod').mockImplementation();

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(function () {
          expect(testContext.model.addPaymentMethod).not.toBeCalled();
        });
      }
    );
  });

  describe('field errors', () => {
    beforeEach(() => {
      testContext.context = {
        fieldErrors: {
          hasOwnProperty: jest.fn().mockReturnValue(false)
        },
        hostedFieldsInstance: {
          setAttribute: jest.fn(),
          removeAttribute: jest.fn(),
          setMessage: jest.fn()
        },
        getElementById: jest.fn().mockReturnValue({})
      };

      jest.spyOn(classList, 'add').mockImplementation();
    });

    describe('showFieldError', () => {
      test('sets hosted fields attributes on hosted fields', () => {
        var fakeGroup = document.createElement('div');
        var fakeHostedField = document.createElement('iframe');

        fakeHostedField.id = 'braintree-hosted-field-foo';
        fakeGroup.appendChild(fakeHostedField);

        testContext.context.getElementById = jest.fn().mockReturnValue(fakeGroup);

        CardView.prototype.showFieldError.call(testContext.context, 'foo', 'errorMessage');

        expect(testContext.context.hostedFieldsInstance.setAttribute).toBeCalledWith({
          field: 'foo',
          attribute: 'aria-invalid',
          value: true
        });
      });

      test(
        'does not set hosted fields attributes on non hosted fields',
        () => {
          var fakeInput = document.createElement('input');
          var fakeGroup = document.createElement('div');

          fakeGroup.setAttribute('data-braintree-id', 'foo-field-group');
          fakeInput.id = 'braintree__card-view-input';
          fakeGroup.appendChild(fakeInput);

          testContext.context.getElementById = jest.fn().mockReturnValue(fakeGroup);

          CardView.prototype.showFieldError.call(testContext.context, 'foo', 'errorMessage');

          expect(testContext.context.hostedFieldsInstance.setAttribute).not.toBeCalled();
        }
      );
    });

    describe('hideFieldError', () => {
      test('removes hosted fields attributes on hosted fields', () => {
        var fakeGroup = document.createElement('div');
        var fakeHostedField = document.createElement('iframe');

        fakeHostedField.id = 'braintree-hosted-field-foo';
        fakeGroup.appendChild(fakeHostedField);

        testContext.context.getElementById = jest.fn().mockReturnValue(fakeGroup);

        CardView.prototype.hideFieldError.call(testContext.context, 'foo', 'errorMessage');

        expect(testContext.context.hostedFieldsInstance.removeAttribute).toBeCalledWith({
          field: 'foo',
          attribute: 'aria-invalid'
        });
      });

      test(
        'does not remove hosted fields attributes on non hosted fields',
        () => {
          var fakeInput = document.createElement('input');
          var fakeGroup = document.createElement('div');

          fakeGroup.setAttribute('data-braintree-id', 'foo-field-group');
          fakeInput.id = 'braintree__card-view-input';
          fakeGroup.appendChild(fakeInput);

          testContext.context.getElementById = jest.fn().mockReturnValue(fakeGroup);

          CardView.prototype.hideFieldError.call(testContext.context, 'foo', 'errorMessage');

          expect(testContext.context.hostedFieldsInstance.removeAttribute).not.toBeCalled();
        }
      );
    });
  });

  describe('teardown', () => {
    beforeEach(() => {
      testContext.context = {
        hostedFieldsInstance: {
          teardown: jest.fn().mockResolvedValue()
        }
      };
    });

    test('tears down hosted fields instance', () => {
      return CardView.prototype.teardown.call(testContext.context).then(function () {
        expect(testContext.context.hostedFieldsInstance.teardown).toBeCalledTimes(1);
      });
    });

    test('passes hosted fields teardown errors to callback', () => {
      var error = new Error('hosted fields teardown error');

      testContext.context.hostedFieldsInstance.teardown.mockRejectedValue(error);

      return CardView.prototype.teardown.call(testContext.context).then(function () {
        throw new Error('should not resolve');
      }).then(throwIfResolves).catch(function (err) {
        expect(err).toBe(error);
      });
    });
  });

  describe('getPaymentMethod', () => {
    beforeEach(() => {
      testContext.context = {
        _validateForm: jest.fn()
      };
    });

    test('returns undefined if form is invalid', () => {
      testContext.context._validateForm.mockReturnValue(false);
      expect(CardView.prototype.getPaymentMethod.call(testContext.context)).toBeUndefined(); // eslint-disable-line no-undefined
    });

    test('returns a card payment method object if form is valid', () => {
      testContext.context._validateForm.mockReturnValue(true);
      expect(CardView.prototype.getPaymentMethod.call(testContext.context)).toEqual({
        type: 'CreditCard'
      });
    });
  });

  describe('onSelection', () => {
    test('focuses on the number field', () => {
      var view = new CardView({element: testContext.element});

      view.hostedFieldsInstance = {
        focus: jest.fn()
      };

      view.onSelection();

      expect(view.hostedFieldsInstance.focus).toBeCalledTimes(1);
      expect(view.hostedFieldsInstance.focus).toBeCalledWith('number');
    });

    test('noops if the hosted fields instance is not available', () => {
      var view = new CardView({element: testContext.element});

      delete view.hostedFieldsInstance;

      expect(function () {
        view.onSelection();
      }).not.toThrowError();
    });
  });
});
