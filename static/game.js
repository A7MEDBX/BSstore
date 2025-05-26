// game.js: Fetch and display game details by ID from URL
const BASE_URL = 'http://127.0.0.1:5000';

function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

// --- HEADER LOGIN STATE LOGIC (COOKIE SUPPORT) ---
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
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

document.addEventListener('DOMContentLoaded', function() {
    // Always update login state and cart header on load
    updateHeaderUserMenu();
    if (typeof initCartHeader === 'function') {
        initCartHeader();
    }

    // Dropdown logic for user menu
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    if (userMenuBtn && userDropdown) {
        userMenuBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const isOpen = userDropdown.style.display === 'block';
            userDropdown.style.display = isOpen ? 'none' : 'block';
            userMenuBtn.classList.toggle('active', !isOpen);
        });
        document.addEventListener('click', function() {
            userDropdown.style.display = 'none';
            userMenuBtn.classList.remove('active');
        });
        userDropdown.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }

    // Sign out logic
    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            document.cookie = "user=; expires=Thu, 01 Jan 1970 00:00:00; path=/;";
            document.cookie = "jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            window.location.reload();
        });
    }

    // --- GAME LOADING LOGIC ---
    const gameId = getQueryParam('id');
    if (!gameId) return;

    fetch(`${BASE_URL}/api/games/${gameId}`)
        .then(res => res.json())
        .then(game => {
            // Prepare media array (video + up to 7 items)
            let media = [];
            if (game.video_url) media.push({ type: 'video', url: game.video_url });
            if (game.images && Array.isArray(game.images) && game.images.length > 0) {
                media = media.concat(
                    game.images.slice(0, 7).map(url => ({ type: 'img', url }))
                );
            } else if (game.image_url) {
                media.push({ type: 'img', url: game.image_url });
            } else {
                media.push({ type: 'img', url: 'images/games/default.jpg' });
            }

            // Carousel logic
            let currentIdx = 0;
            const mainDiv = document.getElementById('gameMediaMain');
            const thumbsDiv = document.getElementById('gameMediaThumbs');

            function showMedia(idx) {
                mainDiv.innerHTML = '';
                if (media[idx].type === 'video') {
                    const vid = document.createElement('video');
                    vid.src = media[idx].url;
                    vid.controls = true;
                    vid.autoplay = false;
                    vid.style.background = '#181b23';
                    mainDiv.appendChild(vid);
                } else {
                    const img = document.createElement('img');
                    img.src = media[idx].url;
                    img.alt = `${game.title} screenshot ${idx + 1}`;
                    mainDiv.appendChild(img);
                }
                Array.from(thumbsDiv.children).forEach((el, i) => {
                    el.classList.toggle('active', i === idx);
                });
            }

            thumbsDiv.innerHTML = '';
            media.forEach((item, idx) => {
                const thumb = document.createElement('img');
                thumb.src =
                    item.type === 'video'
                        ? game.video_thumb || 'images/games/default.jpg'
                        : item.url;
                thumb.alt =
                    item.type === 'video'
                        ? `${game.title} video`
                        : `${game.title} thumb ${idx + 1}`;
                thumb.className = `game-media-thumb${idx === 0 ? ' active' : ''}`;
                thumb.onclick = () => {
                    currentIdx = idx;
                    showMedia(idx);
                    resetAutoIter();
                };
                thumbsDiv.appendChild(thumb);
            });

            showMedia(0);
            let autoIter = setInterval(() => {
                currentIdx = (currentIdx + 1) % media.length;
                showMedia(currentIdx);
            }, 4000);

            function resetAutoIter() {
                clearInterval(autoIter);
                autoIter = setInterval(() => {
                    currentIdx = (currentIdx + 1) % media.length;
                    showMedia(currentIdx);
                }, 4000);
            }

            // Right panel details
            const logo = document.getElementById('gameDetailsLogo');
            if (game.logo_url) {
                logo.src = game.logo_url;
                logo.style.display = '';
            } else logo.style.display = 'none';

            const ageDiv = document.getElementById('gameDetailsAge');
            if (game.age_rating_img || game.age_rating_text) {
                const ageImg = document.getElementById('gameDetailsAgeImg');
                if (game.age_rating_img) {
                    ageImg.src = game.age_rating_img;
                    ageImg.style.display = '';
                } else ageImg.style.display = 'none';
                document.getElementById('gameDetailsAgeText').textContent =
                    game.age_rating_text || '';
                ageDiv.style.display = '';
            } else ageDiv.style.display = 'none';

            const badge = document.getElementById('gameDetailsBadge');
            if (game.badge) {
                badge.textContent = game.badge;
                badge.style.display = '';
            } else badge.style.display = 'none';

            const infoList = document.getElementById('gameDetailsInfoList');
            infoList.innerHTML = `
                <div class='game-details-info-list-row'><span class='game-details-info-list-label'>Epic Rewards</span><span class='game-details-info-list-value'>Earn 20% Back</span></div>
                <div class='game-details-info-list-row'><span class='game-details-info-list-label'>Refund Type</span><span class='game-details-info-list-value'>Self-Refundable</span></div>
                <div class='game-details-info-list-row'><span class='game-details-info-list-label'>Developer</span><span class='game-details-info-list-value'>${game.developer || 'Unknown'}</span></div>
                <div class='game-details-info-list-row'><span class='game-details-info-list-label'>Publisher</span><span class='game-details-info-list-value'>${game.publisher || 'Unknown'}</span></div>
                <div class='game-details-info-list-row'><span class='game-details-info-list-label'>Release Date</span><span class='game-details-info-list-value'>${game.release_date || 'TBA'}</span></div>
                <div class='game-details-info-list-row'><span class='game-details-info-list-label'>Platform</span><span class='game-details-info-list-value'>PC</span></div>
            `;

            // Main details
            document.getElementById('gameDetailsTitle').textContent = game.title;
            document.getElementById('gameDetailsMeta').innerHTML = `
                <span class='game-details-publisher'>${game.publisher || ''}</span> &bull;
                <span class='game-details-status'>${game.status || ''}</span>
            `;

            const descElem = document.getElementById('gameDetailsDesc');
            descElem.textContent = game.description?.trim() ? game.description : '';

            document.getElementById('gameDetailsPrice').textContent =
                (game.price != null) ? `€${game.price.toFixed(2)}` : '';

            document.getElementById('gameTypeLabel').textContent =
                game.genre || game.type || 'Action';
            const typeMeta = document.getElementById('gameTypeLabelMeta');
            if (typeMeta) typeMeta.textContent = game.genre || game.type || 'Action';

            let icon = '🎮';
            const g = (game.genre || '').toLowerCase();
            if (g.includes('rpg')) icon = '🛡️';
            else if (g.includes('action')) icon = '⚔️';
            else if (g.includes('strategy')) icon = '♟️';
            else if (g.includes('adventure')) icon = '🗺️';
            document.getElementById('gameTypeIcon').textContent = icon;
            document.getElementById('gameReleaseDate').textContent = game.release_date || 'TBA';
            document.getElementById('gamePublisher').textContent = game.publisher || 'Unknown';
            document.getElementById('gameStatus').textContent = game.status || 'Available';

            // Helper to get JWT token from localStorage or cookie (support both 'jwt_token' and 'jwt')
            function getJwtToken() {
                let token = localStorage.getItem('jwt_token');
                if (token) return token;
                // Try jwt_token cookie
                let match = document.cookie.match(/(?:^|; )jwt_token=([^;]*)/);
                if (match) return decodeURIComponent(match[1]);
                // Try jwt cookie (this is what backend sets)
                match = document.cookie.match(/(?:^|; )jwt=([^;]*)/);
                if (match) return decodeURIComponent(match[1]);
                return null;
            }

            // --- BUY NOW BUTTON LOGIC ---
            // (No redeclaration, just patch the event handler)
            if (buyNowBtn) {
                buyNowBtn.replaceWith(buyNowBtn.cloneNode(true));
                const patchedBuyNowBtn = document.getElementById('buyNowBtn');
                patchedBuyNowBtn.disabled = false;
                patchedBuyNowBtn.style.pointerEvents = 'auto';
                patchedBuyNowBtn.addEventListener('click', async function (e) {
                    e.preventDefault();
                    const token = getJwtToken();
                    if (!token) {
                        showCartErrorPopup('You must be logged in to purchase.');
                        return;
                    }
                    // --- STRICT: Check if game is already in user's library using game.id and game_id as string and number ---
                    let alreadyOwned = false;
                    try {
                        const libRes = await fetch(`${BASE_URL}/api/userlibrary`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (libRes.ok) {
                            const libData = await libRes.json();
                            alreadyOwned = Array.isArray(libData) && libData.some(g => g.id == game.id || g.game_id == game.id || String(g.id) === String(game.id) || String(g.game_id) === String(game.id));
                        }
                    } catch (err) {console.error('Library check failed', err);}
                    if (alreadyOwned) {
                        showCartErrorPopup('You already own this game in your library.');
                        return;
                    }
                    // Compose a cart-like item for this game only
                    const singleGameCartItem = [{
                        game_id: game.id,
                        title: game.title,
                        publisher: game.publisher,
                        price: game.price,
                        image_url: game.image_url || (game.images && game.images[0]) || 'images/games/default.jpg',
                    }];
                    if (typeof window.showOrderSummaryPopup === 'function') {
                        window.showOrderSummaryPopup(singleGameCartItem);
                    } else {
                        showCartErrorPopup('Order popup is not available. Please reload the page.');
                    }
                });
            }

            // Add to Cart button logic (remade for reliability)
            if (addToCartBtn) {
                addToCartBtn.replaceWith(addToCartBtn.cloneNode(true));
                const patchedAddToCartBtn = document.getElementById('addToCartBtn');
                patchedAddToCartBtn.disabled = false;
                patchedAddToCartBtn.style.pointerEvents = 'auto';
                patchedAddToCartBtn.addEventListener('click', async function (e) {
                    e.preventDefault();
                    if (patchedAddToCartBtn.disabled) return;
                    const originalText = patchedAddToCartBtn.textContent;
                    patchedAddToCartBtn.textContent = 'Adding...';
                    patchedAddToCartBtn.disabled = true;
                    patchedAddToCartBtn.classList.add('loading');
                    const token = getJwtToken();
                    if (!token) {
                        showCartErrorPopup('You must be logged in to add to cart.');
                        patchedAddToCartBtn.textContent = originalText;
                        patchedAddToCartBtn.disabled = false;
                        patchedAddToCartBtn.classList.remove('loading');
                        return;
                    }
                    // --- STRICT: Check if game is already in user's library using game.id and game_id as string and number ---
                    let alreadyOwned = false;
                    try {
                        const libRes = await fetch(`${BASE_URL}/api/userlibrary`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (libRes.ok) {
                            const libData = await libRes.json();
                            alreadyOwned = Array.isArray(libData) && libData.some(g => g.id == game.id || g.game_id == game.id || String(g.id) === String(game.id) || String(g.game_id) === String(game.id));
                        }
                    } catch (err) {console.error('Library check failed', err);}
                    if (alreadyOwned) {
                        showCartErrorPopup('You already own this game in your library.');
                        patchedAddToCartBtn.textContent = originalText;
                        patchedAddToCartBtn.disabled = false;
                        patchedAddToCartBtn.classList.remove('loading');
                        return;
                    }
                    try {
                        const response = await fetch(`${BASE_URL}/api/cart`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ game_id: gameId })
                        });
                        const data = await response.json();
                        if (!response.ok) {
                            showCartErrorPopup(data.error || 'Failed to add to cart.');
                        } else {
                            showCartSuccessPopup('Game added to cart!');
                            updateCartHeaderBadge();
                        }
                    } catch (err) {
                        showCartErrorPopup('Failed to add to cart.');
                    }
                    patchedAddToCartBtn.textContent = originalText;
                    patchedAddToCartBtn.disabled = false;
                    patchedAddToCartBtn.classList.remove('loading');
                });
            }

            // Remove from Cart button logic
            const removeFromCartBtn = document.getElementById('removeFromCartBtn');
            if (removeFromCartBtn) {
                removeFromCartBtn.addEventListener('click', async function (e) {
                    e.preventDefault();
                    const token = getJwtToken();
                    if (!token) {
                        showCartErrorPopup('You must be logged in to remove from cart.');
                        return;
                    }
                    try {
                        const response = await fetch(`${BASE_URL}/api/cart`, {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ game_id: gameId })
                        });
                        const data = await response.json();
                        if (!response.ok) {
                            showCartErrorPopup(data.error || 'Failed to remove from cart.');
                        } else {
                            showPopupMessage('Game removed from cart', 'success');
                            updateCartHeaderBadge();
                        }
                    } catch (err) {
                        showCartErrorPopup('Failed to remove from cart.');
                    }
                });
            }

            // --- BUY NOW BUTTON LOGIC ---
            const buyNowBtn = document.getElementById('buyNowBtn');
            if (buyNowBtn) {
                // Remove any previous event listeners by replacing the button
                const newBuyBtn = buyNowBtn.cloneNode(true);
                buyNowBtn.parentNode.replaceChild(newBuyBtn, buyNowBtn);
                newBuyBtn.disabled = false;
                newBuyBtn.style.pointerEvents = 'auto';
                newBuyBtn.addEventListener('click', async function (e) {
                    e.preventDefault();
                    const token = getJwtToken();
                    if (!token) {
                        showCartErrorPopup('You must be logged in to purchase.');
                        return;
                    }
                    // --- STRICT: Check if game is already in user's library using game.id and game_id as string and number ---
                    let alreadyOwned = false;
                    try {
                        const libRes = await fetch(`${BASE_URL}/api/userlibrary`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (libRes.ok) {
                            const libData = await libRes.json();
                            alreadyOwned = Array.isArray(libData) && libData.some(g => g.id == game.id || g.game_id == game.id || String(g.id) === String(game.id) || String(g.game_id) === String(game.id));
                        }
                    } catch (err) {console.error('Library check failed', err);}
                    if (alreadyOwned) {
                        showCartErrorPopup('You already own this game in your library.');
                        return;
                    }
                    // Compose a cart-like item for this game only
                    const singleGameCartItem = [{
                        game_id: game.id,
                        title: game.title,
                        publisher: game.publisher,
                        price: game.price,
                        image_url: game.image_url || (game.images && game.images[0]) || 'images/games/default.jpg',
                    }];
                    if (typeof window.showOrderSummaryPopup === 'function') {
                        window.showOrderSummaryPopup(singleGameCartItem);
                    } else {
                        showCartErrorPopup('Order popup is not available. Please reload the page.');
                    }
                });
            }

            // --- CART HEADER BADGE UPDATE ---
            function updateCartHeaderBadge() {
                const cartBadge = document.getElementById('cartBadge');
                const token = localStorage.getItem('jwt_token') || (document.cookie.match(/(?:^|; )jwt=([^;]*)/) || [])[1];
                if (!cartBadge) return;
                if (!token) {
                    cartBadge.style.display = 'none';
                    return;
                }
                fetch(`${BASE_URL}/api/cart`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                })
                .then(res => res.ok ? res.json() : { items: [] })
                .then(data => {
                    if (data.items && data.items.length > 0) {
                        cartBadge.textContent = data.items.length;
                        cartBadge.style.display = 'inline-block';
                    } else {
                        cartBadge.style.display = 'none';
                    }
                })
                .catch(() => {
                    cartBadge.style.display = 'none';
                });
            }

            // Call on page load
            updateCartHeaderBadge();

            const genreElement = document.getElementById('gameGenre');
            const descriptionElement = document.getElementById('gameDescription');
            if (genreElement) {
                genreElement.textContent = `Genre: ${game.genre || 'N/A'}`;
            }
            if (descriptionElement) {
                descriptionElement.textContent = `Description: ${game.description || 'No description available.'}`;
            }
        })
        .catch(err => {
            console.error('Failed to fetch game details:', err);
        });
});

// After successful add to cart or remove from cart, also call:
if (typeof initCartHeader === 'function') {
    initCartHeader();
}

function showCartSuccessPopup(msg) {
    const popup = document.createElement('div');
    popup.className = 'registration-complete-popup';
    popup.innerHTML = `
        <div class="popup-content">
            <svg width="48" height="48" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="12" fill="#1ba9ff"/>
                <path d="M7 13l3 3 7-7" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <div class="popup-title">Success</div>
            <div class="popup-msg">${msg}</div>
        </div>
    `;
    popup.style.opacity = '0';
    popup.style.transition = 'opacity 0.3s';
    document.body.appendChild(popup);
    // Force reflow to ensure the transition applies
    void popup.offsetWidth;
    popup.classList.add('show');
    popup.style.opacity = '1';
    setTimeout(() => {
        popup.style.opacity = '0';
        setTimeout(() => popup.remove(), 400);
    }, 2400);
}

function showCartErrorPopup(msg) {
    const popup = document.createElement('div');
    popup.className = 'registration-complete-popup';
    popup.innerHTML = `
        <div class="popup-content">
            <svg width="48" height="48" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="12" fill="#ff6f61"/>
                <path d="M12 8v4m0 4h.01" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <div class="popup-title">Error</div>
            <div class="popup-msg">${msg}</div>
        </div>
    `;
    document.body.appendChild(popup);
    setTimeout(() => popup.classList.add('show'), 10);
    setTimeout(() => { popup.classList.remove('show'); setTimeout(() => popup.remove(), 400); }, 2400);
}

function showPopupMessage(message, type) {
    const popup = document.createElement('div');
    popup.className = `popup-message ${type}`;
    popup.textContent = message;
    document.body.appendChild(popup);
    setTimeout(() => { popup.remove(); }, 3000);
}

// --- POPUP ORDER SUMMARY & PLACE ORDER LOGIC (copied from cart.js, adapted for game page) ---
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

    // Help link
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
        const token = localStorage.getItem('jwt_token') || (document.cookie.match(/(?:^|; )jwt=([^;]*)/) || [])[1];
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
        // Remove from cart if present
        for (const item of cartItems) {
            await fetch(`${BASE_URL}/api/cart/${item.game_id}`, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + token }
            });
        }
        if (allSuccess) {
            showPopupMessage('Order placed! Game added to your library.', 'success');
            overlay.remove();
            if (typeof updateCartHeaderBadge === 'function') updateCartHeaderBadge();
            if (typeof initCartHeader === 'function') initCartHeader();
            if (typeof updateHeaderUserMenu === 'function') updateHeaderUserMenu();
        } else {
            showPopupMessage('Could not add game to library.', 'error');
        }
    };

    document.body.appendChild(overlay);
    overlay.appendChild(box);
}
window.showOrderSummaryPopup = showOrderSummaryPopup;

// Add to Wishlist button logic
document.addEventListener('DOMContentLoaded', function() {
    // Add to Wishlist button logic (ensure gameId is set from URL if not present)
    const addToWishlistBtn = document.getElementById('addToWishlistBtn');
    if (addToWishlistBtn) {
        let gameId = addToWishlistBtn.dataset.gameId;
        if (!gameId) {
            // Try to get from URL param (e.g. ?id=123)
            gameId = getQueryParam('id');
            if (gameId) addToWishlistBtn.dataset.gameId = gameId;
        }
        addToWishlistBtn.addEventListener('click', async function() {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const token = user.token || localStorage.getItem('jwt_token');
            const gameId = addToWishlistBtn.dataset.gameId;
            if (!gameId) {
                if (window.showPopupMessage) showPopupMessage('Game ID not found.', 'error');
                return;
            }
            try {
                const res = await fetch('http://127.0.0.1:5000/api/wishlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}) },
                    body: JSON.stringify({ game_id: gameId })
                });
                if (res.ok) {
                    if (window.showPopupMessage) {
                        showPopupMessage('Added to wishlist!', 'success');
                    } else {
                        alert('Added to wishlist!');
                    }
                } else {
                    const data = await res.json();
                    if (window.showPopupMessage) {
                        showPopupMessage(data.error || 'Failed to add to wishlist.', 'error');
                    } else {
                        alert(data.error || 'Failed to add to wishlist.');
                    }
                }
            } catch (err) {
                if (window.showPopupMessage) {
                    showPopupMessage('Network error', 'error');
                } else {
                    alert('Network error');
                }
            }
        });
    }
});
