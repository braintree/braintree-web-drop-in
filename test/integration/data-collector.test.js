require('./helper');

describe('Drop-in with Data Collector', function () {
  it('includes device data in request payment method payload', function () {
    browser.start({
      dataCollector: {
        paypal: true
      }
    });

    browser.hostedFieldSendInput('number', '4111111111111111');
    browser.hostedFieldSendInput('expirationDate', '1019');
    browser.hostedFieldSendInput('cvv', '123');

    browser.submitPay();

    const result = browser.getResult();

    expect(result.deviceData).to.include('correlation_id');
  });
});
