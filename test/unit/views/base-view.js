'use strict';

var BaseView = require('../../../src/views/base-view');

describe('BaseView', function () {
  describe('Constructor', function () {
    it("doesn't require options to be passed", function () {
      expect(function () {
        new BaseView(); // eslint-disable-line no-new
      }).not.to.throw();
    });

    it('takes properties from passed options', function () {
      var view = new BaseView({foo: 'boo', yas: 'gaga'});

      expect(view.foo).to.equal('boo');
      expect(view.yas).to.equal('gaga');
    });
  });

  describe('teardown', function () {
    it('calls callback immediately', function (done) {
      var view = new BaseView();

      view.teardown(done);
    });
  });
});
