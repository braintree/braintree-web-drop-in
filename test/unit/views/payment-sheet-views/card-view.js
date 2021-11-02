
const BaseView = require('../../../../src/views/base-view');
const CardView = require('../../../../src/views/payment-sheet-views/card-view');
const classList = require('@braintree/class-list');
const DropinModel = require('../../../../src/dropin-model');
const fake = require('../../../helpers/fake');
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
  let fakeClient, fakeHostedFieldsInstance, cardElement, container;

  function makeCardView(merchantConfiguration = {}) {
    const model = fake.model({
      client: fakeClient,
      merchantConfiguration
    });

    container.innerHTML = mainHTML;
    cardElement = document.body.querySelector('.braintree-sheet.braintree-card');

    return model.initialize().then(() => {
      const view = new CardView({
        element: cardElement,
        model,
        client: fakeClient,
        strings
      });

      return view.initialize().then(() => view);
    });
  }

  beforeEach(() => {
    fakeHostedFieldsInstance = fake.hostedFields();
    jest.spyOn(hostedFields, 'create').mockResolvedValue(fakeHostedFieldsInstance);

    container = document.createElement('div');

    container.innerHTML = mainHTML;
    document.body.appendChild(container);
    cardElement = document.body.querySelector('.braintree-sheet.braintree-card');

    fakeClient = fake.client();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Constructor', () => {
    test('inherits from BaseView', () => {
      expect(new CardView({ element: cardElement })).toBeInstanceOf(BaseView);
    });
  });

  describe('initialize', () => {
    let fakeModel;

    beforeEach(() => {
      fakeModel = fake.model();

      return fakeModel.initialize();
    });

    test('defaults merchant configuration when not configured with a card configuration', () => {
      delete fakeModel.merchantConfiguration.card;
      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        client: fakeClient,
        strings: strings
      });

      return view.initialize().then(() => {
        expect(view.merchantConfiguration).toEqual({
          vault: {}
        });
      });
    });

    test('defaults merchant configuration card configuration is `true`', () => {
      fakeModel.merchantConfiguration.card = true;
      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        client: fakeClient,
        strings: strings
      });

      return view.initialize().then(() => {
        expect(view.merchantConfiguration).toEqual({
          vault: {}
        });
      });
    });

    test('uses passed in merchant configuration for card', () => {
      fakeModel.merchantConfiguration.card = {
        vault: { vaultCard: true }
      };
      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        client: fakeClient,
        strings: strings
      });

      return view.initialize().then(() => {
        expect(view.merchantConfiguration).toEqual({
          vault: { vaultCard: true }
        });
      });
    });

    test('has cvv if supplied in challenges', () => {
      fakeClient.getConfiguration.mockReturnValue({
        gatewayConfiguration: {
          challenges: ['cvv'],
          creditCards: {
            supportedCardTypes: []
          }
        }
      });

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        client: fakeClient,
        strings: strings
      });

      return view.initialize().then(() => {
        expect(cardElement.querySelector('[data-braintree-id="cvv-field-group"]')).toBeDefined();
      });
    });

    test(
      'does not have cvv if supplied in challenges, but hosted fields overrides sets cvv to null',
      () => {
        fakeClient.getConfiguration.mockReturnValue({
          gatewayConfiguration: {
            challenges: ['cvv'],
            creditCards: {
              supportedCardTypes: []
            }
          }
        });

        fakeModel.merchantConfiguration.card = {
          overrides: {
            fields: {
              cvv: null
            }
          }
        };

        const view = new CardView({
          element: cardElement,
          model: fakeModel,
          client: fakeClient,
          strings: strings
        });

        return view.initialize().then(() => {
          expect(cardElement.querySelector('[data-braintree-id="cvv-field-group"]')).toBeFalsy();
        });
      }
    );

    test('does not have cvv if not supplied in challenges', () => {
      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        client: fakeClient,
        strings: strings
      });

      return view.initialize().then(() => {
        expect(cardElement.querySelector('[data-braintree-id="cvv-field-group"]')).toBeFalsy();
      });
    });

    test('has postal code if supplied in challenges', () => {
      fakeClient.getConfiguration.mockReturnValue({
        gatewayConfiguration: {
          challenges: ['postal_code'],
          creditCards: {
            supportedCardTypes: []
          }
        }
      });

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        client: fakeClient,
        strings: strings
      });

      return view.initialize().then(() => {
        expect(cardElement.querySelector('[data-braintree-id="postal-code-field-group"]')).toBeDefined();
      });
    });

    test(
      'does not have postal code if supplied in challenges, but hosted fields overrides sets postal code to null',
      () => {
        fakeClient.getConfiguration.mockReturnValue({
          gatewayConfiguration: {
            challenges: ['postal_code'],
            creditCards: {
              supportedCardTypes: []
            }
          }
        });

        fakeModel.merchantConfiguration.card = {
          overrides: {
            fields: {
              postalCode: null
            }
          }
        };

        const view = new CardView({
          element: cardElement,
          model: fakeModel,
          client: fakeClient,
          strings: strings
        });

        return view.initialize().then(() => {
          expect(cardElement.querySelector('[data-braintree-id="postal-code-field-group"]')).toBeFalsy();
        });
      }
    );

    test('does not have postal code if not supplied in challenges', () => {
      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        client: fakeClient,
        strings: strings
      });

      return view.initialize().then(() => {
        expect(cardElement.querySelector('[data-braintree-id="postal-code-field-group"]')).toBeFalsy();
      });
    });

    test('has cardholderName if provided in merchant configuration', () => {
      fakeModel.merchantConfiguration.card = {
        cardholderName: true
      };

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        client: fakeClient,
        strings: strings
      });

      return view.initialize().then(() => {
        expect(cardElement.querySelector('[data-braintree-id="cardholder-name-field-group"]')).toBeDefined();
      });
    });

    test(
      'does not include cardholderName if not provided in merchant configuration',
      () => {
        fakeModel.merchantConfiguration.card = {};

        const view = new CardView({
          element: cardElement,
          model: fakeModel,
          client: fakeClient,
          strings: strings
        });

        return view.initialize().then(() => {
          expect(cardElement.querySelector('[data-braintree-id="cardholder-name-field-group"]')).toBeFalsy();
        });
      }
    );

    test('removes hidden class from save card input if configured', () => {
      fakeModel.merchantConfiguration.card = {
        vault: {
          allowVaultCardOverride: true
        }
      };
      fakeModel.isGuestCheckout = false;

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        client: fakeClient,
        strings: strings
      });

      return view.initialize().then(() => {
        expect(
          cardElement.querySelector('[data-braintree-id="save-card-field-group"]').className
        ).not.toMatch('braintree-hidden');
      });
    });

    test(
      'does not remove hidden class from save card input if not configured',
      () => {
        fakeModel.merchantConfiguration.card = {};
        fakeModel.isGuestCheckout = false;

        const view = new CardView({
          element: cardElement,
          model: fakeModel,
          client: fakeClient,
          strings: strings
        });

        return view.initialize().then(() => {
          expect(
            cardElement.querySelector('[data-braintree-id="save-card-field-group"]').className
          ).toMatch('braintree-hidden');
        });
      }
    );

    test('sets checked value for save card input', () => {
      fakeModel.merchantConfiguration.card = {
        vault: {
          vaultCard: false
        }
      };

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        client: fakeClient,
        strings: strings
      });

      return view.initialize().then(() => {
        expect(view.saveCardInput.checked).toBe(false);
      });
    });

    test('defaults checked value for save card input to true', () => {
      fakeModel.merchantConfiguration.card = {};

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        client: fakeClient,
        strings: strings
      });

      return view.initialize().then(() => {
        expect(view.saveCardInput.checked).toBe(true);
      });
    });

    test(
      'notifies async dependency is ready when Hosted Fields is created',
      () => {
        jest.spyOn(DropinModel.prototype, 'asyncDependencyReady');

        const view = new CardView({
          element: cardElement,
          model: fakeModel,
          client: fakeClient,
          strings: strings
        });

        return view.initialize().then(() => {
          expect(DropinModel.prototype.asyncDependencyReady).toBeCalledTimes(1);
          expect(DropinModel.prototype.asyncDependencyReady).toBeCalledWith('card');
        });
      }
    );

    test('creates Hosted Fields with number and expiration date', () => {
      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        client: fakeClient,
        strings: strings
      });

      return view.initialize().then(() => {
        expect(hostedFields.create).toBeCalledWith(expect.objectContaining({
          client: fakeClient,
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
      fakeClient.getConfiguration.mockReturnValue({
        gatewayConfiguration: {
          challenges: ['cvv'],
          creditCards: {
            supportedCardTypes: []
          }
        }
      });

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        client: fakeClient,
        strings: strings,
        merchantConfiguration: {
          authorization: fake.clientToken
        }
      });

      return view.initialize().then(() => {
        expect(hostedFields.create.mock.calls[0][0].fields).toHaveProperty('cvv');
      });
    });

    test(
      'creates Hosted Fields with postal code if included in challenges',
      () => {
        fakeClient.getConfiguration.mockReturnValue({
          gatewayConfiguration: {
            challenges: ['postal_code'],
            creditCards: {
              supportedCardTypes: []
            }
          }
        });

        const view = new CardView({
          element: cardElement,
          model: fakeModel,
          client: fakeClient,
          strings: strings,
          merchantConfiguration: {
            authorization: fake.clientToken
          }
        });

        return view.initialize().then(() => {
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
        jest.spyOn(fakeModel, 'asyncDependencyFailed').mockImplementation();

        const view = new CardView({
          element: cardElement,
          model: fakeModel,
          client: fakeClient,
          strings: strings
        });

        return view.initialize().then(() => {
          expect(fakeModel.asyncDependencyFailed).toBeCalledWith({
            view: 'card',
            error: fakeError
          });
        });
      }
    );

    test('shows supported card icons', () => {
      const supportedCardTypes = ['american-express', 'discover', 'jcb', 'master-card', 'visa'];

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        client: fakeClient,
        strings: strings
      });

      return view.initialize().then(() => {
        supportedCardTypes.forEach(cardType => {
          const cardIcon = cardElement.querySelector('[data-braintree-id="' + cardType + '-card-icon"]');

          expect(cardIcon.classList.contains('braintree-hidden')).toBe(false);
        });
      });
    });

    test('hides unsupported card icons', () => {
      const unsupportedCardTypes = ['maestro', 'diners-club'];

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        client: fakeClient,
        strings: strings
      });

      return view.initialize().then(() => {
        unsupportedCardTypes.forEach(cardType => {
          const cardIcon = cardElement.querySelector('[data-braintree-id="' + cardType + '-card-icon"]');

          expect(cardIcon.classList.contains('braintree-hidden')).toBe(true);
        });
      });
    });

    test('does not show UnionPay icon even if it is supported', () => {
      let unionPayCardIcon;

      fakeClient.getConfiguration.mockReturnValue({
        gatewayConfiguration: {
          challenges: [],
          creditCards: {
            supportedCardTypes: ['UnionPay']
          }
        }
      });

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        client: fakeClient,
        strings: strings
      });

      return view.initialize().then(() => {
        unionPayCardIcon = cardElement.querySelector('[data-braintree-id="unionpay-card-icon"]');

        expect(unionPayCardIcon.classList.contains('braintree-hidden')).toBe(true);
      });
    });

    test('sets field placeholders', () => {
      let hostedFieldsConfiguredFields;

      fakeClient.getConfiguration.mockReturnValue({
        gatewayConfiguration: {
          challenges: ['cvv', 'postal_code'],
          creditCards: {
            supportedCardTypes: []
          }
        }
      });

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        client: fakeClient,
        strings: strings
      });

      return view.initialize().then(() => {
        hostedFieldsConfiguredFields = hostedFields.create.mock.calls[0][0].fields;

        expect(hostedFieldsConfiguredFields.number.placeholder).toBe('•••• •••• •••• ••••');
        expect(hostedFieldsConfiguredFields.expirationDate.placeholder).toBe(strings.expirationDatePlaceholder);
        expect(hostedFieldsConfiguredFields.cvv.placeholder).toBe('•••');
        expect(hostedFieldsConfiguredFields.postalCode.placeholder).toBeFalsy();
      });
    });

    test('allows overriding field options for hosted fields', () => {
      let hostedFieldsConfiguredFields;

      fakeClient.getConfiguration.mockReturnValue({
        gatewayConfiguration: {
          challenges: ['cvv', 'postal_code'],
          creditCards: {
            supportedCardTypes: []
          }
        }
      });
      fakeModel.merchantConfiguration.card = {
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

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        client: fakeClient,
        strings: strings
      });

      return view.initialize().then(() => {
        hostedFieldsConfiguredFields = hostedFields.create.mock.calls[0][0].fields;

        expect(hostedFieldsConfiguredFields.number.placeholder).toBe('placeholder');
        expect(hostedFieldsConfiguredFields.cvv.maxlength).toBe(2);
      });
    });

    test(
      'does not add hosted fields elements for fields that are not present',
      () => {
        let hostedFieldsConfiguredFields;

        fakeModel.merchantConfiguration.card = {
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

        const view = new CardView({
          element: cardElement,
          model: fakeModel,
          client: fakeClient,
          strings: strings
        });

        return view.initialize().then(() => {
          hostedFieldsConfiguredFields = hostedFields.create.mock.calls[0][0].fields;

          expect(hostedFieldsConfiguredFields.cvv).toBeFalsy();
          expect(hostedFieldsConfiguredFields.postalCode).toBeFalsy();
          expect(hostedFieldsConfiguredFields.expirationMonth).toBeFalsy();
          expect(hostedFieldsConfiguredFields.expirationYear).toBeFalsy();
        });
      }
    );

    test('ignores changes to selector in field options', () => {
      fakeModel.merchantConfiguration.card = {
        overrides: {
          fields: {
            number: {
              selector: '#some-selector'
            }
          }
        }
      };

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        client: fakeClient,
        strings: strings
      });

      return view.initialize().then(() => {
        const hostedFieldsConfiguredFields = hostedFields.create.mock.calls[0][0].fields;

        expect(hostedFieldsConfiguredFields.number.selector).not.toBe('#some-selector');
      });
    });

    test('allows overriding styles options for hosted fields', () => {
      let hostedFieldsConfiguredStyles;

      fakeModel.merchantConfiguration.card = {
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

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        client: fakeClient,
        strings: strings
      });

      return view.initialize().then(() => {
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

        fakeModel.merchantConfiguration.card = {
          overrides: {
            styles: {
              input: 'class-name',
              ':focus': 'focus-class'
            }
          }
        };

        const view = new CardView({
          element: cardElement,
          model: fakeModel,
          client: fakeClient,
          strings: strings
        });

        return view.initialize().then(() => {
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
    let fakeOptions;

    beforeEach(() => {
      fakeOptions = {
        client: fakeClient,
        merchantConfiguration: {}
      };
    });

    test(
      'resovles with true when there is at least one supported card type',
      () => {
        const configuration = fake.configuration();

        configuration.gatewayConfiguration.creditCards.supportedCardTypes = ['visa'];

        fakeClient.getConfiguration.mockReturnValue(configuration);

        return CardView.isEnabled(fakeOptions).then(result => {
          expect(result).toBe(true);
        });
      }
    );

    test(
      'resovles with false when merchant configuration sets card to false',
      () => {
        const configuration = fake.configuration();

        configuration.gatewayConfiguration.creditCards.supportedCardTypes = ['visa'];

        fakeClient.getConfiguration.mockReturnValue(configuration);
        fakeOptions.merchantConfiguration.card = false;

        return CardView.isEnabled(fakeOptions).then(result => {
          expect(result).toBe(false);
        });
      }
    );

    test(
      'resovles with false when there are no supported card types',
      () => {
        const configuration = fake.configuration();

        configuration.gatewayConfiguration.creditCards.supportedCardTypes = [];

        fakeClient.getConfiguration.mockReturnValue(configuration);

        return CardView.isEnabled(fakeOptions).then(result => {
          expect(result).toBe(false);
        });
      }
    );
  });

  describe('requestPaymentMethod', () => {
    let fakeModel;

    beforeEach(() => {
      fakeModel = fake.model();

      return fakeModel.initialize();
    });

    test('calls the callback with an error when tokenize fails', () => {
      expect.assertions(2);

      const cardView = new CardView({
        element: cardElement,
        model: fakeModel,
        client: fakeClient,
        strings: strings
      });

      jest.spyOn(cardView, 'tokenize').mockRejectedValue(new Error('foo'));

      return cardView.requestPaymentMethod().catch(err => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('foo');
      });
    });

    test(
      'calls the callback with the payload when tokenize is successful',
      () => {
        const cardView = new CardView({
          element: cardElement,
          model: fakeModel,
          client: fakeClient,
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
    let cardView, client;

    beforeEach(() => {
      const model = fake.model();

      client = fake.client({
        gatewayConfiguration: {
          challenges: ['cvv'],
          creditCards: {
            supportedCardTypes: []
          }
        }
      });

      return model.initialize().then(() => {
        cardView = new CardView({
          element: cardElement,
          model,
          client,
          strings
        });
      });
    });

    describe('onFocusEvent', () => {
      let eventPayload;

      beforeEach(() => {
        eventPayload = { emittedBy: 'number' };

        fakeHostedFieldsInstance.on.mockImplementation((eventName, handler) => {
          if (eventName === 'focus') {
            handler(eventPayload);
          }
        });
      });

      test('emits a focus event on the model', () => {
        return cardView.initialize().then(() => {
          expect(cardView.model._emit).toBeCalledWith('card:focus', eventPayload);
        });
      });

      test('shows default card icon in number field when focused', () => {
        return cardView.initialize().then(() => {
          const cardNumberIcon = cardElement.querySelector('[data-braintree-id="card-number-icon"]');

          expect(cardNumberIcon.classList.contains('braintree-hidden')).toBe(false);
          expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).toBe('#iconCardFront');
        });
      });

      test('shows default cvv icon in cvv field when focused', () => {
        eventPayload = { emittedBy: 'cvv' };

        return cardView.initialize().then(() => {
          const cvvIcon = cardElement.querySelector('[data-braintree-id="cvv-icon"]');

          expect(cvvIcon.classList.contains('braintree-hidden')).toBe(false);
          expect(cvvIcon.querySelector('use').getAttribute('xlink:href')).toBe('#iconCVVBack');
        });
      });

      test('adds braintree-form__field-group--is-focused', () => {
        eventPayload = {
          emittedBy: 'number',
          fields: {
            number: { isEmpty: true }
          }
        };
        const numberFieldGroup = cardElement.querySelector('[data-braintree-id="number-field-group"]');

        classList.remove(numberFieldGroup, 'braintree-form__field-group--is-focused');

        return cardView.initialize().then(() => {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--is-focused')).toBe(true);
        });
      });
    });

    describe('onBlurEvent', () => {
      let eventPayload;

      beforeEach(() => {
        eventPayload = { emittedBy: 'number' };

        fakeHostedFieldsInstance.on.mockImplementation((eventName, handler) => {
          if (eventName === 'blur') {
            handler(eventPayload);
          }
        });
      });

      test('emits blur event on model', () => {
        const numberFieldGroup = cardElement.querySelector('[data-braintree-id="number-field-group"]');

        eventPayload = {
          cards: [{ type: 'visa' }],
          emittedBy: 'number',
          fields: {
            number: { isEmpty: true }
          }
        };

        classList.add(numberFieldGroup, 'braintree-form__field-group--is-focused');

        return cardView.initialize().then(() => {
          expect(cardView.model._emit).toBeCalledWith('card:blur', eventPayload);
        });
      });

      test(
        'removes braintree-form__field-group--is-focused class when blurred',
        () => {
          const numberFieldGroup = cardElement.querySelector('[data-braintree-id="number-field-group"]');

          eventPayload = {
            cards: [{ type: 'visa' }],
            emittedBy: 'number',
            fields: {
              number: { isEmpty: true }
            }
          };

          classList.add(numberFieldGroup, 'braintree-form__field-group--is-focused');

          return cardView.initialize().then(() => {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--is-focused')).toBe(false);
          });
        }
      );

      test('applies error class if field is not valid', () => {
        const numberFieldError = cardElement.querySelector('[data-braintree-id="number-field-error"]');
        const numberFieldGroup = cardElement.querySelector('[data-braintree-id="number-field-group"]');

        eventPayload = {
          emittedBy: 'number',
          fields: {
            number: {
              isEmpty: false,
              isValid: false
            }
          }
        };

        client.getConfiguration.mockReturnValue({
          gatewayConfiguration: {
            challenges: ['cvv'],
            creditCards: {
              supportedCardTypes: ['Visa']
            }
          }
        });

        classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');

        return cardView.initialize().then(() => {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(true);
          expect(numberFieldError.textContent).toBe('This card number is not valid.');
        });
      });

      test(
        'does apply error class if field is empty when focusing another hosted field',
        () => {
          const fakeHostedField = document.createElement('iframe');
          const modelOptions = fake.modelOptions();
          const numberFieldGroup = cardElement.querySelector('[data-braintree-id="number-field-group"]');
          const numberFieldError = cardElement.querySelector('[data-braintree-id="number-field-error"]');

          eventPayload = {
            cards: [{ type: 'visa' }],
            emittedBy: 'number',
            fields: {
              number: {
                isEmpty: true,
                isValid: false
              }
            }
          };

          fakeHostedField.id = 'braintree-hosted-field-foo';
          document.body.appendChild(fakeHostedField);
          fakeHostedField.focus();

          client.getConfiguration.mockReturnValue({
            authorization: fake.clientToken,
            authorizationType: 'CLIENT_TOKEN',
            gatewayConfiguration: {
              challenges: ['cvv'],
              creditCards: {
                supportedCardTypes: ['Visa']
              }
            }
          });

          modelOptions.client.getConfiguration = client.getConfiguration;

          cardView.model = fake.model(modelOptions);

          classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');

          return cardView.initialize().then(() => {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(true);
            expect(numberFieldError.textContent).toBe('Please fill out a card number.');
          });
        }
      );

      test(
        'sets the empty error when programatically focussing a hosted field (requires a setTimeout)',
        done => {
          const fakeElement = document.createElement('div');
          const fakeHostedField = document.createElement('iframe');
          const modelOptions = fake.modelOptions();
          const numberFieldGroup = cardElement.querySelector('[data-braintree-id="number-field-group"]');

          eventPayload = {
            cards: [{ type: 'visa' }],
            emittedBy: 'number',
            fields: {
              number: {
                isEmpty: true,
                isValid: false
              }
            }
          };

          fakeHostedField.id = 'braintree-hosted-field-foo';
          document.body.appendChild(fakeElement);
          document.body.appendChild(fakeHostedField);
          fakeElement.focus();

          client.getConfiguration.mockReturnValue({
            authorization: fake.clientToken,
            authorizationType: 'CLIENT_TOKEN',
            gatewayConfiguration: {
              challenges: ['cvv'],
              creditCards: {
                supportedCardTypes: ['Visa']
              }
            }
          });

          modelOptions.client.getConfiguration = client.getConfiguration;

          cardView.model = fake.model(modelOptions);

          classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');

          cardView.initialize().then(() => {
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
          const modelOptions = fake.modelOptions();
          const numberFieldGroup = cardElement.querySelector('[data-braintree-id="number-field-group"]');

          eventPayload = {
            cards: [{ type: 'visa' }],
            emittedBy: 'number',
            fields: {
              number: {
                isEmpty: true,
                isValid: false
              }
            }
          };

          document.body.appendChild(fakeElement);
          fakeElement.focus();

          client.getConfiguration.mockReturnValue({
            authorization: fake.clientToken,
            authorizationType: 'CLIENT_TOKEN',
            gatewayConfiguration: {
              challenges: ['cvv'],
              creditCards: {
                supportedCardTypes: ['Visa']
              }
            }
          });

          modelOptions.client.getConfiguration = client.getConfiguration;

          cardView.model = fake.model(modelOptions);

          classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');

          return cardView.initialize().then(() => {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(false);
          });
        }
      );

      test(
        'does not apply error class if field is empty and the active element is not an iframe',
        () => {
          const fakeElement = document.createElement('div');

          const modelOptions = fake.modelOptions();
          const numberFieldGroup = cardElement.querySelector('[data-braintree-id="number-field-group"]');

          eventPayload = {
            cards: [{ type: 'visa' }],
            emittedBy: 'number',
            fields: {
              number: {
                isEmpty: true,
                isValid: false
              }
            }
          };

          document.body.appendChild(fakeElement);
          fakeElement.focus();

          client.getConfiguration.mockReturnValue({
            authorization: fake.clientToken,
            authorizationType: 'CLIENT_TOKEN',
            gatewayConfiguration: {
              challenges: ['cvv'],
              creditCards: {
                supportedCardTypes: ['Visa']
              }
            }
          });

          modelOptions.client.getConfiguration = client.getConfiguration;

          cardView.model = fake.model(modelOptions);

          classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');

          return cardView.initialize().then(() => {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(false);
          });
        }
      );
    });

    describe('onCardTypeChange event', () => {
      let eventPayload;

      beforeEach(() => {
        eventPayload = { emittedBy: 'number' };
        fakeHostedFieldsInstance.on.mockImplementation((eventName, handler) => {
          if (eventName === 'cardTypeChange') {
            handler(eventPayload);
          }
        });
      });

      test('emits card type event on model', () => {
        eventPayload = {
          cards: [{ type: 'master-card' }],
          emittedBy: 'number'
        };

        return cardView.initialize().then(() => {
          expect(cardView.model._emit).toBeCalledWith('card:cardTypeChange', eventPayload);
        });
      });

      test(
        'adds the card-type-known class when there is one possible card type',
        () => {
          const numberFieldGroup = cardElement.querySelector('[data-braintree-id="number-field-group"]');

          eventPayload = {
            cards: [{ type: 'master-card' }],
            emittedBy: 'number'
          };

          return cardView.initialize().then(() => {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--card-type-known')).toBe(true);
          });
        }
      );

      test(
        'removes the card-type-known class when there is no possible card type',
        () => {
          const numberFieldGroup = cardElement.querySelector('[data-braintree-id="number-field-group"]');

          eventPayload = {
            cards: [],
            emittedBy: 'number'
          };

          classList.add(numberFieldGroup, 'braintree-form__field-group--card-type-known');

          return cardView.initialize().then(() => {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--card-type-known')).toBe(false);
          });
        }
      );

      test(
        'removes the card-type-known class when there are many possible card types',
        () => {
          const numberFieldGroup = cardElement.querySelector('[data-braintree-id="number-field-group"]');

          eventPayload = {
            cards: [{ type: 'master-card' }, { type: 'foo-pay' }],
            emittedBy: 'number'
          };

          classList.add(numberFieldGroup, 'braintree-form__field-group--card-type-known');

          return cardView.initialize().then(() => {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--card-type-known')).toBe(false);
          });
        }
      );

      test(
        'updates the card number icon to the card type if there is one possible card type',
        () => {
          const cardNumberIcon = cardElement.querySelector('[data-braintree-id="card-number-icon"]');

          eventPayload = {
            cards: [{ type: 'master-card' }],
            emittedBy: 'number'
          };

          return cardView.initialize().then(() => {
            expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).toBe('#icon-master-card');
          });
        }
      );

      test(
        'updates the card number icon to the generic card if there are many possible card types',
        () => {
          const cardNumberIcon = cardElement.querySelector('[data-braintree-id="card-number-icon"]');

          eventPayload = {
            cards: [{ type: 'master-card' }, { type: 'foo-pay' }],
            emittedBy: 'number'
          };

          return cardView.initialize().then(() => {
            expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).toBe('#iconCardFront');
          });
        }
      );

      test(
        'updates the card icon to the generic card if there no card types',
        () => {
          const cardNumberIcon = cardElement.querySelector('[data-braintree-id="card-number-icon"]');

          eventPayload = {
            cards: [],
            emittedBy: 'number'
          };

          return cardView.initialize().then(() => {
            expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).toBe('#iconCardFront');
          });
        }
      );

      test('updates the cvv icon to back icon for non-amex cards', () => {
        const use = cardElement.querySelector('[data-braintree-id="cvv-icon"]').querySelector('use');

        eventPayload = {
          cards: [{ type: 'visa' }],
          emittedBy: 'number'
        };

        use.setAttribute('xlink:href', '#iconCVVFront');

        return cardView.initialize().then(() => {
          expect(use.getAttribute('xlink:href')).toBe('#iconCVVBack');
        });
      });

      test('updates the cvv icon to front icon for amex cards', () => {
        const use = cardElement.querySelector('[data-braintree-id="cvv-icon"]').querySelector('use');

        eventPayload = {
          cards: [{ type: 'american-express' }],
          emittedBy: 'number'
        };

        return cardView.initialize().then(() => {
          expect(use.getAttribute('xlink:href')).toBe('#iconCVVFront');
        });
      });

      test(
        'updates the cvv label descriptor to four digits when card type is amex',
        () => {
          const cvvLabelDescriptor = cardElement.querySelector('[data-braintree-id="cvv-field-group"]').querySelector('.braintree-form__descriptor');

          eventPayload = {
            cards: [{ type: 'american-express' }],
            emittedBy: 'number'
          };

          cvvLabelDescriptor.textContent = 'some value';

          return cardView.initialize().then(() => {
            expect(cvvLabelDescriptor.textContent).toBe('(4 digits)');
          });
        }
      );

      test(
        'updates the cvv label descriptor to three digits when card type is non-amex',
        () => {
          const cvvLabelDescriptor = cardElement.querySelector('[data-braintree-id="cvv-field-group"]').querySelector('.braintree-form__descriptor');

          eventPayload = {
            cards: [{ type: 'visa' }],
            emittedBy: 'number'
          };

          cvvLabelDescriptor.textContent = 'some value';

          return cardView.initialize().then(() => {
            expect(cvvLabelDescriptor.textContent).toBe('(3 digits)');
          });
        }
      );

      test(
        'updates the cvv label descriptor to three digits when multiple card types',
        () => {
          const cvvLabelDescriptor = cardElement.querySelector('[data-braintree-id="cvv-field-group"]').querySelector('.braintree-form__descriptor');

          eventPayload = {
            cards: [{ type: 'american-express' }, { type: 'visa' }],
            emittedBy: 'number'
          };

          cvvLabelDescriptor.textContent = 'some value';

          return cardView.initialize().then(() => {
            expect(cvvLabelDescriptor.textContent).toBe('(3 digits)');
          });
        }
      );

      test('updates the cvv field placeholder when card type is amex', () => {
        eventPayload = {
          cards: [{ type: 'american-express' }],
          emittedBy: 'number'
        };

        return cardView.initialize().then(() => {
          expect(fakeHostedFieldsInstance.setAttribute).toBeCalledWith({ field: 'cvv', attribute: 'placeholder', value: '••••' });
        });
      });

      test(
        'updates the cvv field placeholder when card type is non-amex',
        () => {
          eventPayload = {
            cards: [{ type: 'visa' }],
            emittedBy: 'number'
          };

          return cardView.initialize().then(() => {
            expect(fakeHostedFieldsInstance.setAttribute).toBeCalledWith({ field: 'cvv', attribute: 'placeholder', value: '•••' });
          });
        }
      );

      test(
        'updates the cvv field placeholder when multiple card types',
        () => {
          eventPayload = {
            cards: [{ type: 'american-express' }, { type: 'visa' }],
            emittedBy: 'number'
          };

          return cardView.initialize().then(() => {
            expect(fakeHostedFieldsInstance.setAttribute).toBeCalledWith({ field: 'cvv', attribute: 'placeholder', value: '•••' });
          });
        }
      );

      test(
        'does not update the cvv field placeholder when there is no cvv challenge',
        () => {
          eventPayload = {
            cards: [{ type: 'american-express' }, { type: 'visa' }],
            emittedBy: 'number'
          };
          client.getConfiguration.mockReturnValue({
            gatewayConfiguration: {
              challenges: [],
              creditCards: {
                supportedCardTypes: []
              }
            }
          });

          return cardView.initialize().then(() => {
            expect(fakeHostedFieldsInstance.setAttribute).not.toBeCalled();
          });
        }
      );

      test(
        'does not update the cvv field placeholder when it is removed with an override',
        () => {
          eventPayload = {
            cards: [{ type: 'american-express' }, { type: 'visa' }],
            emittedBy: 'number'
          };
          cardView.model.merchantConfiguration.card = {
            overrides: {
              fields: {
                cvv: null
              }
            }
          };

          return cardView.initialize().then(() => {
            expect(fakeHostedFieldsInstance.setAttribute).not.toBeCalled();
          });
        }
      );

      test(
        'does not update the cvv field placeholder when using a custom CVV placeholder',
        () => {
          eventPayload = {
            cards: [{ type: 'american-express' }, { type: 'visa' }],
            emittedBy: 'number'
          };

          cardView.model.merchantConfiguration.card = {
            overrides: {
              fields: {
                cvv: {
                  placeholder: 'cool custom placeholder'
                }
              }
            }
          };

          return cardView.initialize().then(() => {
            expect(fakeHostedFieldsInstance.setAttribute).not.toBeCalled();
          });
        }
      );
    });

    describe('onValidityChangeEvent', () => {
      let eventPayload;

      beforeEach(() => {
        eventPayload = { emittedBy: 'number' };
        fakeHostedFieldsInstance.on.mockImplementation((eventName, handler) => {
          if (eventName === 'validityChange') {
            handler(eventPayload);
          }
        });
      });

      test('emits validity change event on model', () => {
        eventPayload = {
          emittedBy: 'number',
          cards: [{ type: 'visa' }],
          fields: {
            number: {
              container: document.createElement('div'),
              isEmpty: false,
              isValid: false,
              isPotentiallyValid: true
            }
          }
        };

        return cardView.initialize().then(() => {
          expect(cardView.model._emit).toBeCalledWith('card:validityChange', eventPayload);
        });
      });

      test(
        'removes the braintree-form__field-group--has-error class if a field is potentially valid',
        () => {
          const numberFieldGroup = cardElement.querySelector('[data-braintree-id="number-field-group"]');

          eventPayload = {
            emittedBy: 'number',
            cards: [{ type: 'visa' }],
            fields: {
              number: {
                container: document.createElement('div'),
                isEmpty: false,
                isValid: false,
                isPotentiallyValid: true
              }
            }
          };

          classList.add(numberFieldGroup, 'braintree-form__field-group--has-error');

          return cardView.initialize().then(() => {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(false);
          });
        }
      );

      test(
        'adds braintree-form__field--valid class to valid expiration date field',
        () => {
          const expirationElement = cardElement.querySelector('.braintree-form-expiration');

          eventPayload = {
            cards: [{ type: 'visa' }],
            emittedBy: 'expirationDate',
            fields: {
              expirationDate: {
                container: expirationElement,
                isValid: true,
                isPotentiallyValid: true
              }
            }
          };

          return cardView.initialize().then(() => {
            expect(expirationElement.classList.contains('braintree-form__field--valid')).toBe(true);
          });
        }
      );

      test(
        'removes braintree-form__field--valid class to invalid expiration date field',
        () => {
          const expirationElement = cardElement.querySelector('.braintree-form-expiration');

          eventPayload = {
            cards: [{ type: 'visa' }],
            emittedBy: 'expirationDate',
            fields: {
              expirationDate: {
                container: expirationElement,
                isValid: false,
                isPotentiallyValid: true
              }
            }
          };

          return cardView.initialize().then(() => {
            expect(expirationElement.classList.contains('braintree-form__field--valid')).toBe(false);
          });
        }
      );

      test(
        'adds braintree-form__field--valid class to valid number with card type supported',
        () => {
          const numberElement = cardElement.querySelector('.braintree-form-number');

          eventPayload = {
            cards: [{ type: 'visa' }],
            emittedBy: 'number',
            fields: {
              number: {
                container: numberElement,
                isValid: true,
                isPotentiallyValid: true
              }
            }
          };

          client.getConfiguration.mockReturnValue({
            gatewayConfiguration: {
              challenges: ['cvv'],
              creditCards: {
                supportedCardTypes: ['Visa']
              }
            }
          });

          return cardView.initialize().then(() => {
            expect(numberElement.classList.contains('braintree-form__field--valid')).toBe(true);
          });
        }
      );

      test(
        'removes braintree-form__field--valid class to valid number without card type supported',
        () => {
          const numberElement = cardElement.querySelector('.braintree-form-number');

          eventPayload = {
            cards: [{ type: 'foo' }],
            emittedBy: 'number',
            fields: {
              number: {
                container: numberElement,
                isValid: true,
                isPotentiallyValid: true
              }
            }
          };

          client.getConfiguration.mockReturnValue({
            gatewayConfiguration: {
              challenges: ['cvv'],
              creditCards: {
                supportedCardTypes: ['Visa']
              }
            }
          });

          return cardView.initialize().then(() => {
            expect(numberElement.classList.contains('braintree-form__field--valid')).toBe(false);
          });
        }
      );

      test(
        'removes braintree-form__field--valid class to not valid number with card type supported',
        () => {
          const numberElement = cardElement.querySelector('.braintree-form-number');

          eventPayload = {
            cards: [{ type: 'visa' }],
            emittedBy: 'number',
            fields: {
              number: {
                container: numberElement,
                isValid: false,
                isPotentiallyValid: true
              }
            }
          };

          client.getConfiguration.mockReturnValue({
            gatewayConfiguration: {
              challenges: ['cvv'],
              creditCards: {
                supportedCardTypes: ['Visa']
              }
            }
          });

          return cardView.initialize().then(() => {
            expect(numberElement.classList.contains('braintree-form__field--valid')).toBe(false);
          });
        }
      );

      test(
        'calls model.setPaymentMethodRequestable with isRequestable true if form is valid',
        () => {
          const numberElement = cardElement.querySelector('.braintree-form-number');

          eventPayload = {
            cards: [{ type: 'visa' }],
            emittedBy: 'number',
            fields: {
              number: {
                container: numberElement,
                isValid: false,
                isPotentiallyValid: true
              }
            }
          };
          jest.spyOn(cardView, 'hideFieldError').mockImplementation();
          jest.spyOn(cardView.model, 'setPaymentMethodRequestable').mockImplementation();
          jest.spyOn(cardView, '_validateForm').mockReturnValue(true);

          return cardView.initialize().then(() => {
            expect(cardView.model.setPaymentMethodRequestable).toBeCalledTimes(1);
            expect(cardView.model.setPaymentMethodRequestable).toBeCalledWith({
              isRequestable: true,
              type: 'CreditCard'
            });
          });
        }
      );

      test(
        'calls model.setPaymentMethodRequestable with isRequestable false if form is invalid',
        () => {
          const numberElement = cardElement.querySelector('.braintree-form-number');

          eventPayload = {
            cards: [{ type: 'visa' }],
            emittedBy: 'number',
            fields: {
              number: {
                container: numberElement,
                isValid: false,
                isPotentiallyValid: true
              }
            }
          };
          jest.spyOn(cardView, 'hideFieldError').mockImplementation();
          jest.spyOn(cardView.model, 'setPaymentMethodRequestable').mockImplementation();
          jest.spyOn(cardView, '_validateForm').mockReturnValue(false);

          return cardView.initialize().then(() => {
            expect(cardView.model.setPaymentMethodRequestable).toBeCalledTimes(1);
            expect(cardView.model.setPaymentMethodRequestable).toBeCalledWith({
              isRequestable: false,
              type: 'CreditCard'
            });
          });
        }
      );

      test(
        'does not call model.setPaymentMethodRequestable if tokenization is in progress',
        () => {
          const numberElement = cardElement.querySelector('.braintree-form-number');

          cardView._isTokenizing = true;
          eventPayload = {
            cards: [{ type: 'visa' }],
            emittedBy: 'number',
            fields: {
              number: {
                container: numberElement,
                isValid: false,
                isPotentiallyValid: true
              }
            }
          };

          jest.spyOn(cardView, 'hideFieldError').mockImplementation();
          jest.spyOn(cardView.model, 'setPaymentMethodRequestable').mockImplementation();
          jest.spyOn(cardView, '_validateForm').mockReturnValue(false);

          return cardView.initialize().then(() => {
            expect(cardView.model.setPaymentMethodRequestable).not.toBeCalled();
          });
        }
      );
    });

    describe('onNotEmptyEvent', () => {
      let eventPayload;

      beforeEach(() => {
        eventPayload = { emittedBy: 'number' };
        fakeHostedFieldsInstance.on.mockImplementation((eventName, handler) => {
          if (eventName === 'notEmpty') {
            handler(eventPayload);
          }
        });
      });

      test('emits not empty event on model', () => {
        eventPayload = {
          emittedBy: 'number',
          cards: [{ type: 'visa' }],
          fields: {
            number: {
              container: document.createElement('div'),
              isEmpty: false,
              isValid: false,
              isPotentiallyValid: true
            }
          }
        };

        return cardView.initialize().then(() => {
          expect(cardView.model._emit).toBeCalledWith('card:notEmpty', eventPayload);
        });
      });

      test('removes the braintree-form__field-group--has-error class', () => {
        const numberFieldGroup = cardElement.querySelector('[data-braintree-id="number-field-group"]');

        eventPayload = {
          emittedBy: 'number',
          cards: [{ type: 'visa' }],
          fields: {
            number: {
              container: document.createElement('div'),
              isEmpty: false,
              isValid: false,
              isPotentiallyValid: true
            }
          }
        };

        classList.add(numberFieldGroup, 'braintree-form__field-group--has-error');

        return cardView.initialize().then(() => {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(false);
        });
      });
    });

    describe('passthrough events', () => {
      let eventPayload, eventNameToIntercept;

      beforeEach(() => {
        eventPayload = { emittedBy: 'number' };
        fakeHostedFieldsInstance.on.mockImplementation((eventName, handler) => {
          if (eventName === eventNameToIntercept) {
            handler(eventPayload);
          }
        });
      });

      test.each([
        'empty',
        'inputSubmitRequest',
        'binAvailable'
      ])('passes along %s event', (eventName) => {
        eventNameToIntercept = eventName;

        return cardView.initialize().then(() => {
          expect(cardView.model._emit).toBeCalledWith(`card:${eventName}`, eventPayload);
        });
      });
    });
  });

  describe('tokenize', () => {
    let cardView;

    beforeEach(() => {
      fakeHostedFieldsInstance.getState.mockReturnValue({
        cards: [{ type: 'visa' }],
        fields: {
          number: {
            isValid: true
          },
          expirationDate: {
            isValid: true
          }
        }
      });
      fakeHostedFieldsInstance.tokenize.mockResolvedValue({});

      jest.spyOn(transitionHelper, 'onTransitionEnd').mockImplementation(yields());

      return makeCardView().then((view) => {
        cardView = view;
      });
    });

    test('clears the error on the model', () => {
      expect.assertions(1);

      jest.spyOn(cardView.model, 'clearError').mockImplementation();
      fakeHostedFieldsInstance.getState.mockReturnValue({
        cards: [{ type: 'Card' }],
        fields: {
          number: {
            isValid: true
          },
          expirationDate: {
            isValid: false
          }
        }
      });

      return cardView.tokenize().catch(() => {
        expect(cardView.model.clearError).toBeCalled();
      });
    });

    test('throws an error if there is no valid card type', () => {
      expect.assertions(2);

      fakeHostedFieldsInstance.getState.mockReturnValue({
        cards: [{ type: 'Card' }],
        fields: {
          number: {
            isValid: true
          },
          expirationDate: {
            isValid: false
          }
        }
      });

      return cardView.tokenize().catch(err => {
        expect(err).toBeDefined();
        expect(fakeHostedFieldsInstance.tokenize).not.toBeCalled();
      });
    });

    test(
      'calls callback with error and reports error to DropinModel if form is not valid',
      () => {
        expect.assertions(3);

        fakeHostedFieldsInstance.getState.mockReturnValue({
          cards: [{ type: 'visa' }],
          fields: {
            number: {
              isValid: true
            },
            expirationDate: {
              isValid: false
            }
          }
        });

        jest.spyOn(cardView.model, 'reportError').mockImplementation();

        return cardView.tokenize().catch(err => {
          expect(fakeHostedFieldsInstance.tokenize).not.toBeCalled();
          expect(cardView.model.reportError).toBeCalledWith('hostedFieldsFieldsInvalidError');
          expect(err.message).toBe('No payment method is available.');
        });
      }
    );

    test(
      'calls callback with error when cardholder name is required and the input is empty',
      () => {
        let cardViewWithCardholderName;

        expect.assertions(3);

        return makeCardView({
          card: {
            cardholderName: {
              required: true
            }
          }
        }).then((view) => {
          cardViewWithCardholderName = view;

          fakeHostedFieldsInstance.getState.mockReturnValue({
            cards: [{ type: 'visa' }],
            fields: {
              cardholderName: {
                isEmpty: true,
                isValid: false
              },
              number: {
                isValid: true
              },
              expirationDate: {
                isValid: true
              }
            }
          });

          jest.spyOn(cardViewWithCardholderName.model, 'reportError').mockImplementation();

          return cardViewWithCardholderName.tokenize();
        }).catch(err => {
          expect(fakeHostedFieldsInstance.tokenize).not.toBeCalled();
          expect(cardViewWithCardholderName.model.reportError).toBeCalledWith('hostedFieldsFieldsInvalidError');
          expect(err.message).toBe('No payment method is available.');
        });
      }
    );

    test(
      'does not error if cardholder name is empty, but not required',
      () => {
        let cardViewWithCardholderName;

        return makeCardView({
          card: {
            cardholderName: {
              required: false
            }
          }
        }).then((view) => {
          cardViewWithCardholderName = view;
          fakeHostedFieldsInstance.getState.mockReturnValue({
            cards: [{ type: 'visa' }],
            fields: {
              cardholderName: {
                isEmpty: true,
                isValid: false
              },
              number: {
                isValid: true
              },
              expirationDate: {
                isValid: true
              }
            }
          });

          jest.spyOn(cardViewWithCardholderName.model, 'reportError').mockImplementation();

          return cardViewWithCardholderName.tokenize();
        }).then(() => {
          expect(cardViewWithCardholderName.model.reportError).not.toBeCalled();
          expect(fakeHostedFieldsInstance.tokenize).toBeCalledTimes(1);
          expect(fakeHostedFieldsInstance.tokenize).toBeCalledWith(expect.objectContaining({
            fieldsToTokenize: ['number', 'expirationDate']
          }));
        });
      }
    );

    test('does not error if cardholder name is not included', () => {
      let cardViewWithoutCardholderName;

      fakeHostedFieldsInstance.getState.mockReturnValue({
        cards: [{ type: 'visa' }],
        fields: {
          number: {
            isValid: true
          },
          expirationDate: {
            isValid: true
          }
        }
      });

      return makeCardView({
        card: {
          cardholderName: false
        }
      }).then((view) => {
        cardViewWithoutCardholderName = view;
        jest.spyOn(cardViewWithoutCardholderName.model, 'reportError').mockImplementation();

        return cardViewWithoutCardholderName.tokenize();
      }).then(() => {
        expect(cardViewWithoutCardholderName.model.reportError).not.toBeCalled();
        expect(fakeHostedFieldsInstance.tokenize).toBeCalledTimes(1);
      });
    });

    test(
      'reports an error to DropinModel when Hosted Fields tokenization returns an error',
      () => {
        expect.assertions(1);

        const fakeError = {
          code: 'A_REAL_ERROR_CODE'
        };

        fakeHostedFieldsInstance.tokenize.mockRejectedValue(fakeError);
        jest.spyOn(cardView.model, 'reportError').mockImplementation();

        return cardView.tokenize().catch(() => {
          expect(cardView.model.reportError).toBeCalledWith(fakeError);
        });
      }
    );

    test(
      'reports a duplicate card error to DropinModel when tokenization returns an error',
      () => {
        expect.assertions(1);

        const fakeError = { code: 'HOSTED_FIELDS_TOKENIZATION_FAIL_ON_DUPLICATE' };

        fakeHostedFieldsInstance.tokenize.mockRejectedValue(fakeError);
        jest.spyOn(cardView.model, 'reportError').mockImplementation();

        return cardView.tokenize().catch(() => {
          expect(cardView.model.reportError).toBeCalledWith(fakeError);
        });
      }
    );

    test(
      'shows unsupported card field error when attempting to use an unsupported card and reports an error',
      () => {
        expect.assertions(4);

        const numberFieldError = cardElement.querySelector('[data-braintree-id="number-field-error"]');

        jest.spyOn(cardView.model, 'reportError').mockImplementation();

        cardView.client.getConfiguration.mockReturnValue({
          gatewayConfiguration: {
            creditCards: {
              supportedCardTypes: ['Foo Pay']
            }
          }
        });

        return cardView.tokenize().catch(() => {
          expect(numberFieldError.classList.contains('braintree-hidden')).toBe(false);
          expect(numberFieldError.textContent).toBe('This card type is not supported. Please try another card.');
          expect(cardView.model.reportError).toBeCalledWith('hostedFieldsFieldsInvalidError');
          expect(fakeHostedFieldsInstance.tokenize).not.toBeCalled();
        });
      }
    );

    test(
      'shows empty field error when attempting to sumbit an empty field',
      () => {
        expect.assertions(3);

        const numberFieldError = cardElement.querySelector('[data-braintree-id="number-field-error"]');

        fakeHostedFieldsInstance.getState.mockReturnValue({
          cards: [{ type: 'visa' }],
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

        return cardView.tokenize().catch(() => {
          expect(numberFieldError.classList.contains('braintree-hidden')).toBe(false);
          expect(numberFieldError.textContent).toBe('Please fill out a card number.');
          expect(fakeHostedFieldsInstance.tokenize).not.toBeCalled();
        });
      }
    );

    test(
      'shows invalid field error when attempting to submit an invalid field',
      () => {
        expect.assertions(3);

        const numberFieldError = cardElement.querySelector('[data-braintree-id="number-field-error"]');

        fakeHostedFieldsInstance.getState.mockReturnValue({
          cards: [{ type: 'visa' }],
          fields: {
            number: {
              isValid: false
            },
            expirationDate: {
              isValid: true
            }
          }
        });

        return cardView.tokenize().catch(() => {
          expect(numberFieldError.classList.contains('braintree-hidden')).toBe(false);
          expect(numberFieldError.textContent).toBe('This card number is not valid.');
          expect(fakeHostedFieldsInstance.tokenize).not.toBeCalled();
        });
      }
    );

    test(
      'sets the aria-invalid attribute and set message when a field error is shown',
      () => {
        fakeHostedFieldsInstance.getState.mockReturnValue({
          cards: [{ type: 'visa' }],
          fields: {
            number: {
              isValid: false
            },
            expirationDate: {
              isValid: true
            }
          }
        });

        cardView.showFieldError('number', 'Example error message');

        expect(fakeHostedFieldsInstance.setAttribute).toBeCalledWith({
          field: 'number',
          attribute: 'aria-invalid',
          value: true
        });
        expect(fakeHostedFieldsInstance.setMessage).toBeCalledWith({
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

        jest.spyOn(cardView, 'getElementById').mockReturnValue(fieldGroup);
        jest.spyOn(classList, 'add').mockImplementation();

        cardView.showFieldError('foo');

        expect(input.setAttribute).toBeCalledWith('aria-invalid', true);
      }
    );

    test(
      'removes the aria-invalid attribute and message when a field error is hidden',
      () => {
        fakeHostedFieldsInstance.getState.mockReturnValue({
          cards: [{ type: 'visa' }],
          fields: {
            number: {
              isValid: false
            },
            expirationDate: {
              isValid: true
            }
          }
        });

        cardView.hideFieldError('number');

        expect(fakeHostedFieldsInstance.removeAttribute).toBeCalledWith({
          field: 'number',
          attribute: 'aria-invalid'
        });
        expect(fakeHostedFieldsInstance.setMessage).toBeCalledWith({
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

        jest.spyOn(cardView, 'getElementById').mockReturnValue(fieldGroup);
        jest.spyOn(classList, 'remove').mockImplementation();

        cardView.hideFieldError('foo');

        expect(input.removeAttribute).toBeCalledWith('aria-invalid');
      }
    );

    test('calls hostedFieldsInstance.tokenize when form is valid', () => {
      return cardView.tokenize().then(() => {
        expect(fakeHostedFieldsInstance.tokenize).toBeCalledTimes(1);
      });
    });

    test(
      'includes `vaulted: true` in tokenization payload if not guest checkout',
      () => {
        cardView.model.isGuestCheckout = false;

        return cardView.tokenize().then(payload => {
          expect(payload.vaulted).toBe(true);
        });
      }
    );

    test(
      'does not include `vaulted: true` in tokenization payload if save card input is not checked',
      () => {
        cardView.model.isGuestCheckout = false;
        cardView.saveCardInput.checked = false;

        return cardView.tokenize().then(payload => {
          expect(payload.vaulted).toBeFalsy();
        });
      }
    );

    test(
      'does not include `vaulted: true` in tokenization payload if guest checkout',
      () => {
        cardView.model.isGuestCheckout = true;

        return cardView.tokenize().then(payload => {
          expect(payload.vaulted).toBeFalsy();
        });
      }
    );

    test('sets isTokenizing to true', () => {
      cardView.tokenize().then();

      expect(cardView._isTokenizing).toBe(true);
    });

    test(
      'does not call hostedFieldsInstance.tokenize if form is invalid',
      () => {
        expect.assertions(1);

        fakeHostedFieldsInstance.getState.mockReturnValue({
          cards: [{ type: 'visa' }],
          fields: {
            number: {
              isValid: true
            },
            expirationDate: {
              isValid: false
            }
          }
        });

        return cardView.tokenize().catch(() => {
          expect(fakeHostedFieldsInstance.tokenize).not.toBeCalled();
        });
      }
    );

    test(
      'does not call hostedFieldsInstance.tokenize if form is valid, but card type is not supported',
      () => {
        expect.assertions(1);

        fakeHostedFieldsInstance.getState.mockReturnValue({
          cards: [{ type: 'foo' }],
          fields: {
            number: {
              isValid: true
            },
            expirationDate: {
              isValid: true
            }
          }
        });

        return cardView.tokenize().catch(() => {
          expect(fakeHostedFieldsInstance.tokenize).not.toBeCalled();
        });
      }
    );

    test(
      'does not call hostedFieldsInstance.tokenize if form is valid, but no card is available in state',
      () => {
        expect.assertions(1);

        fakeHostedFieldsInstance.getState.mockReturnValue({
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

        return cardView.tokenize().catch(() => {
          expect(fakeHostedFieldsInstance.tokenize).not.toBeCalled();
        });
      }
    );

    test('vaults on tokenization if not using guest checkout', () => {
      cardView.model.isGuestCheckout = false;

      return cardView.tokenize().then(() => {
        expect(fakeHostedFieldsInstance.tokenize).toBeCalledWith({ vault: true });
      });
    });

    test(
      'does not vault on tokenization if save card input is not checked',
      () => {
        cardView.model.isGuestCheckout = false;
        cardView.saveCardInput.checked = false;

        return cardView.tokenize().then(() => {
          expect(fakeHostedFieldsInstance.tokenize).toBeCalledWith({ vault: false });
        });
      }
    );

    test('does not vault on tokenization if using guest checkout', () => {
      cardView.model.isGuestCheckout = true;

      return cardView.tokenize().then(() => {
        expect(fakeHostedFieldsInstance.tokenize).toBeCalledWith({ vault: false });
      });
    });

    test('clears fields after successful tokenization', () => {
      fakeHostedFieldsInstance.tokenize.mockResolvedValue({ nonce: 'foo' });

      return cardView.tokenize().then(() => {
        expect(fakeHostedFieldsInstance.clear).toBeCalledWith('number');
        expect(fakeHostedFieldsInstance.clear).toBeCalledWith('expirationDate');
        expect(fakeHostedFieldsInstance.clear).not.toBeCalledWith('cvv');
        expect(fakeHostedFieldsInstance.clear).not.toBeCalledWith('postalCode');
      });
    });

    test(
      'clears cardholder name field if it exists after successful tokenization',
      () => {
        let cardViewWithCardholderName;

        fakeHostedFieldsInstance.getState.mockReturnValue({
          cards: [{ type: 'visa' }],
          fields: {
            cardholderName: {
              isValid: true
            },
            number: {
              isValid: true
            },
            expirationDate: {
              isValid: true
            }
          }
        });

        return makeCardView({
          card: {
            cardholderName: true
          }
        }).then((view) => {
          cardViewWithCardholderName = view;
          fakeHostedFieldsInstance.tokenize.mockResolvedValue({ nonce: 'foo' });

          return cardViewWithCardholderName.tokenize();
        }).then(() => {
          expect(fakeHostedFieldsInstance.clear).toBeCalledWith('cardholderName');
        });
      }
    );

    test(
      'does not clear fields after successful tokenization if merchant configuration includes clearFieldsAfterTokenization as false',
      () => {
        cardView.merchantConfiguration = {
          clearFieldsAfterTokenization: false
        };
        fakeHostedFieldsInstance.tokenize.mockResolvedValue({ nonce: 'foo' });

        return cardView.tokenize().then(() => {
          expect(fakeHostedFieldsInstance.clear).not.toBeCalled();
        });
      }
    );

    test(
      'does not clear cardholder name field after successful tokenization if merchant configuration includes clearFieldsAfterTokenization as false',
      () => {
        let cardViewWithCardholderName;

        fakeHostedFieldsInstance.getState.mockReturnValue({
          cards: [{ type: 'visa' }],
          fields: {
            cardholderName: {
              isValid: true
            },
            number: {
              isValid: true
            },
            expirationDate: {
              isValid: true
            }
          }
        });

        return makeCardView({
          card: {
            clearFieldsAfterTokenization: false,
            cardholderName: true
          }
        }).then((view) => {
          cardViewWithCardholderName = view;
          fakeHostedFieldsInstance.tokenize.mockResolvedValue({ nonce: 'foo' });

          return cardViewWithCardholderName.tokenize();
        }).then(() => {
          expect(fakeHostedFieldsInstance.clear).not.toBeCalled();
        });
      }
    );

    test('sets isTokenizing to false on successful tokenization', done => {
      fakeHostedFieldsInstance.tokenize.mockResolvedValue({ nonce: 'foo' });

      cardView.tokenize().then(() => {
        setTimeout(() => {
          expect(cardView._isTokenizing).toBe(false);
          done();
        }, 300);
      });
    });

    test('sets isTokenizing to false on unsuccessful tokenization', () => {
      expect.assertions(1);

      fakeHostedFieldsInstance.tokenize.mockRejectedValue(new Error('Error'));

      return cardView.tokenize().catch(() => {
        expect(cardView._isTokenizing).toBe(false);
      });
    });

    test(
      'removes braintree-sheet--loading class after successful tokenization',
      done => {
        const stubPayload = {};

        jest.spyOn(classList, 'remove').mockImplementation();
        fakeHostedFieldsInstance.tokenize.mockResolvedValue(stubPayload);

        cardView.tokenize().then(() => {
          setTimeout(() => {
            expect(classList.remove).toBeCalledWith(cardElement, 'braintree-sheet--loading');
            done();
          }, CHANGE_ACTIVE_PAYMENT_METHOD_TIMEOUT);
        });
      }
    );

    test(
      'removes braintree-sheet--loading class after tokenization fails',
      () => {
        expect.assertions(1);

        jest.spyOn(classList, 'remove').mockImplementation();
        fakeHostedFieldsInstance.tokenize.mockRejectedValue(new Error('foo'));

        return cardView.tokenize().catch(() => {
          expect(classList.remove).toBeCalledWith(cardElement, 'braintree-sheet--loading');
        });
      }
    );

    test(
      'adds a new payment method when tokenize is successful and transition ends',
      () => {
        const stubPayload = {};

        fakeHostedFieldsInstance.tokenize.mockResolvedValue(stubPayload);
        jest.spyOn(cardView.model, 'addPaymentMethod').mockImplementation();

        return cardView.tokenize().then(() => {
          expect(cardView.model.addPaymentMethod).toBeCalledWith(stubPayload);
        });
      }
    );

    test(
      'does not update the active payment method when tokenize fails',
      () => {
        expect.assertions(1);

        fakeHostedFieldsInstance.tokenize.mockRejectedValue(new Error('bad happen'));
        jest.spyOn(cardView.model, 'addPaymentMethod').mockImplementation();

        return cardView.tokenize().catch(() => {
          expect(cardView.model.addPaymentMethod).not.toBeCalled();
        });
      }
    );
  });

  describe('field errors', () => {
    beforeEach(() => {
      jest.spyOn(classList, 'add').mockImplementation();
    });

    describe('showFieldError', () => {
      let cardView;

      beforeEach(() => {
        return makeCardView().then((view) => {
          cardView = view;
        });
      });

      test('sets hosted fields attributes on hosted fields', () => {
        const fakeGroup = document.createElement('div');
        const fakeHostedField = document.createElement('iframe');

        fakeHostedField.id = 'braintree-hosted-field-foo';
        fakeGroup.appendChild(fakeHostedField);

        jest.spyOn(cardView, 'getElementById').mockReturnValue(fakeGroup);

        cardView.showFieldError('foo', 'errorMessage');

        expect(fakeHostedFieldsInstance.setAttribute).toBeCalledWith({
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

          jest.spyOn(cardView, 'getElementById').mockReturnValue(fakeGroup);

          cardView.showFieldError('foo', 'errorMessage');

          expect(fakeHostedFieldsInstance.setAttribute).not.toBeCalled();
        }
      );
    });

    describe('hideFieldError', () => {
      let cardView;

      beforeEach(() => {
        return makeCardView().then((view) => {
          cardView = view;
        });
      });

      test('removes hosted fields attributes on hosted fields', () => {
        const fakeGroup = document.createElement('div');
        const fakeHostedField = document.createElement('iframe');

        fakeHostedField.id = 'braintree-hosted-field-foo';
        fakeGroup.appendChild(fakeHostedField);

        jest.spyOn(cardView, 'getElementById').mockReturnValue(fakeGroup);

        cardView.hideFieldError('foo', 'errorMessage');

        expect(fakeHostedFieldsInstance.removeAttribute).toBeCalledWith({
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

          jest.spyOn(cardView, 'getElementById').mockReturnValue(fakeGroup);

          cardView.hideFieldError('foo', 'errorMessage');

          expect(fakeHostedFieldsInstance.removeAttribute).not.toBeCalled();
        }
      );
    });
  });

  describe('teardown', () => {
    let cardView;

    beforeEach(() => {
      return makeCardView().then((view) => {
        cardView = view;
      });
    });

    test('tears down hosted fields instance', () => {
      return cardView.teardown().then(() => {
        expect(fakeHostedFieldsInstance.teardown).toBeCalledTimes(1);
      });
    });

    test('passes hosted fields teardown errors to callback', () => {
      expect.assertions(1);

      const error = new Error('hosted fields teardown error');

      fakeHostedFieldsInstance.teardown.mockRejectedValue(error);

      return cardView.teardown().catch(err => {
        expect(err).toBe(error);
      });
    });
  });

  describe('getPaymentMethod', () => {
    test('returns undefined if form is invalid', () => {
      const view = new CardView({ element: cardElement });

      jest.spyOn(view, '_validateForm').mockReturnValue(false);

      expect(view.getPaymentMethod()).toBeUndefined(); // eslint-disable-line no-undefined
    });

    test('returns a card payment method object if form is valid', () => {
      const view = new CardView({ element: cardElement });

      jest.spyOn(view, '_validateForm').mockReturnValue(true);

      expect(view.getPaymentMethod()).toEqual({
        type: 'CreditCard'
      });
    });
  });

  describe('onSelection', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    test('focuses on the number field', () => {
      const view = new CardView({
        model: fake.model(),
        client: fake.client(),
        element: cardElement
      });

      view.hostedFieldsInstance = fake.hostedFields();

      view.onSelection();

      jest.runAllTimers();

      expect(view.hostedFieldsInstance.focus).toBeCalledTimes(1);
      expect(view.hostedFieldsInstance.focus).toBeCalledWith('number');
    });

    test('setPaymentMethodRequestable is called on selection', () => {
      const model = fake.model();
      const view = new CardView({
        model,
        client: fake.client(),
        element: cardElement
      });
      const hf = fake.hostedFields();

      view.hostedFieldsInstance = hf;
      hf.getState.mockReturnValue({
        cards: [{ type: 'visa' }],
        fields: {
          number: {
            isValid: true
          },
          expirationDate: {
            isValid: true
          }
        }
      });

      jest.spyOn(model, 'setPaymentMethodRequestable').mockImplementation();

      view.onSelection();

      expect(model.setPaymentMethodRequestable).toBeCalledWith({
        isRequestable: true,
        type: 'CreditCard'
      });

      model.setPaymentMethodRequestable.mockClear();
      hf.getState.mockReturnValue({
        cards: [{ type: 'visa' }],
        fields: {
          number: {
            isValid: true
          },
          expirationDate: {
            isValid: false
          }
        }
      });

      view.onSelection();

      expect(model.setPaymentMethodRequestable).toBeCalledWith({
        isRequestable: false,
        type: 'CreditCard'
      });
    });

    test('noops if the hosted fields instance is not available', () => {
      const view = new CardView({ element: cardElement });

      delete view.hostedFieldsInstance;

      expect(() => {
        view.onSelection();

        jest.runAllTimers();
      }).not.toThrowError();
    });
  });
});
