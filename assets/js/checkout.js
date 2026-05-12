/**
 * checkout.js — Multi-step checkout
 * Steps: 1 = Shipping  |  2 = Payment  |  3 = Review & Place Order
 */

const SHIPPING_COST = 7.99;
const FREE_SHIPPING_THRESHOLD = 75;

let step = 1;
let cartItems = [];
let products  = [];
let enriched  = [];

const formData = {
  shipping: {},
  payment:  {},
};

/* ─── Boot ────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // Load cart — redirect if empty
  const [cartRes, prodRes] = await Promise.all([
    API.cart.get(),
    API.products.getAll(),
  ]);

  cartItems = cartRes.success ? cartRes.data : [];
  products  = prodRes.success ? prodRes.data : [];
  enriched  = cartItems
    .map(i => ({ ...i, product: products.find(p => String(p.id) === String(i.productId)) }))
    .filter(i => i.product);

  if (!enriched.length) {
    window.location.href = 'cart.html';
    return;
  }

  renderCheckout();
});

/* ─── Main render ─────────────────────────────────────────────── */
function renderCheckout() {
  const root = document.getElementById('checkout-root');
  if (!root) return;

  const subtotal = enriched.reduce((s, i) => s + i.product.price * i.qty, 0);
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const total    = subtotal + shipping;

  root.innerHTML = `
    <div class="checkout-main">

      <!-- Step Indicator -->
      <div class="checkout-steps">
        <div class="checkout-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'done' : ''}" data-step="1">
          <div class="step-circle">${step > 1 ? '<i class="fas fa-check"></i>' : '1'}</div>
          <span>Shipping</span>
        </div>
        <div class="checkout-step-line ${step > 1 ? 'done' : ''}"></div>
        <div class="checkout-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'done' : ''}" data-step="2">
          <div class="step-circle">${step > 2 ? '<i class="fas fa-check"></i>' : '2'}</div>
          <span>Payment</span>
        </div>
        <div class="checkout-step-line ${step > 2 ? 'done' : ''}"></div>
        <div class="checkout-step ${step >= 3 ? 'active' : ''}" data-step="3">
          <div class="step-circle">3</div>
          <span>Review</span>
        </div>
      </div>

      <!-- Step Panel -->
      <div class="checkout-panel" id="checkout-panel">
        ${step === 1 ? buildShippingStep() : ''}
        ${step === 2 ? buildPaymentStep() : ''}
        ${step === 3 ? buildReviewStep(subtotal, shipping, total) : ''}
      </div>
    </div>

    <!-- Order Summary Sidebar -->
    <aside class="checkout-sidebar">
      <h3>Order Summary</h3>
      <div class="checkout-items">
        ${enriched.map(i => `
          <div class="checkout-item">
            <div class="checkout-item-img">
              <img src="${i.product.image}" alt="${i.product.name}">
              <span class="checkout-item-qty">${i.qty}</span>
            </div>
            <div class="checkout-item-info">
              <p>${i.product.name}</p>
              <small>${i.product.size}</small>
            </div>
            <span>${formatPrice(i.product.price * i.qty)}</span>
          </div>
        `).join('')}
      </div>
      <div class="summary-lines">
        <div class="summary-line"><span>Subtotal</span><span>${formatPrice(subtotal)}</span></div>
        <div class="summary-line">
          <span>Shipping</span>
          <span>${shipping === 0 ? '<span class="free-badge">FREE</span>' : formatPrice(shipping)}</span>
        </div>
        <div class="summary-line summary-total"><span>Total</span><span>${formatPrice(total)}</span></div>
      </div>
      <div class="cart-trust" style="margin-top:1.5rem">
        <span><i class="fas fa-lock"></i> Secure Checkout</span>
        <span><i class="fas fa-shield-alt"></i> Data Protected</span>
      </div>
    </aside>
  `;

  bindStepEvents(subtotal, shipping, total);
}

/* ─── Step 1: Shipping ───────────────────────────────────────── */
function buildShippingStep() {
  const s = formData.shipping;
  return `
    <div class="checkout-card">
      <h2>Shipping Information</h2>
      <form id="shipping-form" novalidate>
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">First Name</label>
            <input type="text" id="sh-first" class="form-input" value="${s.firstName || ''}" placeholder="Name" required>
            <span class="field-error" id="sh-first-error"></span>
          </div>
          <div class="form-group">
            <label class="form-label">Last Name</label>
            <input type="text" id="sh-last" class="form-input" value="${s.lastName || ''}" placeholder="Last name" required>
            <span class="field-error" id="sh-last-error"></span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" id="sh-email" class="form-input" value="${s.email || ''}" placeholder="you@example.com" required>
          <span class="field-error" id="sh-email-error"></span>
        </div>
        <div class="form-group">
          <label class="form-label">Phone</label>
          <input type="tel" id="sh-phone" class="form-input" value="${s.phone || ''}" placeholder="+252 617987865">
        </div>
        <div class="form-group">
          <label class="form-label">Address</label>
          <input type="text" id="sh-line1" class="form-input" value="${s.line1 || ''}" placeholder="123 Main Street" required>
          <span class="field-error" id="sh-line1-error"></span>
        </div>
        <div class="form-group">
          <label class="form-label">Apartment / Suite (optional)</label>
          <input type="text" id="sh-line2" class="form-input" value="${s.line2 || ''}" placeholder="Apt 4B">
        </div>
        <div class="form-row-3">
          <div class="form-group">
            <label class="form-label">City</label>
            <input type="text" id="sh-city" class="form-input" value="${s.city || ''}" required>
            <span class="field-error" id="sh-city-error"></span>
          </div>
          <div class="form-group">
            <label class="form-label">State / Region</label>
            <input type="text" id="sh-state" class="form-input" value="${s.state || ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">ZIP</label>
            <input type="text" id="sh-zip" class="form-input" value="${s.zip || ''}" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Country</label>
          <input type="text" id="sh-country" class="form-input" value="${s.country || 'Somalia'}">
        </div>
        <button type="submit" class="btn btn-gold btn-lg btn-block">
          Continue to Payment <i class="fas fa-arrow-right"></i>
        </button>
      </form>
    </div>
  `;
}

/* ─── Step 2: Payment ────────────────────────────────────────── */
function buildPaymentStep() {
  return `
    <div class="checkout-card">
      <h2>Payment</h2>
      <form id="payment-form" novalidate>
        <div class="payment-methods">
          <label class="payment-method ${formData.payment.method === 'card' || !formData.payment.method ? 'active' : ''}">
            <input type="radio" name="pay-method" value="card" ${!formData.payment.method || formData.payment.method === 'card' ? 'checked' : ''}>
            <i class="fas fa-credit-card"></i> Credit / Debit Card
          </label>
          <label class="payment-method ${formData.payment.method === 'paypal' ? 'active' : ''}">
            <input type="radio" name="pay-method" value="paypal" ${formData.payment.method === 'paypal' ? 'checked' : ''}>
            <i class="fab fa-paypal"></i> PayPal
          </label>
          <label class="payment-method ${formData.payment.method === 'apple' ? 'active' : ''}">
            <input type="radio" name="pay-method" value="apple" ${formData.payment.method === 'apple' ? 'checked' : ''}>
            <i class="fab fa-apple-pay"></i> Apple Pay
          </label>
        </div>

        <div id="card-fields" class="${formData.payment.method === 'paypal' || formData.payment.method === 'apple' ? 'hidden' : ''}">
          <div class="form-group">
            <label class="form-label">Card Number</label>
            <div class="input-icon-wrap">
              <i class="fas fa-credit-card input-icon"></i>
              <input type="text" id="card-num" class="form-input" placeholder="1234 5678 9012 3456"
                maxlength="19" value="${formData.payment.cardNum || ''}">
            </div>
            <span class="field-error" id="card-num-error"></span>
          </div>
          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">Expiry</label>
              <input type="text" id="card-exp" class="form-input" placeholder="MM / YY" maxlength="7" value="${formData.payment.cardExp || ''}">
              <span class="field-error" id="card-exp-error"></span>
            </div>
            <div class="form-group">
              <label class="form-label">CVV</label>
              <input type="password" id="card-cvv" class="form-input" placeholder="•••" maxlength="4" value="${formData.payment.cardCvv || ''}">
              <span class="field-error" id="card-cvv-error"></span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Name on Card</label>
            <input type="text" id="card-name" class="form-input" placeholder="Name Last name" value="${formData.payment.cardName || ''}">
          </div>
        </div>

        <div class="form-row-2" style="margin-top:1.5rem">
          <button type="button" class="btn btn-secondary" id="back-to-shipping">
            <i class="fas fa-arrow-left"></i> Back
          </button>
          <button type="submit" class="btn btn-gold">
            Review Order <i class="fas fa-arrow-right"></i>
          </button>
        </div>
      </form>
    </div>
  `;
}

/* ─── Step 3: Review ─────────────────────────────────────────── */
function buildReviewStep(subtotal, shipping, total) {
  const s = formData.shipping;
  const p = formData.payment;
  const methodLabel = { card: 'Credit Card', paypal: 'PayPal', apple: 'Apple Pay' }[p.method] || 'Card';

  return `
    <div class="checkout-card">
      <h2>Review Your Order</h2>

      <div class="review-section">
        <div class="review-section-head">
          <h4><i class="fas fa-map-marker-alt"></i> Ship To</h4>
          <button class="btn-link" id="edit-shipping">Edit</button>
        </div>
        <p>${s.firstName} ${s.lastName}</p>
        <p>${s.line1}${s.line2 ? ', ' + s.line2 : ''}</p>
        <p>${s.city}, ${s.state} ${s.zip}</p>
        <p>${s.country}</p>
        <p>${s.email}</p>
      </div>

      <div class="review-section">
        <div class="review-section-head">
          <h4><i class="fas fa-credit-card"></i> Payment</h4>
          <button class="btn-link" id="edit-payment">Edit</button>
        </div>
        <p>${methodLabel}${p.method === 'card' && p.cardNum ? ` ending in ${p.cardNum.slice(-4)}` : ''}</p>
      </div>

      <div class="form-error-banner" id="place-error" style="display:none"></div>

      <div class="form-row-2" style="margin-top:2rem">
        <button type="button" class="btn btn-secondary" id="back-to-payment">
          <i class="fas fa-arrow-left"></i> Back
        </button>
        <button class="btn btn-gold btn-lg" id="place-order-btn">
          <i class="fas fa-shield-alt"></i> Place Order — ${formatPrice(total)}
        </button>
      </div>

      <p style="text-align:center;margin-top:1rem;font-size:.8rem;color:var(--text-muted)">
        <i class="fas fa-lock"></i> Your order is protected by 256-bit SSL encryption.
      </p>
    </div>
  `;
}

/* ─── Bind events per step ───────────────────────────────────── */
function bindStepEvents(subtotal, shipping, total) {
  /* Step 1 — Shipping */
  document.getElementById('shipping-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const errors = [];
    const g = id => document.getElementById(id)?.value.trim() || '';

    formData.shipping = {
      firstName: g('sh-first'), lastName: g('sh-last'),
      email: g('sh-email'), phone: g('sh-phone'),
      line1: g('sh-line1'), line2: g('sh-line2'),
      city: g('sh-city'), state: g('sh-state'),
      zip: g('sh-zip'), country: g('sh-country') || 'Somalia',
    };

    if (!formData.shipping.firstName) errors.push(['sh-first', 'Required']);
    if (!formData.shipping.lastName)  errors.push(['sh-last', 'Required']);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.shipping.email)) errors.push(['sh-email', 'Valid email required']);
    if (!formData.shipping.line1) errors.push(['sh-line1', 'Required']);
    if (!formData.shipping.city)  errors.push(['sh-city', 'Required']);

    if (errors.length) {
      errors.forEach(([id, msg]) => {
        document.getElementById(`${id}-error`).textContent = msg;
        document.getElementById(id)?.classList.add('input-error');
      });
      return;
    }
    step = 2;
    renderCheckout();
  });

  /* Step 2 — Payment radio toggle */
  document.querySelectorAll('input[name="pay-method"]').forEach(r => {
    r.addEventListener('change', () => {
      document.querySelectorAll('.payment-method').forEach(l => l.classList.remove('active'));
      r.closest('.payment-method')?.classList.add('active');
      const cardFields = document.getElementById('card-fields');
      if (cardFields) cardFields.classList.toggle('hidden', r.value !== 'card');
    });
  });

  /* Card number formatting */
  document.getElementById('card-num')?.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 16);
    e.target.value = v.match(/.{1,4}/g)?.join(' ') || v;
  });
  document.getElementById('card-exp')?.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (v.length >= 3) v = v.slice(0, 2) + ' / ' + v.slice(2);
    e.target.value = v;
  });

  document.getElementById('back-to-shipping')?.addEventListener('click', () => { step = 1; renderCheckout(); });

  document.getElementById('payment-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const method = document.querySelector('input[name="pay-method"]:checked')?.value || 'card';
    formData.payment = {
      method,
      cardNum:  document.getElementById('card-num')?.value || '',
      cardExp:  document.getElementById('card-exp')?.value || '',
      cardCvv:  document.getElementById('card-cvv')?.value || '',
      cardName: document.getElementById('card-name')?.value || '',
    };

    if (method === 'card') {
      const errors = [];
      const raw = formData.payment.cardNum.replace(/\s/g, '');
      if (raw.length < 13) errors.push(['card-num', 'Enter a valid card number']);
      if (!formData.payment.cardExp.includes('/')) errors.push(['card-exp', 'Enter expiry (MM / YY)']);
      if (formData.payment.cardCvv.length < 3) errors.push(['card-cvv', '3-4 digits required']);
      if (errors.length) {
        errors.forEach(([id, msg]) => {
          document.getElementById(`${id}-error`).textContent = msg;
          document.getElementById(id)?.classList.add('input-error');
        });
        return;
      }
    }

    step = 3;
    renderCheckout();
  });

  /* Step 3 — back/edit */
  document.getElementById('back-to-payment')?.addEventListener('click', () => { step = 2; renderCheckout(); });
  document.getElementById('edit-shipping')?.addEventListener('click', () => { step = 1; renderCheckout(); });
  document.getElementById('edit-payment')?.addEventListener('click', () => { step = 2; renderCheckout(); });

  /* Place Order */
  document.getElementById('place-order-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('place-order-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing order…';

    const res = await API.orders.place({
      shipping: formData.shipping,
      payment:  { method: formData.payment.method },
      subtotal,
      shippingCost: shipping,
      total,
    });

    if (res.success) {
      renderConfirmation(res.data.orderId, total);
    } else {
      const errEl = document.getElementById('place-error');
      if (errEl) { errEl.textContent = res.error || 'Failed to place order. Please try again.'; errEl.style.display = 'block'; }
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-shield-alt"></i> Place Order — ${formatPrice(total)}`;
    }
  });
}

/* ─── Order Confirmation ─────────────────────────────────────── */
function renderConfirmation(orderId, total) {
  const root = document.getElementById('checkout-root');
  if (!root) return;
  updateBadges();
  root.innerHTML = `
    <div class="checkout-confirmation">
      <div class="confirmation-icon"><i class="fas fa-check-circle"></i></div>
      <h2>Order Confirmed!</h2>
      <p class="confirmation-order-id">Order ID: <strong>${orderId}</strong></p>
      <p>Thank you for your purchase. You'll receive a confirmation email shortly.</p>
      <p class="confirmation-total">Total charged: <strong>${formatPrice(total)}</strong></p>
      <div class="confirmation-actions">
        <a href="account.html#orders" class="btn btn-secondary">View My Orders</a>
        <a href="products.html" class="btn btn-gold">Continue Shopping</a>
      </div>
    </div>
  `;
}
