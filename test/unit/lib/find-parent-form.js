'use strict';

var findParentForm = require('../../../src/lib/find-parent-form').findParentForm;

describe('findParentForm', () => {
  test('returns undefined if the element has no parentNode', () => {
    expect(findParentForm({})).toBeUndefined();
  });

  test(
    'checks recursively and returns undefined if no parentNode is a form',
    () => {
      expect(findParentForm({
        parentNode: {
          parentNode: {
            parentNode: {}
          }
        }
      })).toBeUndefined();
    }
  );

  test('returns the parent node if it is a form', () => {
    var form = {
      nodeName: 'FORM'
    };

    expect(findParentForm({
      parentNode: form
    })).toBe(form);
  });

  test(
    'checks recursively until it finds a parent node that is a form',
    () => {
      var form = {
        nodeName: 'FORM'
      };

      expect(findParentForm({
        parentNode: {
          parentNode: {
            parentNode: form
          }
        }
      })).toBe(form);
    }
  );
});
