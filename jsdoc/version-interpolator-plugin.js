'use strict';

const replaceVersionStrings = require('../scripts/replace-version-strings');

exports.handlers = {
  jsdocCommentFound: (e) => {
    e.comment = replaceVersionStrings(e.comment);
  }
};
