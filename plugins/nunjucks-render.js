const fs = require('fs-extra');
const path = require('path');
const nj = require('nunjucks');
const walkSync = require('walk-sync');
const Plugin = require('broccoli-caching-writer');
const pluginUtils = require('./utils');

/**
 * Returns a reduce function for grouping files based on the canonical path of a file.
 */
function groupByCanonicalPath(inputPath, prop, throwIfNotFound) {
  return (acc, file) => {
    let pagePath = pluginUtils.getCanonicalPath(file);
    if (acc.hasOwnProperty(pagePath) === false) {
      if (throwIfNotFound) {
        throw new Error(`Cannot set prop ${prop} because page ${pagePath} doesn't exist.`)
      }

      acc[pagePath] = {};
    }
    acc[pagePath][prop] = path.join(inputPath, file);
    return acc;
  };
}

/**
 * Plugin that will render nunjucks templates.
 */
class NunjucksRender extends Plugin {
  constructor(templatesNode, layoutsNode, contentsNode, contextNode, options) {
    options = options || {};
    super([ templatesNode, layoutsNode, contentsNode, contextNode ], { annotation: options.anotation });

    this.options = options;
  }

  build() {
    // Environment that will load layouts from the layout node input path
    let env = new nj.Environment(new nj.FileSystemLoader(this.inputPaths[1]));

    // Match up templates, contents, and context based on the canonical path
    let templateAndContext = walkSync(this.inputPaths[0], { directories: false })
      .reduce(groupByCanonicalPath(this.inputPaths[0], 'templateSrcPath', false), {});
    
    walkSync(this.inputPaths[2], { directories: false })
      .reduce(groupByCanonicalPath(this.inputPaths[2], 'contentsSrcPath', true), templateAndContext);

    walkSync(this.inputPaths[3], { directories: false })
      .reduce(groupByCanonicalPath(this.inputPaths[3], 'contextSrcPath', true), templateAndContext);

    // Render templates at canonical path as index.html files
    Object.keys(templateAndContext).forEach(pagePath => {
      let { templateSrcPath, contentsSrcPath, contextSrcPath } = templateAndContext[pagePath];
      let template = fs.readFileSync(templateSrcPath, 'utf8');
      let context = JSON.parse(fs.readFileSync(contextSrcPath, 'utf8'));
      if (contentsSrcPath) {
        context.contents = fs.readFileSync(contentsSrcPath, 'utf8');
      }

      let destPath = path.join(this.outputPath, pagePath, 'index.html');
      fs.mkdirsSync(path.dirname(destPath));
      fs.writeFileSync(destPath, env.renderString(template, context), 'utf8');
    });
  }
}

module.exports = NunjucksRender;