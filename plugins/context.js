const path = require('path');
const fs = require('fs-extra');
const Plugin = require('broccoli-plugin');
const walkSync = require('walk-sync');
const merge = require('merge').recursive;

/**
 * Plugin that assembles a context object for each page and outputs it as JSON to a file.
 */
class ContextPlugin extends Plugin {
  constructor(pagesNode, contextNodes, options) {
    options = options || {};
    
    // Start with just pages as input nodes, then add any context nodes
    let inputNodes = [ pagesNode ];
    Array.prototype.push.apply(inputNodes, contextNodes);

    // Call constructor with concated input nodes
    super(inputNodes, { annotation: options.annotation });
  }

  build() {
    // Context paths are all input paths except the first one which is the pages
    let contextPaths = this.inputPaths.slice(1).reduce((acc, contextPath) => {
      // Walk all files in the context path and add any files found to the accumulator. We should end up with
      // an object where the keys are the file name and the values are an array of context file absolute paths
      // { 
      //   "index.nj": [ "/path/to/context/index.nj", "/path/to/other/index.nj" ],
      //   "blog/index.nj": [ "/path/to/context/blog/index.nj" ] 
      // }
      walkSync(contextPath, { directories: false }).forEach(contextFile => {
        if (!acc[contextFile]) {
          acc[contextFile] = [];
        }
        acc[contextFile].push(path.join(contextPath, contextFile));
      });
      return acc;
    }, {});

    // For each page
    walkSync(this.inputPaths[0], { directories: false }).forEach(page => {
      // Look for context paths
      let context = {};
      if (contextPaths.hasOwnProperty(page)) {
        // Read each context file from JSON, then merge into context object
        contextPaths[page].forEach(contextFile => {
          merge(context, JSON.parse(fs.readFileSync(contextFile, 'utf8')));
        });
      }

      // Write the context as JSON
      let destPath = path.join(this.outputPath, page);
      fs.mkdirsSync(path.dirname(destPath));
      fs.writeFileSync(destPath, JSON.stringify(context));
    });
  }
}

module.exports = ContextPlugin;