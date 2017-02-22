module DropIn
  def click_option(option_text)
    find(".braintree-option__label", :text => option_text).click
  end

  def hosted_field_send_input(key, value)
    find("iframe[id='braintree-hosted-field-#{key}']").click
    find("iframe[id='braintree-hosted-field-#{key}']").send_keys(value)
  end

  def submit_pay
    find("input[type='submit']").click
  end
end
