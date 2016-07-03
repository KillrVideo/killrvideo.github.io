const path = require('path');
const Metalsmith = require('metalsmith');
const watch = require('metalsmith-watch');

const Paths = {
    SRC: path.resolve(__dirname, 'src'),
    DEST: path.resolve(__dirname, 'out')
};

let ms = Metalsmith(__dirname)
    .source(Paths.SRC)
    .destination(Paths.DEST);

// Watch?
if (process.argv.length > 2 && process.argv[2] === '--watch') {
    ms.use(watch({ livereload: true }));
}

// Add more plugins here

// Build
ms.build(function (err) {
    if (err) throw err;
    console.log('Build finished');
});
