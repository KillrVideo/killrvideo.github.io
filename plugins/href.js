const fs = require('fs-extra');
const path = require('path');
const Plugin = require('broccoli-plugin');
const walkSync = require('walk-sync');
const pluginUtils = require('./utils');

/**
 * Plugin that outputs JSON file with hrefs for the given pages to same-named files with a
 * .href.json extension.
 */
class Href extends Plugin {
  constructor(pageFilesNode, options) {
    options = options || {};
    super([ pageFilesNode ], { annotation: options.annotation });
  }

  build() {
    // For each page
    walkSync(this.inputPaths[0], { directories: false }).forEach(pageFile => {
      // Generate the hrefs
      let hrefs = {
        source_href: '/' + pageFile.replace(/\\/gi, '/'),
        href: pluginUtils.getCanonicalPath(pageFile)
      };

      // Output to same-named file with .href.json extension
      let destPath = path.join(this.outputPath, pluginUtils.changeFileExtension(pageFile, '.href.json'));
      fs.mkdirsSync(path.dirname(destPath));
      fs.writeFileSync(destPath, JSON.stringify(hrefs), 'utf8');
    });
  }
}

module.exports = Href;