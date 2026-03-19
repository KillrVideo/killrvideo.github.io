const path = require('path');
const fs = require('fs');
const glob = require('fast-glob');
const yaml = require('js-yaml');
const markdownIt = require('markdown-it');
const markdownItAnchor = require('markdown-it-anchor');
const cheerio = require('cheerio');

const SITE_DIR = path.resolve(__dirname, '../site');
const DOCS_DIR = path.resolve(SITE_DIR, 'docs');

// Markdown renderer with anchor plugin for heading IDs
const md = markdownIt({ html: true }).use(markdownItAnchor);

/**
 * Parse YAML front matter from markdown source.
 * Returns { data, content } where data is parsed front matter object.
 */
function parseFrontMatter(source) {
  if (source.startsWith('---')) {
    const end = source.indexOf('---', 3);
    if (end !== -1) {
      const fmStr = source.slice(3, end).trim();
      const content = source.slice(end + 3).trimStart();
      try {
        const data = yaml.load(fmStr) || {};
        return { data, content };
      } catch (e) {
        return { data: {}, content };
      }
    }
  }
  return { data: {}, content: source };
}

/**
 * Strip YAML front matter from markdown source.
 */
function stripFrontMatter(source) {
  return parseFrontMatter(source).content;
}

/**
 * Given a file path relative to SITE_DIR (e.g. "docs/guides/architecture.md"),
 * returns the canonical href: "/docs/guides/architecture/"
 */
function filePathToHref(relPath) {
  // Strip extension
  let withoutExt = relPath.replace(/\.[^.]+$/, '');
  // Lowercase
  withoutExt = withoutExt.toLowerCase();
  // Remove trailing "index"
  if (withoutExt.endsWith('/index') || withoutExt === 'index') {
    withoutExt = withoutExt.replace(/\/?index$/, '');
  }
  // Ensure leading slash and trailing slash
  let href = '/' + withoutExt.replace(/\\/g, '/');
  if (!href.endsWith('/')) href += '/';
  return href;
}

/**
 * Given a file path relative to SITE_DIR, returns a source_href
 * (path as it appears in the source tree, for linking to GitHub)
 */
function filePathToSourceHref(relPath) {
  return '/' + relPath.replace(/\\/g, '/');
}

/**
 * Extract h1 and h2 headings from rendered HTML.
 */
function extractHeadings(html) {
  const $ = cheerio.load(html);
  const h1 = [];
  const h2 = [];

  $('h1').each(function() {
    h1.push({ id: $(this).attr('id') || null, text: $(this).text() });
  });

  $('h2').each(function() {
    h2.push({ id: $(this).attr('id') || null, text: $(this).text() });
  });

  return { h1, h2 };
}

/**
 * Build a collection object from a collection.meta.yaml file.
 * collectionMetaPath: absolute path to collection.meta.yaml
 */
function buildCollection(collectionMetaPath) {
  const collectionDir = path.dirname(collectionMetaPath);
  const meta = yaml.load(fs.readFileSync(collectionMetaPath, 'utf8'));

  const title = meta.title || '';
  const icon = meta.icon || '';
  const group = meta.group || null;
  const sortBy = Array.isArray(meta.sort_by) ? meta.sort_by : [];

  // Build items from sort_by list
  const items = sortBy.map(filename => {
    const absFilePath = path.join(collectionDir, filename);

    if (!fs.existsSync(absFilePath)) {
      return null;
    }

    const rawSource = fs.readFileSync(absFilePath, 'utf8');
    const { data: fmData, content: bodyContent } = parseFrontMatter(rawSource);
    const html = md.render(bodyContent);
    const headings = extractHeadings(html);

    // Derive title from front matter, then first h1, fallback to filename
    const pageTitle = fmData.title || (headings.h1.length > 0 ? headings.h1[0].text : path.basename(filename, '.md'));

    // Compute paths relative to SITE_DIR
    const relPath = path.relative(SITE_DIR, absFilePath);
    const href = filePathToHref(relPath);
    const source_href = filePathToSourceHref(relPath);

    // Draft pages are skipped
    if (fmData.draft === true) {
      return null;
    }

    return {
      href,
      title: pageTitle,
      headings: {
        h1: headings.h1,
        h2: headings.h2
      },
      source_href,
      description: fmData.description || null,
      endpoint: fmData.endpoint || null,
      method: fmData.method || null,
      spec_artifact: fmData.spec_artifact || null,
      concepts: Array.isArray(fmData.concepts) ? fmData.concepts : [],
      order: typeof fmData.order === 'number' ? fmData.order : null
    };
  }).filter(Boolean);

  // Also pick up any markdown files in subdirectories not listed in sort_by
  // (collections with no sort_by enumerate all md files)
  if (sortBy.length === 0) {
    const mdFiles = glob.sync('**/*.md', { cwd: collectionDir, absolute: false });
    mdFiles.forEach(filename => {
      const absFilePath = path.join(collectionDir, filename);
      const rawSource = fs.readFileSync(absFilePath, 'utf8');
      const { data: fmData, content: bodyContent } = parseFrontMatter(rawSource);

      if (fmData.draft === true) return;

      const html = md.render(bodyContent);
      const headings = extractHeadings(html);
      const pageTitle = fmData.title || (headings.h1.length > 0 ? headings.h1[0].text : path.basename(filename, '.md'));
      const relPath = path.relative(SITE_DIR, absFilePath);
      const href = filePathToHref(relPath);
      const source_href = filePathToSourceHref(relPath);

      items.push({
        href,
        title: pageTitle,
        headings: {
          h1: headings.h1,
          h2: headings.h2
        },
        source_href,
        description: fmData.description || null,
        endpoint: fmData.endpoint || null,
        method: fmData.method || null,
        spec_artifact: fmData.spec_artifact || null,
        concepts: Array.isArray(fmData.concepts) ? fmData.concepts : [],
        order: typeof fmData.order === 'number' ? fmData.order : null
      });
    });
  }

  return { title, icon, group, items };
}

module.exports = function() {
  // Find all collection.meta.yaml files under SITE_DIR (not just DOCS_DIR)
  const metaFiles = glob.sync('**/collection.meta.yaml', {
    cwd: SITE_DIR,
    absolute: true
  });

  // Sort for consistent ordering
  const ORDER = [
    'overview',
    'getting-started',
    'concepts',
    'account-management',
    'video-catalog',
    'search',
    'comments-ratings',
    'recommendations',
    'moderation',
    'advanced'
  ];

  metaFiles.sort((a, b) => {
    const aName = path.basename(path.dirname(a));
    const bName = path.basename(path.dirname(b));
    const aIdx = ORDER.indexOf(aName);
    const bIdx = ORDER.indexOf(bName);
    if (aIdx === -1 && bIdx === -1) return aName.localeCompare(bName);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  const collections = metaFiles.map(metaPath => {
    const name = path.basename(path.dirname(metaPath));
    return { name, collection: buildCollection(metaPath) };
  });

  const result = {
    all: collections.map(c => c.collection)
  };

  collections.forEach(({ name, collection }) => {
    result[name] = collection;
  });

  return result;
};
