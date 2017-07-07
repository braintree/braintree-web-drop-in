'use strict';

var dependencies = require('../../package.json').dependencies;
var dependencyNames = Object.keys(dependencies);
var packages = dependencyNames.filter(function (d) {
  // Remove scoped packages
  return d[0] !== '@';
});

describe('Shared dependency', function () {
  packages.forEach(function (pkgName) {
    describe(pkgName, function () {
      var pkgDependencies = require('../../node_modules/' + pkgName + '/package.json').dependencies;
      var sharedDependencyNames = Object.keys(pkgDependencies).filter(function (d) {
        return dependencyNames.indexOf(d) !== -1;
      });

      sharedDependencyNames.forEach(function (sharedDepName) {
        var sharedDepVersion = pkgDependencies[sharedDepName];

        it('uses ' + sharedDepName + '@' + sharedDepVersion, function () {
          var dependencyVersion = dependencies[sharedDepName];

          if (sharedDepVersion !== dependencyVersion) {
            throw new Error(pkgName + ' should be using ' + sharedDepName + '@' + dependencyVersion + ' but was ' + sharedDepVersion);
          }
        });
      });
    });
  });
});
