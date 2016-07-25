const Filter = require('broccoli-filter'); 
const merge = require('merge');
const yaml = require('js-yaml');

/**
 * Convert YAML files to JSON files.
 */
class YamlFilter extends Filter {
  constructor(inputNode, options) {
    options = options || {};
    merge(options, {
      extensions: [ 'yaml', 'yml' ],
      targetExtension: 'json'
    });
    super(inputNode, options);
  }

  processString(contents) {
    return JSON.stringify(yaml.safeLoad(contents));
  }
}

module.exports = YamlFilter;