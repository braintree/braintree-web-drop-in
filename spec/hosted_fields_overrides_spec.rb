require_relative "helpers/drop_in_helper"
require_relative "helpers/skip_browser_helper"

describe "Drop-in Hosted Fields Overrides" do
  include SkipBrowser
  include DropIn

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
    options = '{"overrides":{"styles":{"input":{"font-size":"20px"},".number":{"font-size":"10px"}}}}'
    visit_dropin_url("?card=#{options}")

    click_option("card")

    within_frame(find("iframe[id='braintree-hosted-field-cvv']")) do
      expect(find("input").native.css_value("font-size")).to eq("20px")
    end

    within_frame(find("iframe[id='braintree-hosted-field-number']")) do
      expect(find("input").native.css_value("font-size")).to eq("10px")
    end
  end
end
