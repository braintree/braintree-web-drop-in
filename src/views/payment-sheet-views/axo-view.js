const analytics = require('braintree-web/lib/analytics');
var BaseView = require('../base-view');
var paymentOptionIDs = require('../../constants').paymentOptionIDs;
// var assets = require("@braintree/asset-loader")
var loadAXO = require("@paypalcorp/axo-asset-loader").loadAxo
console.log('meeeeep. heres da loder: ', loadAXO)

function AXOView() {
  BaseView.apply(this, arguments)
}

AXOView.prototype = Object.create(BaseView.prototype)
AXOView.prototype.constructor = AXOView
AXOView.ID = AXOView.prototype.ID = paymentOptionIDs.axo

AXOView.prototype.initialize = function() {
  var self = this

  // Use async loader script to load the thing adn return it. 
  // once loaded and setup, call "this.model.addPaymentMethod" with tokenization payload.
  // call "this.model.reportError" with any error from tokenization.
  // "this.model.asyncDependencyFailed" if the load fails.
  // console.timeLog("axo loading")
  return Promise.resolve().then(function () {
    return loadAXO("staging").then(() => {
      analytics.sendEvent(clientInstance, 'axo.script.loaded')
      console.log('script loaded')
      return
    }).catch((err) => {
      analytics.sendEvent(clientInstance, 'axo.script.failed')
      console.log('There was an error: ', err)
    })
    // return assets.loadScript({
    //   src: "https://cdn-3a711a7e10ec6.static.engineering.dev.paypalinc.com/axo/axo.min.js"
    // }).then(() => {
    //   console.log("script loaded to page");
    //   // console.timeEnd("axo loading")
    //   return
    // }).catch((err) => {
    //     console.log(`err loading to page`, err);
    //     return err
      })
    // })
  //   return Promise.resolve(axo).then(() => {
  //     console.timeEnd("axo loading")
  // })
}

AXOView.isEnabled = function() {
  return Promise.resolve(true)
}

// AXOView.prototype.updateConfiguration = function() {
  // this is where we'd trigger re-render of the component(s)
// }

module.exports = AXOView
