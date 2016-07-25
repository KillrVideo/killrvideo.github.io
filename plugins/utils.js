const path = require('path');

/**
 * Given a relative path, returns the same path minus any suffix or extension (i.e. remove everything after the
 * first dot in the file name).
 */
function getBaseFilePath(relativePath) {
  let baseName = path.basename(relativePath, path.extname(relativePath));
  let firstDot = baseName.indexOf('.');
  baseName = firstDot >= 0
    ? baseName.substr(0, firstDot)
    : baseName;
  return path.join(path.dirname(relativePath), baseName);
}

/**
 * Given the relative path to a file, gets the canonical page's path that it belongs to. Always includes
 * a trailing slash and returns a posix-style path.
 */
function getCanonicalPath(relativePath) {
  // Remove any extension and suffix from the file
  let canonicalPath = getBaseFilePath(relativePath).toLowerCase();

  // Remove index if an index file
  if (canonicalPath.endsWith('index')) {
    canonicalPath = canonicalPath.substr(0, canonicalPath.length - 5);
  }

  // Posix path and leading slash
  canonicalPath = canonicalPath.replace(/\\/gi, '/');
  canonicalPath = '/' + canonicalPath;

  // Add trailing slash
  if (canonicalPath.endsWith('/') === false) {
    canonicalPath += '/';
  }

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
  getBaseFilePath,
  getCanonicalPath,
  changeFileExtension
};