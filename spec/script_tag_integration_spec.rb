require_relative "helpers/drop_in_helper"
require_relative "helpers/paypal_helper"

describe "Drop-in Script Tag Integration" do
  include DropIn
  include PayPal

  it "tokenizes a card" do
    visit_dropin_url("/script-tag-integration.html")

    click_option("card")
    hosted_field_send_input("number", "4111111111111111")
    hosted_field_send_input("expirationDate", "1019")
    hosted_field_send_input("cvv", "123")

    submit_pay

    expect(page).to have_content("Braintree Drop-in Script Tag Result Page")
    expect(page).to have_content("payment_method_nonce:")
  end

  it "tokenizes PayPal", :paypal do
    visit_dropin_url("/script-tag-integration.html")

    click_option("paypal")

    open_popup_and_complete_login

    expect(find(".braintree-heading")).to have_content("Paying with")

    submit_pay

    expect(page).to have_content("Braintree Drop-in Script Tag Result Page")
    expect(page).to have_content("payment_method_nonce:")
  end

  it "does not submit form if card form is invalid" do
    visit_dropin_url("/script-tag-integration.html")

    click_option("card")
    hosted_field_send_input("number", "4111111111111111")

    submit_pay

    expect(page).to_not have_content("Braintree Drop-in Script Tag Result Page")
  end

  it "accepts data attributes as create options" do
    visit_dropin_url("/script-tag-integration.html")

    # Accepts an array for payment option priority
    find(".braintree-heading")
    payment_options = all(:css, ".braintree-option__label")

    expect(payment_options[0]).to have_content("PayPal")
    expect(payment_options[1]).to have_content("Card")
    expect(payment_options[2]).to have_content("PayPal Credit")
  end
end
