const resolve = require('resolve');
const path = require('path');
const pluginUtils = require('./plugins/utils');

const Funnel = require('broccoli-funnel');
const Sass = require('broccoli-sass');
const MergeTrees = require('broccoli-merge-trees');

const Yaml = require('./plugins/yaml');
const Version = require('./plugins/version');
const Href = require('./plugins/href');
const Markdown = require('./plugins/markdown');
const MergeJson = require('./plugins/merge-json');
const Template = require('./plugins/template');
const Context = require('./plugins/context');
const NunjucksRender = require('./plugins/nunjucks-render');

const Paths = {
  IMAGES: 'src/images',
  BULMA: path.dirname(resolve.sync('bulma')),
  FONT_AWESOME: path.dirname(resolve.sync('font-awesome/css/font-awesome.css')),
  SASS: 'src/sass',
  SITE: 'src/site',
  LAYOUTS: 'src/layouts',
  SRC: 'src'
};

// Copy images to output as-is
const imageFiles = new Funnel(Paths.IMAGES, {
  destDir: 'images'
});

// Compile SASS to CSS
const cssFiles = new Sass([ Paths.SASS, Paths.BULMA, Paths.FONT_AWESOME ], 'bundle.scss', 'css/bundle.css');

// Markdown and nunjucks pages
const markdownFiles = new Funnel(Paths.SITE, { include: [ '**/*.md' ] });
const nunjucksFiles = new Funnel(Paths.SITE, { include: [ '**/*.nj' ] });
const pageFiles = new MergeTrees([ markdownFiles, nunjucksFiles ]);

// Select a template for each page file
const templates = new Template(pageFiles, Paths.LAYOUTS, {
  defaultLayout: 'base.nj',
  layouts: [
    { pattern: 'docs/**/*.md', layout: 'docs.nj' }
  ]
});

// Convert markdown to HTML
const markdownHtml = new Markdown(markdownFiles, { gfm: true });

// Global context shared by all pages
const globalContext = new MergeJson([
  new Yaml(new Funnel(Paths.SRC, { files: [ 'global.meta.yaml' ] })),
  new Version()
], {
  annotation: 'GlobalContext',
  getOutputPath() { return 'global.json'; }
});

// Local context for each page
const localContext = new MergeJson([
  new Yaml(new Funnel(Paths.SITE, { include: [ '**/*.meta.yaml' ] })),
  new Href(pageFiles)
], {
  annotation: 'LocalContext',
  getOutputPath(relativePath) { return pluginUtils.getBaseFilePath(relativePath) + '.json'; }
});

// Generate context for each page file
const context = new Context(pageFiles, globalContext, localContext);

// Render all page templates using context to produce pages
const pages = new NunjucksRender(templates, Paths.LAYOUTS, markdownHtml, context);

// Merge output
module.exports = new MergeTrees([ imageFiles, cssFiles, pages ]);
