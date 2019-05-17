require_relative "helpers/paypal_helper"
require_relative "helpers/drop_in_helper"
require_relative "helpers/skip_browser_helper"

describe "Drop-in#requestPaymentMethod" do
  include SkipBrowser
  include DropIn
  include PayPal

  describe "callback api" do
    # it "tokenizes a card" do
    #   visit_dropin_url
    #
    #   click_option("card")
    #   hosted_field_send_input("number", "4111111111111111")
    #   hosted_field_send_input("expirationDate", "1019")
    #   hosted_field_send_input("cvv", "123")
    #
    #   submit_pay
    #
    #   expect(find("[data-braintree-id='methods-label']")).to have_content("Paying with")
    #
    #   # Drop-in Details
    #   expect(page).to have_content("Ending in 1111")
    #
    #   # Nonce Details
    #   expect(page).to have_content("CreditCard")
    #   expect(page).to have_content("ending in 11")
    #   expect(page).to have_content("Visa")
    # end

    it "tokenizes PayPal", :paypal do
      visit_dropin_url

      click_option("paypal")

      open_popup_and_complete_login

      # submit_pay
      #
      # expect(find("[data-braintree-id='methods-label']")).to have_content("Paying with PayPal")
      #
      # expect(page).to have_content("PayPalAccount")
      # expect(page).to have_content(ENV["PAYPAL_USERNAME"])
    end

    # it "tokenizes PayPal Credit", :paypal do
    #   visit_dropin_url
    #
    #   click_option("paypalCredit")
    #
    #   open_popup_and_complete_login do
    #     expect(page).to have_content("PayPal Credit");
    #   end
    #
    #   submit_pay
    #
    #   expect(find("[data-braintree-id='methods-label']")).to have_content("Paying with PayPal")
    #
    #   expect(page).to have_content("PayPalAccount")
    #   expect(page).to have_content(ENV["PAYPAL_USERNAME"])
    # end
  # end
  #
  # describe "promise API" do
  #   it "tokenizes a card" do
  #     visit_dropin_url("/promise.html")
  #
  #     click_option("card")
  #     hosted_field_send_input("number", "4111111111111111")
  #     hosted_field_send_input("expirationDate", "1019")
  #     hosted_field_send_input("cvv", "123")
  #
  #     submit_pay
  #
  #     expect(find("[data-braintree-id='methods-label']")).to have_content("Paying with")
  #
  #     # Drop-in Details
  #     expect(page).to have_content("Ending in 1111")
  #
  #     # Nonce Details
  #     expect(page).to have_content("CreditCard")
  #     expect(page).to have_content("ending in 11")
  #     expect(page).to have_content("Visa")
  #   end
  #
  #   it "tokenizes PayPal", :paypal do
  #     visit_dropin_url("/promise.html")
  #
  #     click_option("paypal")
  #
  #     open_popup_and_complete_login
  #
  #     submit_pay
  #
  #     expect(find("[data-braintree-id='methods-label']")).to have_content("Paying with PayPal")
  #
  #     expect(page).to have_content("PayPalAccount")
  #     expect(page).to have_content(ENV["PAYPAL_USERNAME"])
  #   end
  end
end
