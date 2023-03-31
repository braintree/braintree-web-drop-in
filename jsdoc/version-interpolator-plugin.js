var VERSION = require('../package.json').version;
var BT_WEB_VERSION = require('braintree-web').VERSION;

exports.handlers = {
  jsdocCommentFound: function(e) {
    e.comment = e.comment.replace(/{@pkg version}/g, VERSION).replace(/{@pkg bt-web-version}/g, BT_WEB_VERSION);
  }
};
