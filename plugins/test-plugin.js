const Plugin = require('broccoli-caching-writer');

class TestPlugin extends Plugin {
  constructor(inputNodes, options) {
    options = options || {};
    super(inputNodes, options);

    this.options = options;
  }

  build() {
    this.listEntries().forEach(f => console.log('%j', f));
  }
}

module.exports = TestPlugin;