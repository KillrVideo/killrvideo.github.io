const gitRev = require('git-rev');

module.exports = version;

/**
 * Plugin that will attach the git commit hash to global metadata under version.
 */
function version() {
  return function versionPlugin(files, metalsmith, done) {
    let metadata = metalsmith.metadata();
    metadata.version = {};

    gitRev.short(short => {
      metadata.version.short = short;
      gitRev.long(long => {
        metadata.version.long = long;
        done();
      });
    });
  };
}