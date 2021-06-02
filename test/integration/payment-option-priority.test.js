describe('Drop-in with paymentOptionPriority', function () {
  beforeEach(function () {
    browser.reloadSessionOnRetry(this.currentTest);
  });

  it('displays payment methods in order of the payment option priority array @paypal', function () {
    browser.start({
      paypal: 'default',
      paypalCredit: 'default',
      venmo: 'default',
      paymentOptionPriority: ['paypal', 'card', 'venmo', 'paypalCredit']
    });

    const options = $$('.braintree-options-list .braintree-option');

    expect(options.length).toBe(4);
    expect(options[0].getAttribute('class')).toContain('braintree-option__paypal');
    expect(options[1].getAttribute('class')).toContain('braintree-option__card');
    expect(options[2].getAttribute('class')).toContain('braintree-option__venmo');
    expect(options[3].getAttribute('class')).toContain('braintree-option__paypalCredit');
  });

  it('displays only payment methods in the payment option priority array, even when configured @paypal', function () {
    browser.start({
      paypal: 'default',
      paypalCredit: 'default',
      venmo: 'default',
      paymentOptionPriority: ['card', 'venmo']
    });

    expect($$('.braintree-option').length).toBe(2);
    expect($('.braintree-option__paypal').isDisplayed()).toBeFalsy();
    expect($('.braintree-option__paypalCredit').isDisplayed()).toBeFalsy();
    expect($('.braintree-option__venmo').isDisplayed()).toBeTruthy();
    expect($('.braintree-option__card').isDisplayed()).toBeTruthy();
  });

  it('displays the payment method sheet when only a single payment method is presented in paymentOptionPriority @paypal', function () {
    browser.start({
      paypal: 'default',
      paypalCredit: 'default',
      venmo: 'default',
      paymentOptionPriority: ['paypal']
    });

    expect($('.braintree-option__paypal').isDisplayed()).toBeFalsy();
    expect($('.braintree-option__paypalCredit').isDisplayed()).toBeFalsy();
    expect($('.braintree-option__venmo').isDisplayed()).toBeFalsy();
    expect($('.braintree-option__card').isDisplayed()).toBeFalsy();
    expect($('[data-braintree-id="paypal"]').isDisplayed()).toBeTruthy();

    $('.braintree-sheet__button--paypal iframe.zoid-visible').waitForExist();

    expect($('.braintree-sheet__button--paypal iframe.zoid-visible').isDisplayed()).toBeTruthy();
  });
});
