const path = require('path');
const fs = require('fs-extra');
const Plugin = require('broccoli-plugin');
const walkSync = require('walk-sync');
const merge = require('merge').recursive;
const pluginUtils = require('./utils');

/**
 * Plugin that assembles a context object for each page and outputs it to a same-named .json
 * file.
 */
class ContextPlugin extends Plugin {
  constructor(pagesNode, globalNode, localNode, options) {
    options = options || {};
    
    // Call constructor with concated input nodes
    super([ pagesNode, globalNode, localNode], { annotation: options.annotation });
  }

  build() {
    // Build the global context
    let globalContext = walkSync(this.inputPaths[1], { directories: false })
      .reduce((acc, globalFile) => {
        let srcPath = path.join(this.inputPaths[1], globalFile);
        merge(acc, JSON.parse(fs.readFileSync(srcPath, 'utf8')));
        return acc;
      }, {});
    
    // Figure out which local context files belong to which page
    let localContextFiles = walkSync(this.inputPaths[2], { directories: false })
      .reduce((acc, localFile) => {
        let pagePath = pluginUtils.getCanonicalPath(localFile);
        if (acc.hasOwnProperty(pagePath) === false) {
          acc[pagePath] = [];
        }
        acc[pagePath].push(path.join(this.inputPaths[2], localFile));
        return acc;
      }, {});

    // For each page
    walkSync(this.inputPaths[0], { directories: false }).forEach(pageFile => {
      // Start with global context for the page
      let context = merge({}, globalContext);

      // Merge any local context if available
      let pagePath = pluginUtils.getCanonicalPath(pageFile);
      if (localContextFiles.hasOwnProperty(pagePath)) {
        localContextFiles[pagePath].forEach(localSrcPath => {
          merge(context, JSON.parse(fs.readFileSync(localSrcPath, 'utf8')));
        });
      }

      // Write to output as JSON file
      let destPath = path.join(this.outputPath, pluginUtils.changeFileExtension(pageFile, '.json'));
      fs.mkdirsSync(path.dirname(destPath));
      fs.writeFileSync(destPath, JSON.stringify(context), 'utf8');
    });
  }
}

module.exports = ContextPlugin;