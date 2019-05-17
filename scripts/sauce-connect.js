var dotenv = require('dotenv');
var sauceConnectLauncher = require('sauce-connect-launcher');

dotenv.config();

sauceConnectLauncher({
  username: process.env.SAUCE_USERNAME,
  accessKey: process.env.SAUCE_ACCESS_KEY
}, function (err, sauceConnectProcess) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log("Sauce Connect ready");
});
