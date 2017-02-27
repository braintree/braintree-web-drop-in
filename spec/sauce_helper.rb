# File must reside at this location as the path is hardcoded in Sauce Parallel gem
#
# You should edit this file with the browsers you wish to use
# For options, check out http://saucelabs.com/docs/platforms
require "sauce"
require "sauce/capybara"
require_relative "./os"

tunnel_id = "braintree-web-drop-in"

PLATFORM = ENV["PLATFORM"]

def select_browsers
  browsers = []

  if !PLATFORM || PLATFORM == "desktop"
    browsers += [
      # ["Windows 10", "chrome", nil],
      # ["Windows 10", "firefox", 47],
      # ["OS X 10.11", "safari", nil],
      # ["Windows 7", "internet explorer", "9"],
      # ["Windows 8", "internet explorer", "10"],
      ["Windows 10", "internet explorer", "11"],
    ]
  end

  if !PLATFORM || PLATFORM == "ios"
    browsers += [
      # ["OS X 10.10", "iphone", "9.2"],
    ]
  end

  browsers
end

Capybara.default_driver = :sauce
Sauce.config do |c|
  c[:job_name] = tunnel_id
  c[:application_host] = "https://#{`hostname`}"
  c[:application_port] = 4443
  c[:start_local_application] = false
  c[:start_tunnel] = true
  c[:connect_options] = {
    :tunnel_identifier => tunnel_id,
    :se_port => 4443
  }
  c["tunnel-identifier"] = tunnel_id
  c[:sauce_connect_4_executable] = OS.get_sauce_bin
  c[:browsers] = select_browsers
end
