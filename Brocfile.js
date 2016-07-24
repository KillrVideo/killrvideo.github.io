const Funnel = require('broccoli-funnel');
const Sass = require('broccoli-sass');
const Markdown = require('broccoli-marked');
const MergeTrees = require('broccoli-merge-trees');

const Paths = {
  NODE_MODULES: 'node_modules',
  IMAGES: 'src/images',
  SASS: 'src/sass',
  SITE: 'src/site'
};

// Copy images to output as-is
const imageFiles = new Funnel(Paths.IMAGES, {
  destDir: 'images'
});

// Compile SASS to CSS
const cssFiles = new Sass([ Paths.SASS, Paths.NODE_MODULES ], 'bundle.scss', 'css/bundle.css');

// Convert markdown to HTML
let markdownFiles = new Funnel(Paths.SITE, { include: [ '**/*.md' ] });
markdownFiles = new Markdown(markdownFiles, { gfm: true });

// Merge output
module.exports = new MergeTrees([ imageFiles, cssFiles, markdownFiles ]);
