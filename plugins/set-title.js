const headings = require('metalsmith-headings');

module.exports = setTitle;

/**
 * Metalsmith plugin to set the title metadata for a file. 
 */
function setTitle() {
  // Create an instance of the headings plugin to find h1 in the file
  let headingsInstance = headings('h1');
  
  return function setTitlePlugin(files, metalsmith, done) {
    // Run the headings plugin first
    headingsInstance(files, metalsmith, function gotHeadings(err) {
      if (err) return done(err);

      Object.keys(files).forEach(fileName => {
        let file = files[fileName];
        
        // If a title isn't already specified for the file, set it based on the first heading found
        if (!file.title && file.headings && file.headings.length > 0) {
          file.title = file.headings[0].text;
        }

        // Remove the headings data
        delete file.headings;
      });

      done();
    });
  };
}