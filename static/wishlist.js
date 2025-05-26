// Modern popup message fallback if not present
if (typeof window.showPopupMessage !== 'function') {
    window.showPopupMessage = function (msg, type = 'info') {
        let popup = document.createElement('div');
        popup.textContent = msg;
        popup.className = 'modern-popup-message ' + (type || 'info');
        popup.style.position = 'fixed';
        popup.style.top = '32px';
        popup.style.left = '50%';
        popup.style.transform = 'translateX(-50%)';
        popup.style.background = type === 'error' ? '#e53935' : (type === 'success' ? '#1ba9ff' : '#23262e');
        popup.style.color = '#fff';
        popup.style.padding = '16px 32px';
        popup.style.borderRadius = '10px';
        popup.style.fontSize = '1.1rem';
        popup.style.fontWeight = '600';
        popup.style.zIndex = 9999;
        popup.style.boxShadow = '0 2px 16px #0005';
        document.body.appendChild(popup);
        setTimeout(() => { popup.style.opacity = '0'; }, 1800);
        setTimeout(() => { popup.remove(); }, 2300);
    };
}

// Fetch wishlist from API and render
async function fetchWishlist() {
    // Always get the latest token from localStorage or cookies
    let token = localStorage.getItem('jwt_token');
    if (!token) {
        // Try jwt cookie (backend sets this)
        const match = document.cookie.match(/(?:^|; )jwt=([^;]*)/);
        if (match) token = decodeURIComponent(match[1]);
    }
    if (!token) {
        if (window.showPopupMessage) showPopupMessage('You must be logged in to view your wishlist.', 'error');
        return [];
    }
    const res = await fetch('http://127.0.0.1:5000/api/wishlist', {
        headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) return [];
    return await res.json();
}

function renderWishlist(games) {
    const list = document.getElementById('wishlistList');
    list.innerHTML = '';
    if (!games.length) {
        list.innerHTML = '<div style="color:#aaa;font-size:1.15rem;margin:32px 0;">Your wishlist is empty.</div>';
        return;
    }
    games.forEach(game => {
        const card = document.createElement('div');
        card.className = 'wishlist-card';
        card.innerHTML = `
            <img src="${game.image_url || 'https://via.placeholder.com/120x160?text=No+Image'}" alt="${game.title}">
            <div class="wishlist-info">
                <div class="wishlist-title">${game.title}</div>
                <div class="wishlist-price">${game.currency || '$'} ${game.price ? game.price.toLocaleString() : 'N/A'}</div>
                <div class="wishlist-pegi">
                    <span class="wishlist-pegi-badge">PEGI ${game.pegi || 18}</span>
                    <span class="wishlist-pegi-desc">${game.pegi_desc || 'Violence'}</span>
                </div>
                <div class="wishlist-epic-reward">
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#ffe082"/><path d="M8 12l2.5 2.5L16 9" stroke="#23262e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    ${game.reward || 'Earn a boosted 20% back in Epic Rewards, offer ends Aug 31.'}
                </div>
                <div class="wishlist-actions">
                    <button class="wishlist-remove">Remove</button>
                    <button class="wishlist-addcart">Add To Cart</button>
                </div>
            </div>
        `;
        card.querySelector('.wishlist-remove').onclick = async () => {
            let token = localStorage.getItem('jwt_token');
            if (!token) {
                const match = document.cookie.match(/(?:^|; )jwt=([^;]*)/);
                if (match) token = decodeURIComponent(match[1]);
            }
            if (!token) {
                if (window.showPopupMessage) showPopupMessage('You must be logged in.', 'error');
                return;
            }
            try {
                const resp = await fetch(`http://127.0.0.1:5000/api/wishlist/${game.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (resp.ok) {
                    if (window.showPopupMessage) showPopupMessage('Removed from wishlist!', 'success');
                    loadWishlist();
                } else {
                    let data = {};
                    try { data = await resp.json(); } catch {}
                    if (window.showPopupMessage) showPopupMessage(data.error || 'Failed to remove from wishlist.', 'error');
                }
            } catch (err) {
                if (window.showPopupMessage) showPopupMessage('Network error. Please check your connection or try again.', 'error');
            }
        };
        card.querySelector('.wishlist-addcart').onclick = async () => {
            let token = localStorage.getItem('jwt_token');
            if (!token) {
                const match = document.cookie.match(/(?:^|; )jwt=([^;]*)/);
                if (match) token = decodeURIComponent(match[1]);
            }
            if (!token) {
                if (window.showPopupMessage) showPopupMessage('You must be logged in.', 'error');
                return;
            }
            try {
                const resp = await fetch('http://127.0.0.1:5000/api/cart', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({ game_id: game.id })
                });
                if (resp.ok) {
                    if (window.showPopupMessage) showPopupMessage('Added to cart!', 'success');
                } else {
                    let data = {};
                    try { data = await resp.json(); } catch {}
                    if (window.showPopupMessage) showPopupMessage(data.error || 'Failed to add to cart.', 'error');
                }
            } catch (err) {
                if (window.showPopupMessage) showPopupMessage('Network error. Please check your connection or try again.', 'error');
            }
        };
        list.appendChild(card);
    });
}

async function loadWishlist() {
    const games = await fetchWishlist();
    renderWishlist(games);
}

document.addEventListener('DOMContentLoaded', loadWishlist);
