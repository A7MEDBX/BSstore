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
    // Header login state
    updateHeaderUserMenu();

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

            // Add to Cart button logic (remade for reliability)
            const addToCartBtn = document.getElementById('addToCartBtn');
            if (addToCartBtn) {
                // Remove any previous event listeners by replacing the button
                const newBtn = addToCartBtn.cloneNode(true);
                addToCartBtn.parentNode.replaceChild(newBtn, addToCartBtn);
                newBtn.disabled = false;
                newBtn.style.pointerEvents = 'auto';
                newBtn.addEventListener('click', async function (e) {
                    e.preventDefault();
                    if (newBtn.disabled) return;
                    // Visual feedback: show loading state
                    const originalText = newBtn.textContent;
                    newBtn.textContent = 'Adding...';
                    newBtn.disabled = true;
                    newBtn.classList.add('loading');
                    const token = getJwtToken();
                    if (!token) {
                        showCartErrorPopup('You must be logged in to add to cart.');
                        newBtn.textContent = originalText;
                        newBtn.disabled = false;
                        newBtn.classList.remove('loading');
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
                        }
                    } catch (err) {
                        showCartErrorPopup('Failed to add to cart.');
                    }
                    newBtn.textContent = originalText;
                    newBtn.disabled = false;
                    newBtn.classList.remove('loading');
                });
            }
        });
});

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
    document.body.appendChild(popup);
    setTimeout(() => popup.classList.add('show'), 10);
    setTimeout(() => { popup.classList.remove('show'); setTimeout(() => popup.remove(), 400); }, 2400);
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
