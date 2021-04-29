const PORT = process.env.PORT || '4567';
const HOST = process.env.HOST || 'bs-local.com';
const DEFAULT_START_OPTIONS = {
  paypal: null,
  paypalCredit: null,
  venmo: null,
  googlePay: null,
  applePay: null
};
const PAYPAL_TIMEOUT = 60000; // 60 seconds
const BASE_URL = `http://${HOST}:${PORT}`;

const DEFAULT_HOSTED_FIELDS_VALUES = {
  cardholderName: 'First Last',
  number: '4111111111111111',
  expirationDate: '12' + ((new Date().getFullYear() % 100) + 3), // last month of current year + 3
  cvv: '123',
  postalCode: '12345'
};

module.exports = function createHelpers() {
  browser.addCommand('start', function (options = {}, overrides = {}) {
    const waitTime = overrides.waitTime || 40000;
    let path = '';

    if (typeof options === 'string') {
      path = options;
    } else {
      options = Object.assign({}, DEFAULT_START_OPTIONS, options);
      options = Object.keys(options).reduce((array, key) => {
        if (options[key] === 'default') {
          // use the default config on the test app
          return array;
        }

        array.push(`${key}=${JSON.stringify(options[key])}`);

        return array;
      }, []);

      if (options.length > 0) {
        path = `?${options.join('&')}`;
      }
    }

    const url = encodeURI(`${BASE_URL}${path}`);

    browser.url(url);

    if (overrides.skipReady) {
      return;
    }

    browser.waitUntil(() => {
      return $('#ready').isExisting();
    }, {
      timeout: waitTime,
      timeoutMsg: `Expected Drop-in to be ready after ${waitTime / 1000} seconds.`
    });

    browser.waitForElementToDissapear('.braintree-loader__container');
  });

  browser.addCommand('getResult', function () {
    browser.waitUntil(() => {
      return $('#results').getText().trim() !== '';
    }, {
      timeout: 3000,
      timeoutMsg: 'Expected result to be avaialble within 3 seconds.'
    });

    const resultHtml = $('#results').getText().trim();

    return JSON.parse(resultHtml);
  });

  browser.addCommand('findByBtId', function (id) {
    return $(`[data-braintree-id="${id}"]`);
  });

  browser.addCommand('hostedFieldSendInput', function (key, value) {
    const field = `iframe[id="braintree-hosted-field-${key}"]`;

    $(field).waitForExist();
    $(field).click();

    if (!value) {
      value = DEFAULT_HOSTED_FIELDS_VALUES[key];
    }

    browser.inFrame(field, () => {
      const selector = `.${key}`;

      $(selector).waitForExist();

      $(selector).addValue(value);
    });
  });

  browser.addCommand('getPopupHandle', function (parentWindow) {
    return browser.getWindowHandles().find(handle => handle !== parentWindow);
  });

  browser.addCommand('openPayPalAndCompleteLogin', function (cb) {
    const parentWindow = browser.getWindowHandle();

    $('.braintree-sheet__button--paypal iframe.zoid-visible').waitForExist();
    $('.braintree-sheet__button--paypal iframe.zoid-visible').click();

    browser.waitUntil(() => {
      return browser.getPopupHandle(parentWindow);
    }, {
      timeout: PAYPAL_TIMEOUT,
      timeoutMsg: 'expected multiple windows to be available.'
    });

    const popupHandle = browser.getPopupHandle(parentWindow);

    browser.switchToWindow(popupHandle);

    browser.waitForElementToDissapear('.spinner');

    // in the case where an email cannot be found,
    // this indicates that the user is already logged in
    // from a previous test sharing the same browser session
    // (this makes our tests faster to not need to reload the
    // browser session on every PayPal test)
    if ($('#injectedUnifiedLogin iframe').isExisting()) {
      browser.inFrame('#injectedUnifiedLogin iframe', () => {
        browser.typeKeys('#email', process.env.PAYPAL_USERNAME);
        browser.typeKeys('#password', process.env.PAYPAL_PASSWORD);

        $('#btnLogin').click();
      });
    } else if ($('#email').isExisting()) {
      browser.typeKeys('#email', process.env.PAYPAL_USERNAME);

      if ($('#splitEmail').isExisting()) {
        $('#btnNext').click();
      }

      browser.waitForElementToDissapear('.spinner');

      $('#password').waitForDisplayed();

      browser.typeKeys('#password', process.env.PAYPAL_PASSWORD);

      $('#btnLogin').click();

      browser.waitForElementToDissapear('.spinner');

      // Sometimes PayPal shows a one touch login screen
      // after the login process completes
      if ($('#activate').isExisting()) {
        // if one touch activation is prompted, opt out
        $('#notNowLink').click();

        browser.waitForElementToDissapear('.spinner');
      }
    }

    browser.waitForConfirmButtonEnabled();

    if (cb) {
      cb();
    }

    browser.clickConfirmButton();

    browser.waitUntil(() => {
      return browser.getWindowHandles().length === 1;
    }, {
      timeout: PAYPAL_TIMEOUT
    });
    browser.switchToWindow(parentWindow);

    browser.waitForElementToDissapear('.paypal-checkout-sandbox-iframe');
  });

  browser.addCommand('getPayPalConfirmButtonSelector', function () {
    browser.waitUntil(() => {
      return $('#fiSubmitButton').isDisplayed() ||
        $('#consentButton').isDisplayed() ||
        $('#payment-submit-btn').isDisplayed() ||
        $('#confirmButtonTop').isDisplayed();
    }, {
      timeout: PAYPAL_TIMEOUT
    });

    if ($('#fiSubmitButton').isDisplayed()) {
      return '#fiSubmitButton';
    } else if ($('#consentButton').isDisplayed()) {
      return '#consentButton';
    } else if ($('#payment-submit-btn').isDisplayed()) {
      return '#payment-submit-btn';
    } else if ($('#confirmButtonTop').isDisplayed()) {
      return '#confirmButtonTop';
    }

    throw new Error('Could not find confirm payment button');
  });

  browser.addCommand('waitForConfirmButtonEnabled', function () {
    browser.waitUntil(() => {
      const selector = browser.getPayPalConfirmButtonSelector();

      return $(selector).isEnabled();
    }, {
      timeout: PAYPAL_TIMEOUT
    });
  });

  browser.addCommand('clickConfirmButton', function () {
    browser.waitForConfirmButtonEnabled();

    // dismisses a banner about accepting cookies
    // so that the submit button can be clicked
    if ($('#acceptAllButton').isDisplayed()) {
      $('#acceptAllButton').click();
    }

    browser.waitForConfirmButtonEnabled();

    const selector = browser.getPayPalConfirmButtonSelector();

    $(selector).scrollIntoView();
    $(selector).click();
  });

  browser.addCommand('waitForElementToDissapear', function (selector) {
    browser.waitUntil(() => {
      const el = $(selector);

      return el.isExisting() === false || el.isDisplayed() === false;
    }, {
      timeout: PAYPAL_TIMEOUT,
      timeoutMsg: `expected ${selector} to dissapear`
    });
  });

  browser.addCommand('clickOption', function (type) {
    $(`.braintree-option__${type} .braintree-option__label`).click();
  });

  browser.addCommand('submitPay', function (waitForResult = true) {
    const button = $('input[type="submit"]');

    button.click();

    if (waitForResult) {
      // to not resolve submitPay until result is finished
      browser.getResult();
    }
  });

  browser.addCommand('inFrame', function (iframe, cb) {
    browser.switchToFrame($(iframe));

    cb();

    // go back to parent page
    browser.switchToFrame(null);
  });

  browser.addCommand('dropin', function () {
    return $('#dropin-container');
  });

  browser.addCommand('name', function () {
    return browser.capabilities.browserName.toUpperCase();
  });

  browser.addCommand('repeatKeys', function (key, numberOfTimes) {
    let count = 0;

    while (count < numberOfTimes) {
      this.keys(key);

      count++;
    }
  }, true);

  browser.addCommand('typeKeys', function (selectorString, keys) {
    browser.execute(function (value, selector) {
      document.querySelector(selector).value = value;
    }, keys, selectorString);
  });

  browser.addCommand('reloadSessionOnRetry', (test) => {
    if (test._currentRetry > 0) {
      browser.reloadSession();
    }
  });
};
