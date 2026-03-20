const path = require('path');
const fs = require('fs');
const glob = require('fast-glob');

const SITE_DIR = path.resolve(__dirname, '../site');

module.exports = function() {
  const specFiles = glob.sync('services/**/_specs/*.spec.md', {
    cwd: SITE_DIR,
    absolute: false
  });

  const artifacts = {};

  specFiles.forEach(relPath => {
    const absPath = path.join(SITE_DIR, relPath);
    const content = fs.readFileSync(absPath, 'utf8');
    // Key is the web path: /services/account-management/_specs/post-register.spec.md
    const webPath = '/' + relPath.replace(/\\/g, '/');
    artifacts[webPath] = content;
  });

  return artifacts;
};
