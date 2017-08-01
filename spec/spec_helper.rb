require "sauce"
require "dotenv"
require "capybara/rspec"
require "parallel_tests"
require "rspec/retry"

Dotenv.load

HOSTNAME = `hostname`.chomp
PORT = ENV["PORT"] || 4567 if PORT.nil?
PLATFORM = ENV["PLATFORM"] if PLATFORM.nil?
RUN_PAYPAL_ONLY = ENV["RUN_PAYPAL_ONLY"]
SKIP_PAYPAL = ENV["SKIP_PAYPAL"]

Capybara.default_driver = :selenium
Capybara.app_host = "https://#{HOSTNAME}:#{PORT}"
Capybara.default_max_wait_time = 20

require_relative "sauce_helper"

$pids = []

def spawn_until_port(cmd, port)
  `lsof -i :#{port}`
  if $? != 0
    puts "[STARTING] #{cmd} on #{port}"
    $pids.push spawn(cmd, :out => "/dev/null")
    wait_port(port)
  end
  puts "[RUNNING] #{cmd} on #{port}"
end

def download_sauce_connect
  puts "[DOWNLOADING] Sauce connect"
  `node -e "require('sauce-connect-launcher').download(function () {});"`
  puts "[DOWNLOADED] Sauce connect"
end

def should_run_on_sauce(metadata)
  return metadata.include?(:paypal) if RUN_PAYPAL_ONLY

  return true
end

def wait_port(port)
  loop do
    `lsof -i :#{port}`
    sleep 2
    break if $? == 0
  end
end

RSpec.configure do |config|
  config.include(Capybara::DSL)

  config.verbose_retry = true
  config.around(:each) do |c|
    c.run_with_retry(retry: 2)
  end

  config.around(:each, :paypal) do |c|
    if PLATFORM == 'ie-desktop'
      retry_count = 6
    else
      retry_count = 4
    end

    c.run_with_retry(retry: retry_count, retry_wait: 4)
  end

  if ParallelTests.first_process?
    config.before(:suite) do
      download_sauce_connect
      spawn_until_port("npm run development", PORT)
      Sauce::Utilities::Connect.start
    end

    config.after(:suite) do
      ParallelTests.wait_for_other_processes_to_finish
      $pids.each do |pid|
        Process.kill("INT", pid)
      end
      Sauce::Utilities::Connect.close
    end
  else
    config.before(:suite) do
      wait_port PORT
    end
  end

  config.define_derived_metadata(:file_path => %r{/spec}) do |metadata|
    metadata[:sauce] = true if should_run_on_sauce(metadata)
  end

  config.filter_run_excluding :paypal => true if SKIP_PAYPAL
end
