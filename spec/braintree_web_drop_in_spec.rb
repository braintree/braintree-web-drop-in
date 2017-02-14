require_relative "helpers/paypal_helper"

HOSTNAME = `hostname`.chomp
PORT = 4567

describe "Drop-in" do
  include PayPal

  before :each do
    visit "http://#{HOSTNAME}:#{PORT}"
  end

  # TODO: Figure out how to focus to Hosted Fields in Drop-in.
  # it "tokenizes a card" do
  #   click_on('Card')
  #
  #   find('label[for="credit-card-number"]').click()
  #   find('iframe[name="braintree-hosted-field-number"]').send_keys('4111111111111111')
  #
  #   find('label[for="expiration"]').click()
  #   find('iframe[name="braintree-hosted-field-expirationDate"]').send_keys('12' + (Time.new.year + 2).to_s[-2..-1])
  #
  #   click_button('Pay')
  #
  #   # Drop-in Details
  #   expect(page).to have_content('Ending in ••11')
  #
  #   # Nonce Details
  #   expect(page).to have_content('CreditCard')
  #   expect(page).to have_content('ending in 11')
  #   expect(page).to have_content('Visa')
  # end

  it "tokenizes PayPal" do
    find(".braintree-option__label", :text => "PayPal").click

    open_popup_and_complete_login

    expect(page).to have_content('bt_buyer_us@paypal.com')
  end

end
