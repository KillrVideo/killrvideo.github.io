/**
 * The entry point for generating the webpack bundle.
 */

// Include all CSS in the bundle
const css = [
  require('bulma/css/bulma.css'),
  require('font-awesome/css/font-awesome.css'),
  require('css/site.css')
];

// Just export the JS by default
module.exports = require('js');