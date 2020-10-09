jest.mock('../../../../src/lib/analytics');

const BaseView = require('../../../../src/views/base-view');
const CardView = require('../../../../src/views/payment-sheet-views/card-view');
const classList = require('@braintree/class-list');
const DropinModel = require('../../../../src/dropin-model');
const fake = require('../../../helpers/fake');
const fs = require('fs');
const hostedFields = require('braintree-web/hosted-fields');
const strings = require('../../../../src/translations/en_US');
const transitionHelper = require('../../../../src/lib/transition-helper');
const { yields } = require('../../../helpers/yields');

const mainHTML = fs.readFileSync(`${__dirname}/../../../../src/html/main.html`, 'utf8');
const { CHANGE_ACTIVE_PAYMENT_METHOD_TIMEOUT } = require('../../../../src/constants');

describe('CardView', () => {
  let container, cardElement, fakeHostedFieldsInstance;

  function makeCardView(cardConfiguration = {}) {
    const card = Object.assign({}, cardConfiguration, {
      vault: {}
    });
    const config = {
      merchantConfiguration: {
        card
      }
    };
    const model = fake.model(config);

    container.innerHTML = mainHTML;
    cardElement = document.body.querySelector('.braintree-sheet.braintree-card');

    return model.initialize().then(() => {
      const view = new CardView({
        element: cardElement,
        model,
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
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Constructor', () => {
    it('inherits from BaseView', () => {
      expect(new CardView({ element: cardElement })).toBeInstanceOf(BaseView);
    });
  });

  describe('initialize', () => {
    let fakeModel;

    beforeEach(() => {
      fakeModel = fake.model();

      return fakeModel.initialize();
    });

    it('has cvv by default', async () => {
      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        strings
      });

      await view.initialize();

      expect(cardElement.querySelector('[data-braintree-id="cvv-field-group"]')).toBeTruthy();
    });

    it('does not have cvv if merchant passes `card.cvv.collect = false`',
      async () => {
        fakeModel.merchantConfiguration.card = {
          cvv: {
            collect: false
          }
        };

        const view = new CardView({
          element: cardElement,
          model: fakeModel,
          strings
        });

        await view.initialize();

        expect(cardElement.querySelector('[data-braintree-id="cvv-field-group"]')).toBeFalsy();
      });

    it('has postal code if merchant passes `card.postalCode.collect = true`',
      async () => {
        fakeModel.merchantConfiguration.card = {
          postalCode: {
            collect: true
          }
        };

        const view = new CardView({
          element: cardElement,
          model: fakeModel,
          strings
        });

        await view.initialize();

        expect(cardElement.querySelector('[data-braintree-id="postal-code-field-group"]')).toBeTruthy();
      });

    it('does not have postal code by default', async () => {
      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        strings
      });

      await view.initialize();

      expect(cardElement.querySelector('[data-braintree-id="postal-code-field-group"]')).toBeFalsy();
    });

    it('has cardholderName if provided in merchant configuration', () => {
      fakeModel.merchantConfiguration.card = {
        cardholderName: true
      };

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        strings: strings
      });

      return view.initialize().then(() => {
        expect(cardElement.querySelector('[data-braintree-id="cardholder-name-field-group"]')).toBeDefined();
      });
    });

    it('does not include cardholderName if not provided in merchant configuration', () => {
      fakeModel.merchantConfiguration.card = {};

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        strings: strings
      });

      return view.initialize().then(() => {
        expect(cardElement.querySelector('[data-braintree-id="cardholder-name-field-group"]')).toBeFalsy();
      });
    });

    it('removes hidden class from save card input if configured', () => {
      fakeModel.merchantConfiguration.card = {
        vault: {
          allowAutoVaultOverride: true
        }
      };
      fakeModel.vaultManagerConfig.autoVaultPaymentMethods = true;

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        strings: strings
      });

      return view.initialize().then(() => {
        expect(
          cardElement.querySelector('[data-braintree-id="save-card-field-group"]').className
        ).not.toMatch('braintree-hidden');
      });
    });

    it('does not remove hidden class from save card input if not configured', () => {
      fakeModel.merchantConfiguration.card = {};
      fakeModel.vaultManagerConfig.autoVaultPaymentMethods = true;

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        strings: strings
      });

      return view.initialize().then(() => {
        expect(
          cardElement.querySelector('[data-braintree-id="save-card-field-group"]').className
        ).toMatch('braintree-hidden');
      });
    });

    it('sets checked value for save card input', () => {
      fakeModel.merchantConfiguration.card = {
        vault: {
          autoVault: false
        }
      };

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        strings: strings
      });

      return view.initialize().then(() => {
        expect(view.saveCardInput.checked).toBe(false);
      });
    });

    it('defaults checked value for save card input to true', () => {
      fakeModel.merchantConfiguration.card = {};

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        strings: strings
      });

      return view.initialize().then(() => {
        expect(view.saveCardInput.checked).toBe(true);
      });
    });

    it('starts async dependency', () => {
      jest.spyOn(DropinModel.prototype, 'asyncDependencyStarting');

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        strings: strings
      });

      return view.initialize().then(() => {
        expect(DropinModel.prototype.asyncDependencyStarting).toBeCalledTimes(1);
      });
    });

    it('notifies async dependency is ready when Hosted Fields is created',
      async () => {
        jest.spyOn(DropinModel.prototype, 'asyncDependencyReady');

        const view = new CardView({
          element: cardElement,
          model: fakeModel,
          strings: strings
        });

        return view.initialize().then(() => {
          expect(DropinModel.prototype.asyncDependencyReady).toBeCalledTimes(1);
        });
      });

    it('creates Hosted Fields with number and expiration date', () => {
      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        strings: strings
      });

      return view.initialize().then(() => {
        expect(hostedFields.create).toBeCalledWith(expect.objectContaining({
          authorization: view.model.authorization,
          fields: {
            number: expect.any(Object),
            cvv: expect.any(Object),
            expirationDate: expect.any(Object)
          }
        }));
      });
    });

    it('creates Hosted Fields with postal code if included in config', () => {
      fakeModel.merchantConfiguration.card = {
        postalCode: {
          collect: true
        }
      };

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        strings: strings,
        merchantConfiguration: {
          authorization: fake.clientToken
        }
      });

      return view.initialize().then(() => {
        expect(hostedFields.create.mock.calls[0][0].fields).toHaveProperty('postalCode');
      });
    });

    it('calls asyncDependencyFailed with an error when Hosted Fields creation fails', () => {
      const fakeError = {
        code: 'A_REAL_ERROR_CODE'
      };

      hostedFields.create.mockRejectedValue(fakeError);
      jest.spyOn(fakeModel, 'asyncDependencyFailed').mockImplementation();

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        strings: strings
      });

      return view.initialize().then(() => {
        expect(fakeModel.asyncDependencyFailed).toBeCalledWith({
          view: 'card',
          error: fakeError
        });
      });
    });

    it('shows supported card icons', () => {
      const unsupportedCardTypes = ['maestro', 'diners-club', 'unionpay', 'discover'];
      const supportedCardTypes = ['visa', 'mastercard', 'american-express', 'jcb'];

      fakeHostedFieldsInstance.getSupportedCardTypes.mockResolvedValue([
        'Visa',
        'Mastercard',
        'American Express',
        'JCB'
      ]);

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        strings: strings
      });

      return view.initialize().then(() => {
        unsupportedCardTypes.forEach(cardType => {
          const cardIcon = cardElement.querySelector('[data-braintree-id="' + cardType + '-card-icon"]');

          expect(cardIcon.classList.contains('braintree-hidden')).toBe(true);
        });
        supportedCardTypes.forEach(cardType => {
          const cardIcon = cardElement.querySelector(`[data-braintree-id="${cardType}-card-icon"]`);

          expect(cardIcon.classList.contains('braintree-hidden')).toBe(false);
        });
      });
    });

    it('does not show UnionPay icon even if it is supported', () => {
      fakeHostedFieldsInstance.getSupportedCardTypes.mockResolvedValue([
        'UnionPay'
      ]);

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        strings: strings
      });

      return view.initialize().then(() => {
        const unionPayCardIcon = cardElement.querySelector('[data-braintree-id="unionpay-card-icon"]');

        expect(unionPayCardIcon.classList.contains('braintree-hidden')).toBe(true);
      });
    });

    it('sets field placeholders', () => {
      let hostedFieldsConfiguredFields;

      fakeModel.merchantConfiguration.card = {
        postalCode: {
          collect: true
        }
      };

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
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

    it('allows overriding field options for hosted fields', () => {
      let hostedFieldsConfiguredFields;

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
        strings: strings
      });

      return view.initialize().then(() => {
        hostedFieldsConfiguredFields = hostedFields.create.mock.calls[0][0].fields;

        expect(hostedFieldsConfiguredFields.number.placeholder).toBe('placeholder');
        expect(hostedFieldsConfiguredFields.cvv.maxlength).toBe(2);
      });
    });

    it('does not add hosted fields elements for fields that are not present', () => {
      let hostedFieldsConfiguredFields;

      fakeModel.merchantConfiguration.card = {
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

      const view = new CardView({
        element: cardElement,
        model: fakeModel,
        strings: strings
      });

      return view.initialize().then(() => {
        hostedFieldsConfiguredFields = hostedFields.create.mock.calls[0][0].fields;

        expect(hostedFieldsConfiguredFields.cvv).toBeFalsy();
        expect(hostedFieldsConfiguredFields.postalCode).toBeFalsy();
        expect(hostedFieldsConfiguredFields.expirationMonth).toBeFalsy();
        expect(hostedFieldsConfiguredFields.expirationYear).toBeFalsy();
      });
    });

    it('ignores changes to selector in field options', () => {
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
        strings
      });

      return view.initialize().then(() => {
        const hostedFieldsConfiguredFields = hostedFields.create.mock.calls[0][0].fields;

        expect(hostedFieldsConfiguredFields.number.selector).not.toBe('#some-selector');
      });
    });

    it('allows overriding styles options for hosted fields', () => {
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

    it('allows overriding styles options with class name for hosted fields', () => {
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
    });
  });

  describe('isEnabled', () => {
    let fakeOptions;

    beforeEach(() => {
      fakeOptions = {
        merchantConfiguration: {}
      };
    });

    it('resolves with true when no merchant configuration provided', () => {
      return CardView.isEnabled(fakeOptions).then(result => {
        expect(result).toBe(true);
      });
    });

    it('resolves with false when merchant configuration sets card to false', () => {
      fakeOptions.merchantConfiguration.card = false;

      return CardView.isEnabled(fakeOptions).then(result => {
        expect(result).toBe(false);
      });
    });
  });

  describe('requestPaymentMethod', () => {
    let fakeModel;

    beforeEach(() => {
      fakeModel = fake.model();

      return fakeModel.initialize();
    });

    it('calls the callback with an error when tokenize fails', () => {
      expect.assertions(2);

      const cardView = new CardView({
        element: cardElement,
        model: fakeModel,
        strings: strings
      });

      jest.spyOn(cardView, 'tokenize').mockRejectedValue(new Error('foo'));

      return cardView.requestPaymentMethod().catch(err => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('foo');
      });
    });

    it('calls the callback with the payload when tokenize is successful', () => {
      const cardView = new CardView({
        element: cardElement,
        model: fakeModel,
        strings: strings
      });

      jest.spyOn(cardView, 'tokenize').mockResolvedValue({ foo: 'bar' });

      return cardView.requestPaymentMethod().then(payload => {
        expect(payload.foo).toBe('bar');
      });
    });
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

      it('shows default card icon in number field when focused', () => {
        return cardView.initialize().then(() => {
          const cardNumberIcon = cardElement.querySelector('[data-braintree-id="card-number-icon"]');

          expect(cardNumberIcon.classList.contains('braintree-hidden')).toBe(false);
          expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).toBe('#iconCardFront');
        });
      });

      it('shows default cvv icon in cvv field when focused', () => {
        eventPayload = { emittedBy: 'cvv' };

        return cardView.initialize().then(() => {
          const cvvIcon = cardElement.querySelector('[data-braintree-id="cvv-icon"]');

          expect(cvvIcon.classList.contains('braintree-hidden')).toBe(false);
          expect(cvvIcon.querySelector('use').getAttribute('xlink:href')).toBe('#iconCVVBack');
        });
      });

      it('adds braintree-form__field-group--is-focused', () => {
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

      it('removes braintree-form__field-group--is-focused class when blurred', () => {
        const numberFieldGroup = cardElement.querySelector('[data-braintree-id="number-field-group"]');

        eventPayload = {
          cards: [{ type: 'visa', supported: true }],
          emittedBy: 'number',
          fields: {
            number: { isEmpty: true }
          }
        };

        classList.add(numberFieldGroup, 'braintree-form__field-group--is-focused');

        return cardView.initialize().then(() => {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--is-focused')).toBe(false);
        });
      });

      it('applies error class if field is not valid', () => {
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

        classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');

        return cardView.initialize().then(() => {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(true);
          expect(numberFieldError.textContent).toBe('This card number is not valid.');
        });
      });

      it('does apply error class if field is empty when focusing another hosted field', () => {
        const fakeHostedField = document.createElement('iframe');
        const numberFieldGroup = cardElement.querySelector('[data-braintree-id="number-field-group"]');
        const numberFieldError = cardElement.querySelector('[data-braintree-id="number-field-error"]');

        eventPayload = {
          cards: [{ type: 'visa', supported: true }],
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

        classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');

        return cardView.initialize().then(() => {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(true);
          expect(numberFieldError.textContent).toBe('Please fill out a card number.');
        });
      });

      it('sets the empty error when programatically focussing a hosted field (requires a setTimeout)',
        done => {
          const fakeElement = document.createElement('div');
          const fakeHostedField = document.createElement('iframe');
          const numberFieldGroup = cardElement.querySelector('[data-braintree-id="number-field-group"]');

          eventPayload = {
            cards: [{ type: 'visa', supported: true }],
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

          classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');

          cardView.initialize().then(() => {
            expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(false);

            fakeHostedField.focus();

            setTimeout(() => {
              expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(true);
              done();
            }, 300);
          });
        });

      it('does not apply error class if field is empty and not focusing hosted fields', () => {
        const fakeElement = document.createElement('iframe');
        const numberFieldGroup = cardElement.querySelector('[data-braintree-id="number-field-group"]');

        eventPayload = {
          cards: [{ type: 'visa', supported: true }],
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

        classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');

        return cardView.initialize().then(() => {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(false);
        });
      });

      it('does not apply error class if field is empty and the active element is not an iframe', () => {
        const fakeElement = document.createElement('div');

        const numberFieldGroup = cardElement.querySelector('[data-braintree-id="number-field-group"]');

        eventPayload = {
          cards: [{ type: 'visa', supported: true }],
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

        classList.remove(numberFieldGroup, 'braintree-form__field-group--has-error');

        return cardView.initialize().then(() => {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(false);
        });
      });
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

      it('adds the card-type-known class when there is one possible card type', () => {
        const numberFieldGroup = cardElement.querySelector('[data-braintree-id="number-field-group"]');

        eventPayload = {
          cards: [{ type: 'master-card', supported: true }],
          emittedBy: 'number'
        };

        return cardView.initialize().then(() => {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--card-type-known')).toBe(true);
        });
      });

      it('removes the card-type-known class when there is no possible card type', () => {
        const numberFieldGroup = cardElement.querySelector('[data-braintree-id="number-field-group"]');

        eventPayload = {
          cards: [],
          emittedBy: 'number'
        };

        classList.add(numberFieldGroup, 'braintree-form__field-group--card-type-known');

        return cardView.initialize().then(() => {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--card-type-known')).toBe(false);
        });
      });

      it('removes the card-type-known class when there are many possible card types', () => {
        const numberFieldGroup = cardElement.querySelector('[data-braintree-id="number-field-group"]');

        eventPayload = {
          cards: [{ type: 'master-card', supported: true }, { type: 'foo-pay', supported: true }],
          emittedBy: 'number'
        };

        classList.add(numberFieldGroup, 'braintree-form__field-group--card-type-known');

        return cardView.initialize().then(() => {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--card-type-known')).toBe(false);
        });
      });

      it('updates the card number icon to the card type if there is one possible card type', () => {
        const cardNumberIcon = cardElement.querySelector('[data-braintree-id="card-number-icon"]');

        eventPayload = {
          cards: [{ type: 'master-card', supported: true }],
          emittedBy: 'number'
        };

        return cardView.initialize().then(() => {
          expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).toBe('#icon-master-card');
        });
      });

      it('updates the card number icon to the generic card if there are many possible card types', () => {
        const cardNumberIcon = cardElement.querySelector('[data-braintree-id="card-number-icon"]');

        eventPayload = {
          cards: [{ type: 'master-card', supported: true }, { type: 'foo-pay', supported: true }],
          emittedBy: 'number'
        };

        return cardView.initialize().then(() => {
          expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).toBe('#iconCardFront');
        });
      });

      it('updates the card icon to the generic card if there no card types', () => {
        const cardNumberIcon = cardElement.querySelector('[data-braintree-id="card-number-icon"]');

        eventPayload = {
          cards: [],
          emittedBy: 'number'
        };

        return cardView.initialize().then(() => {
          expect(cardNumberIcon.querySelector('use').getAttribute('xlink:href')).toBe('#iconCardFront');
        });
      });

      it('updates the cvv icon to back icon for non-amex cards', () => {
        const use = cardElement.querySelector('[data-braintree-id="cvv-icon"]').querySelector('use');

        eventPayload = {
          cards: [{ type: 'visa', supported: true }],
          emittedBy: 'number'
        };

        use.setAttribute('xlink:href', '#iconCVVFront');

        return cardView.initialize().then(() => {
          expect(use.getAttribute('xlink:href')).toBe('#iconCVVBack');
        });
      });

      it('updates the cvv icon to front icon for amex cards', () => {
        const use = cardElement.querySelector('[data-braintree-id="cvv-icon"]').querySelector('use');

        eventPayload = {
          cards: [{ type: 'american-express', supported: true }],
          emittedBy: 'number'
        };

        return cardView.initialize().then(() => {
          expect(use.getAttribute('xlink:href')).toBe('#iconCVVFront');
        });
      });

      it('updates the cvv label descriptor to four digits when card type is amex', () => {
        const cvvLabelDescriptor = cardElement.querySelector('[data-braintree-id="cvv-field-group"]').querySelector('.braintree-form__descriptor');

        eventPayload = {
          cards: [{ type: 'american-express', supported: true }],
          emittedBy: 'number'
        };

        cvvLabelDescriptor.textContent = 'some value';

        return cardView.initialize().then(() => {
          expect(cvvLabelDescriptor.textContent).toBe('(4 digits)');
        });
      });

      it('updates the cvv label descriptor to three digits when card type is non-amex', () => {
        const cvvLabelDescriptor = cardElement.querySelector('[data-braintree-id="cvv-field-group"]').querySelector('.braintree-form__descriptor');

        eventPayload = {
          cards: [{ type: 'visa', supported: true }],
          emittedBy: 'number'
        };

        cvvLabelDescriptor.textContent = 'some value';

        return cardView.initialize().then(() => {
          expect(cvvLabelDescriptor.textContent).toBe('(3 digits)');
        });
      });

      it('updates the cvv label descriptor to three digits when multiple card types', () => {
        const cvvLabelDescriptor = cardElement.querySelector('[data-braintree-id="cvv-field-group"]').querySelector('.braintree-form__descriptor');

        eventPayload = {
          cards: [{ type: 'american-express', supported: true }, { type: 'visa', supported: true }],
          emittedBy: 'number'
        };

        cvvLabelDescriptor.textContent = 'some value';

        return cardView.initialize().then(() => {
          expect(cvvLabelDescriptor.textContent).toBe('(3 digits)');
        });
      });

      it('updates the cvv field placeholder when card type is amex', () => {
        eventPayload = {
          cards: [{ type: 'american-express', supported: true }],
          emittedBy: 'number'
        };

        return cardView.initialize().then(() => {
          expect(fakeHostedFieldsInstance.setAttribute).toBeCalledWith({ field: 'cvv', attribute: 'placeholder', value: '••••' });
        });
      });

      it('updates the cvv field placeholder when card type is non-amex', () => {
        eventPayload = {
          cards: [{ type: 'visa', supported: true }],
          emittedBy: 'number'
        };

        return cardView.initialize().then(() => {
          expect(fakeHostedFieldsInstance.setAttribute).toBeCalledWith({ field: 'cvv', attribute: 'placeholder', value: '•••' });
        });
      });

      it('updates the cvv field placeholder when multiple card types', () => {
        eventPayload = {
          cards: [{ type: 'american-express', supported: true }, { type: 'visa', supported: true }],
          emittedBy: 'number'
        };

        return cardView.initialize().then(() => {
          expect(fakeHostedFieldsInstance.setAttribute).toBeCalledWith({ field: 'cvv', attribute: 'placeholder', value: '•••' });
        });
      });

      it('updates the cvv field placeholder when multiple card types', () => {
        eventPayload = {
          cards: [{ type: 'american-express' }, { type: 'visa' }],
          emittedBy: 'number'
        };

        return cardView.initialize().then(() => {
          expect(fakeHostedFieldsInstance.setAttribute).toBeCalledWith({ field: 'cvv', attribute: 'placeholder', value: '•••' });
        });
      });

      it('does not update the cvv field placeholder when there is no cvv challenge', () => {
        eventPayload = {
          cards: [{ type: 'american-express', supported: true }, { type: 'visa', supported: true }],
          emittedBy: 'number'
        };
        cardView.model.merchantConfiguration.card = {
          cvv: {
            collect: false
          }
        };

        return cardView.initialize().then(() => {
          expect(fakeHostedFieldsInstance.setAttribute).not.toBeCalled();
        });
      });

      it('does not update the cvv field placeholder when it is removed with an override', () => {
        eventPayload = {
          cards: [{ type: 'american-express', supported: true }, { type: 'visa', supported: true }],
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
      });

      it('does not update the cvv field placeholder when using a custom CVV placeholder', () => {
        eventPayload = {
          cards: [{ type: 'american-express', supported: true }, { type: 'visa', supported: true }],
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
      });
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

      it('removes the braintree-form__field-group--has-error class if a field is potentially valid', () => {
        const numberFieldGroup = cardElement.querySelector('[data-braintree-id="number-field-group"]');

        eventPayload = {
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

        classList.add(numberFieldGroup, 'braintree-form__field-group--has-error');

        return cardView.initialize().then(() => {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(false);
        });
      });

      it('adds braintree-form__field--valid class to valid expiration date field', () => {
        const expirationElement = cardElement.querySelector('.braintree-form-expiration');

        eventPayload = {
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

        return cardView.initialize().then(() => {
          expect(expirationElement.classList.contains('braintree-form__field--valid')).toBe(true);
        });
      });

      it('removes braintree-form__field--valid class to invalid expiration date field', () => {
        const expirationElement = cardElement.querySelector('.braintree-form-expiration');

        eventPayload = {
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

        return cardView.initialize().then(() => {
          expect(expirationElement.classList.contains('braintree-form__field--valid')).toBe(false);
        });
      });

      it('adds braintree-form__field--valid class to valid number with card type supported', () => {
        const numberElement = cardElement.querySelector('.braintree-form-number');

        eventPayload = {
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
      });

      it('removes braintree-form__field--valid class to valid number without card type supported', () => {
        const numberElement = cardElement.querySelector('.braintree-form-number');

        eventPayload = {
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
      });

      it('removes braintree-form__field--valid class to not valid number with card type supported', () => {
        const numberElement = cardElement.querySelector('.braintree-form-number');

        eventPayload = {
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
      });

      it('calls model.setPaymentMethodRequestable with isRequestable true if form is valid', () => {
        const numberElement = cardElement.querySelector('.braintree-form-number');

        eventPayload = {
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
      });

      it('calls model.setPaymentMethodRequestable with isRequestable false if form is invalid', () => {
        const numberElement = cardElement.querySelector('.braintree-form-number');

        eventPayload = {
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
      });

      it('does not call model.setPaymentMethodRequestable if tokenization is in progress', () => {
        const numberElement = cardElement.querySelector('.braintree-form-number');

        cardView._isTokenizing = true;
        eventPayload = {
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

        jest.spyOn(cardView, 'hideFieldError').mockImplementation();
        jest.spyOn(cardView.model, 'setPaymentMethodRequestable').mockImplementation();
        jest.spyOn(cardView, '_validateForm').mockReturnValue(false);

        return cardView.initialize().then(() => {
          expect(cardView.model.setPaymentMethodRequestable).not.toBeCalled();
        });
      });
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

      it('removes the braintree-form__field-group--has-error class', () => {
        const numberFieldGroup = cardElement.querySelector('[data-braintree-id="number-field-group"]');

        eventPayload = {
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

        classList.add(numberFieldGroup, 'braintree-form__field-group--has-error');

        return cardView.initialize().then(() => {
          expect(numberFieldGroup.classList.contains('braintree-form__field-group--has-error')).toBe(false);
        });
      });
    });
  });

  describe('tokenize', () => {
    let cardView;

    beforeEach(() => {
      fakeHostedFieldsInstance.getState.mockReturnValue({
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
      fakeHostedFieldsInstance.tokenize.mockResolvedValue({});

      jest.spyOn(transitionHelper, 'onTransitionEnd').mockImplementation(yields());

      return makeCardView().then((view) => {
        cardView = view;
      });
    });

    it('clears the error on the model', () => {
      expect.assertions(1);

      jest.spyOn(cardView.model, 'clearError').mockImplementation();
      fakeHostedFieldsInstance.getState.mockReturnValue({
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

      return cardView.tokenize().catch(() => {
        expect(cardView.model.clearError).toBeCalled();
      });
    });

    it('throws an error if there is no valid card type', () => {
      expect.assertions(2);

      fakeHostedFieldsInstance.getState.mockReturnValue({
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

      return cardView.tokenize().catch(err => {
        expect(err).toBeDefined();
        expect(fakeHostedFieldsInstance.tokenize).not.toBeCalled();
      });
    });

    it('calls callback with error and reports error to DropinModel if form is not valid', () => {
      expect.assertions(3);

      fakeHostedFieldsInstance.getState.mockReturnValue({
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

      jest.spyOn(cardView.model, 'reportError').mockImplementation();

      return cardView.tokenize().catch(err => {
        expect(fakeHostedFieldsInstance.tokenize).not.toBeCalled();
        expect(cardView.model.reportError).toBeCalledWith('hostedFieldsFieldsInvalidError');
        expect(err.message).toBe('No payment method is available.');
      });
    });

    it('calls callback with error when cardholder name is required and the input is empty', () => {
      let cardViewWithCardholderName;

      expect.assertions(3);

      return makeCardView({
        cardholderName: {
          required: true
        }
      }).then((view) => {
        cardViewWithCardholderName = view;

        fakeHostedFieldsInstance.getState.mockReturnValue({
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

        jest.spyOn(cardViewWithCardholderName.model, 'reportError').mockImplementation();

        return cardViewWithCardholderName.tokenize();
      }).catch(err => {
        expect(fakeHostedFieldsInstance.tokenize).not.toBeCalled();
        expect(cardViewWithCardholderName.model.reportError).toBeCalledWith('hostedFieldsFieldsInvalidError');
        expect(err.message).toBe('No payment method is available.');
      });
    });

    it('does not error if cardholder name is empty, but not required', () => {
      let cardViewWithCardholderName;

      return makeCardView({
        cardholderName: {
          required: false
        }
      }).then((view) => {
        cardViewWithCardholderName = view;
        fakeHostedFieldsInstance.getState.mockReturnValue({
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

        jest.spyOn(cardViewWithCardholderName.model, 'reportError').mockImplementation();

        return cardViewWithCardholderName.tokenize();
      }).then(() => {
        expect(cardViewWithCardholderName.model.reportError).not.toBeCalled();
        expect(fakeHostedFieldsInstance.tokenize).toBeCalledTimes(1);
      });
    });

    it('does not error if cardholder name is not included', () => {
      let cardViewWithoutCardholderName;

      fakeHostedFieldsInstance.getState.mockReturnValue({
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

      return makeCardView({
        cardholderName: false
      }).then((view) => {
        cardViewWithoutCardholderName = view;
        jest.spyOn(cardViewWithoutCardholderName.model, 'reportError').mockImplementation();

        return cardViewWithoutCardholderName.tokenize();
      }).then(() => {
        expect(cardViewWithoutCardholderName.model.reportError).not.toBeCalled();
        expect(fakeHostedFieldsInstance.tokenize).toBeCalledTimes(1);
      });
    });

    it('calls callback with error when cardholder name length is over 255 characters', () => {
      let cardViewWithCardholderName;

      expect.assertions(3);

      return makeCardView({
        cardholderName: true
      }).then((view) => {
        cardViewWithCardholderName = view;
      }).then(() => {
        const overLengthValue = Array(257).join('a');

        fakeHostedFieldsInstance.getState.mockReturnValue({
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
        jest.spyOn(cardViewWithCardholderName.model, 'reportError').mockImplementation();

        cardViewWithCardholderName.cardholderNameInput.value = overLengthValue;

        return cardViewWithCardholderName.tokenize().catch(err => {
          expect(fakeHostedFieldsInstance.tokenize).not.toBeCalled();
          expect(cardViewWithCardholderName.model.reportError).toBeCalledWith('hostedFieldsFieldsInvalidError');
          expect(err.message).toBe('No payment method is available.');
        });
      });
    });

    it('reports an error to DropinModel when Hosted Fields tokenization returns an error', () => {
      expect.assertions(1);

      const fakeError = {
        code: 'A_REAL_ERROR_CODE'
      };

      fakeHostedFieldsInstance.tokenize.mockRejectedValue(fakeError);
      jest.spyOn(cardView.model, 'reportError').mockImplementation();

      return cardView.tokenize().catch(() => {
        expect(cardView.model.reportError).toBeCalledWith(fakeError);
      });
    });

    it('reports a duplicate card error to DropinModel when tokenization returns an error', () => {
      expect.assertions(1);

      const fakeError = { code: 'HOSTED_FIELDS_TOKENIZATION_FAIL_ON_DUPLICATE' };

      fakeHostedFieldsInstance.tokenize.mockRejectedValue(fakeError);
      jest.spyOn(cardView.model, 'reportError').mockImplementation();

      return cardView.tokenize().catch(() => {
        expect(cardView.model.reportError).toBeCalledWith(fakeError);
      });
    });

    it('shows unsupported card field error when attempting to use an unsupported card and reports an error', () => {
      expect.assertions(4);

      const numberFieldError = cardElement.querySelector('[data-braintree-id="number-field-error"]');

      jest.spyOn(cardView.model, 'reportError').mockImplementation();

      fakeHostedFieldsInstance.getState.mockReturnValue({
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

      return cardView.tokenize().catch(() => {
        expect(numberFieldError.classList.contains('braintree-hidden')).toBe(false);
        expect(numberFieldError.textContent).toBe('This card type is not supported. Please try another card.');
        expect(cardView.model.reportError).toBeCalledWith('hostedFieldsFieldsInvalidError');
        expect(fakeHostedFieldsInstance.tokenize).not.toBeCalled();
      });
    });

    it('shows empty field error when attempting to sumbit an empty field', () => {
      expect.assertions(3);

      const numberFieldError = cardElement.querySelector('[data-braintree-id="number-field-error"]');

      fakeHostedFieldsInstance.getState.mockReturnValue({
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

      return cardView.tokenize().catch(() => {
        expect(numberFieldError.classList.contains('braintree-hidden')).toBe(false);
        expect(numberFieldError.textContent).toBe('Please fill out a card number.');
        expect(fakeHostedFieldsInstance.tokenize).not.toBeCalled();
      });
    });

    it('shows invalid field error when attempting to submit an invalid field', () => {
      expect.assertions(3);

      const numberFieldError = cardElement.querySelector('[data-braintree-id="number-field-error"]');

      fakeHostedFieldsInstance.getState.mockReturnValue({
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

      return cardView.tokenize().catch(() => {
        expect(numberFieldError.classList.contains('braintree-hidden')).toBe(false);
        expect(numberFieldError.textContent).toBe('This card number is not valid.');
        expect(fakeHostedFieldsInstance.tokenize).not.toBeCalled();
      });
    });

    it('sets the aria-invalid attribute and set message when a field error is shown', () => {
      fakeHostedFieldsInstance.getState.mockReturnValue({
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
    });

    it('sets the aria-invalid attribute on an input when a field error is hidden', () => {
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
    });

    it('removes the aria-invalid attribute and message when a field error is hidden', () => {
      fakeHostedFieldsInstance.getState.mockReturnValue({
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

      cardView.hideFieldError('number');

      expect(fakeHostedFieldsInstance.removeAttribute).toBeCalledWith({
        field: 'number',
        attribute: 'aria-invalid'
      });
      expect(fakeHostedFieldsInstance.setMessage).toBeCalledWith({
        field: 'number',
        message: ''
      });
    });

    it('removes the aria-invalid attribute on an input when a field error is hidden', () => {
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
    });

    it('calls hostedFieldsInstance.tokenize when form is valid', () => {
      return cardView.tokenize().then(() => {
        expect(fakeHostedFieldsInstance.tokenize).toBeCalledTimes(1);
      });
    });

    it('includes `vaulted: true` in tokenization payload if not guest checkout', () => {
      cardView.model.vaultManagerConfig.autoVaultPaymentMethods = true;

      return cardView.tokenize().then(payload => {
        expect(payload.vaulted).toBe(true);
      });
    });

    it('does not include `vaulted: true` in tokenization payload if save card input is not checked', () => {
      cardView.model.vaultManagerConfig.autoVaultPaymentMethods = true;
      cardView.saveCardInput.checked = false;

      return cardView.tokenize().then(payload => {
        expect(payload.vaulted).toBeFalsy();
      });
    });

    it('does not include `vaulted: true` in tokenization payload if guest checkout', () => {
      cardView.model.vaultManagerConfig.autoVaultPaymentMethods = false;

      return cardView.tokenize().then(payload => {
        expect(payload.vaulted).toBeFalsy();
      });
    });

    it('sets isTokenizing to true', () => {
      cardView.tokenize().then();

      expect(cardView._isTokenizing).toBe(true);
    });

    it('does not call hostedFieldsInstance.tokenize if form is invalid', () => {
      expect.assertions(1);

      fakeHostedFieldsInstance.getState.mockReturnValue({
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

      return cardView.tokenize().catch(() => {
        expect(fakeHostedFieldsInstance.tokenize).not.toBeCalled();
      });
    });

    it('does not vault on tokenization if auto vaulting is configured globally, but set to not vault locally', () => {
      cardView.merchantConfiguration.vault.autoVault = false;
      cardView.model.vaultManagerConfig.autoVaultPaymentMethods = true;

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

      return cardView.tokenize().then(() => {
        expect(fakeHostedFieldsInstance.tokenize).toBeCalledWith({ vault: false });
      });
    });

    it('vaults on tokenization if auto vaulting is configured globally to not vault, but set to vault locally', () => {
      expect.assertions(1);

      cardView.merchantConfiguration.vault.autoVault = true;
      cardView.model.vaultManagerConfig.autoVaultPaymentMethods = false;

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

      return cardView.tokenize().then(() => {
        expect(fakeHostedFieldsInstance.tokenize).toBeCalledWith({ vault: true });
      });
    });

    it('does not vault on tokenization if save card input is not checked', () => {
      cardView.saveCardInput.checked = false;

      return cardView.tokenize().then(() => {
        expect(fakeHostedFieldsInstance.tokenize).toBeCalledWith({ vault: false });
      });
    });

    it('does not vault on tokenization if save card input is not checked when autovaulting is set locally', () => {
      cardView.model.vaultManagerConfig.autoVaultPaymentMethods = true;
      cardView.saveCardInput.checked = false;

      return cardView.tokenize().then(() => {
        expect(fakeHostedFieldsInstance.tokenize).toBeCalledWith({ vault: false });
      });
    });

    it('does not vault on tokenization if autovaulting is set to false', () => {
      cardView.model.vaultManagerConfig.autoVaultPaymentMethods = false;

      return cardView.tokenize().then(() => {
        expect(fakeHostedFieldsInstance.tokenize).toBeCalledWith({ vault: false });
      });
    });

    it('clears fields after successful tokenization', () => {
      fakeHostedFieldsInstance.tokenize.mockResolvedValue({ nonce: 'foo' });

      return cardView.tokenize().then(() => {
        expect(fakeHostedFieldsInstance.clear).toBeCalledWith('number');
        expect(fakeHostedFieldsInstance.clear).toBeCalledWith('expirationDate');
        expect(fakeHostedFieldsInstance.clear).not.toBeCalledWith('cvv');
        expect(fakeHostedFieldsInstance.clear).not.toBeCalledWith('postalCode');
      });
    });

    it('clears cardholder name field if it exists after successful tokenization', () => {
      let cardViewWithCardholderName;

      return makeCardView({
        cardholderName: true
      }).then((view) => {
        cardViewWithCardholderName = view;
        fakeHostedFieldsInstance.tokenize.mockResolvedValue({ nonce: 'foo' });
        cardViewWithCardholderName.cardholderNameInput.value = 'Some value';

        return cardViewWithCardholderName.tokenize();
      }).then(() => {
        expect(cardViewWithCardholderName.cardholderNameInput.value).toBe('');
      });
    });

    it('does not clear fields after successful tokenization if merchant configuration includes clearFieldsAfterTokenization as false', () => {
      cardView.merchantConfiguration = {
        vault: {},
        clearFieldsAfterTokenization: false
      };
      fakeHostedFieldsInstance.tokenize.mockResolvedValue({ nonce: 'foo' });

      return cardView.tokenize().then(() => {
        expect(fakeHostedFieldsInstance.clear).not.toBeCalled();
      });
    });

    it('does not clear cardholder name field after successful tokenization if merchant configuration includes clearFieldsAfterTokenization as false', () => {
      let cardViewWithCardholderName;

      return makeCardView({
        clearFieldsAfterTokenization: false,
        cardholderName: true
      }).then((view) => {
        cardViewWithCardholderName = view;
        cardViewWithCardholderName.cardholderNameInput.value = 'Some value';
        fakeHostedFieldsInstance.tokenize.mockResolvedValue({ nonce: 'foo' });

        return cardViewWithCardholderName.tokenize();
      }).then(() => {
        expect(cardViewWithCardholderName.cardholderNameInput.value).toBe('Some value');
      });
    });

    it('sets isTokenizing to false on successful tokenization', done => {
      fakeHostedFieldsInstance.tokenize.mockResolvedValue({ nonce: 'foo' });

      cardView.tokenize().then(() => {
        setTimeout(() => {
          expect(cardView._isTokenizing).toBe(false);
          done();
        }, 300);
      });
    });

    it('sets isTokenizing to false on unsuccessful tokenization', () => {
      expect.assertions(1);

      fakeHostedFieldsInstance.tokenize.mockRejectedValue(new Error('Error'));

      return cardView.tokenize().catch(() => {
        expect(cardView._isTokenizing).toBe(false);
      });
    });

    it('removes braintree-sheet--loading class after successful tokenization',
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
      });

    it('removes braintree-sheet--loading class after tokenization fails', () => {
      expect.assertions(1);

      jest.spyOn(classList, 'remove').mockImplementation();
      fakeHostedFieldsInstance.tokenize.mockRejectedValue(new Error('foo'));

      return cardView.tokenize().catch(() => {
        expect(classList.remove).toBeCalledWith(cardElement, 'braintree-sheet--loading');
      });
    });

    it('adds a new payment method when tokenize is successful and transition ends', () => {
      const stubPayload = {};

      fakeHostedFieldsInstance.tokenize.mockResolvedValue(stubPayload);
      jest.spyOn(cardView.model, 'addPaymentMethod').mockImplementation();

      return cardView.tokenize().then(() => {
        expect(cardView.model.addPaymentMethod).toBeCalledWith(stubPayload);
      });
    });

    it('does not update the active payment method when tokenize fails', () => {
      expect.assertions(1);

      fakeHostedFieldsInstance.tokenize.mockRejectedValue(new Error('bad happen'));
      jest.spyOn(cardView.model, 'addPaymentMethod').mockImplementation();

      return cardView.tokenize().catch(() => {
        expect(cardView.model.addPaymentMethod).not.toBeCalled();
      });
    });
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

      it('sets hosted fields attributes on hosted fields', () => {
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

      it('does not set hosted fields attributes on non hosted fields', () => {
        const fakeInput = document.createElement('input');
        const fakeGroup = document.createElement('div');

        fakeGroup.setAttribute('data-braintree-id', 'foo-field-group');
        fakeInput.id = 'braintree__card-view-input';
        fakeGroup.appendChild(fakeInput);

        jest.spyOn(cardView, 'getElementById').mockReturnValue(fakeGroup);

        cardView.showFieldError('foo', 'errorMessage');

        expect(fakeHostedFieldsInstance.setAttribute).not.toBeCalled();
      });
    });

    describe('hideFieldError', () => {
      let cardView;

      beforeEach(() => {
        return makeCardView().then((view) => {
          cardView = view;
        });
      });

      it('removes hosted fields attributes on hosted fields', () => {
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

      it('does not remove hosted fields attributes on non hosted fields', () => {
        const fakeInput = document.createElement('input');
        const fakeGroup = document.createElement('div');

        fakeGroup.setAttribute('data-braintree-id', 'foo-field-group');
        fakeInput.id = 'braintree__card-view-input';
        fakeGroup.appendChild(fakeInput);

        jest.spyOn(cardView, 'getElementById').mockReturnValue(fakeGroup);

        cardView.hideFieldError('foo', 'errorMessage');

        expect(fakeHostedFieldsInstance.removeAttribute).not.toBeCalled();
      });
    });
  });

  describe('teardown', () => {
    let cardView;

    beforeEach(() => {
      return makeCardView().then((view) => {
        cardView = view;
      });
    });

    it('tears down hosted fields instance', () => {
      return cardView.teardown().then(() => {
        expect(fakeHostedFieldsInstance.teardown).toBeCalledTimes(1);
      });
    });

    it('passes hosted fields teardown errors to callback', () => {
      expect.assertions(1);

      const error = new Error('hosted fields teardown error');

      fakeHostedFieldsInstance.teardown.mockRejectedValue(error);

      return cardView.teardown().catch(err => {
        expect(err).toBe(error);
      });
    });
  });

  describe('getPaymentMethod', () => {
    it('returns undefined if form is invalid', () => {
      const view = new CardView({ element: cardElement });

      jest.spyOn(view, '_validateForm').mockReturnValue(false);

      expect(view.getPaymentMethod()).toBeUndefined(); // eslint-disable-line no-undefined
    });

    it('returns a card payment method object if form is valid', () => {
      const view = new CardView({ element: cardElement });

      jest.spyOn(view, '_validateForm').mockReturnValue(true);

      expect(view.getPaymentMethod()).toEqual({
        type: 'CreditCard'
      });
    });
  });

  describe('onSelection', () => {
    it('focuses on the number field', () => {
      const view = new CardView({ element: cardElement });

      view.hostedFieldsInstance = {
        focus: jest.fn()
      };

      view.onSelection();

      expect(view.hostedFieldsInstance.focus).toBeCalledTimes(1);
      expect(view.hostedFieldsInstance.focus).toBeCalledWith('number');
    });

    it('noops if the hosted fields instance is not available', () => {
      const view = new CardView({ element: cardElement });

      delete view.hostedFieldsInstance;

      expect(() => {
        view.onSelection();
      }).not.toThrowError();
    });
  });
});
