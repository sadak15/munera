/**
 * MUNERA SKINCARE — Local JSON API  v2
 * Simulates a REST API using localStorage
 * Provides async/await interface for all data operations
 *
 * Response contract — res.data is ALWAYS the value directly, never wrapped:
 *   auth.me / login / register / updateProfile  → user object
 *   address.add / address.remove                → updated user object
 *   cart.get / add / updateQty / remove / clear → array of { productId, qty }
 *   wishlist.get                                → array of productId strings
 *   wishlist.toggle                             → { action: 'added' | 'removed' }
 *   wishlist.isWishlisted                       → boolean
 *   orders.get                                  → array of orders
 *   orders.place                                → { orderId }
 *   products.getAll                             → array of products
 *   products.getOne                             → product object
 */

const MuneraAPI = (() => {
  const KEYS = {
    users:   'munera_users_db',
    session: 'munera_session',
    cartPfx: 'munera_cart_',
    wishPfx: 'munera_wishlist_',
    orders:  'munera_orders_',
  };

  const DELAY = 200; // Simulate network latency

  /* ── Utilities ──────────────────────────────────────────── */

  const delay = (ms = DELAY) => new Promise(resolve => setTimeout(resolve, ms));

  const ok  = (data)            => ({ success: true,  data });
  const err = (message, code = 400) => ({ success: false, error: message, code });

  const getUsers  = () => { try { return JSON.parse(localStorage.getItem(KEYS.users) || '[]'); } catch { return []; } };
  const saveUsers = (users) => localStorage.setItem(KEYS.users, JSON.stringify(users));
  const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /** Strip password before returning user to callers */
  const safe = (user) => { const { password: _pw, ...safeUser } = user; return safeUser; };

  /* ── Internal: sync session resolver ───────────────────── */

  /**
   * Returns the raw user object (with password) or null.
   * Used internally — callers always strip password via safe() before returning.
   */
  const _me = () => {
    try {
      const session = JSON.parse(localStorage.getItem(KEYS.session) || 'null');
      if (!session?.userId) return null;
      return getUsers().find(u => u.id === session.userId) || null;
    } catch { return null; }
  };

  /* ── Auth Endpoints ─────────────────────────────────────── */

  /**
   * POST /auth/register
   * @param {{ firstName, lastName, email, password }} body
   * res.data → user object
   */
  const register = async (body) => {
    await delay();
    const { firstName, lastName, email, password } = body;

    if (!firstName || !lastName || !email || !password)
      return err('All fields are required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return err('Please enter a valid email address.');
    if (password.length < 8)
      return err('Password must be at least 8 characters.');

    const users = getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase()))
      return err('An account with this email already exists.');

    const newUser = {
      id:        generateId(),
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      email:     email.toLowerCase().trim(),
      password:  btoa(password),
      phone:     '',
      addresses: [],
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    saveUsers(users);

    // Auto-login after registration
    const session = { userId: newUser.id, token: generateId(), createdAt: Date.now() };
    localStorage.setItem(KEYS.session, JSON.stringify(session));

    return ok(safe(newUser));
  };

  /**
   * POST /auth/login
   * @param {{ email, password }} body
   * res.data → user object
   */
  const login = async (body) => {
    await delay();
    const { email, password } = body;

    if (!email || !password) return err('Email and password are required.');

    const users = getUsers();
    const user  = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());

    if (!user) return err('No account found with that email address.');
    if (atob(user.password) !== password) return err('Incorrect password. Please try again.');

    const session = { userId: user.id, token: generateId(), createdAt: Date.now() };
    localStorage.setItem(KEYS.session, JSON.stringify(session));

    return ok(safe(user));
  };

  /**
   * POST /auth/logout
   */
  const logout = async () => {
    await delay(50);
    localStorage.removeItem(KEYS.session);
    return ok({ message: 'Logged out successfully.' });
  };

  /**
   * GET /auth/me
   * res.data → user object
   */
  const me = async () => {
    const user = _me();
    if (!user) return err('Not authenticated.', 401);
    return ok(safe(user));
  };

  /**
   * PUT /auth/profile
   * Supports two password change patterns:
   *   - Simple:   { password }                         — used by account.js profile form
   *   - Verified: { currentPassword, newPassword }     — for future use / higher security
   * res.data → updated user object
   */
  const updateProfile = async (body) => {
    await delay();
    const user = _me();
    if (!user) return err('Not authenticated.', 401);

    const users = getUsers();
    const idx   = users.findIndex(u => u.id === user.id);
    if (idx === -1) return err('User not found.', 404);

    // Prevent email duplicate
    if (body.email && body.email.toLowerCase() !== users[idx].email) {
      const dupe = users.find(u => u.email.toLowerCase() === body.email.toLowerCase());
      if (dupe) return err('Email already in use by another account.');
    }

    // Update allowed scalar fields
    ['firstName', 'lastName', 'email', 'phone'].forEach(key => {
      if (body[key] !== undefined)
        users[idx][key] = typeof body[key] === 'string' ? body[key].trim() : body[key];
    });

    // Pattern 1: verified change — requires currentPassword + newPassword
    if (body.newPassword) {
      if (!body.currentPassword)
        return err('Current password is required to set a new password.');
      if (atob(users[idx].password) !== body.currentPassword)
        return err('Current password is incorrect.');
      if (body.newPassword.length < 8)
        return err('New password must be at least 8 characters.');
      users[idx].password = btoa(body.newPassword);
    }
    // Pattern 2: simple change — just { password }
    else if (body.password) {
      if (body.password.length < 8)
        return err('Password must be at least 8 characters.');
      users[idx].password = btoa(body.password);
    }

    saveUsers(users);
    return ok(safe(users[idx]));
  };

  /* ── Address Endpoints ──────────────────────────────────── */

  /**
   * res.data → updated user object (with full addresses array)
   */
  const addAddress = async (address) => {
    await delay();
    const user = _me();
    if (!user) return err('Not authenticated.', 401);

    const users = getUsers();
    const idx   = users.findIndex(u => u.id === user.id);
    if (!users[idx].addresses) users[idx].addresses = [];

    // If marking as default, unset all others first
    if (address.isDefault) {
      users[idx].addresses.forEach(a => { a.isDefault = false; });
    }

    const newAddress = {
      id: generateId(),
      ...address,
      // First address is always default regardless of flag
      isDefault: address.isDefault || users[idx].addresses.length === 0,
    };

    users[idx].addresses.push(newAddress);
    saveUsers(users);
    return ok(safe(users[idx]));
  };

  /**
   * @param {number} addressIndex — zero-based index in addresses array
   * res.data → updated user object
   */
  const removeAddress = async (addressIndex) => {
    await delay();
    const user = _me();
    if (!user) return err('Not authenticated.', 401);

    const users = getUsers();
    const idx   = users.findIndex(u => u.id === user.id);
    const addrs = users[idx].addresses || [];

    if (addressIndex < 0 || addressIndex >= addrs.length)
      return err('Address not found.', 404);

    addrs.splice(addressIndex, 1);
    users[idx].addresses = addrs;
    saveUsers(users);
    return ok(safe(users[idx]));
  };

  /* ── Cart Endpoints ─────────────────────────────────────── */

  const _cartKey  = () => { const u = _me(); return `${KEYS.cartPfx}${u ? u.id : 'guest'}`; };
  const _readCart = () => { try { return JSON.parse(localStorage.getItem(_cartKey()) || '[]'); } catch { return []; } };
  const _writeCart = (items) => localStorage.setItem(_cartKey(), JSON.stringify(items));

  /**
   * res.data → array of { productId, qty }
   */
  const getCart = async () => ok(_readCart());

  /**
   * @param {string|number} productId
   * @param {number} qty
   * res.data → updated cart array
   */
  const addToCart = async (productId, qty = 1) => {
    await delay(50);
    const id    = String(productId);
    const items = _readCart();
    const found = items.find(i => i.productId === id);

    if (found) {
      found.qty = Math.min(found.qty + qty, 10);
    } else {
      items.push({ productId: id, qty });
    }

    _writeCart(items);
    return ok(items);
  };

  /**
   * res.data → updated cart array
   */
  const updateCartQty = async (productId, qty) => {
    await delay(50);
    const id    = String(productId);
    const items = _readCart();
    const found = items.find(i => i.productId === id);
    if (!found) return err('Item not in cart.');

    if (qty <= 0) {
      const updated = items.filter(i => i.productId !== id);
      _writeCart(updated);
      return ok(updated);
    }

    found.qty = Math.min(qty, 10);
    _writeCart(items);
    return ok(items);
  };

  /**
   * res.data → updated cart array
   */
  const removeFromCart = async (productId) => {
    await delay(50);
    const id      = String(productId);
    const updated = _readCart().filter(i => i.productId !== id);
    _writeCart(updated);
    return ok(updated);
  };

  /**
   * res.data → empty array []
   */
  const clearCart = async () => {
    localStorage.removeItem(_cartKey());
    return ok([]);
  };

  /* ── Wishlist Endpoints ─────────────────────────────────── */

  const _wishKey  = () => { const u = _me(); return `${KEYS.wishPfx}${u ? u.id : 'guest'}`; };
  const _readWish = () => { try { return JSON.parse(localStorage.getItem(_wishKey()) || '[]'); } catch { return []; } };

  /**
   * res.data → array of productId strings
   */
  const getWishlist = async () => ok(_readWish());

  /**
   * @param {string|number} productId
   * res.data → { action: 'added' | 'removed' }
   */
  const toggleWishlist = async (productId) => {
    await delay(50);
    const id    = String(productId);
    const items = _readWish();
    const idx   = items.indexOf(id);
    let action;

    if (idx > -1) { items.splice(idx, 1); action = 'removed'; }
    else          { items.push(id);        action = 'added'; }

    localStorage.setItem(_wishKey(), JSON.stringify(items));
    return ok({ action });
  };

  /**
   * res.data → boolean
   */
  const isWishlisted = async (productId) => ok(_readWish().includes(String(productId)));

  /* ── Orders Endpoints ───────────────────────────────────── */

  const _ordersKey = () => { const u = _me(); return `${KEYS.orders}${u ? u.id : 'guest'}`; };

  /**
   * res.data → { orderId }
   */
  const placeOrder = async (orderData) => {
    await delay(500);
    const key = _ordersKey();
    let orders = [];
    try { orders = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}

    const order = {
      id:        `MNR-${Date.now().toString(36).toUpperCase()}`,
      items:     _readCart(), // snapshot cart at time of order
      ...orderData,
      status:    'processing',
      createdAt: new Date().toISOString(),
    };

    orders.unshift(order);
    localStorage.setItem(key, JSON.stringify(orders));

    // Clear cart after successful order
    await clearCart();

    return ok({ orderId: order.id });
  };

  /**
   * res.data → array of orders
   */
  const getOrders = async () => {
    try { return ok(JSON.parse(localStorage.getItem(_ordersKey()) || '[]')); }
    catch { return ok([]); }
  };

  /* ── Products (from JSON file) ──────────────────────────── */

  let _productsCache = null;

  /**
   * res.data → array of products
   */
  const getProducts = async () => {
    if (_productsCache) return ok(_productsCache);
    try {
      const response = await fetch('data/products.json');
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const json = await response.json();
      // Support both a bare array and { products: [...] } shaped JSON
      _productsCache = Array.isArray(json) ? json : (json.products ?? []);
      return ok(_productsCache);
    } catch (e) {
      return err('Failed to load products: ' + e.message);
    }
  };

  /**
   * @param {string|number} idOrSlug
   * res.data → product object
   */
  const getProduct = async (idOrSlug) => {
    const res = await getProducts();
    if (!res.success) return res;

    const product = res.data.find(
      p => p.id === idOrSlug || p.id === Number(idOrSlug) || p.slug === idOrSlug
    );

    return product ? ok(product) : err('Product not found.', 404);
  };

  /* ── Session Helpers (sync) ─────────────────────────────── */

  const isLoggedIn = () => !!_me();

  const getSessionUser = () => {
    const user = _me();
    return user ? safe(user) : null;
  };

  /* ── Public API ─────────────────────────────────────────── */
  return {
    auth:     { register, login, logout, me, updateProfile },
    cart:     { get: getCart, add: addToCart, updateQty: updateCartQty, remove: removeFromCart, clear: clearCart },
    wishlist: { get: getWishlist, toggle: toggleWishlist, isWishlisted },
    address:  { add: addAddress, remove: removeAddress },
    orders:   { place: placeOrder, get: getOrders },
    products: { getAll: getProducts, getOne: getProduct },
    session:  { isLoggedIn, getUser: getSessionUser },
  };
})();

window.API = MuneraAPI;