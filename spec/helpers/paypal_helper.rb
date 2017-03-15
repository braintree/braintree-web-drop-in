module PayPal
  def open_popup
    return window_opened_by do
      find(".braintree-sheet__button--paypal").click
    end
  end

  def open_popup_and_complete_login
    paypal_popup = open_popup

    within_window paypal_popup do
      login_to_paypal

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
			click_button("btnLogin")
		end

		expect(page).to have_selector("#confirmButtonTop")
  end
end
