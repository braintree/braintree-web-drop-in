# Development Notes

This document outlines development practices that we follow internally while developing Drop-in.

## Building

```
nvm use
npm install
npm run build
```

This creates the following `dist` structure:

```
dist
├── gh-pages/
├── npm/
└── web/
    └── dropin/
        ├── 1.0.0/
        │   ├── css/
        │   └── js/
        └── dev -> 1.0.0/
```

`dist/gh-pages` contains the demo app and JSDocs that are published to gh-pages.

`dist/npm` contains the pre-processed source files that are published to npm.

`dist/web/` mirrors the structure of Drop-in assets available at https://assets.braintreegateway.com.

`dist/web/dropin/dev` assets are available only in development and are never deployed.

**Note:** If you are developing on a Windows machine, you will need to run your command prompt as an administrator so the symlinking step succeeds.

## Demo app and JSDocs

A demo app for the latest release of `braintree-web-drop-in` and JSDocs are published on [gh-pages](https://braintree.github.io/braintree-web-drop-in/).

To run the app and docs locally, follow the build instructions and then run `npm run development`.

This will serve `dist/gh-pages` at port 4567 and watch for changes in `src`.

## CSS

In sandbox and production environments, Drop-in injects a stylesheet onto the page retrieved from https://assets.braintreegateway.com/web/dropin/<VERSION>/css/dropin.css.

When developing, you can include a locally built CSS file on the page that will override the hosted stylesheet by giving it the id `braintree-dropin-stylesheet`:

```html
<link rel="stylesheet" type="text/css" href="/path/to/local/dropin.css" id="braintree-dropin-stylesheet">
```

## Adding new Payment Methods

Adding a new payment method requires changing a number of files. For each of these sections, you will see an example of adding a fake payment method, `FooPay` to the file. *Note:* This guide may fall out of date as things change in the repo. If you find a mistake, please open a PR to fix it.

### Constants

There are a few constants that should be updated in [src/constants.js](https://github.com/braintree/braintree-web-drop-in/blob/main/src/constants.js).

  * `paymentOptionIDs` - In this case, we'll add `fooPay: 'fooPay'` to the list
  * `paymentMethodTypes` - For this, we need to map `fooPay` to whatever the Braintree Gateway lists the tokenization type as. So, if the Gateway lists it as `FooPayAccount`, we should add `fooPay: 'FooPayAccount'`
  * `analyticsKinds` - The same is true here, if the Gateway uses `FooPayAccount`, then we add `fooPay: 'FooPayAccount'`

### Translations

Unless you need to translate error messages or other UI elements (see below), simply add your payment method name to [src/translations/en_US.js](https://github.com/braintree/braintree-web-drop-in/blob/main/src/translations/en_US.js). Braintree developers will have to work with PayPal to provide the translation files for them.

```javascript
'FooPay': 'FooPay'
```

### Drop-in Model

The [src/dropin-model.js](https://github.com/braintree/braintree-web-drop-in/blob/main/src/dropin-model.js) must be updated so that Drop-in can check if the payment option is available for the customer to use.

Primarily, the `isPaymentOptionEnabled` function must be adjusted to account for the new payment method. It checks if the merchant is enabled for the particular payment method in the Braintree gateway, if the merchant has configured Drop-in to enable the payemnt method, and any other requirements the payment method may have to be used in Drop-in. For instance, if FooPay can only be used if the `FooPay` global exists on the window, we would probably add code that looks like this to `isPaymentOptionEnabled`.

```javascript
} else if (paymentOption === paymentOptionIDs.fooPay) {
  return gatewayConfiguration.fooPay && Boolean(options.merchantConfiguration.fooPay) && global.FooPay;
}
```

The payment option id will also need to be added to the `DEFAULT_PAYMENT_OPTION_PRIORITY` to determine the default order for displaying the payment method options.

```javascript
var DEFAULT_PAYMENT_OPTION_PRIORITY = [
  // ...
  paymentOptionIDs.applePay,
  paymentOptionIDs.fooPay
];
```

If a customer's vaulted payment methods cannot be used on the client (i.e., ApplePay, GooglePay, Venmo), you must also add the payment method to the `VAULTED_PAYMENT_METHOD_TYPES_THAT_SHOULD_BE_HIDDEN` array. For instance:

```javascript
var VAULTED_PAYMENT_METHOD_TYPES_THAT_SHOULD_BE_HIDDEN = [
  paymentMethodTypes.ApplePayCard,
  paymentMethodTypes.FooPayAccount
];
```

### Main View

The [src/html/main.html](https://github.com/braintree/braintree-web-drop-in/blob/main/src/html/main.html) must be updated with a div for the payment method's view. This is the UI where the payment method is initiated by the customer (filling the card form, pushing the PayPal button, etc). In our example, FooPay requires a button for the customer to press to initate the flow.

```html
<div data-braintree-id="foo-pay" class="braintree-foo-pay braintree-sheet">
  <div data-braintree-id="foo-pay-sheet-header" class="braintree-sheet__header">
    <div class="braintree-sheet__header-label">
      <div class="braintree-sheet__logo--header">
        <svg height="24" width="40">
        <use xlink:href="#logoFooPay"></use>
        </svg>
      </div>
      <div class="braintree-sheet__label">{{FooPay}}</div>
    </div>
  </div>
  <div class="braintree-sheet__content braintree-sheet__content--button">
    <div data-braintree-id="foo-pay-button" class="braintree-sheet__button--foo-pay foo-pay-button"></div>
  </div>
</div>
```

We will also need to update [src/less/main.less](https://github.com/braintree/braintree-web-drop-in/blob/main/src/less/main.less) to make the payment sheet view visible when selected. Add `.braintree-show-{payment-method-name} .braintree-{payment-method-name}` to the list of classes in the "Dropin Visibility States" section.

```less
// ...
.braintree-show-applePay .braintree-applePay,
.braintree-show-fooPay .braintree-fooPay {
  display: block;
  height: auto;
  overflow: visible;
  visibility: visible;
}
```

You will also need to add your payment method to the `.braintree-show-{payment-method-name} [data-braintree-id='other-ways-to-pay']` section.

```less
// ...
.braintree-show-paypal [data-braintree-id='other-ways-to-pay'],
.braintree-show-applePay [data-braintree-id='other-ways-to-pay'],
.braintree-show-fooPay [data-braintree-id='other-ways-to-pay'] {
  display: block;
}
```

### Payment Option|Method Views

You will need to add your payment method to the switch statement in [src/views/payment-method-view.js](https://github.com/braintree/braintree-web-drop-in/blob/main/src/views/payment-method-view.js).

If your payment method is vaultable on the client, set the `@TITLE` to be an indentifier for the account. Such as a username, email, last 4 numbers of the account, etc. The `@SUBTITLE` will be the payment method name.

```javascript
case paymentMethodTypes.fooPay:
  html = html.replace(/@ICON/g, 'logoFooPay')
    .replace(/@CLASSNAME/g, '')
    .replace(/@TITLE/g, this.paymentMethod.details.accountName)
    .replace(/@SUBTITLE/g, this.strings.FooPay);
  break;
```

If the payment method is not vaultable, there is no need to identify it, since you can only ever have one of that payment method type available. In that case, leave the `@SUBTITLE` as an empty string and set the `@TITLE` to the payment method name.

```javascript
case paymentMethodTypes.fooPay:
  html = html.replace(/@ICON/g, 'logoFooPay')
    .replace(/@CLASSNAME/g, '')
    .replace(/@TITLE/g, this.strings.FooPay)
    .replace(/@SUBTITLE/g, '');
  break;
```

Similiarly, the switch statement in [src/views/payment-options-view.js](https://github.com/braintree/braintree-web-drop-in/blob/main/src/views/payment-options-view.js) will also need to be updated.

```javascript
case paymentOptionIDs.fooPay:
  paymentSource = this.strings.FooPay;
  html = html.replace(/@ICON/g, 'logoFooPay');
  break;
```

### Sheet View

Add a new file at src/views/payment-sheet-views/{payment-method-name}-view.js, this will be the JS portion of the view. This view will take care of setting up the Braintree component.

If you need to collect form details, such as with a credit card or us bank account, include a `requestPaymentMethod` function.

```javascript
var BaseView = require('../base-view');
var btFooPay = require('braintree-web/foo-pay');
var DropinError = require('../../lib/dropin-error');
var paymentOptionIDs = require('../../constants').paymentOptionIDs;

function FooPayView() {
  BaseView.apply(this, arguments);
}

FooPayView.prototype = Object.create(BaseView.prototype);
FooPayView.prototype.constructor = FooPayView;
FooPayView.ID = FooPayView.prototype.ID = paymentOptionIDs.fooPay;

FooPayView.prototype.initialize = function () {
  var self = this;

  self.model.asyncDependencyStarting();

  return btFooPay.create({
    client: this.client
  }).then(function (fooPayInstance) {
    self.fooPayInstance = fooPayInstance;
    self.model.asyncDependencyReady();
  }).catch(function (err) {
    self.model.asyncDependencyFailed({
      view: self.ID,
      error: new DropinError(err)
    });
  });
};

FooPayView.prototype.requestPaymentMethod = function () {
  return this.fooPayInstance.tokenize();
};
```

If your payment method is self contained, like PayPal or ApplePay, simply set up whatever your payment method needs to function, such as a button click to initialize the flow and call `this.model.addPaymentMethod` with the payload and `this.model.reportError` with the error.

```javascript
btFooPay.create({
  client: this.client
}).then(function (fooPayInstance) {
  var btn = self.getElementById('foo-pay-button');

  btn.addEventListener('click', function (event) {
    event.preventDefault();

    fooPayInstance.tokenize().then(function (payload) {
      self.model.addPaymentMethod(payload);
    }).catch(function (tokenizeErr) {
      self.model.reportError(tokenizeErr);
    });
  });

  self.model.asyncDependencyReady();
}).catch(function (err) {
  self.model.asyncDependencyFailed({
    view: self.ID,
    error: new DropinError(err)
  });
});
```

Add the payment method view to the index file at [src/views/payment-sheet-views/index.js](https://github.com/braintree/braintree-web-drop-in/blob/main/src/views/payment-sheet-views/index.js).

```javascript
result[paymentOptionIDs.fooPay] = require('./foo-pay-view');
```

Finally, we just need to add a map for the Gateway Payment Method Type to the translation string for that type in [src/views/payment-methods-view.js](https://github.com/braintree/braintree-web-drop-in/blob/main/src/views/payment-methods-view.js).

```javascript
var PAYMENT_METHOD_TYPE_TO_TRANSLATION_STRING = {
  // ...
  ApplePayCard: 'Apple Pay',
  FooPayAccount: 'FooPay'
};
```


### Update Configuration

If your payment method has a configuration that can be updated after Drop-in has been created, but before tokenization occurs, such as updating the amount setting when authorizing a PayPal account, add an `updateConfiguration` method to the sheet view. If your payment method does not require this, skip this section.

```javascript
FooPayView.prototype.updateConfiguration = function (key, value) {
  this.fooPayConfiguration[key] = value;
};
```

Next, open [src/dropin.js](https://github.com/braintree/braintree-web-drop-in/blob/main/src/dropin.js) and update the `UPDATABLE_CONFIGURATION_OPTIONS` constant to include your payment method:

```javascript
var UPDATABLE_CONFIGURATION_OPTIONS = [
  paymentOptionIDs.paypal,
  paymentOptionIDs.paypalCredit,
  // others
  paymentOptionsIDs.fooPay
];
```

Finally, if updating the configuration would invalidate the authorized payment method, add it to the `UPDATABLE_CONFIGURATION_OPTIONS_THAT_REQUIRE_UNVAULTED_PAYMENT_METHODS_TO_BE_REMOVED` constant.

```javascript
var UPDATABLE_CONFIGURATION_OPTIONS_THAT_REQUIRE_UNVAULTED_PAYMENT_METHODS_TO_BE_REMOVED = [
  paymentOptionIDs.paypal,
  paymentOptionIDs.paypalCredit,
  // others
  paymentOptionsIDs.fooPay
];
```


### Error Handling

If you don't need to handle specific errors, you can let Drop-in populate a generic error. If you do need to handle a specific error, you can pass the key of a specific string to use in the translation file. 

Alternatively, you can pass the `BraintreeError` from braintree-web into `this.model.reportError` and create a translation string for the error code, where the property name is the camel cased version of the code with `Error` appended to it. (See `hostedFieldsTokenization` errors in [src/translations/en_US.js](https://github.com/braintree/braintree-web-drop-in/blob/main/src/translations/en_US.js) for examples).

```javascript
fooPayTokenizationFailedError: 'Something went wrong when connecting to FooPay.'
```

### Documentation

Add documentation info to [src/dropin.js](https://github.com/braintree/braintree-web-drop-in/blob/main/src/dropin.js), [src/index.js](https://github.com/braintree/braintree-web-drop-in/blob/main/src/index.js), and [jsdoc/home.md](https://github.com/braintree/braintree-web-drop-in/blob/main/jsdoc/home.md)

## Unit tests

Run unit tests and lint:

```
npm test
```

## Integration tests

We use [Browserstack](https://www.browserstack.com) to automate end to end testing on Google Chrome, Safari, Firefox and Internet Explorer 11.

First, [sign up for a free open source Browserstack account](https://www.browserstack.com/open-source?ref=pricing) and a and [PayPal Sandbox](https://developer.paypal.com/developer/accounts/).

Copy the `.env.example` file to `.env`

```sh
cp .env.example .env
```

Fill in the `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY` environmental variables with your Browserstack credentials:

```sh
BROWSERSTACK_USERNAME=username
BROWSERSTACK_ACCESS_KEY=access_key
```

Fill in the `PAYPAL_USERNAME` and `PAYPAL_PASSWORD` environmental variables with your PayPal sandbox customer credentials:

```sh
PAYPAL_USERNAME=<PayPal sandbox username here>
PAYPAL_PASSWORD=<PayPal sandbox password>
```

To start the tests, start the app:

```sh
npm run development
```

And run the integration test command:

```bash
npm run test:integration
```

This will run the tests from `test/integration` in the browsers specified in [`wdio.conf.js`](./wdio.conf.js).

To run only the PayPal tests, run:

```bash
npm run test:integration:paypal-only
```

To run all tests but the PayPal tests, run:

```bash
npm run test:integration:paypal-skipped
```

By default, each test will retry once if it fails. PayPal tests will retry up to 4 times. You can ignore the retry behavior by passing `DISABLE_RETRIES=true` before running the test command.

```bash
DISABLE_RETRIES=true npm run test:integration
```

You can mark a test with an `.only` tag:

```js
it.only('asserts something', function () {
```

And then run the test command to run only that test:

```bash
npx wdio wdio.conf.js --spec test/integration/path-to-test.test.js
```

To run tests in only one browser, prefix the test command with an `ONLY_BROWSERS` env variable:

```sh
# run only in chrome browser
ONLY_BROWSERS=chrome npm run test:integration

# run only in internet explorer 11 browser
ONLY_BROWSERS=ie npm run test:integration

# run only in safari browser
ONLY_BROWSERS=safari npm run test:integration

# run only in firefox browser
ONLY_BROWSERS=firefox npm run test:integration
```

To run tests in certain browsers, prefix the test command with an `ONLY_BROWSERS` env variable, with each browser comma separated:

```sh
# run only in internet explorer 11 and chrome browsers
ONLY_BROWSERS=ie,chrome npm run test:integration
```

## Translations

If you need to update a key for a translation that you have already updated in `en_US`, run the following with the existing key and then the new key as arguments:

```
node ./scripts/update-translation-key.js OLD_KEY_NAME NEW_KEY_NAME
```

If you have added strings to `en_US` that you need to get translated, run the following to get the formatted output:

```
node ./scripts/get-translation-strings.js
```
