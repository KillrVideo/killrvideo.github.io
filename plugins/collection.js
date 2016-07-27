const Plugin = require('broccoli-plugin');
const path = require('path');
const fs = require('fs-extra');
const walkSync = require('walk-sync');
const merge = require('merge').recursive;

/**
 * Plugin that takes context input JSON files and optional collection.json metadata and creates
 * a [name].json file with the collection object.
 *  {
 *    ... metadata (collection title, etc.) ...
 * 
 *    items: [
 *      { ... context object ... },
 *      { ... context object 2 ... }
 *    ]
 *  }
 */
class CollectionPlugin extends Plugin {
  constructor(inputNode, metadataNode, name, options) {
    options = options || {};

    super([ inputNode, metadataNode ], { annotation: options.annotation });
    this.sortBy = options.sortBy || 'title';
    this.name = name;
  }

  build() {
    // Parse all item files into objects and sort them
    let items = walkSync(this.inputPaths[0], { directories: false })
      .map(itemPath => {
        let fullPath = path.join(this.inputPaths[0], itemPath);
        return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      })
      .sort((a, b) => {
        const prop = this.sortBy;
        if (a[prop] > b[prop]) {
          return 1;
        }
        if (a[prop] < b[prop]) {
          return -1;
        }
        return 0;
      });

    // Merge in any metadata
    let collection = { items };
    walkSync(this.inputPaths[1], { directories: false }).forEach(metaPath => {
      let fullPath = path.join(this.inputPaths[1], metaPath);
      merge(collection, JSON.parse(fs.readFileSync(fullPath, 'utf8')));
    });


    // Write the collection as a [name].json file under the output path
    let destPath = path.join(this.outputPath, `${this.name}.json`);
    fs.mkdirsSync(path.dirname(destPath));
    fs.writeFileSync(destPath, JSON.stringify(collection), 'utf8');
  }
}

module.exports = CollectionPlugin;