require_relative "helpers/drop_in_helper"
require_relative "helpers/skip_browser_helper"

describe "Drop-in card.cardholderName" do
  include SkipBrowser
  include DropIn

  describe "cardholderName" do
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

      expect(page).to have_button("Pay", disabled: false)

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

      page.within_frame(iframe) do
        expect(find("input").native.attribute("placeholder")).to eq("my placeholder")
      end
    end

    it "can override style configurations" do
      options = '{"overrides":{"styles":{"input":{"font-size":"20px"},".number":{"font-size":"10px"}}}}'
      visit_dropin_url("?card=#{options}")

      click_option("card")

      page.within_frame(find("iframe[id='braintree-hosted-field-cvv']")) do
        expect(find("input").native.css_value("font-size")).to eq("20px")
      end

      page.within_frame(find("iframe[id='braintree-hosted-field-number']")) do
        expect(find("input").native.css_value("font-size")).to eq("10px")
      end
    end
  end

  describe "clearFieldsAfterTokenization" do
    it "does not persist data by default" do
      visit_dropin_url

      click_option("card")

      hosted_field_send_input("number", "4111111111111111")
      hosted_field_send_input("expirationDate", "1019")
      hosted_field_send_input("cvv", "123")

      submit_pay

      expect(find("[data-braintree-id='methods-label']")).to have_content("Paying with")

      find("[data-braintree-id='toggle']").click

      click_option("card")

      expect(page).to have_button("Pay", disabled: true)
    end

    it "persists card data after tokenization if false" do
      options = '{"clearFieldsAfterTokenization":false}'
      visit_dropin_url("?card=#{options}")

      click_option("card")

      hosted_field_send_input("number", "4111111111111111")
      hosted_field_send_input("expirationDate", "1019")
      hosted_field_send_input("cvv", "123")

      submit_pay

      expect(find("[data-braintree-id='methods-label']")).to have_content("Paying with")

      old_nonce = JSON.parse(find("#results").text)["nonce"]

      find("[data-braintree-id='toggle']").click

      click_option("card")

      expect(page).to have_button("Pay", disabled: false)

      submit_pay

      expect(find("[data-braintree-id='methods-label']")).to have_content("Paying with")

      new_nonce = JSON.parse(find("#results").text)["nonce"]

      expect(old_nonce).not_to equal(new_nonce)
    end
  end
end
