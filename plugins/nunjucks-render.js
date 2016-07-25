const fs = require('fs-extra');
const path = require('path');
const nj = require('nunjucks');
const walkSync = require('walk-sync');
const Plugin = require('broccoli-caching-writer');

class NunjucksRender extends Plugin {
  constructor(templatesNode, layoutsNode, contextNode, options) {
    options = options || {};
    super([ templatesNode, layoutsNode, contextNode ], { annotation: options.anotation });

    this.options = options;
  }

  build() {
    // Environment that will load layouts from the layout node input path
    let env = new nj.Environment(new nj.FileSystemLoader(this.inputPaths[1]));

    let contexts = walkSync(this.inputPaths[2], { directories: false })
      .reduce((acc, contextFile) => {
        acc[contextFile] = path.join(this.inputPaths[2], contextFile);
        return acc;
      }, {});

    walkSync(this.inputPaths[0], { directories: false }).forEach(templatePath => {
      // Read the template contents
      let srcPath = path.join(this.inputPaths[0], templatePath);
      let template = fs.readFileSync(srcPath, 'utf8');

      // Get the context
      if (contexts.hasOwnProperty(templatePath) === false) {
        throw new Error(`Could not find context for template ${templatePath}`);
      }
      let context = contexts[templatePath];

      // Create output folder if not exists
      let destPath = path.parse(path.join(this.outputPath, templatePath));
      fs.mkdirsSync(destPath.dir);

      // Change file extension to HTML and render
      fs.writeFileSync(path.format({ dir: destPath.dir, name: destPath.name, ext: '.html' }), env.renderString(template, context));
    });
  }
}

module.exports = NunjucksRender;