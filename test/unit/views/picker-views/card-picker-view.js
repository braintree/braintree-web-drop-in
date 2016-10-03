'use strict';

var BasePickerView = require('../../../../src/views/picker-views/base-picker-view');
var CardPickerView = require('../../../../src/views/picker-views/card-picker-view');
var fake = require('../../../helpers/fake');
var PayWithCardView = require('../../../../src/views/pay-with-card-view');

describe('CardPickerView', function () {
  describe('Constructor', function () {
    beforeEach(function () {
      this.sandbox.stub(CardPickerView.prototype, '_initialize');
    });

    it('calls _initialize', function () {
      new CardPickerView(); // eslint-disable-line no-new

      expect(CardPickerView.prototype._initialize).to.have.been.calledOnce;
    });

    it('inherits from BasePickerView', function () {
      expect(new CardPickerView()).to.be.an.instanceOf(BasePickerView);
    });
  });

  describe('isEnabled', function () {
    it('returns true', function () {
      expect(CardPickerView.isEnabled()).to.be.true;
    });
  });

  describe('_initialize', function () {
    beforeEach(function () {
      var element = document.createElement('div');

      element.innerHTML = '<div data-braintree-id="card-picker-icons"></div>';
      this.context = {
        element: element,
        getElementById: BasePickerView.prototype.getElementById,
        mainView: {
          setActiveView: this.sandbox.spy()
        },
        _onSelect: CardPickerView.prototype._onSelect,
        options: {
          client: {
            getConfiguration: function () {
              return fake.configuration();
            }
          }
        }
      };
    });

    it('sets pay with card view as the active view when clicked', function () {
      CardPickerView.prototype._initialize.call(this.context);

      this.context.element.click();

      expect(this.context.mainView.setActiveView).to.be.calledOnce;
      expect(this.context.mainView.setActiveView).to.be.calledWith(PayWithCardView.ID);
    });

    it('appends card picker html', function () {
      CardPickerView.prototype._initialize.call(this.context);

      expect(this.context.element.querySelector('.braintree-dropin__picker-label').innerHTML).to.equal('Card');
    });

    it('shows supported card icons', function () {
      var supportedCardTypes = ['american-express', 'discover', 'diners-club', 'jcb', 'master-card', 'visa'];

      CardPickerView.prototype._initialize.call(this.context);

      supportedCardTypes.forEach(function (cardType) {
        var cardIcon = this.context.element.querySelector('.braintree-dropin__icon-card-' + cardType);

        expect(cardIcon.classList.contains('braintree-dropin__display--none')).to.be.false;
      }.bind(this));
    });

    it('hides unsupported card icons', function () {
      var unsupportedCardTypes = ['unionpay', 'maestro'];

      CardPickerView.prototype._initialize.call(this.context);

      unsupportedCardTypes.forEach(function (cardType) {
        var cardIcon = this.context.element.querySelector('.braintree-dropin__icon-card-' + cardType);

        expect(cardIcon.classList.contains('braintree-dropin__display--none')).to.be.true;
      }.bind(this));
    });
  });
});
