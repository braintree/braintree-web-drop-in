const createHelpers = require('./test/integration/helper');
const uuid = require('@braintree/uuid');
const browserstack = require('browserstack-local');

// Stop node from complaining about fake memory leaks at higher concurrency
require('events').defaultMaxListeners = 20;
require('dotenv').config();

const ONLY_BROWSERS = process.env.ONLY_BROWSERS;
const localIdentifier = uuid();
const screenResolution = '1920x1080';

const projectName = 'Braintee Web Drop-in';
let type;

if (!process.env.GITHUB_REF) {
  type = "Local";
} else {
  type = "CI";
}

const build = `${projectName} - ${type} ${Date.now()}`;

const desktopCapabilities = {
  'bstack:options' : {
    os : 'Windows',
    osVersion : '10',
    local : 'true',
    debug : 'true',
    seleniumVersion : '3.14.0',
    localIdentifier,
  },
  browserVersion: 'latest',
  acceptInsecureCerts: true
};

let capabilities = [
  {
    ...desktopCapabilities,
    browserName: 'Chrome',
  },
  {
    ...desktopCapabilities,
    browserName: 'IE',
    browserVersion: '11.0',
    'bstack:options': {
      ...desktopCapabilities['bstack:options'],
      seleniumVersion: '3.141.5',
      bfcache: '0',
      ie : {
      // don't update this! There's a weird bug in the
      // 64 bit ie driver that prevents the shift key
      // from working which means that an email can
      // never be entered because the "@" key cannot
      // be entered. This doesn't occur in the 32 bit
      // version, so we pin to that
        arch : 'x32',
        driver : '3.141.5',
      }
    }
  },
  {
    ...desktopCapabilities,
    browserName: 'Firefox',
    // TODO remove this version override
    // In v97+, the PayPal window never launches
    // to unblock current PRs from being merged,
    // we're pinning to v96.0, but this should
    // be investigated and resolved ASAP
    browserVersion: '96.0',
  },
];

// TODO check in with PayPal team on this
// Safari is struggling to close the PayPal popup on CI
// skip PayPal on Safari for now
if (!process.env.RUN_PAYPAL_ONLY) {
  capabilities.push({
    ...desktopCapabilities,
    browserName: 'Safari',
    browserVersion: '14.0',
    'bstack:options': {
      ...desktopCapabilities['bstack:options'],
      os: 'OS X',
      osVersion: 'Big Sur'
    }
  });
}

if (ONLY_BROWSERS) {
  capabilities = ONLY_BROWSERS.split(',')
    .map(browser => capabilities.find(config => config.browserName.toLowerCase() === browser.toLowerCase()))
    .filter(b => b); // in case an invalid value is passed and no corresponding capability is available

  if (capabilities.length === 0) {
    throw new Error(`Could not find browsers ${ONLY_BROWSERS} in config`);
  }
}

const mochaOpts = {
  timeout: 200000
};

if (!process.env.DISABLE_RETRIES) {
  mochaOpts.retries = 3;
}

if (process.env.TEST_GREP) {
  mochaOpts.grep = process.env.TEST_GREP;
} else if (process.env.RUN_PAYPAL_ONLY) {
  mochaOpts.grep = '@paypal';
} else if (process.env.SKIP_PAYPAL) {
  mochaOpts.grep = '@paypal';
  mochaOpts.invert = 1;
}

exports.config = {
  user: process.env.BROWSERSTACK_USERNAME,
  key: process.env.BROWSERSTACK_ACCESS_KEY,
  specs: require('fs')
    .readdirSync('./test/integration')
    .map(f => `./test/integration/${f}`),
  exclude: [
    './test/integration/helper.js'
  ],
  maxInstances: 4,
  capabilities,
  sync: true,
  logLevel: 'error',
  deprecationWarnings: true,
  bail: 0,
  waitforTimeout: 20000,
  connectionRetryTimeout: 90000,
  connectionRetryCount: 1,
  services: [
    ['browserstack', {
      runner: 'local',
      browserstackLocal: true,
    }],
  ],
  framework: 'mocha',
  mochaOpts,
  reporters: ['spec'],
  reportOptions: {
    outputDir: './'
  },
  onPrepare() {
    /* eslint-disable no-console */
    console.log('Connecting local');
    return new Promise((resolve, reject) => {
      exports.bs_local = new browserstack.Local();
      exports.bs_local.start(
        {
          key: process.env.BROWSERSTACK_ACCESS_KEY,
          localIdentifier
        },
        error => {
          if (error) return reject(error);
          console.log(`Connected with localIdentifier=${localIdentifier}`);
          console.log(
            'Testing in the following browsers:',
            capabilities
              .map(
                browser => `${browser.browserName}@${browser.browserVersion}`
              )
              .join(', ')
          );

          return resolve();
        }
      );
    });
    /* eslint-enable no-console */
  },
  before(capabilities) {
    createHelpers();

    browser.setTimeout({
      pageLoad: 10000,
      script: 5 * 60 * 1000
    });
  },
  onComplete() {
    exports.bs_local.stop(() => {});
  }
};
