require_relative "helpers/paypal_helper"
require_relative "helpers/drop_in_helper"
require_relative "helpers/skip_browser_helper"

describe "Drop-in#clearSelectedPaymentMethod" do
  include SkipBrowser
  include DropIn
  include PayPal

  it "clears active payment method card" do
    visit_dropin_url

    click_option("card")
    hosted_field_send_input("number", "4111111111111111")
    hosted_field_send_input("expirationDate", "1019")
    hosted_field_send_input("cvv", "123")

    submit_pay

    expect(page).to have_selector(".braintree-method.braintree-method--active")

    find("#clear-button").click

    expect(page).to_not have_selector(".braintree-method.braintree-method--active")
  end

  it "clears active payment method card", :paypal do
    visit_dropin_url

    click_option("paypal")

    open_popup_and_complete_login

    submit_pay

    expect(page).to have_selector(".braintree-method.braintree-method--active")

    find("#clear-button").click

    expect(page).to_not have_selector(".braintree-method.braintree-method--active")
  end
end
