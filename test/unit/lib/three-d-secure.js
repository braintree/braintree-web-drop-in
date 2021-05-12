
const fake = require('../../helpers/fake');
const threeDSecure = require('braintree-web/three-d-secure');
const classList = require('@braintree/class-list');
const ThreeDSecure = require('../../../src/lib/three-d-secure');
const throwIfResolves = require('../../helpers/throw-if-resolves');

describe('ThreeDSecure', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
  });

  beforeEach(() => {
    testContext.threeDSecureInstance = fake.threeDSecureInstance;
    testContext.merchantConfiguration = {
      threeDSecure: {
        amount: '10.00'
      }
    };
    testContext.model = fake.model({
      client: fake.client(),
      merchantConfiguration: testContext.merchantConfiguration
    });
    jest.spyOn(testContext.threeDSecureInstance, 'verifyCard').mockImplementation();
    jest.spyOn(testContext.threeDSecureInstance, 'cancelVerifyCard').mockImplementation();
    jest.spyOn(testContext.threeDSecureInstance, 'on').mockImplementation();

    jest.spyOn(classList, 'add').mockImplementation();
    jest.spyOn(classList, 'remove').mockImplementation();
  });

  describe('initialize', () => {
    beforeEach(() => {
      jest.spyOn(threeDSecure, 'create').mockResolvedValue(testContext.threeDSecureInstance);
    });

    test('sets up three d secure', () => {
      const client = {};
      const tds = new ThreeDSecure(client, testContext.model);

      return tds.initialize().then(() => {
        expect(threeDSecure.create).toBeCalledTimes(1);
        expect(threeDSecure.create).toBeCalledWith({
          client: client,
          version: 2
        });
        expect(tds._instance).toBe(testContext.threeDSecureInstance);
      });
    });

    test('adds event listeners for 3ds specific events', () => {
      const client = {};
      const tds = new ThreeDSecure(client, testContext.model);

      testContext.threeDSecureInstance.on.mockImplementation((eventName, cb) => {
        cb({ someEvent: 'foo' });
      });

      return tds.initialize().then(() => {
        expect(testContext.model._emit).toBeCalledTimes(3);
        expect(testContext.model._emit).toBeCalledWith('3ds:customer-canceled', { someEvent: 'foo' });
        expect(testContext.model._emit).toBeCalledWith('3ds:authentication-modal-render', { someEvent: 'foo' });
        expect(testContext.model._emit).toBeCalledWith('3ds:authentication-modal-close', { someEvent: 'foo' });
      });
    });

    test('adds cardinalSDKConfig object to the threeDSecure.create call', () => {
      const client = {};

      testContext.model.merchantConfiguration.threeDSecure = {
        cardinalSDKConfig: { logging: { level: 'verbose' }}
      };
      const tds = new ThreeDSecure(client, testContext.model);

      return tds.initialize().then(() => {
        expect(threeDSecure.create).toBeCalledTimes(1);
        expect(threeDSecure.create).toBeCalledWith({
          client: client,
          version: 2,
          cardinalSDKConfig: { logging: { level: 'verbose' }}
        });
        expect(tds._instance).toBe(testContext.threeDSecureInstance);
      });
    });
  });

  describe('verify', () => {
    beforeEach(() => {
      testContext.tds = new ThreeDSecure({}, testContext.model);
      testContext.tds._instance = testContext.threeDSecureInstance;

      jest.spyOn(document.body, 'appendChild').mockImplementation();
      testContext.threeDSecureInstance.verifyCard.mockResolvedValue({
        nonce: 'a-nonce',
        liabilityShifted: true,
        liablityShiftPossible: true
      });
    });

    test('calls verifyCard', () => {
      return testContext.tds.verify({
        nonce: 'old-nonce',
        details: {
          bin: '123456'
        }
      }).then(payload => {
        expect(testContext.threeDSecureInstance.verifyCard).toBeCalledTimes(1);
        expect(testContext.threeDSecureInstance.verifyCard).toBeCalledWith({
          nonce: 'old-nonce',
          bin: '123456',
          amount: '10.00',
          additionalInformation: {
            acsWindowSize: '03'
          },
          onLookupComplete: expect.any(Function)
        });

        expect(payload.nonce).toBe('a-nonce');
        expect(payload.liabilityShifted).toBe(true);
        expect(payload.liablityShiftPossible).toBe(true);
      });
    });

    test('rejects if verifyCard rejects', () => {
      testContext.threeDSecureInstance.verifyCard.mockRejectedValue({
        message: 'A message'
      });

      return testContext.tds.verify({
        nonce: 'old-nonce',
        details: {
          bin: '123456'
        }
      }).then(throwIfResolves).catch(err => {
        expect(err.message).toBe('A message');
      });
    });

    test('can pass additional data along', () => {
      const billingAddress = {
        foo: 'bar'
      };

      return testContext.tds.verify({
        nonce: 'old-nonce',
        details: {
          bin: '123456'
        }
      }, {
        email: 'foo@example.com',
        billingAddress: billingAddress,
        additionalInformation: {
          shippingMethod: '01'
        }
      }).then(payload => {
        expect(testContext.threeDSecureInstance.verifyCard).toBeCalledTimes(1);
        expect(testContext.threeDSecureInstance.verifyCard).toBeCalledWith({
          nonce: 'old-nonce',
          bin: '123456',
          amount: '10.00',
          additionalInformation: {
            shippingMethod: '01',
            acsWindowSize: '03'
          },
          onLookupComplete: expect.any(Function),
          billingAddress: billingAddress,
          email: 'foo@example.com'
        });

        expect(payload.nonce).toBe('a-nonce');
        expect(payload.liabilityShifted).toBe(true);
        expect(payload.liablityShiftPossible).toBe(true);
      });
    });

    test('additional config cannot override nonce or bin', () => {
      return testContext.tds.verify({
        nonce: 'old-nonce',
        details: {
          bin: '123456'
        }
      }, {
        nonce: 'bad-nonce',
        bin: 'bad-bin'
      }).then(payload => {
        expect(testContext.threeDSecureInstance.verifyCard).toBeCalledTimes(1);
        expect(testContext.threeDSecureInstance.verifyCard).toBeCalledWith({
          nonce: 'old-nonce',
          bin: '123456',
          amount: '10.00',
          additionalInformation: {
            acsWindowSize: '03'
          },
          onLookupComplete: expect.any(Function)
        });

        expect(payload.nonce).toBe('a-nonce');
        expect(payload.liabilityShifted).toBe(true);
        expect(payload.liablityShiftPossible).toBe(true);
      });
    });

    test('additional config can override amount', () => {
      return testContext.tds.verify({
        nonce: 'old-nonce',
        details: {
          bin: '123456'
        }
      }, {
        amount: '3.00'
      }).then(payload => {
        expect(testContext.threeDSecureInstance.verifyCard).toBeCalledTimes(1);
        expect(testContext.threeDSecureInstance.verifyCard).toBeCalledWith({
          nonce: 'old-nonce',
          bin: '123456',
          amount: '3.00',
          additionalInformation: {
            acsWindowSize: '03'
          },
          onLookupComplete: expect.any(Function)
        });

        expect(payload.nonce).toBe('a-nonce');
        expect(payload.liabilityShifted).toBe(true);
        expect(payload.liablityShiftPossible).toBe(true);
      });
    });

    test('additional config can override acsWindowSize', () => {
      return testContext.tds.verify({
        nonce: 'old-nonce',
        details: {
          bin: '123456'
        }
      }, {
        additionalInformation: {
          acsWindowSize: '01'
        }
      }).then(payload => {
        expect(testContext.threeDSecureInstance.verifyCard).toBeCalledTimes(1);
        expect(testContext.threeDSecureInstance.verifyCard).toBeCalledWith({
          nonce: 'old-nonce',
          bin: '123456',
          amount: '10.00',
          additionalInformation: {
            acsWindowSize: '01'
          },
          onLookupComplete: expect.any(Function)
        });

        expect(payload.nonce).toBe('a-nonce');
        expect(payload.liabilityShifted).toBe(true);
        expect(payload.liablityShiftPossible).toBe(true);
      });
    });
  });

  describe('teardown', () => {
    beforeEach(() => {
      testContext.tds = new ThreeDSecure({}, testContext.model);

      testContext.tds._instance = testContext.threeDSecureInstance;
      jest.spyOn(testContext.threeDSecureInstance, 'teardown').mockResolvedValue();
    });

    test('calls teardown on 3ds instance', () => {
      return testContext.tds.teardown().then(() => {
        expect(testContext.threeDSecureInstance.teardown).toBeCalledTimes(1);
      });
    });
  });

  describe('udpateConfiguration', () => {
    test('updates configuration', () => {
      testContext.merchantConfiguration.threeDSecure.foo = 'bar';

      const tds = new ThreeDSecure({}, testContext.model);

      tds.updateConfiguration('amount', '23.45');

      expect(tds._config).toEqual({ amount: '23.45', foo: 'bar' });
    });
  });
});
