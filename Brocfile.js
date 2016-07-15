const Funnel = require('broccoli-funnel');

const Paths = {
  IMAGES: 'src/images'
};

const imageFiles = new Funnel(Paths.IMAGES, {
  destDir: 'images'
});

module.exports = imageFiles;
