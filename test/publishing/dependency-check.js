
var execSync = require('child_process').execSync;
var fs = require('fs');

var dependencies = require('../../package.json').dependencies;
var dependencyNames = Object.keys(dependencies);
var dependencyPackages = dependencyNames.map(function (depName) {
  var depPackages = {};
  var depVersion = dependencies[depName];
  var cmd = 'npm view --json ' + depName + '@' + depVersion + ' dependencies';
  var result = execSync(cmd).toString();

  if (result) {
    depPackages = JSON.parse(result);
  }

  return {
    name: depName,
    dependencies: depPackages
  };
});

describe('Shared dependency', function () {
  dependencyPackages.forEach(function (depPkg) {
    describe(depPkg.name, function () {
      var sharedDependencyNames = Object.keys(depPkg.dependencies).filter(function (d) {
        return dependencyNames.indexOf(d) !== -1;
      });

      sharedDependencyNames.forEach(function (sharedDepName) {
        var sharedDepVersion = depPkg.dependencies[sharedDepName];

        it('uses ' + sharedDepName + '@' + sharedDepVersion, function (done) {
          var nestedNodeModulePath = './node_modules/' + depPkg.name + '/node_modules/';

          fs.exists(nestedNodeModulePath + sharedDepName, function (exists) {
            if (exists) {
              done(new Error('Found ' + sharedDepName + ' with a different version in ' + depPkg.name));
            } else {
              done();
            }
          });
        });
      });
    });
  });
});
