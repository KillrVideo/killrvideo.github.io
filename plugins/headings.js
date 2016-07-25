const path = require('path');
const fs = require('fs-extra');
const cheerio = require('cheerio');
const pluginUtils = require('./utils');
const Filter = require('broccoli-filter');

/**
 * Plugin that extracts headings (i.e. <h1>, <h2>, etc.) from HTML and exports a same-named
 * JSON file with an object with those headings:
 *  {
 *    headings: { 
 *      h1: [ 
 *        { id: 'id-attribute', text: 'Contents of Heading' },
 *        ... 
 *      ],
 *      h2: [ ... ]
 *    }
 *  }
 */
class Headings extends Filter {
  constructor(htmlNode, options) {
    options = options || {};
    super(htmlNode, {
      extensions: [ 'htm', 'html' ],
      targetExtension: 'json',
      annotation: options.annotation 
    });
    this.selectors = options.selectors || [ 'h1', 'h2' ];
  }

  processString(contents) {
    // Load into cheerio DOM
    let $ = cheerio.load(contents);

    // For each selector, find matching tags in the DOM
    let output = this.selectors.reduce((acc, sel) => {
      acc[sel] = [];

      $(sel).each(function() {
        acc[sel].push({
          id: $(this).attr('id'),
          text: $(this).text()
        });
      });

      return acc;
    }, {});

    // Export as JSON
    return JSON.stringify({ headings: output });
  }
}

module.exports = Headings;