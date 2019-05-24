IS_TRAVIS = ENV["IS_TRAVIS"]
PORT = ENV["PORT"] || 4567

module DropIn
  def visit_dropin_url(path = "", ready="ready")
    visit URI.encode("http://#{get_hostname}:#{PORT}#{path}")

    if ready
      expect(page).to have_selector('#ready', :visible => false, :text => ready, :wait => 30)
    end
  end

  def get_hostname
    return `hostname`.chomp if !IS_TRAVIS

    return "braintree-web-dropin.bt.local"
  end

  def click_option(option_type)
    find(".braintree-option__#{option_type} .braintree-option__label").click
  end

  def hosted_field_send_input(key, value)
    field = find("iframe[id='braintree-hosted-field-#{key}']")

    field.click

    page.within_frame field do
      find(".#{key}").send_keys(value)
    end
  end

  def submit_pay
    button = find("input[type='submit']")

    sleep 2

    button.click
  end
end
