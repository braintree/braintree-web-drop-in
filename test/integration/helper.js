const PORT = process.env.PORT || '4567';
const DEFAULT_START_OPTIONS = {
  paypal: null,
  paypalCredit: null,
  venmo: null,
  googlePay: null,
  applePay: null
};
const PAYPAL_TIMEOUT = 60000; // 60 seconds
const BASE_URL = `http://bs-local.com:${PORT}`;

const DEFAULT_HOSTED_FIELDS_VALUES = {
  number: '4111111111111111',
  expirationDate: '12' + ((new Date().getFullYear() % 100) + 3), // last month of current year + 3
  cvv: '123',
  postalCode: '12345'
};

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
    return $('#ready').getHTML(false) === 'ready';
  }, {
    timeout: waitTime,
    timeoutMsg: `Expected Drop-in to be ready after ${waitTime / 1000} seconds.`
  });
});

browser.addCommand('getResult', function () {
  browser.waitUntil(() => {
    return $('#results').getHTML(false).trim() !== '';
  }, {
    timeout: 3000,
    timeoutMsg: 'Expected result to be avaialble within 3 seconds.'
  });

  const resultHtml = $('#results').getHTML(false).trim();

  return JSON.parse(resultHtml);
});

browser.addCommand('findByBtId', function (id) {
  return $(`[data-braintree-id="${id}"]`);
});

browser.addCommand('hostedFieldSendInput', function (key, value) {
  const field = $(`iframe[id="braintree-hosted-field-${key}"]`);

  field.click();

  if (!value) {
    value = DEFAULT_HOSTED_FIELDS_VALUES[key];
  }

  browser.inFrame(field, () => {
    $(`.${key}`).typeKeys(value);
  });
});

browser.addCommand('openPayPalAndCompleteLogin', function (cb) {
  const parentWindow = browser.getWindowHandle();

  $('.braintree-sheet__button--paypal iframe.zoid-visible').click();

  browser.waitUntil(() => {
    return browser.getWindowHandles().length > 1;
  }, {
    timeout: PAYPAL_TIMEOUT,
    timeoutMsg: 'expected multiple windows to be available.'
  });

  const handles = browser.getWindowHandles();
  const popupHandle = handles.find(h => h !== parentWindow);

  browser.switchToWindow(popupHandle);

  if ($('#injectedUnifiedLogin iframe').isExisting()) {
    const loginIframe = $('#injectedUnifiedLogin iframe');

    browser.inFrame(loginIframe, () => {
      $('#email').typeKeys(process.env.PAYPAL_USERNAME);
      $('#password').typeKeys(process.env.PAYPAL_PASSWORD);

      $('#btnLogin').click();
    });
  } else {
    $('#email').typeKeys(process.env.PAYPAL_USERNAME);

    if ($('#splitEmail').isExisting()) {
      $('#btnNext').click();
    }

    browser.waitForElementToDissapear('.spinner');

    $('#password').waitForDisplayed();

    $('#password').typeKeys(process.env.PAYPAL_PASSWORD);

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

  browser.switchToWindow(parentWindow);

  browser.waitForElementToDissapear('.paypal-checkout-sandbox-iframe');
});

browser.addCommand('confirmButtonIsEnabled', function () {
  return ($('#payment-submit-btn').isDisplayed() && $('#payment-submit-btn').isEnabled()) ||
    ($('#fiSubmitButton').isDisplayed() && $('#fiSubmitButton').isEnabled()) ||
    ($('#consentButton').isDisplayed() && $('#consentButton').isEnabled()) ||
    ($('#confirmButtonTop').isDisplayed() && $('#confirmButtonTop').isEnabled());
});

browser.addCommand('waitForConfirmButtonEnabled', function () {
  browser.waitUntil(() => {
    return browser.confirmButtonIsEnabled();
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

  if ($('#fiSubmitButton').isDisplayed()) {
    $('#fiSubmitButton').click();
  } else if ($('#consentButton').isDisplayed()) {
    $('#consentButton').click();
  } else if ($('#payment-submit-btn').isDisplayed()) {
    $('#payment-submit-btn').click();
  } else if ($('#confirmButtonTop').isDisplayed()) {
    $('#confirmButtonTop').click();
  }
});

browser.addCommand('waitForElementToDissapear', function (selector) {
  browser.waitUntil(() => {
    const el = $(selector);

    return el.isExisting() === false || el.isDisplayed() === false;
  }, {
    timeout: PAYPAL_TIMEOUT,
    timeoutMsg: 'expected PayPal spinner to dissapear'
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
  if (browser.name() === 'MICROSOFTEDGE') {
    iframe = iframe.getProperty('name');
  }

  browser.switchToFrame(iframe);

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

browser.addCommand('typeKeys', function (keys) {
  this.addValue(keys);
}, true);

browser.addCommand('reloadSessionOnRetry', (test) => {
  if (test._currentRetry > 0) {
    browser.reloadSession();
  }
});
