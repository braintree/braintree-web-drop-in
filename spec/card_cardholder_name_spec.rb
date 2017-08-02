describe "Drop-in card.cardholderName" do
  include DropIn

  it "can add a cardholder name field to the card form" do
    options = '{"cardholderName":true}'
    visit_dropin_url("?card=#{options}")

    click_option("card")

    expect(page).to have_content("Cardholder Name")
  end

  it "does not include cardholder name field if not included in config" do
    visit_dropin_url

    click_option("card")

    expect(page).to_not have_content("Cardholder Name")
  end

  it "does not require cardholder name" do
    options = '{"cardholderName":true}'
    visit_dropin_url("?card=#{options}")

    click_option("card")

    hosted_field_send_input("number", "4111111111111111")
    hosted_field_send_input("expirationDate", "1019")
    hosted_field_send_input("cvv", "123")

    expect(page).to have_button("Pay", disabled: false)

    submit_pay

    expect(page).to have_content("ending in 11")
    expect(page).to have_content("Visa")
  end

  it "can set cardholder name to be required" do
    options = '{"cardholderName":{"required":true}}'
    visit_dropin_url("?card=#{options}")

    click_option("card")

    hosted_field_send_input("number", "4111111111111111")
    hosted_field_send_input("expirationDate", "1019")
    hosted_field_send_input("cvv", "123")

    expect(page).to have_button('Pay', disabled: true)

    find(".braintree-form-cardholder-name input").send_keys("First Last")

    expect(page).to have_button('Pay', disabled: false)

    submit_pay

    expect(page).to have_content("ending in 11")
    expect(page).to have_content("Visa")
  end
end
