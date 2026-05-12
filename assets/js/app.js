/**
 * app.js — Global Application Shell
 * Handles: header/footer injection, nav badges, toast system,
 * mobile menu, search overlay, scroll behaviour, auth guards.
 */

/* ─── Toast System ─────────────────────────────────────────── */
window.Toast = (() => {
  let container;

  function _getContainer() {
    if (!container) {
      container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
      }
    }
    return container;
  }

  function show(message, type = 'success', duration = 3500) {
    const c = _getContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconMap = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
    toast.innerHTML = `
      <i class="fas ${iconMap[type] || 'fa-info-circle'}"></i>
      <span>${message}</span>
      <button class="toast-close"><i class="fas fa-times"></i></button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => dismiss(toast));
    c.appendChild(toast);

    // Trigger reflow for transition
    requestAnimationFrame(() => toast.classList.add('toast-show'));

    const timer = setTimeout(() => dismiss(toast), duration);
    toast._timer = timer;
  }

  function dismiss(toast) {
    clearTimeout(toast._timer);
    toast.classList.remove('toast-show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }

  return { show };
})();

/* ─── Badge Updater ─────────────────────────────────────────── */
window.updateBadges = async function () {
  const cartBadges = document.querySelectorAll('.cart-count');
  const wishBadges = document.querySelectorAll('.wish-count');

  try {
    const [cartRes, wishRes] = await Promise.all([
      API.cart.get(),
      API.wishlist.get()
    ]);

    const cartCount = cartRes.success
      ? cartRes.data.reduce((s, i) => s + i.qty, 0)
      : 0;
    const wishCount = wishRes.success ? wishRes.data.length : 0;

    cartBadges.forEach(b => {
      b.textContent = cartCount;
      b.style.display = cartCount > 0 ? 'flex' : 'none';
    });
    wishBadges.forEach(b => {
      b.textContent = wishCount;
      b.style.display = wishCount > 0 ? 'flex' : 'none';
    });
  } catch (e) {
    // Silently fail — badges are non-critical
  }
};

/* ─── Header HTML ────────────────────────────────────────────── */
function buildHeader() {
  const user = API.session.getUser();
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  const navLinks = [
    { href: 'index.html', label: 'Home' },
    { href: 'products.html', label: 'Shop' },
    { href: 'about.html', label: 'About' },
    { href: 'contact.html', label: 'Contact' },
  ];

  const navHTML = navLinks.map(link => `
    <li>
      <a href="${link.href}" class="${currentPage === link.href ? 'active' : ''}">${link.label}</a>
    </li>
  `).join('');

  return `
    <!-- Top Bar -->
    <div class="topbar">
      <div class="topbar-inner container">
        <span class="topbar-text"><i class="fas fa-truck"></i> Free shipping on orders over $75</span>
        <div class="topbar-links">
          ${user
            ? `<a href="account.html">Hi, ${user.firstName}</a><span class="topbar-sep">|</span><a href="#" id="topbar-logout">Logout</a>`
            : `<a href="login.html">Login</a><span class="topbar-sep">|</span><a href="register.html">Register</a>`
          }
        </div>
      </div>
    </div>

    <!-- Main Header -->
    <header class="site-header" id="site-header">
      <div class="header-inner container">

        <!-- Mobile Menu Toggle -->
        <button class="menu-toggle" id="menu-toggle" aria-label="Open menu">
          <span></span><span></span><span></span>
        </button>

        <!-- Logo -->
        <div class="site-logo">
          <a href="index.html">
            <span class="logo-name">MUNERA</span>
            <span class="logo-tagline">SKINCARE</span>
          </a>
        </div>

        <!-- Desktop Nav -->
        <nav class="main-nav" id="main-nav">
          <ul class="nav-list">
            ${navHTML}
          </ul>
        </nav>

        <!-- Header Actions -->
        <div class="header-actions">
          <a href="wishlist.html" class="action-btn" aria-label="Wishlist">
            <i class="fas fa-heart"></i>
            <span class="badge wish-count" style="display:none">0</span>
          </a>
          <a href="cart.html" class="action-btn" aria-label="Cart">
            <i class="fas fa-shopping-bag"></i>
            <span class="badge cart-count" style="display:none">0</span>
          </a>
          <a href="${user ? 'account.html' : 'login.html'}" class="action-btn" aria-label="Account">
            <i class="fas fa-user"></i>
          </a>
        </div>
      </div>
    </header>

    <!-- Mobile Drawer -->
    <div class="mobile-overlay" id="mobile-overlay"></div>
    <nav class="mobile-nav" id="mobile-nav">
      <div class="mobile-nav-head">
        <span class="logo-name">MUNERA</span>
        <button class="mobile-close" id="mobile-close"><i class="fas fa-times"></i></button>
      </div>
      <ul class="mobile-nav-list">
        ${navLinks.map(l => `<li><a href="${l.href}">${l.label}</a></li>`).join('')}
        <li class="mobile-divider"></li>
        ${user
          ? `<li><a href="account.html"><i class="fas fa-user"></i> My Account</a></li>
             <li><a href="#" id="mobile-logout"><i class="fas fa-sign-out-alt"></i> Logout</a></li>`
          : `<li><a href="login.html"><i class="fas fa-sign-in-alt"></i> Login</a></li>
             <li><a href="register.html"><i class="fas fa-user-plus"></i> Register</a></li>`
        }
        <li><a href="wishlist.html"><i class="fas fa-heart"></i> Wishlist</a></li>
        <li><a href="cart.html"><i class="fas fa-shopping-bag"></i> Cart</a></li>
      </ul>
    </nav>

    <!-- Search Overlay -->
    <div class="search-overlay" id="search-overlay">
      <div class="search-overlay-inner">
        <button class="search-overlay-close" id="search-overlay-close"><i class="fas fa-times"></i></button>
        <form class="search-form" id="search-form" action="products.html" method="GET">
          <input type="text" name="q" id="search-input" placeholder="Search for serums, moisturizers, cleaners…" autocomplete="off">
          <button type="submit"><i class="fas fa-search"></i></button>
        </form>
        <p class="search-hint">Try: Vitamin C, Retinol, Hyaluronic Acid</p>
      </div>
    </div>
  `;
}

/* ─── Footer HTML ────────────────────────────────────────────── */
function buildFooter() {
  return `
    <footer class="site-footer">
      <div class="footer-top container">
        <div class="footer-brand">
          <div class="footer-logo">
            <span class="logo-name">MUNERA</span>
            <span class="logo-tagline">SKINCARE</span>
          </div>
          <p class="footer-desc">Luxury skincare crafted with nature's finest botanicals. Radiance in every drop.</p>
          <div class="footer-social">
            <a href="#" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
            <a href="#" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>
            <a href="#" aria-label="Pinterest"><i class="fab fa-pinterest-p"></i></a>
            <a href="#" aria-label="TikTok"><i class="fab fa-tiktok"></i></a>
          </div>
        </div>

        <div class="footer-col">
          <h4>Shop</h4>
          <ul>
            <li><a href="products.html?category=serums">Serums</a></li>
            <li><a href="products.html?category=moisturizers">Moisturizers</a></li>
            <li><a href="products.html?category=cleansers">Cleansers</a></li>
            <li><a href="products.html?category=masks">Masks</a></li>
            <li><a href="products.html?category=spf">SPF</a></li>
            <li><a href="products.html?featured=true">New Arrivals</a></li>
          </ul>
        </div>

        <div class="footer-col">
          <h4>Help</h4>
          <ul>
            <li><a href="about.html">About Us</a></li>
            <li><a href="contact.html">Contact</a></li>
            <li><a href="#">Shipping & Returns</a></li>
            <li><a href="#">FAQ</a></li>
            <li><a href="#">Privacy Policy</a></li>
            <li><a href="#">Terms of Service</a></li>
          </ul>
        </div>

        <div class="footer-col footer-newsletter-col">
          <h4>Stay in the glow</h4>
          <p>Get skincare tips, early access, and exclusive offers.</p>
          <form class="footer-newsletter" id="footer-newsletter">
            <input type="email" placeholder="Your email address" required>
            <button type="submit"><i class="fas fa-arrow-right"></i></button>
          </form>
          <div class="footer-badges">
            <span><i class="fas fa-lock"></i> Secure Checkout</span>
            <span><i class="fas fa-leaf"></i> Cruelty Free</span>
            <span><i class="fas fa-recycle"></i> Eco Packaging</span>
          </div>
        </div>
      </div>

      <div class="footer-bottom container">
        <p>&copy; ${new Date().getFullYear()} Munera Skincare. All rights reserved.</p>
        <div class="payment-icons">
          <i class="fab fa-cc-visa"></i>
          <i class="fab fa-cc-mastercard"></i>
          <i class="fab fa-cc-paypal"></i>
          <i class="fab fa-cc-apple-pay"></i>
        </div>
      </div>
    </footer>
  `;
}

/* ─── Inject Header & Footer ─────────────────────────────────── */
function injectShell() {
  const headerEl = document.getElementById('app-header');
  const footerEl = document.getElementById('app-footer');

  if (headerEl) headerEl.innerHTML = buildHeader();
  if (footerEl) footerEl.innerHTML = buildFooter();
}

/* ─── Header Scroll Behaviour ────────────────────────────────── */
function initScrollBehaviour() {
  const header = document.getElementById('site-header');
  if (!header) return;
  let lastY = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y > 80) header.classList.add('scrolled');
    else header.classList.remove('scrolled');

    if (y > lastY && y > 200) header.classList.add('header-hidden');
    else header.classList.remove('header-hidden');
    lastY = y;
  }, { passive: true });
}

/* ─── Mobile Menu ─────────────────────────────────────────────── */
function initMobileMenu() {
  const toggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('mobile-nav');
  const overlay = document.getElementById('mobile-overlay');
  const close = document.getElementById('mobile-close');

  function open() {
    nav?.classList.add('open');
    overlay?.classList.add('open');
    toggle?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    nav?.classList.remove('open');
    overlay?.classList.remove('open');
    toggle?.classList.remove('open');
    document.body.style.overflow = '';
  }

  toggle?.addEventListener('click', open);
  close?.addEventListener('click', closeMenu);
  overlay?.addEventListener('click', closeMenu);
}

/* ─── Search Overlay (with live results) ────────────────────── */
function initSearchOverlay() {
  const overlay  = document.getElementById('search-overlay');
  const openBtn  = document.getElementById('search-toggle');
  const closeBtn = document.getElementById('search-overlay-close');
  const input    = document.getElementById('search-input');

  // Inject live-results container right after the form
  const inner = overlay?.querySelector('.search-overlay-inner');
  if (inner && !inner.querySelector('#search-live-results')) {
    const resultsEl = document.createElement('div');
    resultsEl.id = 'search-live-results';
    resultsEl.className = 'search-live-results';
    inner.appendChild(resultsEl);
  }

  function openOverlay() {
    overlay?.classList.add('open');
    setTimeout(() => input?.focus(), 100);
  }
  function closeOverlay() {
    overlay?.classList.remove('open');
    clearResults();
  }
  function clearResults() {
    const r = document.getElementById('search-live-results');
    if (r) r.innerHTML = '';
  }

  openBtn?.addEventListener('click', openOverlay);
  closeBtn?.addEventListener('click', closeOverlay);
  overlay?.addEventListener('click', e => { if (e.target === overlay) closeOverlay(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlay(); });

  // Live search as user types
  let searchTimeout;
  input?.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const q = input.value.trim();
    if (!q) { clearResults(); return; }
    searchTimeout = setTimeout(() => runLiveSearch(q), 250);
  });

  async function runLiveSearch(q) {
    const resultsEl = document.getElementById('search-live-results');
    if (!resultsEl) return;

    resultsEl.innerHTML = '<div class="search-live-loading"><i class="fas fa-spinner fa-spin"></i></div>';

    const res = await API.products.getAll();
    if (!res.success) { resultsEl.innerHTML = ''; return; }

    const term = q.toLowerCase();
    const matches = res.data.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term) ||
      (p.tags || []).some(t => t.toLowerCase().includes(term))
    ).slice(0, 5);

    if (!matches.length) {
      resultsEl.innerHTML = `<p class="search-live-empty">No products found for "<strong>${q}</strong>"</p>`;
      return;
    }

    resultsEl.innerHTML = `
      <div class="search-live-list">
        ${matches.map(p => `
          <a href="product-detail.html?id=${p.id}" class="search-live-item" onclick="document.getElementById('search-overlay').classList.remove('open')">
            <img src="${p.image}" alt="${p.name}">
            <div class="search-live-info">
              <span class="search-live-cat">${p.category}</span>
              <span class="search-live-name">${p.name}</span>
            </div>
            <span class="search-live-price">$${parseFloat(p.price).toFixed(2)}</span>
          </a>
        `).join('')}
        <a href="products.html?q=${encodeURIComponent(q)}" class="search-live-all">
          View all results for "<strong>${q}</strong>" <i class="fas fa-arrow-right"></i>
        </a>
      </div>
    `;
  }
}

/* ─── Auth Actions ───────────────────────────────────────────── */
function initAuthActions() {
  async function doLogout(e) {
    e.preventDefault();
    await API.auth.logout();
    Toast.show('You have been logged out.', 'info');
    setTimeout(() => window.location.href = 'index.html', 800);
  }
  document.getElementById('topbar-logout')?.addEventListener('click', doLogout);
  document.getElementById('mobile-logout')?.addEventListener('click', doLogout);
}

/* ─── Footer Newsletter ──────────────────────────────────────── */
function initFooterNewsletter() {
  document.getElementById('footer-newsletter')?.addEventListener('submit', e => {
    e.preventDefault();
    Toast.show('Thanks for subscribing! ✨', 'success');
    e.target.reset();
  });
}

/* ─── Auth Guard ─────────────────────────────────────────────── */
window.requireAuth = function (redirectTo = 'login.html') {
  if (!API.session.isLoggedIn()) {
    window.location.href = `${redirectTo}?next=${encodeURIComponent(window.location.href)}`;
    return false;
  }
  return true;
};

/* ─── Utility: format price ──────────────────────────────────── */
window.formatPrice = (n) => `$${parseFloat(n).toFixed(2)}`;

/* ─── Utility: render star rating ───────────────────────────── */
window.renderStars = (rating) => {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(rating)) html += '<i class="fas fa-star"></i>';
    else if (i - rating < 1) html += '<i class="fas fa-star-half-alt"></i>';
    else html += '<i class="far fa-star"></i>';
  }
  return html;
};

/* ─── Utility: build product card HTML ──────────────────────── */
window.buildProductCard = (product) => {
  const isWished = false; // async — updated after render
  return `
    <div class="product-card" data-id="${product.id}">
      <div class="product-card-img">
        <a href="product-detail.html?id=${product.id}">
          <img src="${product.image}" alt="${product.name}" loading="lazy">
        </a>
        ${product.badge ? `<span class="product-badge badge-${product.badge.toLowerCase().replace(/\s/g,'-')}">${product.badge}</span>` : ''}
        <div class="product-card-actions">
          <button class="btn-icon wishlist-toggle" data-id="${product.id}" aria-label="Wishlist">
            <i class="far fa-heart"></i>
          </button>
          <a href="product-detail.html?id=${product.id}" class="btn-icon" aria-label="Quick view">
            <i class="fas fa-eye"></i>
          </a>
        </div>
        <div class="product-quick-add">
          <button class="btn btn-gold quick-add-btn" data-id="${product.id}">
            <i class="fas fa-shopping-bag"></i> Add to Cart
          </button>
        </div>
      </div>
      <div class="product-card-body">
        <p class="product-category">${product.category}</p>
        <h3 class="product-name"><a href="product-detail.html?id=${product.id}">${product.name}</a></h3>
        <div class="product-rating">
          ${renderStars(product.rating)}
          <span class="review-count">(${product.reviews})</span>
        </div>
        <div class="product-price">
          <span class="price-current">${formatPrice(product.price)}</span>
          ${product.originalPrice ? `<span class="price-original">${formatPrice(product.originalPrice)}</span>` : ''}
        </div>
      </div>
    </div>
  `;
};

/* ─── Wishlist toggle on product cards ──────────────────────── */
async function updateCardWishlistStates() {
  const btns = document.querySelectorAll('.wishlist-toggle[data-id]');
  if (!btns.length) return;
  for (const btn of btns) {
    const res = await API.wishlist.isWishlisted(btn.dataset.id);
    if (res.success && res.data) {
      btn.classList.add('wishlisted');
      btn.querySelector('i').className = 'fas fa-heart';
    }
  }
}

document.addEventListener('click', async e => {
  const btn = e.target.closest('.wishlist-toggle');
  if (!btn) return;
  const id = btn.dataset.id;
  const res = await API.wishlist.toggle(id);
  if (res.success) {
    const added = res.data.action === 'added';
    btn.classList.toggle('wishlisted', added);
    btn.querySelector('i').className = added ? 'fas fa-heart' : 'far fa-heart';
    Toast.show(added ? 'Added to wishlist ♡' : 'Removed from wishlist', added ? 'success' : 'info');
    updateBadges();
  } else {
    Toast.show(res.error, 'error');
  }
});

document.addEventListener('click', async e => {
  const btn = e.target.closest('.quick-add-btn');
  if (!btn) return;
  const id = btn.dataset.id;
  const res = await API.cart.add(id, 1);
  if (res.success) {
    Toast.show('Added to cart 🛍️', 'success');
    updateBadges();
    btn.innerHTML = '<i class="fas fa-check"></i> Added!';
    setTimeout(() => { btn.innerHTML = '<i class="fas fa-shopping-bag"></i> Add to Cart'; }, 1500);
  } else {
    Toast.show(res.error, 'error');
  }
});

/* ─── Boot ────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  injectShell();
  initScrollBehaviour();
  initMobileMenu();
  initSearchOverlay();
  initAuthActions();
  initFooterNewsletter();
  updateBadges();
  // Defer wishlist state to avoid blocking render
  setTimeout(updateCardWishlistStates, 300);
});