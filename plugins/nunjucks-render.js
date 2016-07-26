const fs = require('fs-extra');
const path = require('path');
const nj = require('nunjucks');
const walkSync = require('walk-sync');
const Plugin = require('broccoli-caching-writer');
const pluginUtils = require('./utils');
const minimatch = require('minimatch');

/**
 * Plugin that will render nunjucks templates.
 */
class NunjucksRender extends Plugin {
  constructor(pagesNode, layoutsNode, contextNode, options) {
    if (!options || !options.defaultLayout) throw new Error('Must specify options with default layout');

    options = options || {};
    super([ pagesNode, layoutsNode, contextNode ], { annotation: options.anotation });

    this.defaultLayout = options.defaultLayout;
    this.layouts = options.layouts || [];
  }

  build() {
    // Figure out what templates to use for each page
    let templates = walkSync(this.inputPaths[0], { directories: false })
      .reduce((acc, pageFile) => {
        // Is it a nunjucks file?
        let templatePath;
        if (path.extname(pageFile) === '.nj') {
          // Use it as is
          templatePath = path.join(this.inputPaths[0], pageFile);
        } else {
          // Try to figure out which template to use based on rules passed in via options
          templatePath = this.defaultLayout;
          if (this.layouts.length !== 0) {
            let match = this.layouts.find(l => minimatch(pageFile, l.pattern));
            if (match) templatePath = match.layout;
          }
          // Add layout path to template path to get full path
          templatePath = path.join(this.inputPaths[1], templatePath);
        }

        // Store using template path as key and array of canonical page paths as value
        if (acc.hasOwnProperty(templatePath) === false) {
          acc[templatePath] = [];
        }

        let pagePath = pluginUtils.getCanonicalPath(pageFile);
        acc[templatePath].push(pagePath);

        return acc;
      }, {});

    // Create hash of context by canonical page path
    let contexts = walkSync(this.inputPaths[2], { directories: false })
      .reduce((acc, contextFile) => {
        let pagePath = pluginUtils.getCanonicalPath(contextFile);
        if (acc.hasOwnProperty(pagePath)) {
          throw new Error(`Multiple context files for page ${pagePath}`);
        }
        acc[pagePath] = path.join(this.inputPaths[2], contextFile);
        return acc;
      }, {});

    // Environment that will load layouts from the layout node input path
    let env = new nj.Environment(new nj.FileSystemLoader(this.inputPaths[1]));
    
    // Render templates
    Object.keys(templates).forEach(templateFile => {
      // Create the template and eagerly compile
      let templateFileContents = fs.readFileSync(templateFile, 'utf8');
      let tmpl = new nj.Template(templateFileContents, env, templateFile, true);

      // For each canonical page associated with the template
      let pagePaths = templates[templateFile];
      pagePaths.forEach(pagePath => {
        // Get the context and render to a index.html file at the page path
        let context = JSON.parse(fs.readFileSync(contexts[pagePath], 'utf8'));

        let destPath = path.join(this.outputPath, pagePath, 'index.html');
        fs.mkdirsSync(path.dirname(destPath));
        fs.writeFileSync(destPath, tmpl.render(context), 'utf8');
      });
    });
  }
}

module.exports = NunjucksRender;