/**
 * The entry point for generating the webpack bundle.
 */

// Include all CSS in the bundle
const css = [
  require('css/all.scss')
];

// Just export the JS by default
module.exports = require('js');