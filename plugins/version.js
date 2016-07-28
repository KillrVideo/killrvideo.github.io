const path = require('path');
const fs = require('fs-extra');
const gitRev = require('git-rev');
const Plugin = require('broccoli-plugin');

/**
 * Plugin that writes a version.json file with an object that contains git version information.
 */
class Version extends Plugin {
  constructor(options) {
    options = options || {};
    super([], { annotation: options.annotation, persistentOutput: true });
    this._promise = null;
  }

  build() {
    if (this._promise !== null) return this._promise;

    this._promise = new Promise((resolve, reject) => {
      let metadata = { version: { } };
      gitRev.short(short => {
        metadata.version.short = short;

        gitRev.long(long => {
          metadata.version.long = long;

          // Write to JSON file
          let destPath = path.join(this.outputPath, 'version.json');
          fs.mkdirsSync(path.dirname(destPath));
          fs.writeFileSync(destPath, JSON.stringify(metadata), 'utf8');
          resolve();
        });
      });
    });
    return this._promise;
  }
}

module.exports = Version;