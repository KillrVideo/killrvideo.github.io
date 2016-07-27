const path = require('path');
const fs = require('fs-extra');
const walkSync = require('walk-sync');
const minimatch = require('minimatch');
const Plugin = require('broccoli-plugin');

// Plugins used as input
const Funnel = require('broccoli-funnel');
const Yaml = require('./yaml');
const Collection = require('./collection');

// Glob Patterns used in collection definitions
const Patterns = {
  DOCS_INDEX: 'docs/index.json',
  GUIDES: 'docs/guides/*',
  LANGUAGES: 'docs/languages/*',
  DEVELOPMENT: 'docs/development/*',
  BLOG_INDEX: 'blog/index.json',
  BLOGS: 'blog/*'
};

// Available collections
const collectionDefs = {
  guides: {
    inputFunnel: { include: [ Patterns.GUIDES ] },
    metadata: 'docs/guides/collection.meta.yaml',
    mergeInto: [ Patterns.GUIDES, Patterns.DOCS_INDEX ]
  },
  languages: {
    inputFunnel: { include: [ Patterns.LANGUAGES ] },
    metadata: 'docs/languages/collection.meta.yaml',
    mergeInto: [ Patterns.LANGUAGES, Patterns.DOCS_INDEX ]
  },
  development: {
    inputFunnel: { include: [ Patterns.DEVELOPMENT ] },
    metadata: 'docs/development/collection.meta.yaml',
    mergeInto: [ Patterns.DEVELOPMENT, Patterns.DOCS_INDEX ]
  },
  blog: {
    inputFunnel: { include: [ Patterns.BLOGS ] },
    metadata: 'blog/collection.meta.yaml',
    mergeInto: [ Patterns.BLOG_INDEX ]
  }
};

class CollectionsPlugin extends Plugin {
  constructor(siteNode, contextNode, options) {
    // Build the input nodes based on the collection definitions
    let inputNodes = [ contextNode ];
    let collectionOutput = [];
    Object.keys(collectionDefs).forEach(name => {
      let collectionDef = collectionDefs[name];

      // Create the collection input node
      inputNodes.push(new Collection(
        new Funnel(contextNode, collectionDef.inputFunnel),
        new Yaml(new Funnel(siteNode, { include: [ collectionDef.metadata ] })),
        name
      ));

      collectionOutput.push(collectionDef.mergeInto);
    });

    options = options || {};
    super(inputNodes, { annotation: options.annotation });
    this.collectionOutput = collectionOutput;
  }

  build() {
    // Load the collection objects from input paths
    let collections = [];
    for (let i = 1; i < this.inputPaths.length; i++) {
      let collectionPaths = walkSync(this.inputPaths[i], { directories: false });

      // Sanity check (collection inputs should only output a single JSON file)
      if (collectionPaths.length !== 1) {
        throw new Error('Unexpected multiple input files from collection');
      }
      let collectionPath = path.join(this.inputPaths[i], collectionPaths[0]);
      collections.push(JSON.parse(fs.readFileSync(collectionPath, 'utf8')));
    }

    // For each context object
    walkSync(this.inputPaths[0], { directories: false }).forEach(contextPath => {
      // Test against each collection's output pattern to see if it needs a collection merged
      let mergeWith = this.collectionOutput.reduce((acc, patterns, idx) => {
        if (patterns.findIndex(pattern => minimatch(contextPath, pattern)) !== -1) {
          acc.push(idx);
        }
        return acc;
      }, []);

      let srcPath = path.join(this.inputPaths[0], contextPath);

      // Make sure dest path exists
      let destPath = path.join(this.outputPath, contextPath);
      fs.mkdirsSync(path.dirname(destPath));

      // If it doesn't need to be merged with anything, just copy as-is
      if (mergeWith.length === 0) {
        fs.copySync(srcPath, destPath);
        return;
      }

      // Otherwise, merge all matching collections under a collections property on the context
      let context = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
      context.collections = [];
      mergeWith.forEach(idx => {
        context.collections.push(collections[idx]);
      });

      // Write the new context
      fs.writeFileSync(destPath, JSON.stringify(context), 'utf8');
    });
  }
}

module.exports = CollectionsPlugin;