const htmlLoader = require('html-loader');

module.exports = {
  process: (src) => htmlLoader(src)
};
