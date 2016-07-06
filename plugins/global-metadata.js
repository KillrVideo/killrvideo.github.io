const fs = require('fs');
const yaml = require('js-yaml');

module.exports = globalMetadata;

/**
 * Reads global metadata from a global.meta.yaml file under the specified path.
 */
function globalMetadata(path) {
  return function addGlobalMetadata(files, metalsmith, done) {
    let metadata = metalsmith.metadata();

    let file = yaml.safeLoad(fs.readFileSync(`${path}/global.meta.yaml`, 'utf-8'));
    Object.keys(file).forEach(key => {
      metadata[key] = file[key];
    });

    done();
  };
}