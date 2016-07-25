const fs = require('fs-extra');
const path = require('path');
const nj = require('nunjucks');
const walkSync = require('walk-sync');
const Plugin = require('broccoli-caching-writer');
const pluginUtils = require('./utils');

class NunjucksRender extends Plugin {
  constructor(templatesNode, layoutsNode, contextNode, options) {
    options = options || {};
    super([ templatesNode, layoutsNode, contextNode ], { annotation: options.anotation });

    this.options = options;
  }

  build() {
    // Environment that will load layouts from the layout node input path
    let env = new nj.Environment(new nj.FileSystemLoader(this.inputPaths[1]));

    // Match up templates and context based on the canonical path
    let templateAndContext = walkSync(this.inputPaths[0], { directories: false })
      .reduce((acc, templateFile) => {
        let pagePath = pluginUtils.getCanonicalPath(templateFile);
        if (acc.hasOwnProperty(pagePath) === false) {
          acc[pagePath] = {};
        }
        acc[pagePath].templateSrcPath = path.join(this.inputPaths[0], templateFile);
        return acc;
      }, {});

    walkSync(this.inputPaths[2], { directories: false })
      .reduce((acc, contextFile) => {
        let pagePath = pluginUtils.getCanonicalPath(contextFile);
        if (acc.hasOwnProperty(pagePath) === false) {
          throw new Error(`Found context ${contextFile} without a template`);
        }
        acc[pagePath].contextSrcPath = path.join(this.inputPaths[2], contextFile);
        return acc;
      }, templateAndContext);

    // Render templates at canonical path as index.html files
    Object.keys(templateAndContext).forEach(pagePath => {
      let { templateSrcPath, contextSrcPath } = templateAndContext[pagePath];
      let template = fs.readFileSync(templateSrcPath, 'utf8');
      let context = JSON.parse(fs.readFileSync(contextSrcPath, 'utf8'));

      let destPath = path.join(this.outputPath, pagePath, 'index.html');
      fs.mkdirsSync(path.dirname(destPath));
      fs.writeFileSync(destPath, env.renderString(template, context), 'utf8');
    });
  }
}

module.exports = NunjucksRender;