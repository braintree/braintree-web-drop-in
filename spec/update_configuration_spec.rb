require_relative "helpers/paypal_helper"
require_relative "helpers/drop_in_helper"
require_relative "helpers/skip_browser_helper"

describe "Drop-in#updateConfiguration" do
  include SkipBrowser
  include DropIn
  include PayPal

  it "updates PayPal configuration", :paypal do
    visit_dropin_url("?showUpdatePayPalMenu=true")

    sleep 2

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
    visit_dropin_url("?showUpdatePayPalMenu=true")

    sleep 2

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
