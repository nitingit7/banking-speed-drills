/**
 * sanitiser.js
 * Whitelist-based HTML sanitiser to prevent XSS.
 * Allowed tags: b, i, u, sub, sup, br, p, table, tr, td, th, thead, tbody, span, img
 * Allowed attributes: only src and alt on img; no other attributes.
 */

const Sanitiser = (() => {
  const ALLOWED_TAGS = new Set([
    'b', 'strong', 'i', 'u', 'sub', 'sup', 'br', 'p',
    'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot',
    'span', 'img', 'div'
  ]);

  // Tags that are self-closing / void
  const VOID_TAGS = new Set(['br', 'img']);

  /**
   * Preprocess text formatting:
   * - Literal "\\n" and real "\n"
   * - Double asterisks **text** -> <b>text</b>
   * - Protect tables (no stray gaps or breaks inside tables)
   * - Two or more newlines -> 0.6em paragraph gap
   * - Single newlines -> <br>
   * @param {string} raw
   * @returns {string}
   */
  function formatText(raw) {
    if (!raw || typeof raw !== 'string') return '';

    // 1. Double-escaped backslash+n ("\\n") becomes real newline
    let s = raw.replace(/\\n/g, '\n');

    // 2. Normalize Windows \r\n and Mac \r
    s = s.replace(/\r\n|\r/g, '\n');

    // 3. Double asterisks **text** becomes <b>text</b> (single * stays plain text)
    s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

    // 4. Protect <table>...</table> markup
    const tablePlaceholders = [];
    s = s.replace(/<table[\s\S]*?<\/table>/gi, match => {
      // Strip whitespace between table tags so no stray gaps
      const cleaned = match.replace(/(<\/?(?:table|thead|tbody|tfoot|tr|th|td)[^>]*>)\s+(<\/?(?:table|thead|tbody|tfoot|tr|th|td)[^>]*>)/gi, '$1$2');
      const token = `___BMT_TABLE_${tablePlaceholders.length}___`;
      tablePlaceholders.push(cleaned);
      return token;
    });

    // 5. Blank line (two or more newlines) becomes small paragraph gap (about 0.6em)
    s = s.replace(/\n\s*\n+/g, '<span class="para-gap" style="display:block; margin-top:0.6em;"></span>');

    // 6. Remaining single newlines become <br>
    s = s.replace(/\n/g, '<br>');

    // 7. Restore protected tables wrapped in responsive container
    tablePlaceholders.forEach((tbl, idx) => {
      s = s.replace(`___BMT_TABLE_${idx}___`, `<div class="table-responsive-wrapper">${tbl}</div>`);
    });

    return s;
  }

  /**
   * Sanitise an HTML string, stripping disallowed tags and attributes.
   * @param {string} html
   * @returns {string} sanitised HTML
   */
  function sanitise(html) {
    if (!html || typeof html !== 'string') return '';

    // First run through shared text-formatting preprocessor
    const formatted = formatText(html);

    // Use DOMParser to parse safely
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<body>${formatted}</body>`, 'text/html');

    function processNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return document.createTextNode(node.textContent);
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return null;
      }

      const tagName = node.tagName.toLowerCase();

      if (!ALLOWED_TAGS.has(tagName)) {
        // Replace with a fragment of its children
        const frag = document.createDocumentFragment();
        for (const child of node.childNodes) {
          const processed = processNode(child);
          if (processed) frag.appendChild(processed);
        }
        return frag;
      }

      const clean = document.createElement(tagName);

      // Preserve safe styles and classes for layout elements
      if (['span', 'div', 'p', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot'].includes(tagName)) {
        const cls = node.getAttribute('class');
        const style = node.getAttribute('style');
        if (cls) clean.setAttribute('class', cls);
        if (style) clean.setAttribute('style', style);
      }

      // Allow only specific attributes on img
      if (tagName === 'img') {
        const rawSrc = node.getAttribute('src') || '';
        const alt = node.getAttribute('alt') || '';
        const width = node.getAttribute('width');
        const height = node.getAttribute('height');

        let isValidSrc = false;
        if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(rawSrc)) {
          isValidSrc = true;
        } else if (/^blob:/i.test(rawSrc)) {
          isValidSrc = true;
        } else if (rawSrc && !/^(?:https?:|\/\/|javascript:|data:)/i.test(rawSrc) && !rawSrc.includes('..')) {
          isValidSrc = true;
        }

        if (isValidSrc) {
          clean.setAttribute('src', rawSrc);
          if (alt) clean.setAttribute('alt', alt);
          if (width) clean.setAttribute('width', width);
          if (height) clean.setAttribute('height', height);
          clean.setAttribute('draggable', 'false');
          clean.style.maxWidth = '100%';
          clean.style.height = 'auto';
          clean.style.userSelect = 'none';
          clean.style.webkitUserDrag = 'none';
        } else {
          return null;
        }
      }

      if (!VOID_TAGS.has(tagName)) {
        for (const child of node.childNodes) {
          const processed = processNode(child);
          if (processed) clean.appendChild(processed);
        }
      }

      return clean;
    }

    const frag = document.createDocumentFragment();
    for (const child of doc.body.childNodes) {
      const processed = processNode(child);
      if (processed) frag.appendChild(processed);
    }

    const div = document.createElement('div');
    div.appendChild(frag);
    return div.innerHTML;
  }

  /**
   * Escape HTML special characters to prevent markup injection.
   * Single shared implementation for the entire application.
   * @param {*} str
   * @returns {string}
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Sanitise and set innerHTML safely.
   * @param {HTMLElement} el
   * @param {string} html
   */
  function setHTML(el, html) {
    el.innerHTML = sanitise(html);
  }

  return { sanitise, formatText, setHTML, escapeHtml, _esc: escapeHtml };
})();

// Expose canonical HTML-escape helper globally for all pages and scripts
if (typeof window !== 'undefined') {
  window.escapeHtml = Sanitiser.escapeHtml;
  window._esc = Sanitiser.escapeHtml;
}

