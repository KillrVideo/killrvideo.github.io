const path = require('path');
const Metalsmith = require('metalsmith');
const watch = require('metalsmith-watch');

// Build paths
const Paths = {
  SRC: path.resolve(__dirname, 'src/site'),
  OUT: path.resolve(__dirname, 'out')
};

/**
 * Do the metalsmith build for the site.
 */

let ms = Metalsmith(__dirname)
  .clean(false)
  .source(Paths.SRC)
  .destination(Paths.OUT);

// Should we watch?
if (process.argv.length > 2 && process.argv[2] === '--watch') {
  ms.use(watch());
}

// Execute the build
ms.build(function(err) {
  if (err) throw err;
  console.log('Build complete');
});
