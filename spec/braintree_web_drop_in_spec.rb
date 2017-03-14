require_relative "helpers/paypal_helper"
require_relative "helpers/drop_in_helper"
require_relative "helpers/skip_browser_helper"

HOSTNAME = `hostname`.chomp
PORT = 4567

describe "Drop-in" do
  include SkipBrowser
  include DropIn
  include PayPal

  describe "setup" do
    it "requires a selector" do
      visit "http://#{HOSTNAME}:#{PORT}?mergeWithDefault=true&selector=null"

      expect(find("#id")).to have_content("options.selector is required.")
    end

    it "requires authorization" do
      visit "http://#{HOSTNAME}:#{PORT}?mergeWithDefault=true&authorization=null"

      expect(find("#id")).to have_content("options.authorization is required.")
    end

    it "does not setup paypal when not configured" do
      visit "http://#{HOSTNAME}:#{PORT}?mergeWithDefault=true&paypal=null"

      expect(page).to_not have_content("PayPal")
      expect(page).to have_content("Card Number")
      expect(page).to have_content("Expiration Date")
    end
  end

  describe "tokenizes" do
    it "a card" do
      browser_skip("safari", "Testing iframes in WebKit does not work")

      visit "http://#{HOSTNAME}:#{PORT}"

      click_option("Card")
      hosted_field_send_input("number", "4111111111111111")
      hosted_field_send_input("expirationDate", "1019")
      submit_pay

      expect(find(".braintree-heading")).to have_content("Paying with")

      # Drop-in Details
      expect(page).to have_content("Ending in ••11")

      # Nonce Details
      expect(page).to have_content("CreditCard")
      expect(page).to have_content("ending in 11")
      expect(page).to have_content("Visa")
    end

    it "PayPal" do
      visit "http://#{HOSTNAME}:#{PORT}"

      click_option("PayPal")

      open_popup_and_complete_login

      expect(find(".braintree-heading")).to have_content("Paying with")

      expect(page).to have_content("bt_buyer_us@paypal.com")
    end
  end
end
