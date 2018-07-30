module SkipBrowser
  def browser_skip(browser_name, reason)
    browser = page.driver.browser
    detected_browser_name = browser.browser.to_s

    if (detected_browser_name == browser_name)
      skip(reason)
    end
  end
end
