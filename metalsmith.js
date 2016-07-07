const path = require('path');
const Metalsmith = require('metalsmith');
const watch = require('metalsmith-watch');
const layouts = require('metalsmith-layouts');
const inPlace = require('metalsmith-in-place');
const nj = require('nunjucks');
const md = require('metalsmith-markdown');
const metafiles = require('metalsmith-metafiles');
const headings = require('metalsmith-headings');
const log = require('./plugins/log');
const globalMetadata = require('./plugins/global-metadata');
const setTitle = require('./plugins/set-title');
const collections = require('./plugins/collections');
const href = require('./plugins/href');
const version = require('./plugins/version');

// Build paths
const Paths = {
  SRC: path.resolve(__dirname, 'src'),
  SITE: path.resolve(__dirname, 'src/site'),
  LAYOUTS: path.resolve(__dirname, 'src/layouts'),
  OUT: path.resolve(__dirname, 'out')
};

// Loader for nunjucks templates
class Loader extends nj.FileSystemLoader {
  constructor(opts) {
    super(Paths.LAYOUTS, opts);
  }
}

/**
 * Do the metalsmith build for the site.
 */

let ms = Metalsmith(__dirname)
  .clean(false)
  .frontmatter(false)
  .source(Paths.SITE)
  .destination(Paths.OUT)
  // Read global metadata from a YAML file
  .use(globalMetadata(Paths.SRC))
  // Add git hash version info
  .use(version())
  // Parse frontmatter metadata from .meta.yaml files instead of the files themselves
  .use(metafiles({ parsers: { ".yaml": true }, onMissingMainFile: 'delete' }))
  // Add an href to the original file
  .use(href('source_href'))
  // Convert markdown files to HTML
  .use(md({ gfm: true }))
  // Add title metadata if not specified
  .use(setTitle())
  // Add files to collections
  .use(collections(Paths.SITE))
  // Add new href now that processing is done
  .use(href('href'))
  // Find all h2 headings in documents
  .use(headings('h2'))
  // Allow nunjucks layouts to be used on all docs pages
  .use(layouts({
    engine: 'nunjucks',
    default: 'docs.nj',
    directory: Paths.LAYOUTS,
    pattern: 'docs/**/*.html',
    rename: true,
    loader: Loader
  }))
  // Convert any nunjucks pages in place to HTML
  .use(inPlace({
    engine: 'nunjucks',
    pattern: '**/*.nj',
    rename: true,
    loader: Loader
  }));

// Should we watch?
if (process.argv.length > 2 && process.argv[2] === '--watch') {
  ms.use(watch());
}

// Execute the build
ms.build(function(err) {
  if (err) throw err;
  console.log('Site build complete');
});
