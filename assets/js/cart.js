/**
 * cart.js — Cart page logic
 * Renders cart items, handles qty/remove, coupon codes, totals, checkout CTA.
 */

const COUPONS = {
  MUNERA10: { type: 'percent', value: 10, label: '10% off' },
  GLOW20:   { type: 'percent', value: 20, label: '20% off' },
  SAVE15:   { type: 'fixed',   value: 15, label: '$15 off' },
};

const FREE_SHIPPING_THRESHOLD = 75;
const SHIPPING_COST = 7.99;

let appliedCoupon = null;

/* ─── Boot ────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await renderCart();
});

/* ─── Render full cart layout ────────────────────────────────── */
async function renderCart() {
  const root = document.getElementById('cart-root');
  if (!root) return;

  const res = await API.cart.get();
  if (!res.success) {
    root.innerHTML = buildError('Failed to load cart. Please refresh.');
    return;
  }

  const items = res.data;

  if (!items.length) {
    root.innerHTML = buildEmptyCart();
    return;
  }

  // Enrich items with product data
  const prodRes = await API.products.getAll();
  const products = prodRes.success ? prodRes.data : [];
  const enriched = items.map(item => ({
    ...item,
    product: products.find(p => String(p.id) === String(item.productId)) || null,
  })).filter(i => i.product); // drop orphaned cart items

  root.innerHTML = buildCartLayout(enriched);
  bindCartEvents(enriched);
  updateSummary(enriched);
}

/* ─── HTML Builders ──────────────────────────────────────────── */
function buildEmptyCart() {
  return `
    <div class="empty-state" style="padding:5rem 0">
      <i class="fas fa-shopping-bag"></i>
      <h3>Your cart is empty</h3>
      <p>Looks like you haven't added anything yet.</p>
      <a href="products.html" class="btn btn-gold">Start Shopping</a>
    </div>
  `;
}

function buildError(msg) {
  return `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>${msg}</h3></div>`;
}

function buildCartLayout(items) {
  const rows = items.map(i => buildCartRow(i)).join('');
  return `
    <div class="cart-layout">
      <!-- Items -->
      <div class="cart-items-section">
        <div class="cart-table-head">
          <span>Product</span>
          <span>Price</span>
          <span>Quantity</span>
          <span>Total</span>
          <span></span>
        </div>
        <div class="cart-rows" id="cart-rows">
          ${rows}
        </div>
        <div class="cart-footer-actions">
          <a href="products.html" class="btn btn-secondary">
            <i class="fas fa-arrow-left"></i> Continue Shopping
          </a>
          <button class="btn btn-ghost" id="clear-cart-btn">
            <i class="fas fa-trash"></i> Clear Cart
          </button>
        </div>
      </div>

      <!-- Summary -->
      <aside class="cart-summary">
        <h3 class="cart-summary-title">Order Summary</h3>

        <!-- Coupon -->
        <div class="coupon-section">
          <label class="coupon-label">Promo Code</label>
          <div class="coupon-input-wrap">
            <input type="text" id="coupon-input" placeholder="Enter code" autocomplete="off">
            <button class="btn btn-secondary" id="apply-coupon-btn">Apply</button>
          </div>
          <p class="coupon-hint" id="coupon-msg"></p>
        </div>

        <!-- Totals -->
        <div class="summary-lines" id="summary-lines">
          <!-- Injected by updateSummary() -->
        </div>

        <a href="checkout.html" class="btn btn-gold btn-lg btn-block checkout-btn" id="checkout-btn">
          Proceed to Checkout <i class="fas fa-arrow-right"></i>
        </a>

        <div class="cart-trust">
          <span><i class="fas fa-lock"></i> Secure Checkout</span>
          <span><i class="fas fa-undo"></i> 30-Day Returns</span>
        </div>

        <div class="payment-icons" style="margin-top:1rem;justify-content:center">
          <i class="fab fa-cc-visa"></i>
          <i class="fab fa-cc-mastercard"></i>
          <i class="fab fa-cc-paypal"></i>
          <i class="fab fa-cc-apple-pay"></i>
        </div>
      </aside>
    </div>
  `;
}

function buildCartRow(item) {
  const p = item.product;
  const lineTotal = p.price * item.qty;
  return `
    <div class="cart-row" data-id="${item.productId}">
      <div class="cart-row-product">
        <a href="product-detail.html?id=${p.id}">
          <img src="${p.image}" alt="${p.name}" loading="lazy">
        </a>
        <div class="cart-row-info">
          <a href="product-detail.html?id=${p.id}" class="cart-row-name">${p.name}</a>
          <p class="cart-row-cat">${p.category} · ${p.size}</p>
        </div>
      </div>
      <span class="cart-row-price">${formatPrice(p.price)}</span>
      <div class="qty-selector cart-qty">
        <button class="qty-btn cart-qty-minus" data-id="${item.productId}"><i class="fas fa-minus"></i></button>
        <input type="number" class="cart-qty-input" value="${item.qty}" min="1" max="10" data-id="${item.productId}" readonly>
        <button class="qty-btn cart-qty-plus" data-id="${item.productId}"><i class="fas fa-plus"></i></button>
      </div>
      <span class="cart-row-total">${formatPrice(lineTotal)}</span>
      <button class="cart-row-remove" data-id="${item.productId}" aria-label="Remove">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
}

/* ─── Update summary totals ──────────────────────────────────── */
function updateSummary(items) {
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.qty, 0);
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;

  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === 'percent') discount = subtotal * (appliedCoupon.value / 100);
    else discount = Math.min(appliedCoupon.value, subtotal);
  }

  const total = Math.max(0, subtotal - discount + shipping);

  const lines = document.getElementById('summary-lines');
  if (!lines) return;

  const freeShipRemaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  lines.innerHTML = `
    ${freeShipRemaining > 0
      ? `<div class="shipping-progress">
           <p>Add <strong>${formatPrice(freeShipRemaining)}</strong> more for free shipping!</p>
           <div class="progress-bar"><div class="progress-fill" style="width:${(subtotal/FREE_SHIPPING_THRESHOLD)*100}%"></div></div>
         </div>`
      : `<div class="shipping-progress free"><i class="fas fa-check-circle"></i> You qualify for free shipping!</div>`
    }
    <div class="summary-line">
      <span>Subtotal</span><span>${formatPrice(subtotal)}</span>
    </div>
    ${discount > 0 ? `
    <div class="summary-line discount">
      <span>Discount (${appliedCoupon.label})</span><span>−${formatPrice(discount)}</span>
    </div>` : ''}
    <div class="summary-line">
      <span>Shipping</span>
      <span>${shipping === 0 ? '<span class="free-badge">FREE</span>' : formatPrice(shipping)}</span>
    </div>
    <div class="summary-line summary-total">
      <span>Total</span><span>${formatPrice(total)}</span>
    </div>
  `;
}

/* ─── Bind all cart events ───────────────────────────────────── */
function bindCartEvents(initialItems) {
  // Use a mutable reference so we can update after qty changes
  let items = [...initialItems];

  async function refreshAfterChange() {
    const res = await API.cart.get();
    if (!res.success) return;
    const prodRes = await API.products.getAll();
    const products = prodRes.success ? prodRes.data : [];
    items = res.data.map(item => ({
      ...item,
      product: products.find(p => String(p.id) === String(item.productId)) || null,
    })).filter(i => i.product);
    updateSummary(items);
    updateBadges();
  }

  // Qty minus
  document.addEventListener('click', async e => {
    const btn = e.target.closest('.cart-qty-minus');
    if (!btn) return;
    const id = btn.dataset.id;
    const input = document.querySelector(`.cart-qty-input[data-id="${id}"]`);
    const currentQty = parseInt(input?.value || 1);
    if (currentQty <= 1) return;
    const res = await API.cart.updateQty(id, currentQty - 1);
    if (res.success) {
      if (input) input.value = currentQty - 1;
      const row = document.querySelector(`.cart-row[data-id="${id}"]`);
      const product = items.find(i => String(i.productId) === String(id))?.product;
      if (row && product) {
        row.querySelector('.cart-row-total').textContent = formatPrice(product.price * (currentQty - 1));
      }
      await refreshAfterChange();
    }
  });

  // Qty plus
  document.addEventListener('click', async e => {
    const btn = e.target.closest('.cart-qty-plus');
    if (!btn) return;
    const id = btn.dataset.id;
    const input = document.querySelector(`.cart-qty-input[data-id="${id}"]`);
    const currentQty = parseInt(input?.value || 1);
    if (currentQty >= 10) return;
    const res = await API.cart.updateQty(id, currentQty + 1);
    if (res.success) {
      if (input) input.value = currentQty + 1;
      const product = items.find(i => String(i.productId) === String(id))?.product;
      const row = document.querySelector(`.cart-row[data-id="${id}"]`);
      if (row && product) {
        row.querySelector('.cart-row-total').textContent = formatPrice(product.price * (currentQty + 1));
      }
      await refreshAfterChange();
    }
  });

  // Remove item
  document.addEventListener('click', async e => {
    const btn = e.target.closest('.cart-row-remove');
    if (!btn) return;
    const id = btn.dataset.id;
    const row = document.querySelector(`.cart-row[data-id="${id}"]`);
    row?.classList.add('removing');
    const res = await API.cart.remove(id);
    if (res.success) {
      setTimeout(async () => {
        row?.remove();
        items = items.filter(i => String(i.productId) !== String(id));
        if (!items.length) {
          document.getElementById('cart-root').innerHTML = buildEmptyCart();
        } else {
          await refreshAfterChange();
        }
        updateBadges();
        Toast.show('Item removed from cart.', 'info');
      }, 250);
    }
  });

  // Clear cart
  document.getElementById('clear-cart-btn')?.addEventListener('click', async () => {
    if (!confirm('Remove all items from your cart?')) return;
    const res = await API.cart.clear();
    if (res.success) {
      document.getElementById('cart-root').innerHTML = buildEmptyCart();
      updateBadges();
      Toast.show('Cart cleared.', 'info');
    }
  });

  // Coupon
  document.getElementById('apply-coupon-btn')?.addEventListener('click', () => {
    const code = document.getElementById('coupon-input')?.value.trim().toUpperCase();
    const msg  = document.getElementById('coupon-msg');
    if (!code) return;
    const coupon = COUPONS[code];
    if (coupon) {
      appliedCoupon = coupon;
      if (msg) { msg.textContent = `✓ Coupon applied: ${coupon.label}`; msg.className = 'coupon-hint success'; }
      Toast.show(`Coupon "${code}" applied! ${coupon.label}`, 'success');
    } else {
      appliedCoupon = null;
      if (msg) { msg.textContent = 'Invalid coupon code.'; msg.className = 'coupon-hint error'; }
    }
    updateSummary(items);
  });
}
