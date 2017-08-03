require_relative "helpers/paypal_helper"
require_relative "helpers/drop_in_helper"
require_relative "helpers/skip_browser_helper"

describe "Drop-in events" do
  include SkipBrowser
  include DropIn
  include PayPal

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
