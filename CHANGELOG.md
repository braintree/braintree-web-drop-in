CHANGELOG
=========

unreleased
----------
- Use version 3.8.0 of braintree-web
- Doesn't show Card payment option for merchants without cards enabled
- Animate payment entry to tokenization
- Animate choosing other saved payment methods
- Animate choosing a different way to pay
- Publish to npm

1.0.0-beta.4
------------
- Fix bug where PayPal button could not be clicked in some browsers
- Fix bug where SVGs did not render correctly in Edge
- Fix bug in some browsers that prevented form from appearing with certain configurations
- Use version 3.7.0 of braintree-web

1.0.0-beta.3
------------

- Fix "insufficient privileges" error when using tokenization keys with cards
- Update UI
- Add analytics events
- Use version 3.6.3 of braintree-web

1.0.0-beta.1
------------

This version of Drop-in uses v3 of Braintree's JS SDK to build a ready-made UI for easily accepting payments on the web. This release includes:

- Credit card and PayPal support
- Both guest and vaulted checkouts
- PCI SAQ A compliance

Updates from the previous version of Drop-in:

- Refreshed UI to easily accommodate multiple payment methods
- Not in an iframe; feel free to manipulate any elements of Drop-in that don't fit with your checkout
- Open source and open development

Features from the previous version not included in this release:

- PayPal Credit and Coinbase support
- Automatic PayPal configuration; a PayPal configuration object is required for all merchants using PayPal
- Automatic injection of `payment_method_nonce` into your form
