const path = require('path');
const fs = require('fs-extra');
const merge = require('merge').recursive;
const Plugin = require('broccoli-plugin');

/**
 * Merge's JSON files from inputNodes using the getOutputPath function on the options passed in to
 * determine which files are related and what file to merge them to. The getOutputPath function is
 * called with the relative path of each input file.
 */
class MergeJson extends Plugin {
  constructor(inputNodes, options) {
    if (!options || !options.getOutputPath) 
      throw new Error('Must specify options with a getOutputPath function');
    
    super(inputNodes, { annotation: options.annotation });
    this.getOutputPath = options.getOutputPath;
  }

  build() {
    // Walk all files in all input paths and group by the output path 
    let outputs = this.inputPaths.reduce((pathAcc, inputPath) => {
      walkSync(inputPath, { directories: false }).reduce((acc, inputFile) => {
        // Get output path for input file and create base object if we haven't yet
        let outputPath = this.getOutputPath(inputFile);
        if (acc.hasOwnProperty(outputPath) === false) {
          acc[outputPath] = {};
        }

        // Merge file with output object
        let srcPath = path.join(inputPath, inputFile);
        merge(acc[outputPath], JSON.parse(fs.readFileSync(srcPath, 'utf8')));
        return acc;
      }, pathAcc);
      return pathAcc;
    }, {});

    Object.keys(outputs).forEach(outputFile => {
      let destPath = path.join(this.outputPath, outputFile);
      fs.mkdirsSync(path.dirname(destPath));
      fs.writeFileSync(destPath, JSON.stringify(outputs[outputFile]), 'utf8');
    });
  }
}

module.exports = MergeJson;