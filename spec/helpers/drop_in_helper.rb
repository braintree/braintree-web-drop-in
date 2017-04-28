module DropIn
  def click_option(option_type)
    find(".braintree-option__#{option_type} .braintree-option__label").click
  end

  def hosted_field_send_input(key, value)
    find("iframe[id='braintree-hosted-field-#{key}']").click
    find("iframe[id='braintree-hosted-field-#{key}']").send_keys(value)
  end

  def submit_pay
    sleep 1
    find("input[type='submit']").click
  end
end
