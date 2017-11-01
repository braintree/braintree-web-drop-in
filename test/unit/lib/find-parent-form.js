'use strict';

var findParentForm = require('../../../src/lib/find-parent-form').findParentForm;

describe('findParentForm', function () {
  it('returns undefined if the element has no parentNode', function () {
    expect(findParentForm({})).to.be.undefined;
  });

  it('checks recursively and returns undefined if no parentNode is a form', function () {
    expect(findParentForm({
      parentNode: {
        parentNode: {
          parentNode: {}
        }
      }
    })).to.be.undefined;
  });

  it('returns the parent node if it is a form', function () {
    var form = {
      nodeName: 'FORM'
    };

    expect(findParentForm({
      parentNode: form
    })).to.equal(form);
  });

  it('checks recursively until it finds a parent node that is a form', function () {
    var form = {
      nodeName: 'FORM'
    };

    expect(findParentForm({
      parentNode: {
        parentNode: {
          parentNode: form
        }
      }
    })).to.equal(form);
  });
});
