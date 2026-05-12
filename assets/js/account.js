/**
 * account.js — My Account page
 * Tabs: Dashboard | Orders | Profile | Addresses
 */

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Auth guard
  if (!requireAuth('login.html')) return;

  const meRes = await API.auth.me();
  if (!meRes.success) { window.location.href = 'login.html'; return; }
  currentUser = meRes.data;

  renderAccountShell();
  activateTab('dashboard');

  // Handle tab clicks and hash routing
  document.addEventListener('click', e => {
    const btn = e.target.closest('.account-nav-btn');
    if (btn) activateTab(btn.dataset.tab);
  });

  if (window.location.hash) {
    activateTab(window.location.hash.replace('#', ''));
  }
});

/* ─── Shell ──────────────────────────────────────────────────── */
function renderAccountShell() {
  const root = document.getElementById('account-root');
  if (!root) return;

  const initials = (currentUser.firstName[0] + currentUser.lastName[0]).toUpperCase();

  root.innerHTML = `
    <!-- Sidebar -->
    <aside class="account-sidebar">
      <div class="account-profile-card">
        <div class="account-avatar">${initials}</div>
        <div class="account-profile-info">
          <h3>${currentUser.firstName} ${currentUser.lastName}</h3>
          <p>${currentUser.email}</p>
        </div>
      </div>
      <nav class="account-nav">
        <button class="account-nav-btn active" data-tab="dashboard">
          <i class="fas fa-th-large"></i> Dashboard
        </button>
        <button class="account-nav-btn" data-tab="orders">
          <i class="fas fa-box"></i> My Orders
        </button>
        <button class="account-nav-btn" data-tab="profile">
          <i class="fas fa-user"></i> Profile
        </button>
        <button class="account-nav-btn" data-tab="addresses">
          <i class="fas fa-map-marker-alt"></i> Addresses
        </button>
        <button class="account-nav-btn" data-tab="wishlist-shortcut" id="account-wishlist-btn">
          <i class="fas fa-heart"></i> Wishlist
        </button>
        <button class="account-nav-btn" id="account-logout-btn">
          <i class="fas fa-sign-out-alt"></i> Logout
        </button>
      </nav>
    </aside>

    <!-- Content -->
    <div class="account-content" id="account-content">
      <!-- Tab panels injected dynamically -->
    </div>
  `;

  document.getElementById('account-wishlist-btn')?.addEventListener('click', () => {
    window.location.href = 'wishlist.html';
  });
  document.getElementById('account-logout-btn')?.addEventListener('click', async () => {
    await API.auth.logout();
    Toast.show('Logged out.', 'info');
    setTimeout(() => window.location.href = 'index.html', 700);
  });
}

/* ─── Tab routing ────────────────────────────────────────────── */
async function activateTab(tabName) {
  document.querySelectorAll('.account-nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabName);
  });

  const content = document.getElementById('account-content');
  if (!content) return;
  content.innerHTML = `<div class="loading-spinner" style="padding:3rem;text-align:center"><i class="fas fa-spinner fa-spin" style="color:var(--gold)"></i></div>`;

  switch (tabName) {
    case 'dashboard':  await renderDashboard(content); break;
    case 'orders':     await renderOrders(content); break;
    case 'profile':    renderProfile(content); break;
    case 'addresses':  renderAddresses(content); break;
  }
}

/* ─── Dashboard ──────────────────────────────────────────────── */
async function renderDashboard(el) {
  const [ordersRes, wishRes, cartRes] = await Promise.all([
    API.orders.get(),
    API.wishlist.get(),
    API.cart.get(),
  ]);

  const orderCount = ordersRes.success ? ordersRes.data.length : 0;
  const wishCount  = wishRes.success  ? wishRes.data.length  : 0;
  const cartCount  = cartRes.success  ? cartRes.data.reduce((s, i) => s + i.qty, 0) : 0;

  const recentOrders = ordersRes.success ? ordersRes.data.slice(0, 3) : [];

  el.innerHTML = `
    <div class="account-section">
      <h2>Welcome back, ${currentUser.firstName} <span class="wave">👋</span></h2>
      <p style="color:var(--text-muted);margin-bottom:2rem">Here's a summary of your account activity.</p>

      <div class="account-stats">
        <div class="stat-card">
          <i class="fas fa-box"></i>
          <span class="stat-num">${orderCount}</span>
          <span class="stat-label">Orders</span>
        </div>
        <div class="stat-card">
          <i class="fas fa-heart"></i>
          <span class="stat-num">${wishCount}</span>
          <span class="stat-label">Wishlisted</span>
        </div>
        <div class="stat-card">
          <i class="fas fa-shopping-bag"></i>
          <span class="stat-num">${cartCount}</span>
          <span class="stat-label">In Cart</span>
        </div>
      </div>

      ${recentOrders.length ? `
        <h3 style="margin:2rem 0 1rem">Recent Orders</h3>
        <div class="order-list">
          ${recentOrders.map(buildOrderRow).join('')}
        </div>
        <div style="margin-top:1rem">
          <button class="btn btn-secondary btn-sm account-nav-btn" data-tab="orders">View All Orders</button>
        </div>
      ` : `
        <div class="empty-state" style="padding:2rem">
          <i class="fas fa-box-open"></i>
          <h3>No orders yet</h3>
          <a href="products.html" class="btn btn-gold">Start Shopping</a>
        </div>
      `}
    </div>
  `;
}

/* ─── Orders ─────────────────────────────────────────────────── */
async function renderOrders(el) {
  const res = await API.orders.get();
  if (!res.success || !res.data.length) {
    el.innerHTML = `
      <div class="account-section">
        <h2>My Orders</h2>
        <div class="empty-state" style="padding:2rem">
          <i class="fas fa-box-open"></i>
          <h3>No orders yet</h3>
          <a href="products.html" class="btn btn-gold">Shop Now</a>
        </div>
      </div>
    `;
    return;
  }

  el.innerHTML = `
    <div class="account-section">
      <h2>My Orders</h2>
      <div class="order-list">
        ${res.data.map(buildOrderRow).join('')}
      </div>
    </div>
  `;
}

function buildOrderRow(order) {
  const statusClass = { pending: 'status-pending', processing: 'status-processing', shipped: 'status-shipped', delivered: 'status-delivered' };
  const date = new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  return `
    <div class="order-row">
      <div class="order-row-info">
        <span class="order-id">${order.id}</span>
        <span class="order-date">${date}</span>
      </div>
      <div class="order-row-meta">
        <span class="order-items">${order.items.length} item${order.items.length !== 1 ? 's' : ''}</span>
        <span class="order-total">${formatPrice(order.total)}</span>
        <span class="order-status ${statusClass[order.status] || ''}">
          ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}
        </span>
      </div>
    </div>
  `;
}

/* ─── Profile ────────────────────────────────────────────────── */
function renderProfile(el) {
  el.innerHTML = `
    <div class="account-section">
      <h2>Profile Details</h2>
      <form class="account-form" id="profile-form" novalidate>

        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">First Name</label>
            <input type="text" id="pf-first" class="form-input" value="${currentUser.firstName}" required>
            <span class="field-error" id="pf-first-error"></span>
          </div>
          <div class="form-group">
            <label class="form-label">Last Name</label>
            <input type="text" id="pf-last" class="form-input" value="${currentUser.lastName}" required>
            <span class="field-error" id="pf-last-error"></span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Email Address</label>
          <input type="email" id="pf-email" class="form-input" value="${currentUser.email}" required>
          <span class="field-error" id="pf-email-error"></span>
        </div>

        <div class="form-group">
          <label class="form-label">Phone (optional)</label>
          <input type="tel" id="pf-phone" class="form-input" value="${currentUser.phone || ''}" placeholder="+252 617987865">
        </div>

        <div class="form-section-title">Change Password <span style="font-size:.8em;color:var(--text-muted)">(leave blank to keep current)</span></div>

        <div class="form-group">
          <label class="form-label">New Password</label>
          <input type="password" id="pf-password" class="form-input" placeholder="Min. 8 characters" autocomplete="new-password">
        </div>
        <div class="form-group">
          <label class="form-label">Confirm New Password</label>
          <input type="password" id="pf-confirm" class="form-input" placeholder="Repeat new password" autocomplete="new-password">
          <span class="field-error" id="pf-confirm-error"></span>
        </div>

        <div class="form-error-banner" id="profile-error" style="display:none"></div>

        <button type="submit" class="btn btn-gold" id="profile-save-btn">
          <i class="fas fa-save"></i> Save Changes
        </button>
      </form>
    </div>
  `;

  document.getElementById('profile-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    clearProfileErrors();

    const firstName = document.getElementById('pf-first').value.trim();
    const lastName  = document.getElementById('pf-last').value.trim();
    const email     = document.getElementById('pf-email').value.trim();
    const phone     = document.getElementById('pf-phone').value.trim();
    const password  = document.getElementById('pf-password').value;
    const confirm   = document.getElementById('pf-confirm').value;
    let valid = true;

    if (!firstName) { showPFError('pf-first', 'Required.'); valid = false; }
    if (!lastName)  { showPFError('pf-last', 'Required.'); valid = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showPFError('pf-email', 'Valid email required.'); valid = false; }
    if (password && password.length < 8) { showPFError('pf-confirm', 'Password must be ≥ 8 chars.'); valid = false; }
    if (password && password !== confirm) { showPFError('pf-confirm', 'Passwords do not match.'); valid = false; }
    if (!valid) return;

    const btn = document.getElementById('profile-save-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';

    const payload = { firstName, lastName, email, phone };
    if (password) payload.password = password;

    const res = await API.auth.updateProfile(payload);
    if (res.success) {
      currentUser = res.data;
      Toast.show('Profile updated successfully!', 'success');
      // Refresh header to reflect name change
      document.getElementById('app-header').innerHTML = '';
      injectShell && injectShell();
    } else {
      document.getElementById('profile-error').textContent = res.error;
      document.getElementById('profile-error').style.display = 'block';
    }
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
  });

  function showPFError(id, msg) {
    const el = document.getElementById(`${id}-error`) || document.getElementById('pf-confirm-error');
    if (el) el.textContent = msg;
    document.getElementById(id)?.classList.add('input-error');
  }
  function clearProfileErrors() {
    document.querySelectorAll('#profile-form .field-error').forEach(e => e.textContent = '');
    document.querySelectorAll('#profile-form .form-input').forEach(i => i.classList.remove('input-error'));
    const fe = document.getElementById('profile-error');
    fe.textContent = ''; fe.style.display = 'none';
  }
}

/* ─── Addresses ──────────────────────────────────────────────── */
function renderAddresses(el) {
  const addresses = currentUser.addresses || [];

  function buildAddressCard(addr, i) {
    return `
      <div class="address-card" data-index="${i}">
        ${addr.isDefault ? '<span class="address-default-badge">Default</span>' : ''}
        <p><strong>${addr.fullName}</strong></p>
        <p>${addr.line1}</p>
        ${addr.line2 ? `<p>${addr.line2}</p>` : ''}
        <p>${addr.city}, ${addr.state} ${addr.zip}</p>
        <p>${addr.country}</p>
        <p>${addr.phone}</p>
        <div class="address-card-actions">
          <button class="btn btn-ghost btn-sm addr-remove-btn" data-index="${i}">
            <i class="fas fa-trash"></i> Remove
          </button>
        </div>
      </div>
    `;
  }

  el.innerHTML = `
    <div class="account-section">
      <h2>Saved Addresses</h2>

      <div class="addresses-grid" id="addresses-grid">
        ${addresses.length
          ? addresses.map(buildAddressCard).join('')
          : `<p style="color:var(--text-muted)">No saved addresses yet.</p>`
        }
      </div>

      <h3 style="margin:2rem 0 1rem">Add New Address</h3>
      <form class="account-form" id="address-form" novalidate>
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" id="addr-name" class="form-input" placeholder="Name Last name" required>
          </div>
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input type="tel" id="addr-phone" class="form-input" placeholder="+252 617987865" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Address Line 1</label>
          <input type="text" id="addr-line1" class="form-input" placeholder="123 Main St" required>
        </div>
        <div class="form-group">
          <label class="form-label">Address Line 2 (optional)</label>
          <input type="text" id="addr-line2" class="form-input" placeholder="Apt 4B">
        </div>
        <div class="form-row-3">
          <div class="form-group">
            <label class="form-label">City</label>
            <input type="text" id="addr-city" class="form-input" required>
          </div>
          <div class="form-group">
            <label class="form-label">State / Region</label>
            <input type="text" id="addr-state" class="form-input" required>
          </div>
          <div class="form-group">
            <label class="form-label">ZIP / Postal Code</label>
            <input type="text" id="addr-zip" class="form-input" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Country</label>
          <input type="text" id="addr-country" class="form-input" placeholder="Somalia" required>
        </div>
        <div class="form-check-group">
          <label class="form-check">
            <input type="checkbox" id="addr-default"> Set as default address
          </label>
        </div>
        <span class="field-error" id="addr-error"></span>
        <button type="submit" class="btn btn-gold" id="addr-save-btn">
          <i class="fas fa-plus"></i> Save Address
        </button>
      </form>
    </div>
  `;

  // Remove address
  document.querySelectorAll('.addr-remove-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.index);
      const res = await API.address.remove(idx);
      if (res.success) {
        currentUser = res.data;
        renderAddresses(el);
        Toast.show('Address removed.', 'info');
      }
    });
  });

  // Add address
  document.getElementById('address-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('addr-error');
    errEl.textContent = '';

    const addr = {
      fullName:  document.getElementById('addr-name').value.trim(),
      phone:     document.getElementById('addr-phone').value.trim(),
      line1:     document.getElementById('addr-line1').value.trim(),
      line2:     document.getElementById('addr-line2').value.trim(),
      city:      document.getElementById('addr-city').value.trim(),
      state:     document.getElementById('addr-state').value.trim(),
      zip:       document.getElementById('addr-zip').value.trim(),
      country:   document.getElementById('addr-country').value.trim() || 'Somalia',
      isDefault: document.getElementById('addr-default').checked,
    };

    if (!addr.fullName || !addr.line1 || !addr.city || !addr.state || !addr.zip) {
      errEl.textContent = 'Please fill in all required fields.';
      return;
    }

    const btn = document.getElementById('addr-save-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    const res = await API.address.add(addr);
    if (res.success) {
      currentUser = res.data;
      renderAddresses(el);
      Toast.show('Address saved!', 'success');
    } else {
      errEl.textContent = res.error;
    }
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Save Address';
  });
}
