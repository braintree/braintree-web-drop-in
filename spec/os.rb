# adapted from http://stackoverflow.com/a/171011/2601552
module OS
  def OS.windows?
    (/cygwin|mswin|mingw|bccwin|wince|emx/ =~ RUBY_PLATFORM) != nil
  end

  def OS.mac?
   (/darwin/ =~ RUBY_PLATFORM) != nil
  end

  def OS.unix?
    !OS.windows?
  end

  def OS.linux?
    OS.unix? and not OS.mac?
  end

  def OS.get_sauce_bin
    if OS.linux?
      type = "linux"
    elsif OS.mac?
      type = "osx"
    else
      raise "Your OS is not supported for running these tests"
    end

    "./node_modules/sauce-connect-launcher/sc/sc-4.3.13-#{type}/bin/sc"
  end
end
