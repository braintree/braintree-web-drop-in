var dotenv = require('dotenv');
var sauceConnectLauncher = require('sauce-connect-launcher');

var config = dotenv.config();

sauceConnectLauncher({
  username: config.SAUCE_USERNAME,
  accessKey: config.SAUCE_ACCESS_KEY
}, function (err, sauceConnectProcess) {
  if (err) {
    console.error(err.message);
    process.exit(1);
  }
  console.log("Sauce Connect ready");
});
