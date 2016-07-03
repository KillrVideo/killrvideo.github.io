/**
 * The entry point for generating the webpack bundle.
 */

// Include all CSS in the bundle
const bootswatchCss = require('bootswatch/cosmo/bootstrap.css');
const siteCss = require('css/site.css');

// Just export the JS by default
module.exports = require('js');