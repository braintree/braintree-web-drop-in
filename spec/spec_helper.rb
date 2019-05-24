require "dotenv"
require 'capybara'
require 'capybara/rspec'
require 'selenium-webdriver'
require 'rspec'
require "parallel_tests"
require "rspec/retry"
require 'sauce_whisk'

Dotenv.load

Capybara.default_driver = :selenium
Capybara.default_max_wait_time = 20

SauceWhisk.data_center = :US_WEST

RSpec.configure do |config|
  config.include Capybara::DSL
  config.include Capybara::RSpecMatchers

  # turn off retries by passing DISABLE_RETRIES=true before running test command
  unless ENV["DISABLE_RETRIES"]
    config.verbose_retry = true
    config.around(:each) do |c|
      c.run_with_retry(retry: 2)
    end

    config.around(:each, :paypal) do |c|
      c.run_with_retry(retry: 4, retry_wait: 4)
    end
  end

  config.filter_run_when_matching :only

  if ParallelTests.first_process?
    config.after(:suite) do
      ParallelTests.wait_for_other_processes_to_finish
    end
  end

  config.before(:each) do |test|
    Capybara.register_driver :sauce do |app|
      opt = platform(test.full_description)

      caps = Selenium::WebDriver::Remote::Capabilities.send(opt.delete(:browser_name).to_sym, opt)

      caps['tunnel-identifier'] = ENV['TRAVIS_JOB_NUMBER'] if ENV['TRAVIS_JOB_NUMBER']
      url = 'https://ondemand.saucelabs.com:443/wd/hub'

      Capybara::Selenium::Driver.new(app, browser: :remote,
                                          url: url,
                                          desired_capabilities: caps)
    end
    Capybara.current_driver = :sauce
  end

  config.after(:each) do |test|
    session_id = Capybara.current_session.driver.browser.session_id
    SauceWhisk::Jobs.change_status(session_id, !test.exception)
    Capybara.current_session.quit
  end

  def chrome(name)
    # This is for running Chrome with w3c which is not yet the default
    {
      platform_name: 'Windows 10',
      browser_name: 'chrome',
      "goog:chromeOptions": {w3c: true},
    }.merge(sauce_w3c(name))
  end

  def platform(name)
    case ENV['PLATFORM']
    when 'windows_ie11'
      {
        platform: 'Windows 10',
        browser_name: 'ie',
        browser_version: '11.0'
      }.merge(sauce_w3c(name))
    when 'windows_10_chrome'
      chrome(name)
    when 'mac_mojave_safari'
      {
        platform_name: 'macOS 10.14',
        browser_name: 'safari',
      }.merge(sauce_w3c(name))
    when 'windows_10_ff'
      {
        platform_name: 'Windows 10',
        browser_name: 'firefox',
      }.merge(sauce_w3c(name))
    else
      # Always specify a default
      chrome(name)
    end
  end

  def sauce_w3c(name)
    {
      'sauce:options' => {
        name: name,
        build: build_name,
        username: ENV['SAUCE_USERNAME'],
        access_key: ENV['SAUCE_ACCESS_KEY'],
        iedriver_version: '3.141.59',
        selenium_version: '3.141.59'
      }
    }
  end

  # Note that this build name is specifically for Travis CI execution
  # Most CI tools have ENV variables that can be structured to provide useful build names
  def build_name
    if ENV['TRAVIS_REPO_SLUG']
      "#{ENV['TRAVIS_REPO_SLUG'][%r{[^/]+$}]}: #{ENV['TRAVIS_JOB_NUMBER']}"
    elsif ENV['SAUCE_START_TIME']
      ENV['SAUCE_START_TIME']
    else
      "Braintree Web Drop-in: Local-#{Time.now.to_i}"
    end
  end
end
