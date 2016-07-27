const path = require('path');
const fs = require('fs-extra');
const Plugin = require('broccoli-plugin');
const walkSync = require('walk-sync');
const merge = require('merge').recursive;
const pluginUtils = require('./utils');

// Plugins used by context for input
const Funnel = require('broccoli-funnel');
const Yaml = require('./yaml');
const Version = require('./version');
const Markdown = require('./markdown');
const Href = require('./href');
const Headings = require('./headings');

function createGlobalInputNodes(siteNode) {
  return [
    // Global metadata
    new Yaml(new Funnel(siteNode, { include: [ 'global.meta.yaml' ] })),
    // Git version information
    new Version()
  ];
}

function createLocalInputNodes(pagesNode, siteNode) {
  // Markdown files converted to HTML
  const markdownHtml = new Markdown(new Funnel(pagesNode, { include: [ '**/*.md'] }));

  return [
    // Local metadata
    new Yaml(new Funnel(siteNode, { include: [ '**/*.meta.yaml' ], exclude: [ 'global.meta.yaml', '**/collection.meta.yaml' ] })),
    // Generate hrefs
    new Href(pagesNode),
    // Generate headings from the HTML
    new Headings(markdownHtml),
    // Include HTML to be used as contents
    markdownHtml
  ];
}

/**
 * Plugin that assembles a context object for each page and outputs it to a same-named .json
 * file.
 */
class ContextPlugin extends Plugin {
  constructor(pagesNode, siteNode, options) {
    options = options || {};

    // Create input nodes using functions above
    const globalContext = createGlobalInputNodes(siteNode);
    const localContext = createLocalInputNodes(pagesNode, siteNode);
    super([ pagesNode, ...globalContext, ...localContext ], { annotation: options.annotation });

    // Keep track of where local context nodes begin (+1 to account for pages node at index 0)
    this.localStartIndex = globalContext.length + 1;
  }

  build() {
    // Build the global context object once
    let globalContext = {};

    // For each path in global context nodes
    for (let i = 1; i < this.localStartIndex; i++) {
      // Walk all the files and merge JSON into the global context object
      walkSync(this.inputPaths[i], { directories: false })
        .reduce((acc, globalFile) => {
          let srcPath = path.join(this.inputPaths[i], globalFile);
          merge(acc, JSON.parse(fs.readFileSync(srcPath, 'utf8')));
          return acc;
        }, globalContext);
    }

    // Figure out which local context files belong to which page
    let localContextFiles = {};

    // For each path in the local context nodes
    for (let i = this.localStartIndex; i < this.inputPaths.length; i++) {
      // Walk all files and save the full input file path under the page it belongs to
      walkSync(this.inputPaths[i], { directories: false })
        .reduce((acc, localFile) => {
          // What page does the file belong to?
          let pagePath = pluginUtils.getCanonicalPath(localFile);
          if (acc.hasOwnProperty(pagePath) === false) {
            acc[pagePath] = [];
          }

          // Add to collection for that page
          acc[pagePath].push(path.join(this.inputPaths[i], localFile));
          return acc;
        }, localContextFiles);
    }

    // For each page
    walkSync(this.inputPaths[0], { directories: false }).forEach(pageFile => {
      // Start with global context for the page
      let context = merge({}, globalContext);

      // Merge any local context if available
      let pagePath = pluginUtils.getCanonicalPath(pageFile);
      if (localContextFiles.hasOwnProperty(pagePath)) {
        localContextFiles[pagePath].forEach(localSrcPath => {
          let localFileContents = fs.readFileSync(localSrcPath, 'utf8');

          // Decide what to do with the file
          let ext = path.extname(localSrcPath); 
          switch (ext) {
            case '.json':
              // Just merge into the context
              merge(context, JSON.parse(localFileContents));
              break;
            case '.html':
              // Use as the contents property on the context
              context.contents = localFileContents;
              break;
            default:
              throw new Error(`Unknown local context file extension ${ext} for file ${localSrcPath}`);
          }
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