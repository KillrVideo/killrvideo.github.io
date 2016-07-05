const path = require('path');
const webpack = require('webpack');

// Path constants
const Paths = {
    SRC: path.resolve(__dirname, 'src'),
    JS: path.resolve(__dirname, 'src/js'),
    OUT: path.resolve(__dirname, 'out/assets')
};

// Plugins for the build
let plugins = [
  // Define process.env.NODE_ENV in the app based on the setting during the build
  new webpack.DefinePlugin({
    'process.env': {
      'NODE_ENV': JSON.stringify(process.env.NODE_ENV === 'production' ? 'production' : 'development')
    }
  })
];

module.exports = {
  devtool: 'source-map',
  context: Paths.SRC,
  entry: './webpack',
  output: {
    path: Paths.OUT,
    publicPath: '/assets/',
    filename: 'bundle.js'
  },
  resolve: {
    root: Paths.SRC
  },
  module: {
    loaders: [
      // Babel transpiler (see .babelrc file for presets)
      { test: /\.jsx?$/, include: Paths.JS, loader: 'babel' }
    ]
  },
  plugins
};