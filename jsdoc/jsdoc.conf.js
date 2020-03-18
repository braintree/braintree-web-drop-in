const { version } = require('../package.json');

module.exports = {
  opts: {
    destination: `../dist/gh-pages/docs/${version}`,
    recurse: true,
    readme: 'Home.md',
    template: '../node_modules/jsdoc-template'
  },
  templates: {
    referenceTitle: 'Braintree Drop-in Reference'
  },
  plugins: ['./version-interpolator-plugin', 'plugins/markdown']
};
