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

global.expect = require('chai').expect;

browser.addCommand('start', function (options = {}, waitTime = 40000) {
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

  browser.waitUntil(() => {
    return $('#ready').getHTML(false) === 'ready';
  }, waitTime, `Expected Drop-in to be ready after ${waitTime / 1000} seconds.`);
});

browser.addCommand('reloadSessionOnRetry', () => {
  if (this.sessionId === browser.sessionId) {
    browser.reloadSession();
  } else {
    this.sessionId = browser.sessionId;
  }
});

browser.addCommand('getResult', function () {
  browser.waitUntil(() => {
    return $('#results').getHTML(false).trim() !== '';
  }, 3000, 'Expected result to be avaialble within 3 seconds.');

  const resultHtml = $('#results').getHTML(false).trim();

  return JSON.parse(resultHtml);
});

browser.addCommand('findByBtId', function (id) {
  return $(`[data-braintree-id="${id}"]`);
});

browser.addCommand('hostedFieldSendInput', function (key, value) {
  const field = $(`iframe[id="braintree-hosted-field-${key}"]`);

  field.click();

  browser.inFrame(field, () => {
    $(`.${key}`).typeKeys(value);
  });
});

browser.addCommand('openPayPalAndCompleteLogin', function (cb) {
  $('.braintree-sheet__button--paypal iframe.zoid-visible').click();

  browser.waitUntil(() => {
    return browser.getWindowHandles().length > 1;
  }, PAYPAL_TIMEOUT, 'expected multiple windows to be available.');

  const handles = browser.getWindowHandles();
  const currentHandle = browser.getWindowHandle();
  const popupHandle = handles.find(h => h !== currentHandle);

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

    $('.spinner').waitForDisplayed(PAYPAL_TIMEOUT, true);
    $('#password').waitForDisplayed();

    $('#password').typeKeys(process.env.PAYPAL_PASSWORD);

    $('#btnLogin').click();

    $('.spinner').waitForDisplayed(PAYPAL_TIMEOUT, true);

    // safari sometimes fails the initial login, so the
    // login form is shown again with email already filled in
    // using the iframe system
    if ($('#injectedUnifiedLogin iframe').isExisting()) {
      const loginIframe = $('#injectedUnifiedLogin iframe');

      browser.inFrame(loginIframe, () => {
        $('#password').typeKeys(process.env.PAYPAL_PASSWORD);

        $('#btnLogin').click();
      });
    }
  }

  $('#confirmButtonTop').waitForDisplayed();
  $('.spinner').waitForDisplayed(PAYPAL_TIMEOUT, true);

  if (cb) {
    cb();
  }

  $('#confirmButtonTop').click();

  if (browser.name() === 'INTERNET EXPLORER') {
    $('.spinner').waitForDisplayed(PAYPAL_TIMEOUT, true);
    $('#confirmButtonTop').click();
  }

  browser.switchToWindow(currentHandle);

  $('.paypal-checkout-sandbox-iframe').waitForDisplayed(PAYPAL_TIMEOUT, true);
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
