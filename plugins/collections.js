const path = require('path');
const collections = require('metalsmith-collections');

module.exports = collectionsPlugin;

/**
 * Returns the metalsmith collections plugin with the appropriate settings.
 */
function collectionsPlugin(sitePath) {
  const settings = {
    guides: {
      pattern: 'docs/guides/*.html',
      sortBy: 'title',
      metadata: path.resolve(sitePath, 'docs/guides/collection.meta.yaml')
    },
    languages: {
      pattern: 'docs/languages/*.html',
      sortBy: 'title',
      metadata: path.resolve(sitePath, 'docs/languages/collection.meta.yaml')
    },
    development: {
      pattern: 'docs/development/*.html',
      sortBy: 'title',
      metadata: path.resolve(sitePath, 'docs/development/collection.meta.yaml')
    }
  };

  return collections(settings);
}