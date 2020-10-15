'use strict';

const replaceVersionStrings = require('../scripts/replace-version-strings');
const { version } = require('../package.json');

module.exports = {
  opts: {
    destination: `../dist/gh-pages/docs/${version}`,
    recurse: true,
    readme: 'Home.md',
    template: '../node_modules/jsdoc-template'
  },
  source: {
    include: ['../src'],
    exclude: ['/__mocks__/', '/translations/']
  },
  templates: {
    referenceTitle: 'Braintree Drop-in Reference',
    postProcess: (text) => replaceVersionStrings(text)

  },
  plugins: ['plugins/markdown']
};
