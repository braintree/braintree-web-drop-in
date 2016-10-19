'use strict';

module.exports = {
  addPaymentMethod: 'Add A Payment Method',
  changePaymentMethod: 'Change Payment Method',
  choosePaymentMethod: 'Choose a payment method',
  savedPaymentMethods: 'Saved Payment Methods',
  // Errors
  fieldEmptyForCvv: 'Please fill out a CVV.',
  fieldEmptyForExpirationDate: 'Please fill out an expiration date.',
  fieldEmptyForNumber: 'Please fill out a number.',
  fieldEmptyForPostalCode: 'Please fill out a postal code.',
  fieldInvalidForCvv: 'This security code is not valid.',
  fieldInvalidForExpirationDate: 'This expiration date is not valid.',
  fieldInvalidForNumber: 'This card number is not valid.',
  fieldInvalidForPostalCode: 'This postal code is not valid.',
  genericError: 'Something went wrong on our end.',
  hostedFieldsFailedTokenizationError: 'Please check your information and try again.',
  hostedFieldsFieldsInvalidError: 'Please check your information and try again.',
  paypalAccountTokenizationFailed: 'Something went wrong adding the PayPal account. Please try again.',
  paypalFlowFailedError: 'Something went wrong connecting to PayPal. Please try again.',
  paypalTokenizationRequestActiveError: 'PayPal payment authorization is already in progress.',
  unsupportedCardTypeError: 'This card type is not supported. Please try another card.',
  // Card form
  cardNumberLabel: 'Card Number',
  cvvLabel: 'CVV',
  cvvThreeDigitLabelSubheading: '(3 digits)',
  cvvFourDigitLabelSubheading: '(4 digits)',
  expirationDateLabel: 'Expiration Date',
  expirationDateLabelSubheading: '(MM/YY)',
  postalCodeLabel: 'Postal Code',
  // Payment Method descriptions
  endingIn: 'Ending in ••',
  card: 'Card',
  paypal: 'PayPal',
  'American Express': 'American Express',
  Discover: 'Discover',
  'Diners Club': 'Diners Club',
  MasterCard: 'MasterCard',
  Visa: 'Visa',
  JCB: 'JCB',
  Maestro: 'Maestro',
  UnionPay: 'UnionPay'
};
