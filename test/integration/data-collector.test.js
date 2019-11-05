require('./helper');

describe('Drop-in with Data Collector', function () {
  beforeEach(function () {
    browser.reloadSessionOnRetry();
  });

  it('includes device data in request payment method payload', function () {
    browser.start({
      dataCollector: {
        paypal: true
      }
    });

    browser.hostedFieldSendInput('number');
    browser.hostedFieldSendInput('expirationDate');
    browser.hostedFieldSendInput('cvv');

    browser.submitPay();

    const result = browser.getResult();

    expect(result.deviceData).to.include('correlation_id');
  });
});
