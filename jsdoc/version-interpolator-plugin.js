var VERSION = require('../package.json').version;
var BT_WEB_VERSION = require('braintree-web').VERSION;

exports.handlers = {
  jsdocCommentFound: function(e) {
    e.comment = e.comment.replace('{@pkg version}', VERSION).replace('{@pkg bt-web-version}', BT_WEB_VERSION);
  }
};
