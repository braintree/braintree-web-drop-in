'use strict';

var BasePickerView = require('../../../../src/views/picker-views/base-picker-view');
var BaseView = require('../../../../src/views/base-view');

describe('BasePickerView', function () {
  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(BasePickerView.prototype, '_initialize');
    });

    it('calls _initialize', function () {
      new BasePickerView(); // eslint-disable-line no-new

      expect(BasePickerView.prototype._initialize).to.have.been.calledOnce;
    });

    it('inherits from BaseView', function () {
      expect(new BasePickerView()).to.be.an.instanceOf(BaseView);
    });
  });
});
