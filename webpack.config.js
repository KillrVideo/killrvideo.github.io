const path = require('path');
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

// Path constants
const Paths = {
    SRC: path.resolve(__dirname, 'src'),
    JS: path.resolve(__dirname, 'src/js'),
    CSS: path.resolve(__dirname, 'src/css'),
    IMAGES: path.resolve(__dirname, 'src/images'),
    OUT: path.resolve(__dirname, 'out/assets')
};

// Plugins for the build
let plugins = [
  // Define process.env.NODE_ENV in the app based on the setting during the build
  new webpack.DefinePlugin({
    'process.env': {
      'NODE_ENV': JSON.stringify(process.env.NODE_ENV === 'production' ? 'production' : 'development')
    }
  }),

  // Put CSS that's extracted into bundle.css
  new ExtractTextPlugin('bundle.css', { allChunks: true }),

  // Copy our images to a corresponsing images folder in the output
  new CopyWebpackPlugin([
    { from: Paths.IMAGES, to: 'images' }
  ])
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
      { test: /\.jsx?$/, include: Paths.JS, loader: 'babel' },

      // Extract CSS files from our app that are referenced by require('') calls
      { test: /\.css$/, loader: ExtractTextPlugin.extract('style-loader', 'css-loader', {}) }
    ]
  },
  plugins
};