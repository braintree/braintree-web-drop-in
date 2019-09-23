const PORT = process.env.PORT || '4567';
const DEFAULT_START_OPTIONS = {
  paypal: null,
  paypalCredit: null,
  venmo: null,
  googlePay: null,
  applePay: null
};

global.expect = require('chai').expect;

browser.addCommand('start', function (options = {}, waitTime = 40000) {
  let path = '';

  options = Object.assign({}, options, DEFAULT_START_OPTIONS);
  options = Object.keys(options).reduce((array, key) => {
    array.push(`${key}=${JSON.stringify(options[key])}`);

    return array;
  }, []);

  if (options.length > 0) {
    path = `?${options.join('&')}`;
  }

  const url = encodeURI(`http://bs-local.com:${PORT}${path}`);

  browser.url(url);

  browser.waitUntil(() => {
    return $('#ready').getHTML(false) === 'ready';
  }, waitTime, `Expected Drop-in to be ready after ${waitTime / 1000} seconds.`);
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

browser.addCommand('clickOption', function (type) {
  $(`.braintree-option__${type} .braintree-option__label`).click();
});

browser.addCommand('submitPay', function () {
  const button = $('input[type="submit"]');

  button.click();
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

browser.addCommand('getSelectionRange', function () {
  return browser.execute(function (nodeId) {
    const el = document.getElementById(nodeId);

    return {
      start: el.selectionStart,
      end: el.selectionEnd
    };
  }, this.getProperty('id'));
}, true);

browser.addCommand('typeKeys', function (keys) {
  let i;

  if (browser.name() !== 'IE 11') {
    this.addValue(keys);

    return;
  }

  for (i = 0; i < keys.length; i++) {
    this.keys(keys[i]);
  }
}, true);
