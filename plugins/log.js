const util = require ('util');

module.exports = {
  fileMetadata,
  globalMetadata
};

/**
 * Metalsmith plugin that logs all metadata for files to the console.
 */
function fileMetadata() {
  return function logMetadata(files) {
    Object.keys(files).forEach(f => {
      let meta = files[f];
      console.log(f);
      Object.keys(meta).forEach(m => {
        if (m === 'contents' || m === 'mode' || m === 'stats') return;
        console.log('  %s: %j', m, meta[m]);
      });
    });
  };
}

/**
 * Logs global metadata.
 */
function globalMetadata() {
  return function logGlobalMetadata(files, metalsmith) {
    console.log(util.inspect(metalsmith.metadata(), { depth: 3 }));
  };
}