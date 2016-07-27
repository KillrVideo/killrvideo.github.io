const resolve = require('resolve');
const path = require('path');
const pluginUtils = require('./plugins/utils');

const Funnel = require('broccoli-funnel');
const Sass = require('broccoli-sass');
const MergeTrees = require('broccoli-merge-trees');

const Context = require('./plugins/context');
const CollectionsPlugin = require('./plugins/collections');
const NunjucksRender = require('./plugins/nunjucks-render');

const Paths = {
  IMAGES: 'src/images',
  BULMA: path.dirname(resolve.sync('bulma')),
  FONT_AWESOME: path.dirname(resolve.sync('font-awesome/css/font-awesome.css')),
  SASS: 'src/sass',
  SITE: 'src/site',
  LAYOUTS: 'src/layouts',
};

// Copy images to output as-is
const imageFiles = new Funnel(Paths.IMAGES, {
  destDir: 'images'
});

// Compile SASS to CSS
const cssFiles = new Sass([ Paths.SASS, Paths.BULMA, Paths.FONT_AWESOME ], 'bundle.scss', 'css/bundle.css');

// Pages are all markdown and nunjucks files under the site node
const pageFiles = new Funnel(Paths.SITE, { include: [ '**/*.md', '**/*.nj' ] });

// Generate context for each page file to be used when rendering
const contextFiles = new Context(pageFiles, Paths.SITE);

// Use context to generate collections and create (possibly) new context for the pages that need it
const contextWithCollections = new CollectionsPlugin(Paths.SITE, contextFiles);

// Render all page files using context to produce pages
const pages = new NunjucksRender(pageFiles, Paths.LAYOUTS, contextWithCollections, {
  defaultLayout: 'base.nj',
  layouts: [
    { pattern: 'docs/**/*.md', layout: 'docs.nj' }
  ]
});

// Merge output
module.exports = new MergeTrees([ imageFiles, cssFiles, pages ]);
