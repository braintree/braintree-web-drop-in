# adapted from https://github.com/saucelabs-sample-test-frameworks/Ruby-RSpec-Capybara/blob/680e533d80fa850a6906dd383d7440367a65bb30/Rakefile

require 'rspec/core/rake_task'

#
# For use in building a unique Build Name for running tests in parallel on Sauce Labs from a local machine
#
ENV['SAUCE_START_TIME'] = "Restricted Input: Local-#{Time.now.to_i}"

PORT = ENV['PORT'] || 3099
SAUCE_CONNECT_PORT = 4445

@build_success = true

PLATFORMS = {
  "windows_ie9" => "Windows 7 IE9",
  "windows_ie10" => "Windows 8.1 IE10",
  "windows_ie11" => "Windows 10 IE11",
  "windows_10_chrome" => "Windows 10 Chrome",
  "windows_10_ff" => "Windows 10 Firefox",
  "mac_mojave_safari" => "Mac OS 10.14 Safari"
}

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

def wait_port(port)
  loop do
    `lsof -i :#{port}`
    sleep 2
    break if $? == 0
  end
end

PLATFORMS.each do |platform_key, browser_name|
  desc "Run tests using #{browser_name}"
  task platform_key do
    ENV['PLATFORM'] = platform_key
    begin
      @result = system 'rspec spec/restricted_input_spec.rb'
    ensure
      @build_success &= @result
    end
  end
end

desc "Starts up demo app and sauceconnect process"
task "setup_tests" do
  spawn_until_port("npm run development", PORT)
  spawn_until_port("npm run sauceconnect", SAUCE_CONNECT_PORT)
end

desc "Kills app and sauceconnect process"
task "teardown_tests" do
  $pids.each do |pid|
    Process.kill("INT", pid)
  end
end

desc "Run all browser tests"
multitask "all_browsers": PLATFORMS.keys do
  begin
    raise StandardError, 'Tests failed!' unless @build_success
  ensure
    @build_success &= @result
  end
end

task "test" => ["setup_tests", "all_browsers", "teardown_tests"]

task :default => [:test]
