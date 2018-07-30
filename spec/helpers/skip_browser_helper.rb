module SkipBrowser
  def skip_ie_less_than_11
    browser = page.driver.browser
    browser_name = browser.browser.to_s
    browser_version = browser.capabilities.version.to_i

    if (browser_name == "internet_explorer" and browser_version < 11)
      skip("Not supported in Internet Explorer 9 or 10")
    end
  end
end
