const { execSync } = require('child_process');
const fs = require('fs');
const { dependencies } = require('../../package.json');
const dependencyNames = Object.keys(dependencies);
const dependencyPackages = dependencyNames.map(depName => {
  let depPackages = {};
  const depVersion = dependencies[depName];
  const cmd = `npm view --json ${depName}@${depVersion} dependencies`;
  const result = execSync(cmd).toString();

  if (result) {
    depPackages = JSON.parse(result);
  }

  return {
    name: depName,
    dependencies: depPackages
  };
});

describe('Shared dependency', () => {
  dependencyPackages.forEach(depPkg => {
    describe(depPkg.name, () => {
      const sharedDependencyNames = Object.keys(depPkg.dependencies).filter(d => dependencyNames.indexOf(d) !== -1);

      sharedDependencyNames.forEach(sharedDepName => {
        const sharedDepVersion = depPkg.dependencies[sharedDepName];

        it(`uses ${sharedDepName}@${sharedDepVersion}`, done => {
          const nestedNodeModulePath = `./node_modules/${depPkg.name}/node_modules/`;

          fs.exists(nestedNodeModulePath + sharedDepName, exists => {
            if (exists) {
              done(new Error(`Found ${sharedDepName} with a different version in ${depPkg.name}`));
            } else {
              done();
            }
          });
        });
      });
    });
  });
});
