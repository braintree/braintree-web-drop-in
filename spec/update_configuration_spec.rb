require_relative "helpers/paypal_helper"
require_relative "helpers/drop_in_helper"
require_relative "helpers/skip_browser_helper"

describe "Drop-in#updateConfiguration" do
  include SkipBrowser
  include DropIn
  include PayPal

  it "updates PayPal configuration", :paypal do
    skip_ie_less_than_11

    skip "This test fails repeatedly in multiple browsers. Something about opening 2 popups results in Saucelabs having trouble."

    visit_dropin_url("?showUpdatePayPalMenu=true")

    find("#paypal-config-checkout").click()

    sleep 2

    click_option("paypal")

    open_popup_and_complete_login do
      expect(page).to_not have_content("future payments");
    end

    sleep 2

    find("#paypal-config-vault").click()
    click_option("paypal")

    open_already_logged_in_paypal_flow do
      expect(page).to have_content("future payments");
    end
  end

  it "updates PayPal Credit configuration", :paypal do
    skip_ie_less_than_11

    skip "This test fails repeatedly in multiple browsers. Something about opening 2 popups results in Saucelabs having trouble."

    visit_dropin_url("?showUpdatePayPalMenu=true")

    find("#paypal-config-checkout").click()

    sleep 2

    click_option("paypalCredit")

    open_popup_and_complete_login do
      expect(page).to_not have_content("future payments");
    end

    sleep 2

    find("#paypal-config-vault").click()
    click_option("paypalCredit")

    open_already_logged_in_paypal_flow do
      expect(page).to have_content("future payments");
    end
  end

  it "removes authorized PayPal account when configuration is updated", :paypal do
    skip_ie_less_than_11

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
