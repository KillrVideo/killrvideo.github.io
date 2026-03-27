module Jekyll
  # CodeFragmentGenerator copies _includes/code_examples/*.html into
  # assets/code/ so the client-side tab switcher can fetch them via XHR.
  #
  # Place this file in _plugins/code_fragment_generator.rb
  class CodeFragmentGenerator < Generator
    safe true
    priority :low

    FRAGMENT_DIR = File.join('_includes', 'code_examples')
    OUTPUT_DIR   = File.join('assets', 'code')

    def generate(site)
      return unless Dir.exist?(FRAGMENT_DIR)

      Dir.glob(File.join(FRAGMENT_DIR, '*.html')).each do |src|
        basename = File.basename(src)
        lang     = File.basename(src, '.html')

        site.static_files << CodeFragment.new(site, site.source, FRAGMENT_DIR, basename)
      end
    end
  end

  class CodeFragment < StaticFile
    def initialize(site, base, dir, name)
      super(site, base, dir, name)
      # Override destination so files land in assets/code/
      @dest_dir = File.join('assets', 'code')
    end

    def destination(dest)
      File.join(dest, @dest_dir, @name)
    end

    def destination_rel_dir
      @dest_dir
    end
  end
end
