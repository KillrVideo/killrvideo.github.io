const Filter = require('broccoli-filter');
const marked = require('marked');
const highlightJs = require('highlight.js');

// Override some of the default rendering
const renderer = new marked.Renderer();

// Add highlight.js syntax highlighting if a language is specified
renderer.code = function(code, language) {
  if (language) {
    return `<pre><code class="hljs">${highlightJs.highlightAuto(code, [ language ]).value}</pre></code>`;
  }
  return `<pre><code>${code}</code></pre>`;
};

// Open external links in a new window
renderer.link = function(href, title, text) {
  let titleAttr = title ? ` title="${title}"` : '';
  let targetAttr = href.startsWith('http') ? ` target="_blank"` : '';
  return `<a href="${href}"${titleAttr}${targetAttr}>${text}</a>`;
};


// Set default options for markdown rendering
marked.setOptions({
  gfm: true,
  renderer
});

/**
 * Plugin that converts markdown files to HTML.
 */
class Markdown extends Filter {
  constructor(inputNode, options) {
    options = options || {};

    super(inputNode, {
      extensions: [ 'md' ],
      targetExtension: 'html',
      annotation: options.annotation
    });

    this.options = options;
  }

  processString(contents) {
    return marked(contents);
  }
}

module.exports = Markdown;