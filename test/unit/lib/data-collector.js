'use strict';

const fake = require('../../helpers/fake');
const assets = require('@braintree/asset-loader');
const Promise = require('../../../src/lib/promise');
const analytics = require('../../../src/lib/analytics');
const DataCollector = require('../../../src/lib/data-collector');

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
      const createStub = jest.fn().mockResolvedValue(testContext.dataCollectorInstance);

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

      jest.spyOn(assets, 'loadScript').mockImplementation(() => {
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
        const dc = new DataCollector(testContext.config);

        delete global.braintree.dataCollector;

        return dc.initialize().then(() => {
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
        const dc = new DataCollector(testContext.config);

        delete global.braintree;

        return dc.initialize().then(() => {
          expect(assets.loadScript).toBeCalledTimes(1);
          expect(assets.loadScript).toBeCalledWith({
            src: 'https://js.braintreegateway.com/web/1.2.3/js/data-collector.min.js',
            id: 'braintree-dropin-data-collector-script'
          });
        });
      }
    );

    test('does not load datacollector script if it already exists', () => {
      const dc = new DataCollector(testContext.config);

      return dc.initialize().then(() => {
        expect(assets.loadScript).not.toBeCalled();
      });
    });

    test('creates a data collector instance', () => {
      const dc = new DataCollector(testContext.config);

      expect(dc._instance).toBeFalsy();

      return dc.initialize().then(() => {
        expect(dc._instance).toBe(testContext.dataCollectorInstance);
      });
    });

    test('resolves even if data collector setup fails', () => {
      const dc = new DataCollector(testContext.config);
      const err = new Error('fail');

      jest.spyOn(dc, 'log').mockImplementation();
      global.braintree.dataCollector.create.mockRejectedValue(err);

      return dc.initialize().then(() => {
        expect(dc._instance).toBeFalsy();
        expect(dc.log).toBeCalledWith(err);
        expect(analytics.sendEvent).toBeCalledWith(testContext.config.client, 'data-collector.setup-failed');
      });
    });
  });

  describe('getDeviceData', () => {
    test('returns device data', () => {
      const dc = new DataCollector({});

      dc._instance = testContext.dataCollectorInstance;

      expect(dc.getDeviceData()).toBe('device-data');
    });
  });

  describe('teardown', () => {
    test('calls teardown on data collector instance', () => {
      const dc = new DataCollector({});

      dc._instance = testContext.dataCollectorInstance;

      return dc.teardown().then(() => {
        expect(testContext.dataCollectorInstance.teardown).toBeCalledTimes(1);
      });
    });
  });
});
