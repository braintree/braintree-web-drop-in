const { execSync } = require('child_process');
const fs = require('fs');
const { dependencies } = require('../../package.json');
const dependencyNames = Object.keys(dependencies);
const dependencyPackages = Object.entries(dependencies).map(([name, version]) => {
  const result = execSync(`npm view --json ${name}@${version} dependencies`).toString();

  return [name, result ? JSON.parse(result) : {}];
});

describe.each(dependencyPackages)('Shared dependency %s', (name, deps) => {
  it('requests a specific version', () => {
    expect(Array.isArray(deps)).toBeFalsy();
  });

  const sharedDeps = Object.entries(deps).filter(([depName]) => dependencyNames.includes(depName));

  if (sharedDeps.length > 0) {
    it.each(sharedDeps)('uses %s@%s', sharedName => {
      expect(() => { fs.statSync(`./node_modules/${name}/node_modules/${sharedName}`); }).toThrow();
    });
  }
});
