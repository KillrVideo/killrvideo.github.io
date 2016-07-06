module.exports = href;

/**
 * Add an href to the file at the property specified.
 */
function href(prop) {
  return function hrefPlugin(files) {
    Object.keys(files).forEach(fileName => {
      let file = files[fileName];
      let href = fileName.replace('\\', '/');
      file[prop] = `/${href}`;
    });
  };
}