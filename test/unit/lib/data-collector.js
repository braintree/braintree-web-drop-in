jest.mock('../../../src/lib/analytics');

const btWebVersion = require('braintree-web/client').VERSION;
const fake = require('../../helpers/fake');
const assets = require('@braintree/asset-loader');
const Promise = require('../../../src/lib/promise');
const analytics = require('../../../src/lib/analytics');
const DataCollector = require('../../../src/lib/data-collector');

describe('DataCollector', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
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
        authorization: 'fake-auth',
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

    it('loads datacollector script if data collector does not exist on braintree object', () => {
      const dc = new DataCollector(testContext.config);

      delete global.braintree.dataCollector;

      return dc.initialize().then(() => {
        expect(assets.loadScript).toBeCalledTimes(1);
        expect(assets.loadScript).toBeCalledWith({
          src: `https://js.braintreegateway.com/web/${btWebVersion}/js/data-collector.min.js`,
          id: 'braintree-dropin-data-collector-script'
        });
      });
    });

    it('loads datacollector script if braintree object does not exist', () => {
      const dc = new DataCollector(testContext.config);

      delete global.braintree;

      return dc.initialize().then(() => {
        expect(assets.loadScript).toBeCalledTimes(1);
        expect(assets.loadScript).toBeCalledWith({
          src: `https://js.braintreegateway.com/web/${btWebVersion}/js/data-collector.min.js`,
          id: 'braintree-dropin-data-collector-script'
        });
      });
    });

    it('does not load datacollector script if it already exists', () => {
      const dc = new DataCollector(testContext.config);

      return dc.initialize().then(() => {
        expect(assets.loadScript).not.toBeCalled();
      });
    });

    it('creates a data collector instance using deferred method', () => {
      const dc = new DataCollector(testContext.config);

      expect(dc._instance).toBeFalsy();

      return dc.initialize().then(() => {
        expect(dc._instance).toBe(testContext.dataCollectorInstance);
        expect(global.braintree.dataCollector.create).toBeCalledTimes(1);
        expect(global.braintree.dataCollector.create).toBeCalledWith({
          authorization: 'fake-auth',
          kount: true,
          useDeferredClient: true
        });
      });
    });

    it('resolves even if data collector setup fails', () => {
      const dc = new DataCollector(testContext.config);
      const err = new Error('fail');

      jest.spyOn(dc, 'log').mockImplementation();
      global.braintree.dataCollector.create.mockRejectedValue(err);

      return dc.initialize().then(() => {
        expect(dc._instance).toBeFalsy();
        expect(dc.log).toBeCalledWith(err);
        expect(analytics.sendEvent).toBeCalledWith('data-collector.setup-failed');
      });
    });
  });

  describe('getDeviceData', () => {
    it('resolves with empty string when data collector instance is not avaialble', async () => {
      const dc = new DataCollector({});

      const data = await dc.getDeviceData();

      expect(data).toBe('');
    });

    it('resolves device data', async () => {
      const dc = new DataCollector({});

      dc._instance = testContext.dataCollectorInstance;

      const data = await dc.getDeviceData();

      expect(data).toBe('device-data');
    });
  });

  describe('teardown', () => {
    it('calls teardown on data collector instance', () => {
      const dc = new DataCollector({});

      dc._instance = testContext.dataCollectorInstance;

      return dc.teardown().then(() => {
        expect(testContext.dataCollectorInstance.teardown).toBeCalledTimes(1);
      });
    });
  });
});
