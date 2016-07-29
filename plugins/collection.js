const Plugin = require('broccoli-plugin');
const path = require('path');
const fs = require('fs-extra');
const walkSync = require('walk-sync');
const merge = require('merge').recursive;

/**
 * Returns a sorting function that sorts by the given prop's value.
 */
function sortByProp(prop) {
  return (a, b) => {
    if (a[prop] > b[prop]) {
      return 1;
    }
    if (a[prop] < b[prop]) {
      return -1;
    }
    return 0;
  };
}

function sortBySpecifiedOrder(order) {
  // Create a hash keyed by page name with the index in the order as the value
  let m = order.reduce((map, page, idx) => {
    map[page] = idx;
    return map;
  }, {});

  return (a, b) => {
    // Get the original file name from each item's source href and look up index in the map
    let aIdx = m[path.basename(a.source_href)];
    let bIdx = m[path.basename(b.source_href)];

    // Always sort docs with values to the top
    if (aIdx !== undefined && bIdx === undefined) return -1;
    if (aIdx === undefined && bIdx !== undefined) return 1;

    // Regular comparison
    if (aIdx < bIdx) return -1;
    if (bIdx < aIdx) return 1;
    return 0;
  };
}

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
    this.name = name;
  }

  build() {
    let collection = {};

    // Get any metadata
    walkSync(this.inputPaths[1], { directories: false }).forEach(metaPath => {
      let fullPath = path.join(this.inputPaths[1], metaPath);
      merge(collection, JSON.parse(fs.readFileSync(fullPath, 'utf8')));
    });

    // Was sorting of items specified in metadata?
    let sortBy;
    if (collection.hasOwnProperty('sort_by')) {
      if (Array.isArray(collection.sort_by)) {
        // If an array, assume they've specified an order for at least some of the pages
        sortBy = sortBySpecifiedOrder(collection.sort_by);
      } else {
        // Assume sortBy in metadata is a prop name
        sortBy = sortByProp(collection.sort_by);
      }
      delete collection.sort_by;
    } else {
      // Default to sorting by title
      sortBy = sortByProp('title');
    }

    // Parse all item files into objects and sort them
    collection.items = walkSync(this.inputPaths[0], { directories: false })
      .map(itemPath => {
        let fullPath = path.join(this.inputPaths[0], itemPath);
        return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      })
      .sort(sortBy);

    // Write the collection as a [name].json file under the output path
    let destPath = path.join(this.outputPath, `${this.name}.json`);
    fs.mkdirsSync(path.dirname(destPath));
    fs.writeFileSync(destPath, JSON.stringify(collection), 'utf8');
  }
}

module.exports = CollectionPlugin;