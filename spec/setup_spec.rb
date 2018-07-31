require_relative "helpers/paypal_helper"
require_relative "helpers/drop_in_helper"
require_relative "helpers/skip_browser_helper"

describe "Drop-in#create" do
  include SkipBrowser
  include DropIn
  include PayPal

  it "requires a selector or container" do
    visit_dropin_url("?container=null&selector=null", "error")

    expect(find("#error")).to have_content("options.container is required.")
  end

  it "requires authorization" do
    visit_dropin_url("?authorization=null", "error")

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

  it "uses default priority of card, paypal, paypalCredit" do
    visit_dropin_url

    find("[data-braintree-id='choose-a-way-to-pay']")
    payment_options = all(:css, ".braintree-option__label")

    expect(payment_options[0]).to have_content("Card")
    expect(payment_options[1]).to have_content("PayPal")
    expect(payment_options[2]).to have_content("PayPal Credit")
  end

  it "uses custom priority of paypal, card, paypalCredit" do
    options = '["paypal","card","paypalCredit"]'
    visit_dropin_url("?paymentOptionPriority=#{options}")

    find("[data-braintree-id='choose-a-way-to-pay']")
    payment_options = all(:css, ".braintree-option__label")

    expect(payment_options[0]).to have_content("PayPal")
    expect(payment_options[1]).to have_content("Card")
    expect(payment_options[2]).to have_content("PayPal Credit")
  end

  it "shows an error when an unrecognized payment option is specified" do
    options = '["dummy","card"]'
    visit_dropin_url("?paymentOptionPriority=#{options}", "error")

    expect(find("#error")).to have_content("paymentOptionPriority: Invalid payment option specified.")
  end
end
