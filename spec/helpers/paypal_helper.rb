module PayPal
  def open_popup
    return window_opened_by do
      find('.paypal-button').click
    end
  end

  def open_popup_and_complete_login
    paypal_popup = open_popup

    within_window paypal_popup do
      wait_for_hermes_sandbox_to_load
      click_link("return_url")
    end
  end

  def wait_for_hermes_sandbox_to_load
    expect(page).to have_text("Mock Sandbox Purchase Flow")
  end
end
