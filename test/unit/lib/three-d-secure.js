'use strict';

var fake = require('../../helpers/fake');
var threeDSecure = require('braintree-web/three-d-secure');
var classList = require('@braintree/class-list');
var ThreeDSecure = require('../../../src/lib/three-d-secure');
var throwIfResolves = require('../../helpers/throw-if-resolves');

describe('ThreeDSecure', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
  });

  beforeEach(() => {
    testContext.threeDSecureInstance = fake.threeDSecureInstance;
    jest.spyOn(testContext.threeDSecureInstance, 'verifyCard').mockImplementation();
    jest.spyOn(testContext.threeDSecureInstance, 'cancelVerifyCard').mockImplementation();

    jest.spyOn(classList, 'add').mockImplementation();
    jest.spyOn(classList, 'remove').mockImplementation();
  });

  describe('initialize', () => {
    beforeEach(() => {
      jest.spyOn(threeDSecure, 'create').mockResolvedValue(testContext.threeDSecureInstance);
    });

    test('sets up three d secure', () => {
      var config = {};
      var client = {};
      var tds = new ThreeDSecure(client, config, 'Card Verification');

      return tds.initialize().then(function () {
        expect(threeDSecure.create).toBeCalledTimes(1);
        expect(threeDSecure.create).toBeCalledWith({
          client: client,
          version: 2
        });
        expect(tds._instance).toBe(testContext.threeDSecureInstance);
      });
    });
  });

  describe('verify', () => {
    beforeEach(() => {
      testContext.config = {
        client: {},
        amount: '10.00'
      };

      testContext.tds = new ThreeDSecure({}, testContext.config, 'Card Verification');
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
      }).then(function (payload) {
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
      }).then(throwIfResolves).catch(function (err) {
        expect(err.message).toBe('A message');
      });
    });

    test('can pass additional data along', () => {
      var billingAddress = {
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
      }).then(function (payload) {
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
      }).then(function (payload) {
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
      }).then(function (payload) {
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
      }).then(function (payload) {
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
      testContext.tds = new ThreeDSecure({}, {}, 'Card Verification');

      testContext.tds._instance = testContext.threeDSecureInstance;
      jest.spyOn(testContext.threeDSecureInstance, 'teardown').mockResolvedValue();
    });

    test('calls teardown on 3ds instance', () => {
      return testContext.tds.teardown().then(function () {
        expect(testContext.threeDSecureInstance.teardown).toBeCalledTimes(1);
      });
    });
  });

  describe('udpateConfiguration', () => {
    test('updates configuration', () => {
      var tds = new ThreeDSecure({}, {amount: '10.00', foo: 'bar'}, 'Card Verification');

      tds.updateConfiguration('amount', '23.45');

      expect(tds._config).toEqual({amount: '23.45', foo: 'bar'});
    });
  });
});
