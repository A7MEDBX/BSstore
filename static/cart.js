// cart.js: Handles cart page logic, dynamic cart rendering, and badge update
const BASE_URL = 'http://127.0.0.1:5000';

function getToken() {
    let token = localStorage.getItem('jwt_token');
    if (token) return token;
    let match = document.cookie.match(/(?:^|; )jwt_token=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
    match = document.cookie.match(/(?:^|; )jwt=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
    return null;
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

function initCartHeader() {
    const token = getToken();
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const userMenu = document.getElementById('headerUserMenu');
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    const signOutBtn = document.getElementById('signOutBtn');

    function showUserMenu(user) {
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'none';
        userMenu.style.display = '';
        userName.textContent = user.username;
        userAvatar.textContent = user.username ? user.username[0].toUpperCase() : 'U';
    }
    function showLoginRegister() {
        loginBtn.style.display = '';
        registerBtn.style.display = '';
        userMenu.style.display = 'none';
    }
    if (userMenuBtn && userDropdown) {
        userMenuBtn.onclick = function(e) {
            e.stopPropagation();
            userDropdown.style.display = userDropdown.style.display === 'block' ? 'none' : 'block';
        };
        document.body.addEventListener('click', function() {
            userDropdown.style.display = 'none';
        });
    }
    if (signOutBtn) {
        signOutBtn.onclick = function() {
            localStorage.removeItem('jwt_token');
            // Remove cookies by setting expiry in the past
            document.cookie = 'jwt_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            document.cookie = 'jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            showLoginRegister();
            window.location.href = 'index.html'; // Redirect to home
        };
    }
    if (token) {
        fetch(`${BASE_URL}/api/me`, {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(user => {
            showUserMenu(user);
        })
        .catch(() => {
            showLoginRegister();
        });
    } else {
        showLoginRegister();
    }
}

function updateHeaderUserMenu() {
    const userCookie = getCookie('user');
    const headerUserMenu = document.getElementById('headerUserMenu');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');

    if (userCookie) {
        const user = JSON.parse(decodeURIComponent(userCookie));
        if (userName) userName.textContent = user.username;
        if (userAvatar) userAvatar.textContent = user.username[0].toUpperCase();
        if (headerUserMenu) headerUserMenu.style.display = 'flex';
        if (loginBtn) loginBtn.style.display = 'none';
        if (registerBtn) registerBtn.style.display = 'none';
    } else {
        if (headerUserMenu) headerUserMenu.style.display = 'none';
        if (loginBtn) loginBtn.style.display = '';
        if (registerBtn) registerBtn.style.display = '';
    }
}

async function fetchCartFromBackend() {
    const token = getToken();
    if (!token) return [];
    try {
        const res = await fetch(`${BASE_URL}/api/cart`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.items || [];
    } catch (e) { return []; }
}

async function renderCart() {
    const cart = await fetchCartFromBackend();
    const cartContainer = document.getElementById('cartContainer');
    const cartSummary = document.getElementById('cartSummary');
    const cartEmpty = document.getElementById('cartEmpty');
    const cartTotal = document.getElementById('cartTotal');

    cartContainer.innerHTML = '';
    if (cart.length === 0) {
        cartSummary.style.display = 'none';
        cartEmpty.style.display = 'block';
        return;
    }
    cartSummary.style.display = 'flex';
    cartEmpty.style.display = 'none';

    let total = 0;
    cart.forEach((item, idx) => {
        total += item.price;
        const itemDiv = document.createElement('div');
        itemDiv.className = 'cart-item';
        itemDiv.innerHTML = `
            <img src="${item.image}" alt="${item.title}" class="cart-item-img">
            <div class="cart-item-info">
                <div class="cart-item-title">${item.title}</div>
                <div class="cart-item-price">$${item.price.toFixed(2)}</div>
            </div>
            <button class="cart-remove-btn" data-id="${item.id}">Remove</button>
        `;
        cartContainer.appendChild(itemDiv);
    });
    cartTotal.textContent = `$${total.toFixed(2)}`;

    // Remove item
    cartContainer.querySelectorAll('.cart-remove-btn').forEach(btn => {
        btn.addEventListener('click', async function () {
            const itemId = this.getAttribute('data-id');
            const token = getToken();
            if (!token) return;
            await fetch(`${BASE_URL}/api/cart/${itemId}`, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + token }
            });
            renderCart();
            updateCartBadgeBackend(token);
        });
    });
}

async function updateCartBadgeBackend(token) {
    try {
        const res = await fetch(`${BASE_URL}/api/cart`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) return;
        const data = await res.json();
        const badge = document.getElementById('cartBadge');
        if (badge) {
            if (data.items && data.items.length > 0) {
                badge.textContent = data.items.length;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (e) {}
}

function showLoginPopup() {
    let popup = document.createElement('div');
    popup.className = 'login-required-popup';
    popup.innerHTML = `
        <div class="popup-content">
            <svg width="48" height="48" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="12" fill="#ff6f61"/>
                <path d="M12 8v4m0 4h.01" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <div class="popup-title">Login Required</div>
            <div class="popup-msg">Please log in to view your cart.</div>
        </div>
    `;
    document.body.appendChild(popup);
    setTimeout(() => { popup.classList.add('show'); }, 10);
    setTimeout(() => { popup.classList.remove('show'); setTimeout(()=>popup.remove(), 400); }, 2400);
}

function showCartErrorPopup() {
    let popup = document.createElement('div');
    popup.className = 'registration-complete-popup';
    popup.innerHTML = `
        <div class="popup-content">
            <svg width="48" height="48" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="12" fill="#ff6f61"/>
                <path d="M12 8v4m0 4h.01" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <div class="popup-title">Error</div>
            <div class="popup-msg">Error fetching cart items.<br>Please try again later.</div>
        </div>
    `;
    document.body.appendChild(popup);
    setTimeout(() => { popup.classList.add('show'); }, 10);
    setTimeout(() => { popup.classList.remove('show'); setTimeout(()=>popup.remove(), 400); }, 2400);
}

// Fetch and render cart items
async function fetchCartItems() {
    const token = getToken();
    const userCookie = getCookie('user');
    if (!token && !userCookie) {
        showLoginPopup();
        return;
    }
    try {
        const response = await fetch(`${BASE_URL}/api/cart`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch cart items');
        const cartItems = await response.json();
        renderCartItems(cartItems);
    } catch (error) {
        console.error(error);
        showCartErrorPopup();
    }
}

function renderCartItems(response) {
    // Accepts the full response object and extracts items
    const items = response.items || [];
    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    const cartPrice = document.getElementById('cart-price');
    cartItemsContainer.innerHTML = '';
    let total = 0;
    items.forEach(item => {
        total += item.price;
        const itemDiv = document.createElement('div');
        itemDiv.className = 'cart-item-modern epic-cart-item';
        itemDiv.innerHTML = `
            <div class="cart-item-modern-imgbox">
                <img src="${item.image || 'static/images/games/default.jpg'}" alt="${item.title}" class="cart-item-modern-img">
            </div>
            <div class="cart-item-modern-details">
                <div class="cart-item-modern-title-row">
                    <span class="cart-item-modern-badge">Base Game</span>
                    <span class="cart-item-modern-title">${item.title}</span>
                    <span class="cart-item-modern-price" style="margin-left:auto;">$${item.price.toFixed(2)}</span>
                </div>
                <div class="cart-item-modern-rating-row" style="margin-bottom:12px;">
                    <img src="static/images/games/esrb-m.png" class="cart-item-modern-rating-img" alt="Mature 17+">
                    <span class="cart-item-modern-rating-label">Mature 17+</span>
                    <span class="cart-item-modern-rating-desc">Blood and Gore, Language, Sexual Themes, Violence</span>
                </div>
                <div class="cart-item-modern-reward-row">
                    <span class="cart-item-modern-reward-icon">&#9888;</span>
                    <span class="cart-item-modern-reward-text">Earn a boosted 20% back in Epic Rewards, offer ends Aug 31.</span>
                </div>
                <div class="cart-item-modern-refund-row">
                    Self-Refundable <span class="cart-item-modern-refund-icon" title="This item is self-refundable.">?</span>
                </div>
                <div class="cart-item-modern-actions-row">
                    <button class="cart-item-modern-remove" data-id="${item.game_id}">Remove</button>
                    <button class="cart-item-modern-wishlist">Move to wishlist</button>
                </div>
            </div>
        `;
        cartItemsContainer.appendChild(itemDiv);
    });
    if (cartPrice) cartPrice.textContent = `$${total.toFixed(2)}`;
    if (cartTotal) cartTotal.textContent = `$${total.toFixed(2)}`;
    attachRemoveHandlers();
}

// Update cart badge after cart changes
async function updateCartBadgeAfterChange() {
    const token = getToken();
    if (token) await updateCartBadgeBackend(token);
}

// Patch attachRemoveHandlers to update header and badge after removal
function attachRemoveHandlers() {
    const removeButtons = document.querySelectorAll('.cart-item-modern-remove');
    removeButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            const gameId = e.target.dataset.id;
            await removeCartItem(gameId);
            showPopupMessage('Game removed from cart', 'success');
            await fetchCartItems();
            await updateCartBadgeAfterChange();
            initCartHeader();
            updateHeaderUserMenu();
        });
    });
}

function removeCartItem(gameId) {
    const token = getToken();
    return fetch(`${BASE_URL}/api/cart/${gameId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
}

function showPopupMessage(message, type) {
    const popup = document.createElement('div');
    popup.className = `popup-message ${type}`; // Add type for styling (e.g., 'success', 'error')
    popup.textContent = message;
    document.body.appendChild(popup);

    setTimeout(() => {
        popup.remove();
    }, 3000); // Remove popup after 3 seconds
}

// --- POPUP ORDER SUMMARY & PLACE ORDER LOGIC ---
function showOrderSummaryPopup(cartItems) {
    // Remove any existing popup
    const old = document.getElementById('orderSummaryPopup');
    if (old) old.remove();
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'orderSummaryPopup';
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.45)';
    overlay.style.zIndex = 9999;
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    // Popup box
    const box = document.createElement('div');
    box.style.background = '#fff';
    box.style.borderRadius = '16px';
    box.style.width = '410px';
    box.style.maxWidth = '95vw';
    box.style.maxHeight = '90vh';
    box.style.overflowY = 'auto';
    box.style.boxShadow = '0 8px 32px rgba(0,0,0,0.18)';
    box.style.padding = '0 0 24px 0';
    box.style.position = 'relative';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '18px';
    closeBtn.style.right = '22px';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.fontSize = '1.7em';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => overlay.remove();
    box.appendChild(closeBtn);

    // Title
    const title = document.createElement('div');
    title.textContent = 'ORDER SUMMARY';
    title.style.fontWeight = 'bold';
    title.style.fontSize = '1.13em';
    title.style.letterSpacing = '0.04em';
    title.style.padding = '28px 28px 8px 28px';
    box.appendChild(title);

    // Games list (all games, each with details)
    cartItems.forEach(item => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '18px';
        row.style.padding = '12px 28px 0 28px';
        const img = document.createElement('img');
        img.src = item.image_url || item.image || 'static/images/games/default.jpg';
        img.style.width = '72px';
        img.style.height = '72px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '8px';
        row.appendChild(img);
        const info = document.createElement('div');
        info.style.flex = '1';
        info.innerHTML = `
            <div style="font-weight:600;font-size:1.08em;">${item.title}</div>
            <div style="color:#666;font-size:0.98em;">${item.publisher || ''}</div>
            <div style="margin:6px 0 0 0;">
                <span style="background:#1a9fff;color:#fff;font-size:0.85em;padding:2px 8px;border-radius:6px;font-weight:600;">-100%</span>
                <span style="color:#888;text-decoration:line-through;margin-left:8px;">${item.price ? '$' + item.price.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}) : ''}</span>
                <span style="color:#222;font-weight:600;margin-left:8px;">$0.00</span>
            </div>
        `;
        row.appendChild(info);
        box.appendChild(row);
    });

    // Divider
    const divider = document.createElement('div');
    divider.style.height = '1px';
    divider.style.background = '#eee';
    divider.style.margin = '18px 0 0 0';
    box.appendChild(divider);

    // Price summary
    let total = cartItems.reduce((sum, item) => sum + (item.price || 0), 0);
    const priceBox = document.createElement('div');
    priceBox.style.padding = '18px 28px 0 28px';
    priceBox.innerHTML = `<div style="display:flex;justify-content:space-between;font-size:1em;"><span>Price</span><span>$${total.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>`;
    box.appendChild(priceBox);
    // Sale Discount
    const discountBox = document.createElement('div');
    discountBox.style.padding = '8px 28px 0 28px';
    discountBox.innerHTML = `<div style="display:flex;justify-content:space-between;font-size:1em;"><span>Sale Discount</span><span>-$${total.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>`;
    box.appendChild(discountBox);
    // Total
    const totalBox = document.createElement('div');
    totalBox.style.padding = '8px 28px 0 28px';
    totalBox.innerHTML = `<div style="display:flex;justify-content:space-between;font-size:1.1em;font-weight:700;"><span>Total</span><span>$0.00</span></div>`;
    box.appendChild(totalBox);

    // Rewards info
    const rewardsBox = document.createElement('div');
    rewardsBox.style.background = '#f5f6fa';
    rewardsBox.style.margin = '18px 28px 0 28px';
    rewardsBox.style.padding = '12px 14px';
    rewardsBox.style.borderRadius = '8px';
    rewardsBox.style.fontSize = '0.98em';
    rewardsBox.innerHTML = `<span style="color:#222;">Earn <b>$0.00</b> in Epic Rewards with this purchase.</span>`;
    box.appendChild(rewardsBox);

    // Help link (no email agreement for all games)
    const helpBox = document.createElement('div');
    helpBox.style.margin = '18px 28px 0 28px';
    helpBox.style.fontSize = '0.97em';
    helpBox.innerHTML = `<div style="margin-top:0;color:#888;font-size:0.97em;">Need Help? <a href="#" style="color:#0074e4;text-decoration:underline;">Contact Us</a></div>`;
    box.appendChild(helpBox);

    // Place Order button
    const placeOrderBtn = document.createElement('button');
    placeOrderBtn.textContent = 'PLACE ORDER';
    placeOrderBtn.style.margin = '24px auto 0 auto';
    placeOrderBtn.style.display = 'block';
    placeOrderBtn.style.width = '90%';
    placeOrderBtn.style.background = '#0074e4';
    placeOrderBtn.style.color = '#fff';
    placeOrderBtn.style.fontWeight = 'bold';
    placeOrderBtn.style.fontSize = '1.1em';
    placeOrderBtn.style.border = 'none';
    placeOrderBtn.style.borderRadius = '8px';
    placeOrderBtn.style.padding = '14px 0';
    placeOrderBtn.style.cursor = 'pointer';
    placeOrderBtn.style.transition = 'background 0.2s';
    placeOrderBtn.onmouseover = () => placeOrderBtn.style.background = '#005bb5';
    placeOrderBtn.onmouseout = () => placeOrderBtn.style.background = '#0074e4';
    box.appendChild(placeOrderBtn);

    // Place order logic
    placeOrderBtn.onclick = async () => {
        placeOrderBtn.disabled = true;
        placeOrderBtn.textContent = 'Processing...';
        const token = getToken();
        let userId = null;
        // Try to get userId from /api/me
        try {
            const res = await fetch(`${BASE_URL}/api/me`, { headers: { 'Authorization': 'Bearer ' + token } });
            if (res.ok) {
                const user = await res.json();
                userId = user.id;
            }
        } catch {}
        if (!userId) {
            placeOrderBtn.disabled = false;
            placeOrderBtn.textContent = 'PLACE ORDER';
            showPopupMessage('Login required', 'error');
            return;
        }
        // Add each game to user library
        let allSuccess = true;
        for (const item of cartItems) {
            const resp = await fetch(`${BASE_URL}/api/userlibrary`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ user_id: userId, game_id: item.game_id })
            });
            if (!resp.ok) allSuccess = false;
        }
        // Remove all games from cart after order
        for (const item of cartItems) {
            await fetch(`${BASE_URL}/api/cart/${item.game_id}`, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + token }
            });
        }
        if (allSuccess) {
            showPopupMessage('Order placed! Games added to your library.', 'success');
            overlay.remove();
            fetchCartItems();
            // --- PATCH: update cart badge and header after checkout ---
            initCartHeader();
            updateHeaderUserMenu();
            updateCartBadgeBackend(token);
        } else {
            showPopupMessage('Some games could not be added.', 'error');
        }
    };

    document.body.appendChild(overlay);
    overlay.appendChild(box);
}
window.showOrderSummaryPopup = showOrderSummaryPopup;

// --- Attach to checkout button ---
function attachCheckoutButtonHandler() {
    const checkoutBtn = document.getElementById('checkout-btn');
    if (!checkoutBtn) return;
    if (checkoutBtn._handlerAttached) return; // Prevent double-attach
    checkoutBtn._handlerAttached = true;
    checkoutBtn.onclick = async function(e) {
        console.log('Checkout button clicked');
        e.preventDefault();
        const token = getToken();
        if (!token) {
            showPopupMessage('Login required', 'error');
            return;
        }
        try {
            const response = await fetch(`${BASE_URL}/api/cart`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (!response.ok) throw new Error('Failed to fetch cart');
            const cartData = await response.json();
            const items = cartData.items || [];
            if (!items.length) {
                showPopupMessage('Your cart is empty.', 'error');
                return;
            }
            showOrderSummaryPopup(items);
        } catch (err) {
            showPopupMessage('Failed to load cart.', 'error');
        }
    };
}

function robustCheckoutButtonAttach() {
    attachCheckoutButtonHandler();
    // MutationObserver for dynamic DOM changes
    const observer = new MutationObserver(() => {
        attachCheckoutButtonHandler();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // Fallback: interval
    let tries = 0;
    const interval = setInterval(() => {
        attachCheckoutButtonHandler();
        tries++;
        if (tries > 10) clearInterval(interval);
    }, 500);
}

window.onload = function() {
    initCartHeader();
    updateHeaderUserMenu();
    fetchCartItems();
    robustCheckoutButtonAttach();
};
