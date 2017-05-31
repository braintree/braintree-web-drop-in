require_relative "helpers/paypal_helper"
require_relative "helpers/drop_in_helper"
require_relative "helpers/skip_browser_helper"

HOSTNAME = `hostname`.chomp
PORT = 4567

describe "Drop-in" do
  include SkipBrowser
  include DropIn
  include PayPal

  describe "tokenizes" do
    it "a card" do
      visit "http://#{HOSTNAME}:#{PORT}"

      click_option("card")
      hosted_field_send_input("number", "4111111111111111")
      hosted_field_send_input("expirationDate", "1019")
      hosted_field_send_input("cvv", "123")

      submit_pay

      expect(find(".braintree-heading")).to have_content("Paying with")

      # Drop-in Details
      expect(page).to have_content("Ending in ••11")

      # Nonce Details
      expect(page).to have_content("CreditCard")
      expect(page).to have_content("ending in 11")
      expect(page).to have_content("Visa")
    end

    it "PayPal", :paypal do
      visit "http://#{HOSTNAME}:#{PORT}"

      click_option("paypal")

      open_popup_and_complete_login

      submit_pay

      expect(find(".braintree-heading")).to have_content("Paying with PayPal")

      expect(page).to have_content("PayPalAccount")
      expect(page).to have_content(ENV["PAYPAL_USERNAME"])
    end

    it "PayPal Credit", :paypal do
      visit "http://#{HOSTNAME}:#{PORT}"

      click_option("paypalCredit")

      open_popup_and_complete_login do
        expect(page).to have_content("PayPal Credit");
      end

      submit_pay

      expect(find(".braintree-heading")).to have_content("Paying with PayPal")

      expect(page).to have_content("PayPalAccount")
      expect(page).to have_content(ENV["PAYPAL_USERNAME"])
    end
  end

  describe "promise API" do
    it "tokenizes a card" do
      visit "http://#{HOSTNAME}:#{PORT}/promise.html"

      click_option("card")
      hosted_field_send_input("number", "4111111111111111")
      hosted_field_send_input("expirationDate", "1019")
      hosted_field_send_input("cvv", "123")

      submit_pay

      expect(find(".braintree-heading")).to have_content("Paying with")

      # Drop-in Details
      expect(page).to have_content("Ending in ••11")

      # Nonce Details
      expect(page).to have_content("CreditCard")
      expect(page).to have_content("ending in 11")
      expect(page).to have_content("Visa")
    end

    it "tokenizes PayPal", :paypal do
      visit "http://#{HOSTNAME}:#{PORT}/promise.html"

      click_option("paypal")

      open_popup_and_complete_login

      submit_pay

      expect(find(".braintree-heading")).to have_content("Paying with PayPal")

      expect(page).to have_content("PayPalAccount")
      expect(page).to have_content(ENV["PAYPAL_USERNAME"])
    end
  end

  describe "updateConfiguration" do
    it "updates PayPal configuration", :paypal do
      visit "http://#{HOSTNAME}:#{PORT}?showUpdatePayPalMenu=true"

      find("#paypal-config-checkout").click()
      click_option("paypal")

      open_popup_and_complete_login do
        expect(page).to_not have_content("future payments");
      end

      find("#paypal-config-vault").click()
      click_option("paypal")

      complete_iframe_flow do
        expect(page).to have_content("future payments");
      end
    end

    it "updates PayPal Credit configuration", :paypal do
      visit "http://#{HOSTNAME}:#{PORT}?showUpdatePayPalMenu=true"

      find("#paypal-config-checkout").click()
      click_option("paypalCredit")

      open_popup_and_complete_login do
        expect(page).to_not have_content("future payments");
      end

      find("#paypal-config-vault").click()
      click_option("paypalCredit")

      complete_iframe_flow do
        expect(page).to have_content("future payments");
      end
    end

    it "removes authorized PayPal account when configuration is updated", :paypal do
      visit "http://#{HOSTNAME}:#{PORT}?showUpdatePayPalMenu=true"

      find("#paypal-config-checkout").click()
      click_option("paypal")

      open_popup_and_complete_login do
        expect(page).to_not have_content("future payments");
      end

      expect(page).to have_content(ENV["PAYPAL_USERNAME"])

      find("#paypal-config-vault").click()

      expect(page).to_not have_content(ENV["PAYPAL_USERNAME"])
    end
  end

  describe "events" do
    it "disable and enable submit button on credit card validity" do
      visit "http://#{HOSTNAME}:#{PORT}"

      click_option("card")

      expect(page).to have_button('Pay', disabled: true)

      # Put in valid state
      hosted_field_send_input("number", "4111111111111111")
      hosted_field_send_input("expirationDate", "1019")
      hosted_field_send_input("cvv", "123")

      expect(page).to have_button('Pay', disabled: false)

      # Put in invalid state
      hosted_field_send_input("expirationDate", :backspace)
      hosted_field_send_input("expirationDate", "2")

      expect(page).to have_button('Pay', disabled: true)

      # Put in valid state again
      hosted_field_send_input("expirationDate", :backspace)
      hosted_field_send_input("expirationDate", "9")

      expect(page).to have_button('Pay', disabled: false)
    end

    it "enable submit button on PayPal authorization", :paypal do
      visit "http://#{HOSTNAME}:#{PORT}"

      click_option("paypal")

      expect(page).to have_button('Pay', disabled: true)

      open_popup_and_complete_login

      expect(page).to have_button('Pay', disabled: false)

      find('.braintree-toggle').click

      expect(page).to have_button('Pay', disabled: false)

      click_option("paypal")

      expect(page).to have_button('Pay', disabled: true)

      find('.braintree-toggle').click

      expect(page).to have_button('Pay', disabled: false)
    end
  end

  describe "setup" do
    it "requires a selector or container" do
      visit "http://#{HOSTNAME}:#{PORT}?container=null&selector=null"

      expect(find("#error")).to have_content("options.container is required.")
    end

    it "requires authorization" do
      visit "http://#{HOSTNAME}:#{PORT}?authorization=null"

      expect(find("#error")).to have_content("options.authorization is required.")
    end

    it "does not setup paypal when not configured" do
      visit "http://#{HOSTNAME}:#{PORT}?paypal=null&paypalCredit=null"

      expect(page).not_to have_selector(".braintree-option__paypal")
      expect(page).to have_content("Card Number")
      expect(page).to have_content("Expiration Date")
    end

    it "supports locale" do
      visit "http://#{HOSTNAME}:#{PORT}?locale=es_ES"

      expect(page).to have_content("Tarjeta")
    end
  end

  describe "payment option priority" do
    it "uses default priority of card, paypal, paypalCredit" do
      visit "http://#{HOSTNAME}:#{PORT}"

      find(".braintree-heading")
      payment_options = all(:css, ".braintree-option__label")

      expect(payment_options[0]).to have_content("Card")
      expect(payment_options[1]).to have_content("PayPal")
      expect(payment_options[2]).to have_content("PayPal Credit")
    end

    it "uses custom priority of paypal, card, paypalCredit" do
      options = '["paypal","card","paypalCredit"]'
      visit URI.encode("http://#{HOSTNAME}:#{PORT}?paymentOptionPriority=#{options}")

      find(".braintree-heading")
      payment_options = all(:css, ".braintree-option__label")

      expect(payment_options[0]).to have_content("PayPal")
      expect(payment_options[1]).to have_content("Card")
      expect(payment_options[2]).to have_content("PayPal Credit")
    end

    it "shows an error when an unrecognized payment option is specified" do
      options = '["dummy","card"]'
      visit URI.encode("http://#{HOSTNAME}:#{PORT}?paymentOptionPriority=#{options}")

      expect(find("#error")).to have_content("paymentOptionPriority: Invalid payment option specified.")
    end
  end
end
