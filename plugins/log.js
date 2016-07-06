module.exports = log;

/**
 * Metalsmith plugin that logs all metadata for files to the console.
 */
function log() {
  return function logMetadata(files) {
    Object.keys(files).forEach(f => {
      let meta = files[f];
      console.log(f);
      Object.keys(meta).forEach(m => {
        if (m === 'contents') return;
        console.log('%s: %j', m, meta[m]);
      });
    });
  };
}