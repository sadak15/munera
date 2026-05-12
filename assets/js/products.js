/**
 * products.js — Shop listing page logic
 * Handles: load products, filter/sort/search, pagination, view toggle
 */

const PRODUCTS_PER_PAGE = 9;

let allProducts   = [];
let filtered      = [];
let currentPage   = 1;
let currentView   = 'grid';

/* Active filter state */
let filters = {
  categories: [],
  skinTypes:  [],
  minPrice:   null,
  maxPrice:   null,
  minRating:  null,
  search:     '',
};

/* ─── Bootstrap ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  readURLParams();
  await loadProducts();
  bindEvents();
});

function readURLParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('category')) filters.categories = [params.get('category')];
  if (params.get('q'))        filters.search = params.get('q');
  if (params.get('featured')) filters.featured = true;
}

async function loadProducts() {
  const grid = document.getElementById('products-grid');
  if (grid) grid.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';

  const res = await API.products.getAll();
  if (!res.success) {
    Toast.show('Failed to load products.', 'error');
    return;
  }
  allProducts = Array.isArray(res.data) ? res.data : [];
  if (!allProducts.length) {
    Toast.show('No products returned from server.', 'warning');
  }
  syncCheckboxesFromState();
  applyFilters();
}

/* ─── Apply active filters → filtered array ──────────────────── */
function applyFilters() {
  let list = Array.isArray(allProducts) ? [...allProducts] : [];

  if (filters.featured) list = list.filter(p => p.featured);

  if (filters.categories.length) {
    list = list.filter(p =>
  filters.categories.includes(p.category.toLowerCase().replace(/\s+/g, '-'))
);
  }

  if (filters.skinTypes.length) {
    list = list.filter(p =>
  filters.skinTypes.some(st => p.skinType.map(s => s.toLowerCase()).includes(st))
);
  }

  if (filters.minPrice !== null) list = list.filter(p => p.price >= filters.minPrice);
  if (filters.maxPrice !== null) list = list.filter(p => p.price <= filters.maxPrice);

  if (filters.minRating) {
    list = list.filter(p => p.rating >= parseFloat(filters.minRating));
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  // Sort
  const sort = document.getElementById('sort-select')?.value || 'default';
  switch (sort) {
    case 'price-asc':  list.sort((a, b) => a.price - b.price); break;
    case 'price-desc': list.sort((a, b) => b.price - a.price); break;
    case 'rating':     list.sort((a, b) => b.rating - a.rating); break;
    case 'name':       list.sort((a, b) => a.name.localeCompare(b.name)); break;
    default:           list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  }

  filtered = list;
  currentPage = 1;
  renderProducts();
  renderPagination();
  renderActiveFilters();
  updateCount();
}

/* ─── Render product cards ───────────────────────────────────── */
function renderProducts() {
  const grid = document.getElementById('products-grid');
  const empty = document.getElementById('empty-state');
  if (!grid) return;

  const start = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const page  = filtered.slice(start, start + PRODUCTS_PER_PAGE);

  if (!page.length) {
    grid.innerHTML = '';
    empty && (empty.style.display = 'flex');
    return;
  }
  empty && (empty.style.display = 'none');

  grid.className = currentView === 'list' ? 'products-grid list-view' : 'products-grid';
  grid.innerHTML = page.map(buildProductCard).join('');

  // Update wishlist icons async
  setTimeout(async () => {
    for (const card of grid.querySelectorAll('.wishlist-toggle[data-id]')) {
      const r = await API.wishlist.isWishlisted(card.dataset.id);
      if (r.success && r.data) {
        card.classList.add('wishlisted');
        card.querySelector('i').className = 'fas fa-heart';
      }
    }
  }, 100);
}

/* ─── Pagination ─────────────────────────────────────────────── */
function renderPagination() {
  const pg = document.getElementById('pagination');
  if (!pg) return;
  const total = Math.ceil(filtered.length / PRODUCTS_PER_PAGE);
  if (total <= 1) { pg.innerHTML = ''; return; }

  let html = '';
  // Prev
  html += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">
    <i class="fas fa-chevron-left"></i>
  </button>`;
  // Pages
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= currentPage - 1 && i <= currentPage + 1)) {
      html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      html += `<span class="page-ellipsis">…</span>`;
    }
  }
  // Next
  html += `<button class="page-btn" ${currentPage === total ? 'disabled' : ''} data-page="${currentPage + 1}">
    <i class="fas fa-chevron-right"></i>
  </button>`;

  pg.innerHTML = html;
  pg.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPage = parseInt(btn.dataset.page);
      renderProducts();
      renderPagination();
      document.getElementById('shop-layout')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ─── Active Filter Tags ─────────────────────────────────────── */
function renderActiveFilters() {
  const container = document.getElementById('active-filters');
  if (!container) return;
  let tags = [];

  filters.categories.forEach(c => {
    tags.push({ label: c, remove: () => { filters.categories = filters.categories.filter(x => x !== c); applyFilters(); } });
  });
  filters.skinTypes.forEach(s => {
    tags.push({ label: `Skin: ${s}`, remove: () => { filters.skinTypes = filters.skinTypes.filter(x => x !== s); applyFilters(); } });
  });
  if (filters.minPrice !== null || filters.maxPrice !== null) {
    const label = `$${filters.minPrice ?? 0}–$${filters.maxPrice ?? '∞'}`;
    tags.push({ label, remove: () => { filters.minPrice = null; filters.maxPrice = null; applyFilters(); } });
  }
  if (filters.minRating) {
    tags.push({ label: `${filters.minRating}★+`, remove: () => { filters.minRating = null; applyFilters(); } });
  }
  if (filters.search) {
    tags.push({ label: `"${filters.search}"`, remove: () => { filters.search = ''; document.getElementById('inline-search').value = ''; applyFilters(); } });
  }

  container.innerHTML = tags.map((t, i) => `
    <span class="active-filter-tag" data-index="${i}">
      ${t.label} <button aria-label="Remove filter"><i class="fas fa-times"></i></button>
    </span>
  `).join('');

  container.querySelectorAll('.active-filter-tag').forEach((el, i) => {
    el.querySelector('button')?.addEventListener('click', () => tags[i].remove());
  });
}

function updateCount() {
  const el = document.getElementById('product-count');
  if (el) el.textContent = `${filtered.length} product${filtered.length !== 1 ? 's' : ''}`;
}

/* ─── Sync checkboxes to filter state ───────────────────────── */
function syncCheckboxesFromState() {
  document.querySelectorAll('#fg-category input[type="checkbox"]').forEach(cb => {
    cb.checked = filters.categories.includes(cb.value);
  });
  if (filters.search) {
    const si = document.getElementById('inline-search');
    if (si) si.value = filters.search;
  }
}

/* ─── Bind all events ────────────────────────────────────────── */
function bindEvents() {
  // Category checkboxes
  document.querySelectorAll('#fg-category input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      filters.categories = [...document.querySelectorAll('#fg-category input:checked')].map(i => i.value);
      applyFilters();
    });
  });

  // Skin type checkboxes
  document.querySelectorAll('#fg-skintype input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      filters.skinTypes = [...document.querySelectorAll('#fg-skintype input:checked')].map(i => i.value);
      applyFilters();
    });
  });

  // Price range
  document.getElementById('apply-price')?.addEventListener('click', () => {
    const min = document.getElementById('price-min')?.value;
    const max = document.getElementById('price-max')?.value;
    filters.minPrice = min ? parseFloat(min) : null;
    filters.maxPrice = max ? parseFloat(max) : null;
    applyFilters();
  });

  // Rating radio
  document.querySelectorAll('input[name="rating"]').forEach(r => {
    r.addEventListener('change', () => { filters.minRating = r.value; applyFilters(); });
  });

  // Inline search
  let searchTimeout;
  document.getElementById('inline-search')?.addEventListener('input', e => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => { filters.search = e.target.value.trim(); applyFilters(); }, 300);
  });

  // Sort
  document.getElementById('sort-select')?.addEventListener('change', applyFilters);

  // Clear All
  document.getElementById('clear-all-filters')?.addEventListener('click', clearAllFilters);
  document.getElementById('reset-filters')?.addEventListener('click', clearAllFilters);

  // View toggle
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentView = btn.dataset.view;
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderProducts();
    });
  });

  // Filter sidebar open/close (mobile)
  document.getElementById('filter-open-btn')?.addEventListener('click', () => {
    document.getElementById('filter-sidebar')?.classList.add('open');
    document.getElementById('filter-overlay')?.classList.add('open');
    document.body.style.overflow = 'hidden';
  });
  function closeSidebar() {
    document.getElementById('filter-sidebar')?.classList.remove('open');
    document.getElementById('filter-overlay')?.classList.remove('open');
    document.body.style.overflow = '';
  }
  document.getElementById('filter-sidebar-close')?.addEventListener('click', closeSidebar);
  document.getElementById('filter-overlay')?.addEventListener('click', closeSidebar);

  // Collapsible filter groups
  document.querySelectorAll('.filter-group-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.closest('.filter-group');
      group?.classList.toggle('collapsed');
    });
  });
}

function clearAllFilters() {
  filters = { categories: [], skinTypes: [], minPrice: null, maxPrice: null, minRating: null, search: '' };
  document.querySelectorAll('.filter-sidebar input[type="checkbox"], .filter-sidebar input[type="radio"]').forEach(i => i.checked = false);
  if (document.getElementById('inline-search')) document.getElementById('inline-search').value = '';
  if (document.getElementById('price-min')) document.getElementById('price-min').value = '';
  if (document.getElementById('price-max')) document.getElementById('price-max').value = '';
  applyFilters();
}