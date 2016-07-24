const resolve = require('resolve');
const path = require('path');

const Funnel = require('broccoli-funnel');
const Sass = require('broccoli-sass');
const Markdown = require('broccoli-marked');
const MergeTrees = require('broccoli-merge-trees');

const Paths = {
  IMAGES: 'src/images',
  BULMA: path.dirname(resolve.sync('bulma')),
  FONT_AWESOME: path.dirname(resolve.sync('font-awesome/css/font-awesome.css')),
  SASS: 'src/sass',
  SITE: 'src/site'
};

console.log(Paths.FONT_AWESOME);

// Copy images to output as-is
const imageFiles = new Funnel(Paths.IMAGES, {
  destDir: 'images'
});

// Compile SASS to CSS
const cssFiles = new Sass([ Paths.SASS, Paths.BULMA, Paths.FONT_AWESOME ], 'bundle.scss', 'css/bundle.css');

// Convert markdown to HTML
const markdownFiles = new Funnel(Paths.SITE, { include: [ '**/*.md' ] });
const markdownHtml = new Markdown(markdownFiles, { gfm: true });

// Merge output
module.exports = new MergeTrees([ imageFiles, cssFiles, markdownHtml ]);
