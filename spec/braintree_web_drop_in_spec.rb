require_relative "helpers/paypal_helper"
require_relative "helpers/drop_in_helper"
require_relative "helpers/skip_browser_helper"

describe "Drop-in" do
  include SkipBrowser
  include DropIn
  include PayPal

  describe "tokenizes" do
    it "a card" do
      visit_dropin_url

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
      visit_dropin_url

      click_option("paypal")

      open_popup_and_complete_login

      submit_pay

      expect(find(".braintree-heading")).to have_content("Paying with PayPal")

      expect(page).to have_content("PayPalAccount")
      expect(page).to have_content(ENV["PAYPAL_USERNAME"])
    end

    it "PayPal Credit", :paypal do
      visit_dropin_url

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
      visit_dropin_url("/promise.html")

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
      visit_dropin_url("/promise.html")

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
      visit_dropin_url("?showUpdatePayPalMenu=true")

      find("#paypal-config-checkout").click()
      click_option("paypal")

      open_popup_and_complete_login do
        expect(page).to_not have_content("future payments");
      end

      find("#paypal-config-vault").click()
      click_option("paypal")

      open_already_logged_in_paypal_flow do
        expect(page).to have_content("future payments");
      end
    end

    it "updates PayPal Credit configuration", :paypal do
      visit_dropin_url("?showUpdatePayPalMenu=true")

      find("#paypal-config-checkout").click()
      click_option("paypalCredit")

      open_popup_and_complete_login do
        expect(page).to_not have_content("future payments");
      end

      find("#paypal-config-vault").click()
      click_option("paypalCredit")

      open_already_logged_in_paypal_flow do
        expect(page).to have_content("future payments");
      end
    end

    it "removes authorized PayPal account when configuration is updated", :paypal do
      visit_dropin_url("?showUpdatePayPalMenu=true")

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
      visit_dropin_url

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
      visit_dropin_url

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
      visit_dropin_url("?container=null&selector=null")

      expect(find("#error")).to have_content("options.container is required.")
    end

    it "requires authorization" do
      visit_dropin_url("?authorization=null")

      expect(find("#error")).to have_content("options.authorization is required.")
    end

    it "does not setup paypal when not configured" do
      visit_dropin_url("?paypal=null&paypalCredit=null")

      expect(page).not_to have_selector(".braintree-option__paypal")
      expect(page).to have_content("Card Number")
      expect(page).to have_content("Expiration Date")
    end

    it "supports locale" do
      visit_dropin_url("?locale=es_ES")

      expect(page).to have_content("Tarjeta")
    end

    it "supports custom locale object" do
      translations = '{"chooseAWayToPay":"My Choose a Way to Pay String"}'
      visit_dropin_url("?translations=#{translations}&locale=es_ES")

      expect(page).to have_content("My Choose a Way to Pay String")
      expect(page).to have_content("Tarjeta")
    end
  end

  describe "payment option priority" do
    it "uses default priority of card, paypal, paypalCredit" do
      visit_dropin_url

      find(".braintree-heading")
      payment_options = all(:css, ".braintree-option__label")

      expect(payment_options[0]).to have_content("Card")
      expect(payment_options[1]).to have_content("PayPal")
      expect(payment_options[2]).to have_content("PayPal Credit")
    end

    it "uses custom priority of paypal, card, paypalCredit" do
      options = '["paypal","card","paypalCredit"]'
      visit_dropin_url("?paymentOptionPriority=#{options}")

      find(".braintree-heading")
      payment_options = all(:css, ".braintree-option__label")

      expect(payment_options[0]).to have_content("PayPal")
      expect(payment_options[1]).to have_content("Card")
      expect(payment_options[2]).to have_content("PayPal Credit")
    end

    it "shows an error when an unrecognized payment option is specified" do
      options = '["dummy","card"]'
      visit_dropin_url("?paymentOptionPriority=#{options}")

      expect(find("#error")).to have_content("paymentOptionPriority: Invalid payment option specified.")
    end
  end

  describe "cardholder name" do
    it "can add a cardholder name field to the card form" do
      options = '{"cardholderName":true}'
      visit_dropin_url("?card=#{options}")

      click_option("card")

      expect(page).to have_content("Cardholder Name")
    end

    it "does not include cardholder name field if not included in config" do
      visit_dropin_url

      click_option("card")

      expect(page).to_not have_content("Cardholder Name")
    end

    it "does not require cardholder name" do
      options = '{"cardholderName":true}'
      visit_dropin_url("?card=#{options}")

      click_option("card")

      hosted_field_send_input("number", "4111111111111111")
      hosted_field_send_input("expirationDate", "1019")
      hosted_field_send_input("cvv", "123")

      expect(page).to have_button('Pay', disabled: false)

      submit_pay

      expect(page).to have_content("ending in 11")
      expect(page).to have_content("Visa")
    end

    it "can set cardholder name to be required" do
      options = '{"cardholderName":{"required":true}}'
      visit_dropin_url("?card=#{options}")

      click_option("card")

      hosted_field_send_input("number", "4111111111111111")
      hosted_field_send_input("expirationDate", "1019")
      hosted_field_send_input("cvv", "123")

      expect(page).to have_button('Pay', disabled: true)

      find(".braintree-form-cardholder-name input").send_keys("First Last")

      expect(page).to have_button('Pay', disabled: false)

      submit_pay

      expect(page).to have_content("ending in 11")
      expect(page).to have_content("Visa")
    end
  end

  describe "Hosted Fields overrides" do
    it "can remove a field from the card form" do
      options = '{"overrides":{"fields":{"cvv":null}}}'
      visit_dropin_url("?card=#{options}")

      click_option("card")

      expect(page).to have_content("Card Number")
      expect(page).to have_content("Expiration Date")
      expect(page).to_not have_content("CVV")
    end

    it "can override field configurations" do
      options = '{"overrides":{"fields":{"cvv":{"placeholder":"my placeholder"}}}}'
      visit_dropin_url("?card=#{options}")

      click_option("card")

      iframe = find("iframe[id='braintree-hosted-field-cvv']")

      within_frame(iframe) do
        expect(find("input").native.attribute("placeholder")).to eq("my placeholder")
      end
    end

    it "can override style configurations" do
      options = '{"overrides":{"styles":{"input":{"font-size":"20px"}}}}'
      visit_dropin_url("?card=#{options}")

      click_option("card")

      iframe = find("iframe[id='braintree-hosted-field-cvv']")

      within_frame(iframe) do
        expect(find("input").native.css_value("font-size")).to eq("20px")
      end
    end
  end
end
