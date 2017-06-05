require_relative "helpers/drop_in_helper"

HOSTNAME = `hostname`.chomp
PORT = 4567

describe "Drop-in Script Tag Integration" do
  include DropIn

  it "tokenizes a card" do
    visit "http://#{HOSTNAME}:#{PORT}/script-tag-integration.html"

    hosted_field_send_input("number", "4111111111111111")
    hosted_field_send_input("expirationDate", "1019")
    hosted_field_send_input("cvv", "123")

    submit_pay

    expect(page).to have_content("Braintree Drop-in Script Tag Result Page")
    expect(page).to have_content("payment_method_nonce:")
  end

  it "does not submit form if card form is invalid" do
    visit "http://#{HOSTNAME}:#{PORT}/script-tag-integration.html"

    hosted_field_send_input("number", "4111111111111111")
    hosted_field_send_input("expirationDate", "1019")

    submit_pay

    expect(page).to_not have_content("Braintree Drop-in Script Tag Result Page")
  end
end
