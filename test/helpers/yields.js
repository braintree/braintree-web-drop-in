function baseYields(async, originalFunctionArgs, callbackArgs) {
  // eslint-disable-next-line no-warning-comments
  // TODO this should probably just be grabbing the last argument instead
  originalFunctionArgs.some(arg => {
    if (typeof arg === 'function') {
      if (async) {
        process.nextTick(() => {
          arg.apply(null, callbackArgs);

          return true;
        });
      } else {
        arg.apply(null, callbackArgs);

        return true;
      }
    }

    return false;
  });
}

function yields(...callbackArgs) {
  return (...originalFunctionArgs) => {
    baseYields(false, originalFunctionArgs, callbackArgs);
  };
}

function yieldsAsync(...callbackArgs) {
  return (...originalFunctionArgs) => {
    baseYields(true, originalFunctionArgs, callbackArgs);
  };
}

module.exports = {
  yields,
  yieldsAsync
};
