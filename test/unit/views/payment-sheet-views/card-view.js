
const BaseView = require('../../../../src/views/base-view');
const CardView = require('../../../../src/views/payment-sheet-views/card-view');
const classList = require('@braintree/class-list');
const DropinModel = require('../../../../src/dropin-model');
const fake = require('../../../helpers/fake');
const throwIfResolves = require('../../../helpers/throw-if-resolves');
const fs = require('fs');
const hostedFields = require('braintree-web/hosted-fields');
const strings = require('../../../../src/translations/en_US');
const transitionHelper = require('../../../../src/lib/transition-helper');
const {
  yields
} = require('../../../helpers/yields');

const mainHTML = fs.readFileSync(__dirname + '/../../../../src/html/main.html', 'utf8');
const CHANGE_ACTIVE_PAYMENT_METHOD_TIMEOUT = require('../../../../src/constants').CHANGE_ACTIVE_PAYMENT_METHOD_TIMEOUT;

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
      expect(new CardView({ element: testContext.element })).toBeInstanceOf(BaseView);
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      testContext.hostedFieldsInstance = fake.hostedFieldsInstance;
      fake.hostedFieldsInstance.getSupportedCardTypes.mockResolvedValue([]);
      jest.spyOn(hostedFields, 'create').mockResolvedValue(testContext.hostedFieldsInstance);

      testContext.model = fake.model();

      return testContext.model.initialize();
    });

    test('has cvv by default', async () => {
      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      await testContext.view.initialize();

      expect(testContext.element.querySelector('[data-braintree-id="cvv-field-group"]')).toBeTruthy();
    });

    test('does not have cvv if merchant passes `card.cvv.collect = false`', async () => {
      testContext.model.merchantConfiguration.card = {
        cvv: {
          collect: false
        }
      };

      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      await testContext.view.initialize();

      expect(testContext.element.querySelector('[data-braintree-id="cvv-field-group"]')).toBeFalsy();
    });

    test('has postal code if merchant passes `card.postalCode.collect = true`', async () => {
      testContext.model.merchantConfiguration.card = {
        postalCode: {
          collect: true
        }
      };

      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      await testContext.view.initialize();

      expect(testContext.element.querySelector('[data-braintree-id="postal-code-field-group"]')).toBeTruthy();
    });

    test('does not have postal code by default', async () => {
      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      await testContext.view.initialize();

      expect(testContext.element.querySelector('[data-braintree-id="postal-code-field-group"]')).toBeFalsy();
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

      return testContext.view.initialize().then(() => {
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

        return testContext.view.initialize().then(() => {
          expect(testContext.element.querySelector('[data-braintree-id="cardholder-name-field-group"]')).toBeFalsy();
        });
      }
    );

    test('removes hidden class from save card input if configured', () => {
      testContext.model.merchantConfiguration.card = {
        vault: {
          allowAutoVaultOverride: true
        }
      };
      testContext.model.vaultManagerConfig.autoVaultPaymentMethods = true;

      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      return testContext.view.initialize().then(() => {
        expect(
          testContext.element.querySelector('[data-braintree-id="save-card-field-group"]').className
        ).not.toMatch('braintree-hidden');
      });
    });

    test(
      'does not remove hidden class from save card input if not configured',
      () => {
        testContext.model.merchantConfiguration.card = {};
        testContext.model.vaultManagerConfig.autoVaultPaymentMethods = true;

        testContext.view = new CardView({
          element: testContext.element,
          mainView: testContext.mainView,
          model: testContext.model,
          client: testContext.client,
          strings: strings
        });

        return testContext.view.initialize().then(() => {
          expect(
            testContext.element.querySelector('[data-braintree-id="save-card-field-group"]').className
          ).toMatch('braintree-hidden');
        });
      }
    );

    test('sets checked value for save card input', () => {
      testContext.model.merchantConfiguration.card = {
        vault: {
          autoVault: false
        }
      };

      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      return testContext.view.initialize().then(() => {
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

      return testContext.view.initialize().then(() => {
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

      return testContext.view.initialize().then(() => {
        expect(DropinModel.prototype.asyncDependencyStarting).toBeCalledTimes(1);
      });
    });

    test('notifies async dependency is ready when Hosted Fields is created', async () => {
      jest.spyOn(DropinModel.prototype, 'asyncDependencyReady');

      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      await testContext.view.initialize();

      expect(DropinModel.prototype.asyncDependencyReady).toBeCalledTimes(1);
    });

    test('creates Hosted Fields with number, cvv and expiration date', () => {
      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      return testContext.view.initialize().then(() => {
        expect(hostedFields.create).toBeCalledWith(expect.objectContaining({
          client: testContext.client,
          fields: {
            number: expect.any(Object),
            cvv: expect.any(Object),
            expirationDate: expect.any(Object)
          }
        }));
      });
    });

    test(
      'creates Hosted Fields with postal code if included in config',
      () => {
        testContext.model.merchantConfiguration.card = {
          postalCode: {
            collect: true
          }
        };

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

        return testContext.view.initialize().then(() => {
          expect(hostedFields.create.mock.calls[0][0].fields).toHaveProperty('postalCode');
        });
      }
    );

    test(
      'calls asyncDependencyFailed with an error when Hosted Fields creation fails',
      () => {
        const fakeError = {
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

        return testContext.view.initialize().then(() => {
          expect(testContext.model.asyncDependencyFailed).toBeCalledWith({
            view: 'card',
            error: fakeError
          });
        });
      }
    );

    test('shows supported card icons', (done) => {
      const unsupportedCardTypes = ['maestro', 'diners-club', 'unionpay', 'discover'];
      const supportedCardTypes = ['visa', 'mastercard', 'american-express', 'jcb'];

      testContext.hostedFieldsInstance.getSupportedCardTypes.mockResolvedValue([
        'Visa',
        'Mastercard',
        'American Express',
        'JCB'
      ]);

      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      testContext.view.initialize().then(() => {
        setTimeout(() => {
          unsupportedCardTypes.forEach(cardType => {
            const cardIcon = testContext.element.querySelector('[data-braintree-id="' + cardType + '-card-icon"]');

            expect(cardIcon.classList.contains('braintree-hidden')).toBe(true);
          });
          supportedCardTypes.forEach(cardType => {
            const cardIcon = testContext.element.querySelector('[data-braintree-id="' + cardType + '-card-icon"]');

            expect(cardIcon.classList.contains('braintree-hidden')).toBe(false);
          });

          done();
        }, 1);
      });
    });

    test('does not show UnionPay icon even if it is supported', () => {
      let unionPayCardIcon;

      testContext.client.getConfiguration.mockReturnValue({
        gatewayConfiguration: {
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

      return testContext.view.initialize().then(() => {
        unionPayCardIcon = testContext.element.querySelector('[data-braintree-id="unionpay-card-icon"]');

        expect(unionPayCardIcon.classList.contains('braintree-hidden')).toBe(true);
      });
    });

    test('sets field placeholders', () => {
      let hostedFieldsConfiguredFields;

      testContext.model.merchantConfiguration.card = {
        postalCode: {
          collect: true
        }
      };

      testContext.view = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      return testContext.view.initialize().then(() => {
        hostedFieldsConfiguredFields = hostedFields.create.mock.calls[0][0].fields;

        expect(hostedFieldsConfiguredFields.number.placeholder).toBe('•••• •••• •••• ••••');
        expect(hostedFieldsConfiguredFields.expirationDate.placeholder).toBe(strings.expirationDatePlaceholder);
        expect(hostedFieldsConfiguredFields.cvv.placeholder).toBe('•••');
        expect(hostedFieldsConfiguredFields.postalCode.placeholder).toBeFalsy();
      });
    });

    test('allows overriding field options for hosted fields', () => {
      let hostedFieldsConfiguredFields;

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

      return testContext.view.initialize().then(() => {
        hostedFieldsConfiguredFields = hostedFields.create.mock.calls[0][0].fields;

        expect(hostedFieldsConfiguredFields.number.placeholder).toBe('placeholder');
        expect(hostedFieldsConfiguredFields.cvv.maxlength).toBe(2);
      });
    });

    test(
      'does not add hosted fields elements for fields that are not present',
      () => {
        let hostedFieldsConfiguredFields;

        testContext.model.merchantConfiguration.card = {
          cvv: {
            collect: false
          },
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

        return testContext.view.initialize().then(() => {
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

      return testContext.view.initialize().then(() => {
        const hostedFieldsConfiguredFields = hostedFields.create.mock.calls[0][0].fields;

        expect(hostedFieldsConfiguredFields.number.selector).not.toBe('#some-selector');
      });
    });

    test('allows overriding styles options for hosted fields', () => {
      let hostedFieldsConfiguredStyles;

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

      return testContext.view.initialize().then(() => {
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
        let hostedFieldsConfiguredStyles;

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

        return testContext.view.initialize().then(() => {
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
        merchantConfiguration: {}
      };
    });

    test(
      'resolves with true when no merchant configuratoin provided',
      () => {
        return CardView.isEnabled(testContext.fakeOptions).then(result => {
          expect(result).toBe(true);
        });
      }
    );

    test(
      'resovles with false when merchant configuration sets card to false',
      () => {
        testContext.fakeOptions.merchantConfiguration.card = false;

        return CardView.isEnabled(testContext.fakeOptions).then(result => {
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
      const cardView = new CardView({
        element: testContext.element,
        mainView: testContext.mainView,
        model: testContext.model,
        client: testContext.client,
        strings: strings
      });

      jest.spyOn(cardView, 'tokenize').mockRejectedValue(new Error('foo'));

      return cardView.requestPaymentMethod().then(throwIfResolves).catch(err => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('foo');
      });
    });

    test(
      'calls the callback with the payload when tokenize is successful',
      () => {
        const cardView = new CardView({
          element: testContext.element,
          mainView: testContext.mainView,
          model: testContext.model,
          client: testContext.client,
          strings: strings
        });

        jest.spyOn(cardView, 'tokenize').mockResolvedValue({ foo: 'bar' });

        return cardView.requestPaymentMethod().then(payload => {
          expect(payload.foo).toBe('bar');
        });
      }
    );
  });

  describe('Hosted Fields events', () => {
    beforeEach(() => {
      const model = fake.model();

      return model.initialize().then(() => {
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
          _showSupportedCardIcons: function () {},
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
        const hostedFieldsInstance = {
          on: jest.fn().mockImplementation(yields({ emittedBy: 'number' }))
        };

        jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

        return CardView.prototype.initialize.call(testContext.context).then(() => {
          const cardNumberIcon = testContext.element.querySelector('[data-braintree-id="card-number-icon"]');

          expect(cardNumberIcon.classList.contains('braintree-hidden')).toBe(false);
          expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).toBe('#iconCardFront');
        });
      });

      test('shows default cvv icon in cvv field when focused', () => {
        const hostedFieldsInstance = {
          on: jest.fn().mockImplementation(yields({ emittedBy: 'cvv' }))
        };

        jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

        return CardView.prototype.initialize.call(testContext.context).then(() => {
          const cvvIcon = testContext.element.querySelector('[data-braintree-id="cvv-icon"]');

          expect(cvvIcon.classList.contains('braintree-hidden')).toBe(false);
          expect(cvvIcon.querySelector('use').getAttribute('xlink:href')).toBe('#iconCVVBack');
        });
      });

      test('adds braintree-form__field-group--is-focused', () => {
        const fakeEvent = {
          emittedBy: 'number',
          fields: {
            number: { isEmpty: true }
          }
        };
        const hostedFieldsInstance = {
          on: function (event, callback) {
            if (event === 'focus') {
              callback(fakeEvent);
            }
          }
        };
        const numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');

        jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);
        classList.remove(numberFieldGroup, 'braintree-form__field-group--is-focused');

        return CardView.prototype.initialize.call(testContext.context).then(() => {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--is-focused')).toBe(true);
        });
      });
    });

    describe('onBlurEvent', () => {
      beforeEach(() => {
        testContext.context._onBlurEvent = CardView.prototype._onBlurEvent;
        jest.spyOn(window, 'setTimeout').mockImplementation();
      });

      test(
        'removes braintree-form__field-group--is-focused class when blurred',
        () => {
          const fakeEvent = {
            cards: [{ type: 'visa', supported: true }],
            emittedBy: 'number',
            fields: {
              number: { isEmpty: true }
            }
          };
          const hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: jest.fn()
          };
          const numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);
          classList.add(numberFieldGroup, 'braintree-form__field-group--is-focused');

          return CardView.prototype.initialize.call(testContext.context).then(() => {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--is-focused')).toBe(false);
          });
        }
      );

      test('applies error class if field is not valid', () => {
        const fakeEvent = {
          emittedBy: 'number',
          fields: {
            number: {
              isEmpty: false,
              isValid: false
            }
          }
        };
        const hostedFieldsInstance = {
          on: function (event, callback) {
            if (event === 'blur') {
              callback(fakeEvent);
            }
          },
          setAttribute: jest.fn()
        };
        const numberFieldError = testContext.element.querySelector('[data-braintree-id="number-field-error"]');
        const numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');

        classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');
        jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

        return CardView.prototype.initialize.call(testContext.context).then(() => {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(true);
          expect(numberFieldError.textContent).toBe('This card number is not valid.');
        });
      });

      test(
        'does apply error class if field is empty when focusing another hosted field',
        () => {
          const fakeHostedField = document.createElement('iframe');
          const fakeEvent = {
            cards: [{ type: 'visa', supported: true }],
            emittedBy: 'number',
            fields: {
              number: {
                isEmpty: true,
                isValid: false
              }
            }
          };
          const modelOptions = fake.modelOptions();
          const hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: jest.fn()
          };
          const numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');
          const numberFieldError = testContext.element.querySelector('[data-braintree-id="number-field-error"]');

          fakeHostedField.id = 'braintree-hosted-field-foo';
          document.body.appendChild(fakeHostedField);
          fakeHostedField.focus();

          modelOptions.merchantConfiguration.authorization = fake.clientToken;
          testContext.context.model = fake.model(modelOptions);

          classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');
          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return testContext.context.model.initialize().then(() => {
            return CardView.prototype.initialize.call(testContext.context);
          }).then(() => {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(true);
            expect(numberFieldError.textContent).toBe('Please fill out a card number.');
          });
        }
      );

      test(
        'sets the empty error when programatically focussing a hosted field (requires a setTimeout)',
        done => {
          window.setTimeout.mockRestore();

          const fakeElement = document.createElement('div');
          const fakeHostedField = document.createElement('iframe');
          const fakeEvent = {
            cards: [{ type: 'visa', supported: true }],
            emittedBy: 'number',
            fields: {
              number: {
                isEmpty: true,
                isValid: false
              }
            }
          };
          const modelOptions = fake.modelOptions();
          const hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: jest.fn(),
            setMessage: jest.fn()
          };
          const numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');

          fakeHostedField.id = 'braintree-hosted-field-foo';
          document.body.appendChild(fakeElement);
          document.body.appendChild(fakeHostedField);
          fakeElement.focus();

          modelOptions.merchantConfiguration.authorization = fake.clientToken;
          testContext.context.model = fake.model(modelOptions);

          classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');
          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return testContext.context.model.initialize().then(() => {
            return CardView.prototype.initialize.call(testContext.context);
          }).then(() => {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(false);

            fakeHostedField.focus();

            setTimeout(() => {
              expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(true);
              done();
            }, 300);
          });
        }
      );

      test(
        'does not apply error class if field is empty and not focusing hosted fields',
        () => {
          const fakeElement = document.createElement('iframe');
          const fakeEvent = {
            cards: [{ type: 'visa', supported: true }],
            emittedBy: 'number',
            fields: {
              number: {
                isEmpty: true,
                isValid: false
              }
            }
          };
          const modelOptions = fake.modelOptions();
          const hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent))
          };
          const numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');

          document.body.appendChild(fakeElement);
          fakeElement.focus();

          modelOptions.merchantConfiguration.authorization = fake.clientToken;
          testContext.context.model = fake.model(modelOptions);

          classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');
          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return testContext.context.model.initialize().then(() => {
            return CardView.prototype.initialize.call(testContext.context);
          }).then(() => {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(false);
          });
        }
      );

      test(
        'does not apply error class if field is empty and the active element is not an iframe',
        () => {
          const fakeElement = document.createElement('div');
          const fakeEvent = {
            cards: [{ type: 'visa', supported: true }],
            emittedBy: 'number',
            fields: {
              number: {
                isEmpty: true,
                isValid: false
              }
            }
          };
          const modelOptions = fake.modelOptions();
          const hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent))
          };
          const numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');

          document.body.appendChild(fakeElement);
          fakeElement.focus();

          modelOptions.merchantConfiguration.authorization = fake.clientToken;
          testContext.context.model = fake.model(modelOptions);

          classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');
          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return testContext.context.model.initialize().then(() => {
            return CardView.prototype.initialize.call(testContext.context);
          }).then(() => {
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
          const numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');
          const fakeEvent = {
            cards: [{ type: 'master-card', supported: true }],
            emittedBy: 'number'
          };
          const hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: function () {}
          };

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(() => {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--card-type-known')).toBe(true);
          });
        }
      );

      test(
        'removes the card-type-known class when there is no possible card type',
        () => {
          const numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');
          const fakeEvent = {
            cards: [],
            emittedBy: 'number'
          };
          const hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: function () {}
          };

          classList.add(numberFieldGroup, 'braintree-form__field-group--card-type-known');

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(() => {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--card-type-known')).toBe(false);
          });
        }
      );

      test(
        'removes the card-type-known class when there are many possible card types',
        () => {
          const numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');
          const fakeEvent = {
            cards: [{ type: 'master-card', supported: true }, { type: 'foo-pay', supported: true }],
            emittedBy: 'number'
          };
          const hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: function () {}
          };

          classList.add(numberFieldGroup, 'braintree-form__field-group--card-type-known');

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(() => {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--card-type-known')).toBe(false);
          });
        }
      );

      test(
        'updates the card number icon to the card type if there is one possible card type',
        () => {
          const cardNumberIcon = testContext.element.querySelector('[data-braintree-id="card-number-icon"]');
          const fakeEvent = {
            cards: [{ type: 'master-card', supported: true }],
            emittedBy: 'number'
          };
          const hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: function () {}
          };

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(() => {
            expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).toBe('#icon-master-card');
          });
        }
      );

      test(
        'updates the card number icon to the generic card if there are many possible card types',
        () => {
          const cardNumberIcon = testContext.element.querySelector('[data-braintree-id="card-number-icon"]');
          const fakeEvent = {
            cards: [{ type: 'master-card', supported: true }, { type: 'foo-pay', supported: true }],
            emittedBy: 'number'
          };
          const hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: function () {}
          };

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(() => {
            expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).toBe('#iconCardFront');
          });
        }
      );

      test(
        'updates the card icon to the generic card if there no card types',
        () => {
          const cardNumberIcon = testContext.element.querySelector('[data-braintree-id="card-number-icon"]');
          const fakeEvent = {
            cards: [],
            emittedBy: 'number'
          };
          const hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: function () {}
          };

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(() => {
            expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).toBe('#iconCardFront');
          });
        }
      );

      test('updates the cvv icon to back icon for non-amex cards', () => {
        const use = testContext.element.querySelector('[data-braintree-id="cvv-icon"]').querySelector('use');
        const fakeEvent = {
          cards: [{ type: 'visa', supported: true }],
          emittedBy: 'number'
        };
        const hostedFieldsInstance = {
          on: jest.fn().mockImplementation(yields(fakeEvent)),
          setAttribute: function () {}
        };

        use.setAttribute('xlink:href', '#iconCVVFront');
        jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

        return CardView.prototype.initialize.call(testContext.context).then(() => {
          expect(use.getAttribute('xlink:href')).toBe('#iconCVVBack');
        });
      });

      test('updates the cvv icon to front icon for amex cards', () => {
        const use = testContext.element.querySelector('[data-braintree-id="cvv-icon"]').querySelector('use');
        const fakeEvent = {
          cards: [{ type: 'american-express', supported: true }],
          emittedBy: 'number'
        };
        const hostedFieldsInstance = {
          on: jest.fn().mockImplementation(yields(fakeEvent)),
          setAttribute: function () {}
        };

        jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

        return CardView.prototype.initialize.call(testContext.context).then(() => {
          expect(use.getAttribute('xlink:href')).toBe('#iconCVVFront');
        });
      });

      test(
        'updates the cvv label descriptor to four digits when card type is amex',
        () => {
          const cvvLabelDescriptor = testContext.element.querySelector('[data-braintree-id="cvv-field-group"]').querySelector('.braintree-form__descriptor');
          const fakeEvent = {
            cards: [{ type: 'american-express', supported: true }],
            emittedBy: 'number'
          };
          const hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: function () {}
          };

          cvvLabelDescriptor.textContent = 'some value';
          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(() => {
            expect(cvvLabelDescriptor.textContent).toBe('(4 digits)');
          });
        }
      );

      test(
        'updates the cvv label descriptor to three digits when card type is non-amex',
        () => {
          const cvvLabelDescriptor = testContext.element.querySelector('[data-braintree-id="cvv-field-group"]').querySelector('.braintree-form__descriptor');
          const fakeEvent = {
            cards: [{ type: 'visa', supported: true }],
            emittedBy: 'number'
          };
          const hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: function () {}
          };

          cvvLabelDescriptor.textContent = 'some value';
          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(() => {
            expect(cvvLabelDescriptor.textContent).toBe('(3 digits)');
          });
        }
      );

      test(
        'updates the cvv label descriptor to three digits when multiple card types',
        () => {
          const cvvLabelDescriptor = testContext.element.querySelector('[data-braintree-id="cvv-field-group"]').querySelector('.braintree-form__descriptor');
          const fakeEvent = {
            cards: [{ type: 'american-express', supported: true }, { type: 'visa', supported: true }],
            emittedBy: 'number'
          };
          const hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: function () {}
          };

          cvvLabelDescriptor.textContent = 'some value';
          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(() => {
            expect(cvvLabelDescriptor.textContent).toBe('(3 digits)');
          });
        }
      );

      test('updates the cvv field placeholder when card type is amex', () => {
        const fakeEvent = {
          cards: [{ type: 'american-express', supported: true }],
          emittedBy: 'number'
        };
        const hostedFieldsInstance = {
          on: jest.fn().mockImplementation(yields(fakeEvent)),
          setAttribute: jest.fn()
        };

        jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

        return CardView.prototype.initialize.call(testContext.context).then(() => {
          expect(hostedFieldsInstance.setAttribute).toBeCalledWith({ field: 'cvv', attribute: 'placeholder', value: '••••' });
        });
      });

      test(
        'updates the cvv field placeholder when card type is non-amex',
        () => {
          const fakeEvent = {
            cards: [{ type: 'visa', supported: true }],
            emittedBy: 'number'
          };
          const hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: jest.fn()
          };

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(() => {
            expect(hostedFieldsInstance.setAttribute).toBeCalledWith({ field: 'cvv', attribute: 'placeholder', value: '•••' });
          });
        }
      );

      test(
        'updates the cvv field placeholder when multiple card types',
        () => {
          const fakeEvent = {
            cards: [{ type: 'american-express', supported: true }, { type: 'visa', supported: true }],
            emittedBy: 'number'
          };
          const hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: jest.fn()
          };

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(() => {
            expect(hostedFieldsInstance.setAttribute).toBeCalledWith({ field: 'cvv', attribute: 'placeholder', value: '•••' });
          });
        }
      );

      test(
        'does not update the cvv field placeholder when there is no cvv challenge',
        () => {
          const fakeEvent = {
            cards: [{ type: 'american-express', supported: true }, { type: 'visa', supported: true }],
            emittedBy: 'number'
          };
          const hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            setAttribute: jest.fn()
          };

          testContext.context.model.merchantConfiguration.card = {
            cvv: {
              collect: false
            }
          };

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(() => {
            expect(hostedFieldsInstance.setAttribute).not.toBeCalled();
          });
        }
      );

      test(
        'does not update the cvv field placeholder when it is removed with an override',
        () => {
          const fakeEvent = {
            cards: [{ type: 'american-express', supported: true }, { type: 'visa', supported: true }],
            emittedBy: 'number'
          };
          const hostedFieldsInstance = {
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

          return CardView.prototype.initialize.call(testContext.context).then(() => {
            expect(hostedFieldsInstance.setAttribute).not.toBeCalled();
          });
        }
      );

      test(
        'does not update the cvv field placeholder when using a custom CVV placeholder',
        () => {
          const fakeEvent = {
            cards: [{ type: 'american-express', supported: true }, { type: 'visa', supported: true }],
            emittedBy: 'number'
          };
          const hostedFieldsInstance = {
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

          return CardView.prototype.initialize.call(testContext.context).then(() => {
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
          const fakeEvent = {
            emittedBy: 'number',
            cards: [{ type: 'visa', supported: true }],
            fields: {
              number: {
                container: document.createElement('div'),
                isEmpty: false,
                isValid: false,
                isPotentiallyValid: true
              }
            }
          };
          const hostedFieldsInstance = {
            on: jest.fn().mockImplementation(yields(fakeEvent)),
            removeAttribute: jest.fn()
          };
          const numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');

          classList.add(numberFieldGroup, 'braintree-form__field-group--has-error');
          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(() => {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(false);
          });
        }
      );

      test(
        'adds braintree-form__field--valid class to valid expiration date field',
        () => {
          const expirationElement = testContext.element.querySelector('.braintree-form-expiration');
          const fakeEvent = {
            cards: [{ type: 'visa', supported: true }],
            emittedBy: 'expirationDate',
            fields: {
              expirationDate: {
                container: expirationElement,
                isValid: true,
                isPotentiallyValid: true
              }
            }
          };
          const hostedFieldsInstance = {
            on: function (event, callback) {
              if (event === 'validityChange') {
                callback(fakeEvent);
              }
            },
            removeAttribute: jest.fn()
          };

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(() => {
            expect(expirationElement.classList.contains('braintree-form__field--valid')).toBe(true);
          });
        }
      );

      test(
        'removes braintree-form__field--valid class to invalid expiration date field',
        () => {
          const expirationElement = testContext.element.querySelector('.braintree-form-expiration');
          const fakeEvent = {
            cards: [{ type: 'visa', supported: true }],
            emittedBy: 'expirationDate',
            fields: {
              expirationDate: {
                container: expirationElement,
                isValid: false,
                isPotentiallyValid: true
              }
            }
          };
          const hostedFieldsInstance = {
            on: function (event, callback) {
              if (event === 'validityChange') {
                callback(fakeEvent);
              }
            },
            removeAttribute: jest.fn()
          };

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(() => {
            expect(expirationElement.classList.contains('braintree-form__field--valid')).toBe(false);
          });
        }
      );

      test(
        'adds braintree-form__field--valid class to valid number with card type supported',
        () => {
          const numberElement = testContext.element.querySelector('.braintree-form-number');
          const fakeEvent = {
            cards: [{ type: 'visa', supported: true }],
            emittedBy: 'number',
            fields: {
              number: {
                container: numberElement,
                isValid: true,
                isPotentiallyValid: true
              }
            }
          };
          const hostedFieldsInstance = {
            on: function (event, callback) {
              if (event === 'validityChange') {
                callback(fakeEvent);
              }
            },
            removeAttribute: jest.fn()
          };

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(() => {
            expect(numberElement.classList.contains('braintree-form__field--valid')).toBe(true);
          });
        }
      );

      test(
        'removes braintree-form__field--valid class to valid number without card type supported',
        () => {
          const numberElement = testContext.element.querySelector('.braintree-form-number');
          const fakeEvent = {
            cards: [{ type: 'foo', supported: false }],
            emittedBy: 'number',
            fields: {
              number: {
                container: numberElement,
                isValid: false,
                isPotentiallyValid: true
              }
            }
          };
          const hostedFieldsInstance = {
            on: function (event, callback) {
              if (event === 'validityChange') {
                callback(fakeEvent);
              }
            },
            removeAttribute: jest.fn()
          };

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(() => {
            expect(numberElement.classList.contains('braintree-form__field--valid')).toBe(false);
          });
        }
      );

      test(
        'removes braintree-form__field--valid class to not valid number with card type supported',
        () => {
          const numberElement = testContext.element.querySelector('.braintree-form-number');
          const fakeEvent = {
            cards: [{ type: 'visa', supported: true }],
            emittedBy: 'number',
            fields: {
              number: {
                container: numberElement,
                isValid: false,
                isPotentiallyValid: true
              }
            }
          };
          const hostedFieldsInstance = {
            on: function (event, callback) {
              if (event === 'validityChange') {
                callback(fakeEvent);
              }
            },
            removeAttribute: jest.fn()
          };

          jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

          return CardView.prototype.initialize.call(testContext.context).then(() => {
            expect(numberElement.classList.contains('braintree-form__field--valid')).toBe(false);
          });
        }
      );

      test(
        'calls model.setPaymentMethodRequestable with isRequestable true if form is valid',
        () => {
          const numberElement = testContext.element.querySelector('.braintree-form-number');
          const fakeEvent = {
            cards: [{ type: 'visa', supported: true }],
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
          const numberElement = testContext.element.querySelector('.braintree-form-number');
          const fakeEvent = {
            cards: [{ type: 'visa', supported: true }],
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
          const numberElement = testContext.element.querySelector('.braintree-form-number');
          const fakeEvent = {
            cards: [{ type: 'visa', supported: true }],
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
        const fakeEvent = {
          emittedBy: 'number',
          cards: [{ type: 'visa', supported: true }],
          fields: {
            number: {
              container: document.createElement('div'),
              isEmpty: false,
              isValid: false,
              isPotentiallyValid: true
            }
          }
        };
        const hostedFieldsInstance = {
          on: jest.fn().mockImplementation(yields(fakeEvent)),
          removeAttribute: jest.fn()
        };
        const numberFieldGroup = testContext.element.querySelector('[data-braintree-id="number-field-group"]');

        classList.add(numberFieldGroup, 'braintree-form__field-group--has-error');
        jest.spyOn(hostedFields, 'create').mockResolvedValue(hostedFieldsInstance);

        return CardView.prototype.initialize.call(testContext.context).then(() => {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(false);
        });
      });
    });
  });

  describe('tokenize', () => {
    beforeEach(() => {
      fake.hostedFieldsInstance.getState.mockReturnValue({
        cards: [{ type: 'visa', supported: true }],
        fields: {
          number: {
            isValid: true
          },
          expirationDate: {
            isValid: true
          }
        }
      });
      fake.hostedFieldsInstance.tokenize.mockResolvedValue({});
      testContext.model = fake.model();

      return testContext.model.initialize().then(() => {
        testContext.context = {
          element: testContext.element,
          _shouldVault: CardView.prototype._shouldVault,
          saveCardInput: {
            checked: true
          },
          getElementById: BaseView.prototype.getElementById,
          hostedFieldsInstance: fake.hostedFieldsInstance,
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
            vault: {},
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
        cards: [{ type: 'Card', supported: true }],
        fields: {
          number: {
            isValid: true
          },
          expirationDate: {
            isValid: false
          }
        }
      });

      return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(() => {
        expect(testContext.model.clearError).toBeCalled();
      });
    });

    test('throws an error if there is no valid card type', () => {
      testContext.context.hostedFieldsInstance.getState.mockReturnValue({
        cards: [{ type: 'Card', supported: true }],
        fields: {
          number: {
            isValid: true
          },
          expirationDate: {
            isValid: false
          }
        }
      });

      return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(err => {
        expect(err).toBeDefined();
        expect(fake.hostedFieldsInstance.tokenize).not.toBeCalled();
      });
    });

    test(
      'calls callback with error and reports error to DropinModel if form is not valid',
      () => {
        testContext.context.hostedFieldsInstance.getState.mockReturnValue({
          cards: [{ type: 'visa', supported: true }],
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

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(err => {
          expect(fake.hostedFieldsInstance.tokenize).not.toBeCalled();
          expect(testContext.context.model.reportError).toBeCalledWith('hostedFieldsFieldsInvalidError');
          expect(err.message).toBe('No payment method is available.');
        });
      }
    );

    test(
      'calls callback with error when cardholder name is required and the input is empty',
      () => {
        testContext.context.hostedFieldsInstance.getState.mockReturnValue({
          cards: [{ type: 'visa', supported: true }],
          fields: {
            number: {
              isValid: true
            },
            expirationDate: {
              isValid: true
            }
          }
        });
        testContext.context.cardholderNameInput = { value: '' };
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

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(err => {
          expect(fake.hostedFieldsInstance.tokenize).not.toBeCalled();
          expect(testContext.context.model.reportError).toBeCalledWith('hostedFieldsFieldsInvalidError');
          expect(err.message).toBe('No payment method is available.');
        });
      }
    );

    test(
      'does not error if cardholder name is empty, but not required',
      () => {
        testContext.context.hostedFieldsInstance.getState.mockReturnValue({
          cards: [{ type: 'visa', supported: true }],
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
        testContext.context.cardholderNameInput = { value: '' };

        jest.spyOn(testContext.context.model, 'reportError').mockImplementation();

        return CardView.prototype.tokenize.call(testContext.context).then(() => {
          expect(testContext.context.model.reportError).not.toBeCalled();
          expect(fake.hostedFieldsInstance.tokenize).toBeCalledTimes(1);
        });
      }
    );

    test('does not error if cardholder name is not included', () => {
      testContext.context.hostedFieldsInstance.getState.mockReturnValue({
        cards: [{ type: 'visa', supported: true }],
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

      return CardView.prototype.tokenize.call(testContext.context).then(() => {
        expect(testContext.context.model.reportError).not.toBeCalled();
        expect(fake.hostedFieldsInstance.tokenize).toBeCalledTimes(1);
      });
    });

    test(
      'calls callback with error when cardholder name length is over 255 characters',
      () => {
        const overLengthValue = Array(256).join('a');

        testContext.context.hostedFieldsInstance.getState.mockReturnValue({
          cards: [{ type: 'visa', supported: true }],
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

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(err => {
          expect(fake.hostedFieldsInstance.tokenize).not.toBeCalled();
          expect(testContext.context.model.reportError).toBeCalledWith('hostedFieldsFieldsInvalidError');
          expect(err.message).toBe('No payment method is available.');
        });
      }
    );

    test(
      'reports an error to DropinModel when Hosted Fields tokenization returns an error',
      () => {
        const fakeError = {
          code: 'A_REAL_ERROR_CODE'
        };

        testContext.context.hostedFieldsInstance.tokenize.mockRejectedValue(fakeError);
        jest.spyOn(testContext.context.model, 'reportError').mockImplementation();

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(() => {
          expect(testContext.context.model.reportError).toBeCalledWith(fakeError);
        });
      }
    );

    test(
      'reports a duplicate card error to DropinModel when tokenization returns an error',
      () => {
        const fakeError = { code: 'HOSTED_FIELDS_TOKENIZATION_FAIL_ON_DUPLICATE' };

        testContext.context.hostedFieldsInstance.tokenize.mockRejectedValue(fakeError);
        jest.spyOn(testContext.context.model, 'reportError').mockImplementation();

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(() => {
          expect(testContext.context.model.reportError).toBeCalledWith(fakeError);
        });
      }
    );

    test(
      'shows unsupported card field error when attempting to use an unsupported card and reports an error',
      () => {
        const numberFieldError = testContext.element.querySelector('[data-braintree-id="number-field-error"]');

        jest.spyOn(testContext.context.model, 'reportError').mockImplementation();
        testContext.context.hostedFieldsInstance.getState.mockReturnValue({
          cards: [{ type: 'foo', supported: false }],
          fields: {
            number: {
              isEmpty: false,
              isValid: false
            },
            expirationDate: {
              isValid: true
            }
          }
        });

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(() => {
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
        const numberFieldError = testContext.element.querySelector('[data-braintree-id="number-field-error"]');

        testContext.context.hostedFieldsInstance.getState.mockReturnValue({
          cards: [{ type: 'visa', supported: true }],
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

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(() => {
          expect(numberFieldError.classList.contains('braintree-hidden')).toBe(false);
          expect(numberFieldError.textContent).toBe('Please fill out a card number.');
          expect(testContext.context.hostedFieldsInstance.tokenize).not.toBeCalled();
        });
      }
    );

    test(
      'shows invalid field error when attempting to submit an invalid field',
      () => {
        const numberFieldError = testContext.element.querySelector('[data-braintree-id="number-field-error"]');

        testContext.context.hostedFieldsInstance.getState.mockReturnValue({
          cards: [{ type: 'visa', supported: true }],
          fields: {
            number: {
              isValid: false
            },
            expirationDate: {
              isValid: true
            }
          }
        });

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(() => {
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
          cards: [{ type: 'visa', supported: true }],
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
        const input = {
          id: {
            indexOf: function () {
              return 1;
            }
          },
          setAttribute: jest.fn()
        };
        const fieldGroup = {
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
          cards: [{ type: 'visa', supported: true }],
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
        const input = {
          id: {
            indexOf: function () {
              return 1;
            }
          },
          removeAttribute: jest.fn()
        };
        const fieldGroup = {
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
      return CardView.prototype.tokenize.call(testContext.context).then(() => {
        expect(testContext.context.hostedFieldsInstance.tokenize).toBeCalledTimes(1);
      });
    });

    test(
      'includes `vaulted: true` in tokenization payload if not guest checkout',
      () => {
        testContext.context.model.vaultManagerConfig.autoVaultPaymentMethods = true;

        return CardView.prototype.tokenize.call(testContext.context).then(payload => {
          expect(payload.vaulted).toBe(true);
        });
      }
    );

    test(
      'does not include `vaulted: true` in tokenization payload if save card input is not checked',
      () => {
        testContext.context.model.vaultManagerConfig.autoVaultPaymentMethods = true;
        testContext.context.saveCardInput.checked = false;

        return CardView.prototype.tokenize.call(testContext.context).then(payload => {
          expect(payload.vaulted).toBeFalsy();
        });
      }
    );

    test(
      'does not include `vaulted: true` in tokenization payload if guest checkout',
      () => {
        testContext.context.model.vaultManagerConfig.autoVaultPaymentMethods = false;

        return CardView.prototype.tokenize.call(testContext.context).then(payload => {
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
          cards: [{ type: 'visa', supported: true }],
          fields: {
            number: {
              isValid: true
            },
            expirationDate: {
              isValid: false
            }
          }
        });

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(() => {
          expect(testContext.context.hostedFieldsInstance.tokenize).not.toBeCalled();
        });
      }
    );

    test('vaults on tokenization if auto vaulting is configured', () => {
      testContext.context.model.vaultManagerConfig.autoVaultPaymentMethods = true;

      return CardView.prototype.tokenize.call(testContext.context).then(() => {
        expect(testContext.context.hostedFieldsInstance.tokenize).toBeCalledWith({ vault: true });
      });
    });

    test('does not vault on tokenization if auto vaulting is configured globally, but set to not vault locally', () => {
      testContext.context.merchantConfiguration.vault.autoVault = false;
      testContext.context.model.vaultManagerConfig.autoVaultPaymentMethods = true;

      return CardView.prototype.tokenize.call(testContext.context).then(() => {
        expect(testContext.context.hostedFieldsInstance.tokenize).toBeCalledWith({ vault: false });
      });
    });

    test('vaults on tokenization if auto vaulting is configured globally to not vault, but set to vault locally', () => {
      testContext.context.merchantConfiguration.vault.autoVault = true;
      testContext.context.model.vaultManagerConfig.autoVaultPaymentMethods = false;

      return CardView.prototype.tokenize.call(testContext.context).then(() => {
        expect(testContext.context.hostedFieldsInstance.tokenize).toBeCalledWith({ vault: true });
      });
    });

    test(
      'does not vault on tokenization if save card input is not checked',
      () => {
        testContext.context.model.vaultManagerConfig.autoVaultPaymentMethods = true;
        testContext.context.saveCardInput.checked = false;

        return CardView.prototype.tokenize.call(testContext.context).then(() => {
          expect(testContext.context.hostedFieldsInstance.tokenize).toBeCalledWith({ vault: false });
        });
      }
    );

    test(
      'does not vault on tokenization if save card input is not checked when autovaulting is set locally',
      () => {
        testContext.context.merchantConfiguration.vault.autoVault = true;
        testContext.context.saveCardInput.checked = false;

        return CardView.prototype.tokenize.call(testContext.context).then(() => {
          expect(testContext.context.hostedFieldsInstance.tokenize).toBeCalledWith({ vault: false });
        });
      }
    );

    test('does not vault on tokenization if autovaulting is set to false', () => {
      testContext.context.model.vaultManagerConfig.autoVaultPaymentMethods = false;

      return CardView.prototype.tokenize.call(testContext.context).then(() => {
        expect(testContext.context.hostedFieldsInstance.tokenize).toBeCalledWith({ vault: false });
      });
    });

    test('clears fields after successful tokenization', () => {
      testContext.context.hostedFieldsInstance.tokenize.mockResolvedValue({ nonce: 'foo' });

      return CardView.prototype.tokenize.call(testContext.context).then(() => {
        expect(testContext.context.hostedFieldsInstance.clear).toBeCalledWith('number');
        expect(testContext.context.hostedFieldsInstance.clear).toBeCalledWith('expirationDate');
        expect(testContext.context.hostedFieldsInstance.clear).not.toBeCalledWith('cvv');
        expect(testContext.context.hostedFieldsInstance.clear).not.toBeCalledWith('postalCode');
      });
    });

    test(
      'clears cardholder name field if it exists after successful tokenization',
      () => {
        testContext.context.hostedFieldsInstance.tokenize.mockResolvedValue({ nonce: 'foo' });
        testContext.context.hasCardholderName = true;
        testContext.context.cardholderNameInput = {
          value: 'Some value'
        };

        return CardView.prototype.tokenize.call(testContext.context).then(() => {
          expect(testContext.context.cardholderNameInput.value).toBe('');
        });
      }
    );

    test(
      'does not clear fields after successful tokenization if merchant configuration includes clearFieldsAfterTokenization as false',
      () => {
        testContext.context.merchantConfiguration = {
          vault: {},
          clearFieldsAfterTokenization: false
        };
        testContext.context.hostedFieldsInstance.tokenize.mockResolvedValue({ nonce: 'foo' });

        return CardView.prototype.tokenize.call(testContext.context).then(() => {
          expect(testContext.context.hostedFieldsInstance.clear).not.toBeCalled();
        });
      }
    );

    test(
      'does not clear cardholder name field after successful tokenization if merchant configuration includes clearFieldsAfterTokenization as false',
      () => {
        testContext.context.merchantConfiguration = {
          vault: {},
          clearFieldsAfterTokenization: false
        };
        testContext.context.hasCardholderName = true;
        testContext.context.cardholderNameInput = {
          value: 'Some value'
        };
        testContext.context.hostedFieldsInstance.tokenize.mockResolvedValue({ nonce: 'foo' });

        return CardView.prototype.tokenize.call(testContext.context).then(() => {
          expect(testContext.context.cardholderNameInput.value).toBe('Some value');
        });
      }
    );

    test('sets isTokenizing to false on successful tokenization', done => {
      testContext.context.hostedFieldsInstance.tokenize.mockResolvedValue({ nonce: 'foo' });

      CardView.prototype.tokenize.call(testContext.context).then(() => {
        setTimeout(() => {
          expect(testContext.context._isTokenizing).toBe(false);
          done();
        }, 300);
      });
    });

    test('sets isTokenizing to false on unsuccessful tokenization', () => {
      testContext.context.hostedFieldsInstance.tokenize.mockRejectedValue(new Error('Error'));

      return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(() => {
        expect(testContext.context._isTokenizing).toBe(false);
      });
    });

    test(
      'removes braintree-sheet--loading class after successful tokenization',
      done => {
        const stubPayload = {};

        jest.spyOn(classList, 'remove').mockImplementation();
        testContext.context.hostedFieldsInstance.tokenize.mockResolvedValue(stubPayload);

        CardView.prototype.tokenize.call(testContext.context).then(() => {
          setTimeout(() => {
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

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(() => {
          expect(classList.remove).toBeCalledWith(testContext.context.element, 'braintree-sheet--loading');
        });
      }
    );

    test(
      'adds a new payment method when tokenize is successful and transition ends',
      () => {
        const stubPayload = {};

        testContext.context.hostedFieldsInstance.tokenize.mockResolvedValue(stubPayload);
        jest.spyOn(testContext.model, 'addPaymentMethod').mockImplementation();

        return CardView.prototype.tokenize.call(testContext.context).then(() => {
          expect(testContext.model.addPaymentMethod).toBeCalledWith(stubPayload);
        });
      }
    );

    test(
      'does not update the active payment method when tokenize fails',
      () => {
        fake.hostedFieldsInstance.tokenize.mockRejectedValue(new Error('bad happen'));
        jest.spyOn(testContext.model, 'addPaymentMethod').mockImplementation();

        return CardView.prototype.tokenize.call(testContext.context).then(throwIfResolves).catch(() => {
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
        const fakeGroup = document.createElement('div');
        const fakeHostedField = document.createElement('iframe');

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
          const fakeInput = document.createElement('input');
          const fakeGroup = document.createElement('div');

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
        const fakeGroup = document.createElement('div');
        const fakeHostedField = document.createElement('iframe');

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
          const fakeInput = document.createElement('input');
          const fakeGroup = document.createElement('div');

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
      return CardView.prototype.teardown.call(testContext.context).then(() => {
        expect(testContext.context.hostedFieldsInstance.teardown).toBeCalledTimes(1);
      });
    });

    test('passes hosted fields teardown errors to callback', () => {
      const error = new Error('hosted fields teardown error');

      testContext.context.hostedFieldsInstance.teardown.mockRejectedValue(error);

      return CardView.prototype.teardown.call(testContext.context).then(() => {
        throw new Error('should not resolve');
      }).then(throwIfResolves).catch(err => {
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
      const view = new CardView({ element: testContext.element });

      view.hostedFieldsInstance = {
        focus: jest.fn()
      };

      view.onSelection();

      expect(view.hostedFieldsInstance.focus).toBeCalledTimes(1);
      expect(view.hostedFieldsInstance.focus).toBeCalledWith('number');
    });

    test('noops if the hosted fields instance is not available', () => {
      const view = new CardView({ element: testContext.element });

      delete view.hostedFieldsInstance;

      expect(() => {
        view.onSelection();
      }).not.toThrowError();
    });
  });
});
