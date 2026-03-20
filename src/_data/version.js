const { execSync } = require('child_process');
module.exports = function() {
  return {
    short: execSync('git rev-parse --short HEAD').toString().trim(),
    long: execSync('git rev-parse HEAD').toString().trim()
  };
};
