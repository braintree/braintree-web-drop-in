require_relative "helpers/drop_in_helper"

describe "Drop-in with Data Collector" do
  include DropIn

  it "includes device data in request payment method payload" do
    options = '{"paypal":true}'
    visit_dropin_url("?dataCollector=#{options}")

    click_option("card")
    hosted_field_send_input("number", "4111111111111111")
    hosted_field_send_input("expirationDate", "1019")
    hosted_field_send_input("cvv", "123")

    submit_pay

    expect(page).to have_content('"deviceData": "{\"correlation_id\"')
  end
end
