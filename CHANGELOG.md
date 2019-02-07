CHANGELOG
=========

1.16.0
------
- Allow `ApplePaySession` version to be set
- Fix issue where vaulted payment methods have a UI error when deleting them (#474)
- Stop halting Drop-in setup when Data Collector fails to load

1.15.0
------
- Add `rawPaymentData` to Apple Pay payment method payload
- Fix error with `toLowerCase` on error reporting
- Update braintree-web to v3.42.0
- Update @braintree/asset-loader to v0.2.1
- Fix issue where 3ds modal may not get cleaned up during teardown (#463)
- Allow easy Google Pay version 2 configuration
- Provide error message when payment method is requested on PayPal button view (#433)

1.14.1
------
- Explicitly opt out of additional PayPal credit button in normal PayPal view

1.14.0
------
- Change Google Pay button to black style to better match [Google's brand guidelines](https://developers.google.com/pay/api/web/guides/brand-guidelines)
- Allow passing in [button options](https://developers.google.com/pay/api/web/reference/object#ButtonOptions) to Google Pay configuration
- Fix issue where Drop-in would emit `noPaymentMethodRequestable` and `paymentMethodRequestable` right after tokenization
- Fix issue where Mastercard was styled as MasterCard in vault manager view
- Update braintree-web to v3.39.0
- Fix issue where PayPal email addresses may overflow the container
- Use @braintree/asset-loader@v0.1.0 for asset loading
- Use @braintree/class-list@v0.1.0 for manipulating classes

1.13.0
------
- Provide browserified version of Drop-in on npm at `dist/browser/dropin.js`
- Fix issue where Drop-in would throw an error when updating not presented payment method
- Fix issue where the keyboard could get stuck when entering card details on iOS (#419)
- Update braintree-web to v3.37.0

1.12.0
------
- Update braintree-web to v3.36.0
- Fix issue where sass compliation would prevent styling of ApplePay button
- Fix slight HTML error for the expiration date field
- Fix issue where Drop-in could not load in IE9 and 10
- Add feature where payment methods can be deleted from Drop-in
- Fix issue where consumed payment methods could not be cleared in 3ds flow (closes #408)

1.11.0
------
- Use generic error with console log when a payment method fails to set up
- Fix issue where Mastercard was displayed as MasterCard
- Allow card form to not be cleared after succesful tokenization with `card.clearFieldsAfterTokenization`
- Fix atob polyfill
- Update braintree-web to v3.34.0
- Fix issue where Drop-in would fail to load if something blocked an external script from loading (#379)
- Report error for duplicate payment method error
- Fix issue where Drop-in would throw an error if another Google script was included on the merchant page
- Fix issue where Drop-in would throw an error if a non-checkout.js PayPal script was included in the merchant page
- Update Google Pay script to enable it in Desktop Chrome, Firefox, Safari, and others (See [Google's documentation](https://developers.google.com/pay/api/web/guides/test-and-deploy/overview#browser-test))

1.10.0
------
- Enable Venmo support
- Enable Google Pay support
- Fix issue where non utf-8 encoded sites would show strange characters for card placeholders
- Fix issue where card fields could not be focused by clicking on the corresponding label
- Update braintree-web to v3.31.0

1.9.4
-----
- Update braintree-web to v3.30.0
- Update promise-polyfill to v7.0.2
- Update jsdoc-template to v3.2.0
- Fix issue where 3DS modal would not appear (#352)

1.9.3
-----
- Update checkout.js to evergreen link
- Update braintree-web to v3.28.0
- Update promise-polyfill to v7.0.0
- Fix documentation for `preselectVaultedPaymentMethod`
- Fix issue where 3DS modal would not close when no bank frame is added (#335)
- Fix issue where liability shift information was only passed back if `liabilityShiftPossible` was true
- Fix issue where vaulted Apple Pay methods were being displayed when they could not be used for transactions
- Fix issue where script tag integration could not be instantiated when script tag was not a direct child of the form (#344)

1.9.2
-----
- Improve logic for enabling Apple Pay to only trigger with HTTPS (#328 thanks @maxsz)
- Fix error for saved ApplePay payment method being displayed with incorrect details (#330 thanks @julka)
- Displays "Apple Pay" instead of "undefined" for saved Apple Pay payment methods (#332 thanks @julka)

1.9.1
-----
- Normalize label styles
 - Fixes styling applied by frameworks like Bootstrap
- Fix logic for Apple Pay being enabled (#324)
- Update checkout.js to v4.0.166

1.9.0
-----
- Add 3D Secure support (#208)
- Add Apple Pay support (#256)
- Limit cardholder name length to 255 characters (#283)
- Show error for cardholder name when attempting to tokenize (#318)
- Fix cardholder-name in script tag integration
- Update braintree-web to v3.26.0
  - Fix issue where credit card cannot be pasted in on iOS devices (#299)

1.8.1
-----
- Update braintree-web to v3.25.0
- Update paypal-checkout to v4.0.148
- Fix errors that were not translated when using a locale
- Update browser-detection to v1.7.0
- Fix issue where the edges of card form inputs were not clickable
  - This adds a label element to the Drop-in card form. If you have global styles for the label tag, it may affect the look of the Drop-in card form.
- Fix issue where style overrides could not be applied if previous style rule did not exist
- Improve accessibility for screenreaders when encountering field errors in card view

1.8.0
-----
- Simplify check for checkout.js on the merchant's page
- Allow useraction to be set for PayPal button.
- Allow vaulted payment methods to not be pre-selected on initialization
- Update PayPal Checkout to v4.0.130

1.7.0
-----
- Add data collector
- Update PayPal Checkout to v4.0.110
- Update braintree-web to v3.22.2

1.6.1
-----
- Fix svgs not showing up when d3.js is used on page
- Use version 3.22.0 of braintree-web

1.6.0
-----
- Hide Diners Club logo when Diners Club may not be supported
- Add `cardholderName` option to card configuration
- Use version 3.21.1 of braintree-web

1.5.0
-----
- Use version 3.20.1 of braintree-web
- Update browser-detection to v1.6.0
- Add `aria-label` attribute to payment options
- Update checkout.js to v4.0.95
- Add `clearSelectedPaymentMethod` to remove selected payment method
- Add `paymentMethodIsSelected` property on `paymentMethodRequestable` events

1.4.0
-----
- Add `paymentOptionSelected` event
- Add support for PayPal and PayPal credit in the script tag integration
- Add support for locale and payment option priority in the script tag integration
- `dropinInstance.requestPaymentMethod` will return a promise if no callback is provided
- `dropinInstance.teardown` will return a promise if no callback is provided
- `dropin.create` will return a promise if no callback is provided
- Fix error thrown in console when removing fields with card overrides
- Fix bug where Drop-in would not finish loading if inside a hidden div
- Improve transition from payment sheet views to payment methods view
- Use version 3.19.1 of braintree-web
- Improve UI in older versions of iOS Safari

1.3.1
-----
- Use version 3.19.0 of braintree-web
- Autoprefix CSS, fixing issues in older browsers
- Add aria-invalid attribute for cards

1.3.0
------
- Add script tag integration for cards only
- Add support for custom translations
- Clean up payment option error messages
- Update braintree-web to version 3.18.0
- Update paypal checkout.js to version 4.0.82
- Allow card overrides with Hosted Fields
- Use npm scoped version of browser-detection

1.2.0
------
- Adjust styling of saved payment methods
- Fix typo in Russian translation
- Update browser detection library to 1.4.0
- Fix width errors where Drop-in was not aligned with other elements on merchant page
- Add ability to style PayPal button
- Fail early if PayPal creation errors
- Upgrade braintree-web to v3.17.0
- Upgrade checkout.js to 4.0.78

1.1.0
------
- Add built css to npm build
- Fix typo in Dutch translations
- Add ability to pass in a DOM Node to Drop-in as an alternative to a CSS selector
- Update braintree-web to [version 3.16.0](https://github.com/braintree/braintree-web/blob/master/CHANGELOG.md#3160)
- Update browser-detection to version 1.3.0
- Update PayPal Checkout.js to version 4.0.75
- Add updateConfiguration method to Drop-in instance for updating PayPal or PayPal Credit configuration
- Only load paypal checkout script once

1.0.2
-----
- Add timeout for async dependencies in PayPal
- Record Drop-in version in metadata

1.0.1
-----
- Fix card icon overflow in small browser windows
- Show empty field errors only when another field is focused
- Use version 3.15.0 of braintree-web

1.0.0
-----
- Fix localization for placeholders
- Fix error thrown when CVV was not enabled

1.0.0-beta.7
----------
- Use PayPal Checkout for PayPal View
- Use version 3.14.0 of braintree-web
- Use version 4.0.65 of paypal-checkout
- Improve loading transition
- Add full support for IE 9 and 10
- Add support for PayPal Credit
- Fix bug where adding a vaulted payment method would duplicate previously added payment methods
- Add support for tab navigation
- Auto focus the number input when selecting the card view
- Add events for `paymentMethodRequestable` and `noPaymentMethodRequestable`
- Fix bug where PayPal button was not being translated
- Fix bug where unusable payment methods would be displayed if saved in the vault
- Provide more specific tokenization errors for duplicate payment methods and cvv verification failures
- Fix styling bug where hosted fields iframe margin style could be overwritten

1.0.0-beta.6
------------
- Disable payment methods if they error when creating
- Add `paymentOptionPriority` option for specifying the ordering of payment options such as `card` and `paypal`
- Add translations
- Use version 3.11.1 of braintree-web

1.0.0-beta.5
------------
- Use version 3.10.0 of braintree-web
- Doesn't show Card payment option for merchants without cards enabled
- Animate payment entry to tokenization
- Animate choosing other saved payment methods
- Animate choosing a different way to pay
- Publish to npm
- Fix #85 where the Drop-in would overflow in a small container
- Show loading indicator until all components have finished loading

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
