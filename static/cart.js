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
            showLoginRegister();
            window.location.reload();
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

function attachRemoveHandlers() {
    const removeButtons = document.querySelectorAll('.cart-item-modern-remove');
    removeButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            const gameId = e.target.dataset.id;
            await removeCartItem(gameId);
            fetchCartItems();
        });
    });
}

async function removeCartItem(gameId) {
    const token = getToken();
    try {
        const response = await fetch(`${BASE_URL}/api/cart/${gameId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to remove item');
    } catch (error) {
        console.error(error);
        alert('Error removing item from cart.');
    }
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

// Ensure user data is loaded from cookies and login header is displayed dynamically
window.onload = function() {
    // Update header user menu based on cookies
    updateHeaderUserMenu();

    // Fetch and render cart items after initializing the header
    fetchCartItems();
};
