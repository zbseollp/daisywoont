/**
 * Elementor Pro Table of Contents — client-side builder.
 * Replaces the spinner with a hierarchical numbered list from page headings.
 */
(function () {
  const LEVEL = { H2: 0, H3: 1, H4: 2 };

  function slugify(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  function ensureId(heading, used) {
    if (heading.id) {
      used.add(heading.id);
      return heading.id;
    }
    let base = slugify(heading.textContent || 'section') || 'section';
    let id = base;
    let n = 2;
    while (used.has(id) || document.getElementById(id)) {
      id = `${base}-${n++}`;
    }
    heading.id = id;
    used.add(id);
    return id;
  }

  function getSettings(widget) {
    const raw = widget.getAttribute('data-settings');
    if (!raw) {
      return { tags: ['H2', 'H3', 'H4'], hierarchical: true };
    }
    try {
      const parsed = JSON.parse(raw.replace(/&quot;/g, '"'));
      const tags = (parsed.headings_by_tags || ['h2', 'h3', 'h4']).map((t) =>
        String(t).toUpperCase()
      );
      return {
        tags,
        hierarchical: parsed.hierarchical_view !== 'no',
        minimizeBox: parsed.minimize_box === 'yes',
        minimizedOn: parsed.minimized_on || '',
        emptyMessage:
          parsed.no_headings_message || 'Er zijn geen kopteksten gevonden op deze pagina.',
      };
    } catch {
      return { tags: ['H2', 'H3', 'H4'], hierarchical: true };
    }
  }

  function collectHeadings(widget, tags) {
    const root = widget.closest('.elementor') || document.getElementById('main') || document;
    const selector = tags.map((t) => t.toLowerCase()).join(',');
    return Array.from(root.querySelectorAll(selector)).filter((el) => {
      if (widget.contains(el)) return false;
      if (el.closest('.elementor-toc__header')) return false;
      // Skip empty / whitespace-only headings
      if (!(el.textContent || '').trim()) return false;
      return true;
    });
  }

  function buildTree(headings, hierarchical) {
    const root = [];
    const stack = [{ level: -1, children: root }];

    headings.forEach((heading) => {
      const level = hierarchical ? (LEVEL[heading.tagName] ?? 0) : 0;
      const node = {
        heading,
        level,
        children: [],
      };
      while (stack.length && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    });

    return root;
  }

  function renderList(nodes, usedIds) {
    if (!nodes.length) return null;
    const ol = document.createElement('ol');
    ol.className = 'elementor-toc__list-wrapper';

    nodes.forEach((node) => {
      const li = document.createElement('li');
      li.className = 'elementor-toc__list-item';

      const wrapper = document.createElement('div');
      wrapper.className = 'elementor-toc__list-item-text-wrapper';

      const a = document.createElement('a');
      a.className = 'elementor-toc__list-item-text';
      a.href = `#${ensureId(node.heading, usedIds)}`;
      a.textContent = (node.heading.textContent || '').trim();

      wrapper.appendChild(a);
      li.appendChild(wrapper);

      const childList = renderList(node.children, usedIds);
      if (childList) li.appendChild(childList);

      ol.appendChild(li);
    });

    return ol;
  }

  function setupToggle(widget) {
    const header = widget.querySelector('.elementor-toc__header');
    if (!header) return;

    const expandBtn = widget.querySelector('.elementor-toc__toggle-button--expand');
    const collapseBtn = widget.querySelector('.elementor-toc__toggle-button--collapse');

    const setCollapsed = (collapsed) => {
      widget.classList.toggle('elementor-toc--collapsed', collapsed);
      if (expandBtn) expandBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      if (collapseBtn) collapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    };

    // Tablet/mobile start minimized when Elementor class is present
    const minimizedOnTablet = widget.classList.contains('elementor-toc--minimized-on-tablet');
    if (minimizedOnTablet && window.matchMedia('(max-width: 1024px)').matches) {
      setCollapsed(true);
    } else {
      setCollapsed(false);
    }

    const toggle = () => setCollapsed(!widget.classList.contains('elementor-toc--collapsed'));

    header.addEventListener('click', (e) => {
      // Only toggle when minimize controls exist
      if (!expandBtn && !collapseBtn) return;
      e.preventDefault();
      toggle();
    });

    [expandBtn, collapseBtn].forEach((btn) => {
      if (!btn) return;
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      });
    });
  }

  function initToc(widget) {
    const body = widget.querySelector('.elementor-toc__body');
    if (!body) return;

    const settings = getSettings(widget);
    const headings = collectHeadings(widget, settings.tags);
    const usedIds = new Set();
    const tree = buildTree(headings, settings.hierarchical !== false);
    const list = renderList(tree, usedIds);

    body.innerHTML = '';
    if (!list) {
      const empty = document.createElement('p');
      empty.className = 'elementor-toc__empty';
      empty.textContent = settings.emptyMessage || 'Er zijn geen kopteksten gevonden op deze pagina.';
      body.appendChild(empty);
    } else {
      body.appendChild(list);
    }

    setupToggle(widget);
  }

  function init() {
    document.querySelectorAll('.elementor-widget-table-of-contents').forEach(initToc);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
