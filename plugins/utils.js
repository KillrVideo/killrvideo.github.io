const path = require('path');

/**
 * Given the relative path to a file, gets the canonical page's path that it belongs to. Always includes
 * a trailing slash.
 */
function getCanonicalPath(relativePath) {
  let parsedPath = path.parse(relativePath);

  // Start with directory and add trailing slash if not root (i.e. no directory)
  let canonicalPath = parsedPath.dir.replace(/\\/gi, '/');
  
  // Look for the first dot in the file name (without extension) and ignore everything after the first dot
  let firstDot = parsedPath.name.indexOf('.');
  let name = firstDot >= 0
    ? parsedPath.name.substr(0, firstDot).toLowerCase() 
    : parsedPath.name.toLowerCase();

  // If not already an index page, use the name
  if (name !== 'index') {
    canonicalPath += `/${name}`;
  }

  canonicalPath += '/';

  return canonicalPath;
}

/**
 * Changes the file extension on a relative path.
 */
function changeFileExtension(relativePath, newExt) {
  let baseName = path.basename(relativePath, path.extname(relativePath));
  return path.join(path.dirname(relativePath), `${baseName}${newExt}`);
}

module.exports = {
  getCanonicalPath,
  changeFileExtension
};