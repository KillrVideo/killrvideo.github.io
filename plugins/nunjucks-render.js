const fs = require('fs');
const path = require('path');
const nj = require('nunjucks');
const walkSync = require('walk-sync');
const mkdirp = require('mkdirp');
const Plugin = require('broccoli-caching-writer');

class NunjucksRender extends Plugin {
  constructor(templatesNode, layoutsNode, options) {
    options = options || {};
    super([ templatesNode, layoutsNode ], { annotation: options.anotation });

    this.options = options;
  }

  build() {
    // Environment that will load layouts from the layout node input path
    let env = new nj.Environment(new nj.FileSystemLoader(this.inputPaths[1]));

    walkSync(this.inputPaths[0], { directories: false }).forEach(templatePath => {
      // Read the template contents and render
      let srcPath = path.join(this.inputPaths[0], templatePath);
      let contents = fs.readFileSync(srcPath, 'utf-8');
      let output = env.renderString(contents, {});

      // Create output folder if not exists
      let destPath = path.parse(path.join(this.outputPath, templatePath));
      mkdirp.sync(destPath.dir);

      // Change file extension to HTML and write
      fs.writeFileSync(path.format({ dir: destPath.dir, name: destPath.name, ext: '.html' }), output);
    });
  }
}

module.exports = NunjucksRender;