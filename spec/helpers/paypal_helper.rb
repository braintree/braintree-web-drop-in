module PayPal
  def open_popup
    return window_opened_by do
      find(".braintree-sheet__button--paypal").click
    end
  end

  def open_already_logged_in_paypal_flow(&block)
    begin
      within_window open_popup do
        block.call if block

        click_button("confirmButtonTop", wait: 30)
      end
    rescue Capybara::WindowError
      paypal_outer_frame = find(".paypal-checkout-sandbox iframe")

      within_frame paypal_outer_frame do
        inner_frame = find("body iframe")

        within_frame inner_frame do
          block.call if block

          click_button("confirmButtonTop", wait: 30)
        end
      end
    end
  end

  def open_popup_and_complete_login(&block)
    paypal_popup = open_popup

    within_window paypal_popup do
      login_to_paypal

      sleep 1

      block.call if block

      click_button("confirmButtonTop", wait: 30)
    end

    # can take sandbox a while to close
    sleep 4
  end

  def login_to_paypal
    expect(page).to have_text("Pay with PayPal", wait: 30)

    login_iframe = find("#injectedUnifiedLogin iframe")

    within_frame login_iframe do
      fill_in("email", :with => ENV["PAYPAL_USERNAME"])
      fill_in("password", :with => ENV["PAYPAL_PASSWORD"])

      sleep 1

      click_button("btnLogin")
    end

    expect(page).to have_selector("#confirmButtonTop")
  end
end
