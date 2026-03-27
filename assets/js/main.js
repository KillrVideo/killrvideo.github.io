/**
 * main.js — KillrVideo site interactions
 *
 * Modules:
 *   1. Scroll-reveal (IntersectionObserver)
 *   2. Code tab switcher
 *   3. Copy-to-clipboard
 */

(function () {
  'use strict';

  // ── 1. SCROLL REVEAL ──────────────────────────────────────────────────────
  // Adds `.visible` to `.reveal` elements when they enter the viewport.
  // Siblings are staggered by 80 ms each.

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const siblings = entry.target.parentElement.querySelectorAll('.reveal');
        siblings.forEach((el, idx) => {
          el.style.transitionDelay = idx * 80 + 'ms';
        });

        entry.target.classList.add('visible');
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));


  // ── 2. CODE TAB SWITCHER ──────────────────────────────────────────────────
  // Fetches pre-rendered HTML snippets from _includes/code_examples/<lang>.html
  // via data attributes on each tab button, then swaps the <pre> content.

  /**
   * Map of language id → { filename, htmlContent }
   * Content is loaded lazily on first tab click and cached thereafter.
   * The `python` entry is pre-populated from the server-rendered initial state.
   */
  const codeCache = {};

  const tabButtons   = document.querySelectorAll('.code-tab');
  const codeContent  = document.getElementById('code-content');
  const codeFilename = document.getElementById('code-filename');

  // Seed the cache with the initially rendered Python snippet
  const firstTab = document.querySelector('.code-tab[data-lang]');
  if (firstTab && codeContent) {
    const firstLang = firstTab.dataset.lang;
    codeCache[firstLang] = {
      filename: firstTab.dataset.file,
      html: codeContent.innerHTML,
    };
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn));
  });

  /**
   * Activate a tab and update the code block.
   * @param {HTMLElement} btn — the clicked tab button
   */
  function switchTab(btn) {
    const lang = btn.dataset.lang;
    const file = btn.dataset.file;

    // Update active state + ARIA
    tabButtons.forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');

    // Update filename label immediately
    if (codeFilename) codeFilename.textContent = file;

    // Serve from cache if available
    if (codeCache[lang]) {
      codeContent.innerHTML = codeCache[lang].html;
      return;
    }

    // Otherwise fetch the Jekyll-rendered include fragment.
    // The fragments live at /assets/code/<lang>.html (copied there by Jekyll).
    fetch(resolveCodeUrl(lang))
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load: ' + res.status);
        return res.text();
      })
      .then((html) => {
        codeCache[lang] = { filename: file, html };
        codeContent.innerHTML = html;
      })
      .catch(() => {
        // Graceful fallback: show a plain message
        codeContent.textContent = '// Could not load example. Visit GitHub for full source.';
      });
  }

  /**
   * Resolve the URL for a code-example fragment.
   * Strips the trailing slash from baseurl if present.
   */
  function resolveCodeUrl(lang) {
    const base = (document.documentElement.dataset.baseurl || '').replace(/\/$/, '');
    return base + '/assets/code/' + lang + '.html';
  }


  // ── 3. COPY TO CLIPBOARD ──────────────────────────────────────────────────

  const copyBtn = document.getElementById('code-copy-btn');

  if (copyBtn && codeContent) {
    copyBtn.addEventListener('click', () => {
      const text = codeContent.innerText;

      navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = 'copied!';
        copyBtn.style.color = 'var(--green)';
        copyBtn.style.borderColor = 'var(--green)';

        setTimeout(() => {
          copyBtn.textContent = 'copy';
          copyBtn.style.color = '';
          copyBtn.style.borderColor = '';
        }, 1500);
      }).catch(() => {
        // Fallback for browsers without clipboard API
        selectText(codeContent);
      });
    });
  }

  /** Selects all text inside an element (clipboard API fallback). */
  function selectText(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

})();
