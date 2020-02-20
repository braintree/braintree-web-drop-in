
const dropin = require('../../src/index');
const Dropin = require('../../src/dropin');
const DropinError = require('../../src/lib/dropin-error');
const BraintreeError = require('braintree-web/lib/braintree-error');
const client = require('braintree-web/client');
const fake = require('../helpers/fake');
const dropinConstants = require('../../src/constants');
const analytics = require('../../src/lib/analytics');
const {
  yields
} = require('../helpers/yields');
// TODO this gets transformed to the package.json version when built
// should we figure out how to actually test this?
const version = '__VERSION__';

describe('dropin.create', () => {
  let testContext;

  beforeEach(() => {
    testContext = {};
  });

  beforeEach(() => {
    const container = document.createElement('div');

    testContext.form = document.createElement('form');

    container.id = 'foo';

    testContext.form.appendChild(container);
    document.body.appendChild(testContext.form);

    jest.spyOn(client, 'create').mockResolvedValue();
  });

  afterEach(() => {
    document.body.removeChild(testContext.form);
  });

  test('errors out if no authorization given', done => {
    dropin.create({}, (err, instance) => {
      expect(err).toBeInstanceOf(DropinError);
      expect(err.message).toBe('options.authorization is required.');
      expect(instance).not.toBeDefined();
      done();
    });
  });

  test('returns an error if client.create errors', done => {
    const originalErr = new BraintreeError({
      type: 'MERCHANT',
      code: 'CODE',
      message: 'you goofed!!'
    });

    client.create.mockRejectedValue(originalErr);

    dropin.create({
      authorization: 'tokenization_key',
      selector: '#foo'
    }, (err, instance) => {
      expect(err).toBeInstanceOf(DropinError);
      expect(err.message).toBe('There was an error creating Drop-in.');
      expect(err._braintreeWebError).toBe(originalErr);
      expect(instance).not.toBeDefined();
      done();
    });
  });

  test('resolves a Dropin instance if client.create returns successfully', () => {
    const fakeClient = fake.client();

    jest.spyOn(Dropin.prototype, '_initialize').mockImplementation(function (callback) {
      callback(null, this); // eslint-disable-line no-invalid-this
    });

    client.create.mockResolvedValue(fakeClient);

    return dropin.create({
      authorization: 'tokenization_key',
      selector: '#foo'
    }).then(instance => {
      expect(instance).toBeInstanceOf(Dropin);
    });
  }
  );

  test(
    'returns an error to callback if Drop-in initialization fails',
    done => {
      const fakeClient = fake.client();
      const dropinError = new DropinError('Dropin Error');

      jest.spyOn(Dropin.prototype, '_initialize').mockImplementation(yields(dropinError));

      client.create.mockResolvedValue(fakeClient);

      dropin.create({
        authorization: 'tokenization_key',
        selector: '#foo'
      }, (err, instance) => {
        expect(err).toBe(dropinError);
        expect(instance).not.toBeDefined();

        done();
      });
    }
  );

  test('sets the correct analytics metadata', done => {
    const fakeClient = fake.client();

    jest.spyOn(Dropin.prototype, '_initialize').mockImplementation(function (callback) {
      callback(null, this);
    });

    client.create.mockResolvedValue(fakeClient);

    dropin.create({
      authorization: 'tokenization_key',
      selector: '#foo'
    }, () => {
      const configuration = fakeClient.getConfiguration();

      expect(configuration.analyticsMetadata.integration).toBe(dropinConstants.INTEGRATION);
      expect(configuration.analyticsMetadata.integrationType).toBe(dropinConstants.INTEGRATION);
      expect(configuration.analyticsMetadata.dropinVersion).toBe(version);

      done();
    });
  });

  test(
    'sends web.dropin.started.tokenization-key event when using a tokenization key',
    done => {
      const fakeClient = fake.client();

      jest.spyOn(Dropin.prototype, '_initialize').mockImplementation(function (callback) {
        callback(null, this);
      });
      jest.spyOn(analytics, 'sendEvent');

      client.create.mockResolvedValue(fakeClient);

      dropin.create({
        authorization: fake.tokenizationKey,
        selector: '#foo'
      }, () => {
        expect(analytics.sendEvent).toBeCalledWith(fakeClient, 'started.tokenization-key');
        done();
      });
    }
  );

  test(
    'sends web.dropin.started.client-token event when using a client token',
    done => {
      let fakeConfiguration, fakeClient;

      fakeConfiguration = fake.configuration();
      fakeConfiguration.authorizationType = 'CLIENT_TOKEN';
      fakeConfiguration.authorization = fake.clientToken;

      fakeClient = fake.client();
      fakeClient.getConfiguration.mockReturnValue(fakeConfiguration);

      jest.spyOn(Dropin.prototype, '_initialize').mockImplementation(function (callback) {
        callback(null, this);
      });
      jest.spyOn(analytics, 'sendEvent');

      client.create.mockResolvedValue(fakeClient);

      dropin.create({
        authorization: fake.clientToken,
        selector: '#foo'
      }, () => {
        expect(analytics.sendEvent).toBeCalledWith(fakeClient, 'started.client-token');
        done();
      });
    }
  );
});
