const path = require('path');
const Metalsmith = require('metalsmith');
const watch = require('metalsmith-watch');
const layouts = require('metalsmith-layouts');
const nj = require('nunjucks');
const paths = require('metalsmith-paths');
const md = require('metalsmith-markdown');
const headings = require('metalsmith-headings');

// Build paths
const Paths = {
  SITE: path.resolve(__dirname, 'src/site'),
  LAYOUTS: path.resolve(__dirname, 'src/layouts'),
  OUT: path.resolve(__dirname, 'out')
};

// Global metadata available to all files
const GLOBAL_METADATA = {
  "github_org_url": "https://github.com/KillrVideo",
  "github_site_url": "https://github.com/KillrVideo/killrvideo.github.io"
};

// Loader for nunjucks templates
class Loader extends nj.FileSystemLoader {
  constructor(opts) {
    super(Paths.LAYOUTS, opts);
  }
}

// Helper plugin that will log metadata to the console
function log() {
  return function logMetadata(files) {
    Object.keys(files).forEach(f => {
      let meta = files[f];
      console.log(f);
      Object.keys(meta).forEach(m => {
        if (m === 'content') return;
        console.log('%s: %j', m, meta[m]);
      });
    });
  };
}

/**
 * Do the metalsmith build for the site.
 */

let ms = Metalsmith(__dirname)
  .clean(false)
  .source(Paths.SITE)
  .destination(Paths.OUT)
  .metadata(GLOBAL_METADATA)
  // Add the original path info to metadata before any processing is done
  .use(paths({ property: "original_path" }))
  // Convert markdown files to HTML
  .use(md({ gfm: true }))
  // Extract h1 tags and add to metadata
  .use(headings('h1'))
  // Use handlebars layouts on all site pages
  .use(layouts({
    engine: 'nunjucks',
    default: 'default.nj',
    directory: Paths.LAYOUTS,
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
