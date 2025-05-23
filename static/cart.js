// cart.js: Handles cart page logic, dynamic cart rendering, and badge update
const BASE_URL = 'http://127.0.0.1:5000';

function getToken() {
    let token = localStorage.getItem('jwt_token');
    if (token) return token;
    const match = document.cookie.match(/(?:^|; )jwt_token=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
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
        total += item.price * (item.quantity || 1);
        const itemDiv = document.createElement('div');
        itemDiv.className = 'cart-item';
        itemDiv.innerHTML = `
            <img src="${item.image}" alt="${item.title}" class="cart-item-img">
            <div class="cart-item-info">
                <div class="cart-item-title">${item.title}</div>
                <div class="cart-item-price">$${item.price.toFixed(2)}</div>
                <div class="cart-item-qty">Qty: ${item.quantity || 1}</div>
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

document.addEventListener('DOMContentLoaded', function () {
    initCartHeader();
    renderCart();
    const token = getToken();
    if (token) updateCartBadgeBackend(token);
});
