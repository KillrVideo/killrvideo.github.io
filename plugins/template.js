const path = require('path');
const fs = require('fs-extra');
const Plugin = require('broccoli-plugin');
const walkSync = require('walk-sync');
const minimatch = require('minimatch');

/**
 * Selects a template for each file in the pagesNode and copies to a same-named output file.
 */
class TemplatePlugin extends Plugin {
  constructor(pagesNode, layoutsNode, options) {
    if (!options || !options.defaultLayout) throw new Error('Must specify options with default layout');
    super([ pagesNode, layoutsNode ], { annotation: options.annotation });

    this.defaultLayout = options.defaultLayout;
    this.layouts = options.layouts || [];
  }

  build() {
    // Walk all pages
    walkSync(this.inputPaths[0], { directories: false }).forEach(inputFile => {
      let copyFrom;

      // Is the path already a nunjucks file?
      if (path.extname(inputFile) === '.nj') {
        // Just copy it as-is
        copyFrom = path.join(this.inputPaths[0], inputFile);
      } else {
        // Not a nunjucks file, so try to find a template to use for it based on options
        let layout = this.defaultLayout;
        if (this.layouts.length !== 0) {
          let match = this.layouts.find(l => minimatch(inputFile, l.pattern));
          if (match) layout = match.layout;
        }

        copyFrom = path.join(this.inputPaths[1], layout);
      }

      // Copy to same-named file in output path
      let copyTo = path.join(this.outputPath, inputFile);

      // Copy the template
      fs.mkdirsSync(path.dirname(copyTo));
      fs.copySync(copyFrom, copyTo);
    });
  }
}

module.exports = TemplatePlugin;