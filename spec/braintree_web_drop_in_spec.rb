require_relative "helpers/paypal_helper"
require_relative "helpers/drop_in_helper"
require_relative "helpers/skip_browser_helper"

HOSTNAME = `hostname`.chomp
PORT = 4567

describe "Drop-in" do
  include SkipBrowser
  include DropIn
  include PayPal

  before :each do
    visit "http://#{HOSTNAME}:#{PORT}"
  end

  describe "tokenizes" do
    it "a card" do
      browser_skip("safari", "Testing iframes in WebKit does not work")

      click_option("Card")
      hosted_field_send_input("number", "4111111111111111")
      hosted_field_send_input("expirationDate", "1019")
      submit_pay

      expect(find(".braintree-heading")).to have_content("Paying with")

      # Drop-in Details
      expect(page).to have_content('Ending in ••11')

      # Nonce Details
      expect(page).to have_content('CreditCard')
      expect(page).to have_content('ending in 11')
      expect(page).to have_content('Visa')
    end

    it "PayPal" do
      click_option("PayPal")

      open_popup_and_complete_login

      submit_pay

      expect(find(".braintree-heading")).to have_content("Paying with")

      expect(page).to have_content('PayPalAccount')
      expect(page).to have_content(ENV['PAYPAL_USERNAME'])
    end
  end
end
