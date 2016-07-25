const Filter = require('broccoli-filter');
const marked = require('marked');

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