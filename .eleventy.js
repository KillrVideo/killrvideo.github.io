const eleventySass = require('eleventy-sass');
const markdownIt = require('markdown-it');
const markdownItAnchor = require('markdown-it-anchor');
const hljs = require('highlight.js');
const path = require('path');

module.exports = function(eleventyConfig) {
  // Markdown config
  const md = markdownIt({
    html: true,
    highlight: function(str, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(str, { language: lang }).value;
        } catch (__) {}
      }
      return '';
    }
  }).use(markdownItAnchor);

  eleventyConfig.setLibrary('md', md);

  // SASS
  eleventyConfig.addPlugin(eleventySass, {
    sass: {
      loadPaths: [
        path.resolve(__dirname, 'src/site/assets/css'),
        path.resolve(__dirname, 'node_modules/bulma'),
        path.resolve(__dirname, 'node_modules/font-awesome/css'),
        path.resolve(__dirname, 'node_modules/highlight.js/styles')
      ],
      silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'slash-div'],
      quietDeps: true
    }
  });

  // Ignore spec artifacts from template processing (they're passthrough-copied)
  eleventyConfig.ignores.add('src/site/services/**/_specs/**');

  // Passthrough copy
  eleventyConfig.addPassthroughCopy({ 'src/images': 'assets/images' });
  eleventyConfig.addPassthroughCopy({ 'src/js': 'assets/js' });
  eleventyConfig.addPassthroughCopy({ 'node_modules/font-awesome/fonts': 'assets/fonts' });
  eleventyConfig.addPassthroughCopy({ 'src/site/proto': 'proto' });
  eleventyConfig.addPassthroughCopy('src/site/services/**/_specs/*.spec.md');

  return {
    dir: {
      input: 'src/site',
      includes: '../_includes',
      data: '../_data',
      output: '_site'
    },
    templateFormats: ['njk', 'md'],
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk'
  };
};
