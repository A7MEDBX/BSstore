// game.js: Fetch and display game details by ID from URL
const BASE_URL = 'http://127.0.0.1:5000';

function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

// --- HEADER LOGIN STATE LOGIC (COOKIE SUPPORT) ---
function getToken() {
    // Try localStorage first
    let token = localStorage.getItem('jwt_token');
    if (token) return token;
    // Fallback: try cookies
    const match = document.cookie.match(/(?:^|; )jwt_token=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
}

document.addEventListener('DOMContentLoaded', function() {
    // --- HEADER LOGIN STATE LOGIC ---
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
    // Dropdown logic
    if (userMenuBtn && userDropdown) {
        userMenuBtn.onclick = function(e) {
            e.stopPropagation();
            userDropdown.style.display = userDropdown.style.display === 'block' ? 'none' : 'block';
        };
        document.body.addEventListener('click', function() {
            userDropdown.style.display = 'none';
        });
    }
    // Sign out logic
    if (signOutBtn) {
        signOutBtn.onclick = function() {
            localStorage.removeItem('jwt_token');
            showLoginRegister();
            window.location.reload();
        };
    }
    // Check login state
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

    const gameId = getQueryParam('id');
    if (!gameId) return;
    fetch(`${BASE_URL}/api/games/${gameId}`)
        .then(res => res.json())
        .then(game => {
            // Prepare media array (video + up to 6 images)
            let media = [];
            if (game.video_url) {
                media.push({type: 'video', url: game.video_url});
            }
            if (game.images && Array.isArray(game.images) && game.images.length > 0) {
                media = media.concat(game.images.slice(0, 7).map(url => ({type: 'img', url})));
            } else if (game.image_url) {
                media.push({type: 'img', url: game.image_url});
            } else {
                media.push({type: 'img', url: 'images/games/default.jpg'});
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
                    img.alt = game.title + ' screenshot ' + (idx + 1);
                    mainDiv.appendChild(img);
                }
                Array.from(thumbsDiv.children).forEach((el, i) => {
                    el.classList.toggle('active', i === idx);
                });
            }
            thumbsDiv.innerHTML = '';
            media.forEach((item, idx) => {
                let thumb;
                if (item.type === 'video') {
                    thumb = document.createElement('img');
                    thumb.src = game.video_thumb || 'images/games/default.jpg';
                    thumb.alt = game.title + ' video';
                } else {
                    thumb = document.createElement('img');
                    thumb.src = item.url;
                    thumb.alt = game.title + ' thumb ' + (idx + 1);
                }
                thumb.className = 'game-media-thumb' + (idx === 0 ? ' active' : '');
                thumb.onclick = () => {
                    currentIdx = idx;
                    showMedia(idx);
                    resetAutoIter();
                };
                thumbsDiv.appendChild(thumb);
            });
            showMedia(0);
            // Auto-iterate
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
            // Right panel details (logo, age, badge, info list)
            const logo = document.getElementById('gameDetailsLogo');
            if (game.logo_url) {
                logo.src = game.logo_url;
                logo.style.display = '';
            } else {
                logo.style.display = 'none';
            }
            const ageDiv = document.getElementById('gameDetailsAge');
            if (game.age_rating_img || game.age_rating_text) {
                if (game.age_rating_img) {
                    document.getElementById('gameDetailsAgeImg').src = game.age_rating_img;
                    document.getElementById('gameDetailsAgeImg').style.display = '';
                } else {
                    document.getElementById('gameDetailsAgeImg').style.display = 'none';
                }
                document.getElementById('gameDetailsAgeText').textContent = game.age_rating_text || '';
                ageDiv.style.display = '';
            } else {
                ageDiv.style.display = 'none';
            }
            const badge = document.getElementById('gameDetailsBadge');
            if (game.badge) {
                badge.textContent = game.badge;
                badge.style.display = '';
            } else {
                badge.style.display = 'none';
            }
            const infoList = document.getElementById('gameDetailsInfoList');
            infoList.innerHTML = `
                <div class='game-details-info-list-row'><span class='game-details-info-list-label'>Epic Rewards</span><span class='game-details-info-list-value'>Earn 20% Back</span></div>
                <div class='game-details-info-list-row'><span class='game-details-info-list-label'>Refund Type</span><span class='game-details-info-list-value'>Self-Refundable</span></div>
                <div class='game-details-info-list-row'><span class='game-details-info-list-label'>Developer</span><span class='game-details-info-list-value'>${game.developer || 'Unknown'}</span></div>
                <div class='game-details-info-list-row'><span class='game-details-info-list-label'>Publisher</span><span class='game-details-info-list-value'>${game.publisher || 'Unknown'}</span></div>
                <div class='game-details-info-list-row'><span class='game-details-info-list-label'>Release Date</span><span class='game-details-info-list-value'>${game.release_date || 'TBA'}</span></div>
                <div class='game-details-info-list-row'><span class='game-details-info-list-label'>Platform</span><span class='game-details-info-list-value'>PC</span></div>
            `;
            // Set game details
            document.getElementById('gameDetailsTitle').textContent = game.title;
            document.getElementById('gameDetailsMeta').innerHTML =
                `<span class='game-details-publisher'>${game.publisher || ''}</span> &bull; <span class='game-details-status'>${game.status || ''}</span>`;
            // Set description from database
            const descElem = document.getElementById('gameDetailsDesc');
            if (game.description && game.description.trim()) {
                descElem.textContent = game.description;
            } else {
                descElem.textContent = '';
            }
            document.getElementById('gameDetailsPrice').textContent = (game.price !== undefined && game.price !== null) ? `€${game.price.toFixed(2)}` : '';
            document.getElementById('gameTypeLabel').textContent = (game.genre || game.type || 'Action');
            const typeMeta = document.getElementById('gameTypeLabelMeta');
            if (typeMeta) typeMeta.textContent = (game.genre || game.type || 'Action');
            let icon = '🎮';
            if (game.genre && game.genre.toLowerCase().includes('rpg')) icon = '🛡️';
            else if (game.genre && game.genre.toLowerCase().includes('action')) icon = '⚔️';
            else if (game.genre && game.genre.toLowerCase().includes('strategy')) icon = '♟️';
            else if (game.genre && game.genre.toLowerCase().includes('adventure')) icon = '🗺️';
            document.getElementById('gameTypeIcon').textContent = icon;
            document.getElementById('gameReleaseDate').textContent = game.release_date || 'TBA';
            document.getElementById('gamePublisher').textContent = game.publisher || 'Unknown';
            document.getElementById('gameStatus').textContent = game.status || 'Available';
        });
});
