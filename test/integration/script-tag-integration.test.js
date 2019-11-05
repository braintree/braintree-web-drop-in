require('./helper');

describe('Drop-in Script Tag Integration', function () {
  beforeEach(function () {
    browser.reloadSessionOnRetry();
  });

  it('tokenizes a card', function () {
    browser.start('/script-tag-integration.html', {
      skipReady: true
    });
    browser.waitUntil(() => {
      return $('.braintree-option__card').isDisplayed() && !$('.braintree-loader__container').isDisplayed();
    }, 5000, 'expected Drop-in to be ready after 5 s');

    browser.clickOption('card');

    browser.hostedFieldSendInput('number');
    browser.hostedFieldSendInput('expirationDate');
    browser.hostedFieldSendInput('cvv');

    browser.submitPay(false);

    browser.waitUntil(() => {
      return browser.getUrl().indexOf('script-tag-result.html') > -1;
    });

    expect($('body').getHTML()).to.include('payment_method_nonce:');
  });

  it('tokenizes PayPal @paypal', function () {
    if (browser.name() === 'INTERNET EXPLORER') {
      this.skip('IE 11 has trouble with these tests.');

      return;
    }

    browser.start('/script-tag-integration.html', {
      skipReady: true
    });
    browser.waitUntil(() => {
      return $('.braintree-option__paypal').isDisplayed() && !$('.braintree-loader__container').isDisplayed();
    }, 5000, 'expected Drop-in to be ready after 5 s');

    browser.clickOption('paypal');

    browser.openPayPalAndCompleteLogin();

    browser.submitPay(false);

    browser.waitUntil(() => {
      return browser.getUrl().indexOf('script-tag-result.html') > -1;
    });

    expect($('body').getHTML()).to.include('payment_method_nonce:');
  });

  it('does not submit form if card form is invalid', function () {
    browser.start('/script-tag-integration.html', {
      skipReady: true
    });
    browser.waitUntil(() => {
      return $('.braintree-option__card').isDisplayed() && !$('.braintree-loader__container').isDisplayed();
    }, 5000, 'expected Drop-in to be ready after 5 s');

    browser.clickOption('card');

    browser.hostedFieldSendInput('number');

    browser.submitPay(false);

    $('.braintree-sheet--has-error').waitForDisplayed();

    const currentUrl = browser.getUrl();

    expect(currentUrl).to.not.include('script-tag-result.html');
  });

  it('accepts data attributes as create options', function () {
    browser.start('/script-tag-integration.html', {
      skipReady: true
    });
    browser.waitUntil(() => {
      return $('.braintree-option__card').isDisplayed() && !$('.braintree-loader__container').isDisplayed();
    }, 5000, 'expected Drop-in to be ready after 5 s');

    const options = $$('[data-braintree-id="options"] .braintree-option__label');

    expect(options[0].getHTML()).to.include('PayPal');
    expect(options[1].getHTML()).to.include('Card');
    expect(options[2].getHTML()).to.include('PayPal Credit');
  });
});
