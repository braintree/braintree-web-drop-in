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

if (!process.env.TRAVIS_BRANCH) {
  type = 'Local';
} else if (process.env.TRAVIS_BRANCH !== 'master') {
  type = 'Pull Request';
} else {
  type = 'CI';
}

const build = `${projectName} - ${type} ${Date.now()}`;

const defaultCapabilities = {
  project: projectName,
  build,
  'browserstack.debug': true,
  'browserstack.local': true,
  'browserstack.networkLogs': true,
  'browserstack.localIdentifier': localIdentifier
};

const desktopCapabilities = {
  ...defaultCapabilities,
  os: 'windows',
  os_version: '10',
  resolution: screenResolution
};

const mobileCapabilities = {
  ...defaultCapabilities,
  real_mobile: true,
  'browserstack.appium_version': '1.14.0'
};

let capabilities = [
  {
    ...desktopCapabilities,
    browserName: 'Google Chrome',
    browser: 'chrome',
    'browserstack.console': 'info'
  },
  // TODO mobile browsers are having trouble with browser.keys
  //{
  //  ...mobileCapabilities,
  //  browserName: 'iPhone XS Safari',
  //  device: 'iPhone XS',
  //  os_version: '13'
  //},
  //{
  //  ...mobileCapabilities,
  //  browserName: 'Google Pixel 3 Chrome',
  //  device: 'Google Pixel 3',
  //  os_version: '9.0',
  //  chromeOptions: {
  //    prefs: {
  //      // disable chrome's annoying password manager, may be unnec
  //      'profile.password_manager_enabled': false,
  //      credentials_enable_service: false,
  //      password_manager_enabled: false
  //    }
  //  }
  //},
  {
    ...desktopCapabilities,
    browser: 'IE',
    browserName: 'IE 11',
    browser_version: '11.0',
    'browserstack.selenium_version' : '3.141.5',
    // https://stackoverflow.com/a/42340325/7851516
    'browserstack.bfcache': '0',
    // don't update this! There's a weird bug in the
    // 64 bit ie driver that prevents the shift key
    // from working which means that an email can
    // never be entered because the "@" key cannot
    // be entered. This doesn't occur in the 32 bit
    // version, so we pin to that
    'browserstack.ie.arch' : 'x32'
  },
  // TODO edge has been pretty flaky
  // disable it for now to make the transition
  // to browserstack, but look into re-enabling
  // it once the transition is complete
  //{
  //  ...desktopCapabilities,
  //  browserName: 'Microsoft Edge',
  //  browser: 'edge',
  //  browser_version: '18.0'
  //},
  {
    ...desktopCapabilities,
    browserName: 'Firefox',
    browser: 'firefox',
    'browserstack.console': 'info'
  },
  {
    ...desktopCapabilities,
    browserName: 'Desktop Safari',
    browser: 'safari',
    os: 'OS X',
    os_version: 'Mojave'
  }
];

if (ONLY_BROWSERS) {
  capabilities = ONLY_BROWSERS.split(',')
    .map(browser => capabilities.find(config => config.browser.toLowerCase() === browser.toLowerCase()))
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
  baseUrl: process.env.HOST,
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
                browser =>
                  browser.real_mobile
                    ? `${browser.device}@${browser.os_version}`
                    : `${browser.browser}@${browser.browser_version}`
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
    // Mobile devices/selenium don't support the following APIs yet
    if (!capabilities.real_mobile) {
      browser.maximizeWindow();
      browser.setTimeout({
        pageLoad: 10000,
        script: 5 * 60 * 1000
      });
    }
  },
  onComplete() {
    exports.bs_local.stop(() => {});
  }
};
