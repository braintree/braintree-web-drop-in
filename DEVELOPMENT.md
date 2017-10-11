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

## Unit tests

Run unit tests and lint:

```
npm test
```

## Integration tests

Create a `.env` with [SauceLabs](https://saucelabs.com/) and [PayPal Sandbox](https://developer.paypal.com/docs/classic/lifecycle/sb_about-accounts/#creating-sandbox-test-accounts) credentials:

```
export SAUCE_USERNAME=<SAUCE_USERNAME here>
export SAUCE_ACCESS_KEY=<SAUCE_ACCESS_KEY here>
export PAYPAL_USERNAME=<PayPal sandbox username here>
export PAYPAL_PASSWORD=<PayPal sandbox password>
```

To start the tests, run:

```
npm run test:integration
```

This will run the tests from `spec` in the browsers specified in [`spec/sauce_helper.rb`](./spec/sauce_helper.rb).

## Translations

If you need to update a key for a translation that you have already updated in `en_US`, run the following with the existing key and then the new key as arguments:

```
node ./scripts/update-translation-key.js OLD_KEY_NAME NEW_KEY_NAME
```
