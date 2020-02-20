'use strict';

var fake = require('../../helpers/fake');
var assets = require('@braintree/asset-loader');
var Promise = require('../../../src/lib/promise');
var analytics = require('../../../src/lib/analytics');
var DataCollector = require('../../../src/lib/data-collector');

describe('DataCollector', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
  });

  beforeEach(() => {
    jest.spyOn(analytics, 'sendEvent').mockImplementation();
    testContext.dataCollectorInstance = fake.dataCollectorInstance;
    jest.spyOn(testContext.dataCollectorInstance, 'teardown').mockResolvedValue();
  });

  describe('initialize', () => {
    beforeEach(() => {
      var createStub = jest.fn().mockResolvedValue(testContext.dataCollectorInstance);

      function makeFakeBraintree() {
        return {
          dataCollector: {
            create: createStub
          }
        };
      }

      testContext.config = {
        client: {
          getVersion: jest.fn().mockReturnValue('1.2.3')
        },
        kount: true
      };

      global.braintree = makeFakeBraintree();

      jest.spyOn(assets, 'loadScript').mockImplementation(function () {
        global.braintree = makeFakeBraintree();

        return Promise.resolve();
      });
    });

    afterEach(() => {
      delete global.braintree;
    });

    test(
      'loads datacollector script if data collector does not exist on braintree object',
      () => {
        var dc = new DataCollector(testContext.config);

        delete global.braintree.dataCollector;

        return dc.initialize().then(function () {
          expect(assets.loadScript).toBeCalledTimes(1);
          expect(assets.loadScript).toBeCalledWith({
            src: 'https://js.braintreegateway.com/web/1.2.3/js/data-collector.min.js',
            id: 'braintree-dropin-data-collector-script'
          });
        });
      }
    );

    test(
      'loads datacollector script if braintree object does not exist',
      () => {
        var dc = new DataCollector(testContext.config);

        delete global.braintree;

        return dc.initialize().then(function () {
          expect(assets.loadScript).toBeCalledTimes(1);
          expect(assets.loadScript).toBeCalledWith({
            src: 'https://js.braintreegateway.com/web/1.2.3/js/data-collector.min.js',
            id: 'braintree-dropin-data-collector-script'
          });
        });
      }
    );

    test('does not load datacollector script if it already exists', () => {
      var dc = new DataCollector(testContext.config);

      return dc.initialize().then(function () {
        expect(assets.loadScript).not.toBeCalled();
      });
    });

    test('creates a data collector instance', () => {
      var dc = new DataCollector(testContext.config);

      expect(dc._instance).toBeFalsy();

      return dc.initialize().then(function () {
        expect(dc._instance).toBe(testContext.dataCollectorInstance);
      });
    });

    test('resolves even if data collector setup fails', () => {
      var dc = new DataCollector(testContext.config);
      var err = new Error('fail');

      jest.spyOn(dc, 'log').mockImplementation();
      global.braintree.dataCollector.create.mockRejectedValue(err);

      return dc.initialize().then(function () {
        expect(dc._instance).toBeFalsy();
        expect(dc.log).toBeCalledWith(err);
        expect(analytics.sendEvent).toBeCalledWith(testContext.config.client, 'data-collector.setup-failed');
      });
    });
  });

  describe('getDeviceData', () => {
    test('returns device data', () => {
      var dc = new DataCollector({});

      dc._instance = testContext.dataCollectorInstance;

      expect(dc.getDeviceData()).toBe('device-data');
    });
  });

  describe('teardown', () => {
    test('calls teardown on data collector instance', () => {
      var dc = new DataCollector({});

      dc._instance = testContext.dataCollectorInstance;

      return dc.teardown().then(function () {
        expect(testContext.dataCollectorInstance.teardown).toBeCalledTimes(1);
      });
    });
  });
});
