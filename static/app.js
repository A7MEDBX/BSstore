// Password show/hide logic for login.html
const pwd = document.getElementById('loginPassword');
const toggleBtn = document.querySelector('.login-toggle-password');
const eyeIcon = document.getElementById('eyeIcon');
let show = false;
if (toggleBtn && pwd && eyeIcon) {
    toggleBtn.addEventListener('click', function(e) {
        e.preventDefault();
        show = !show;
        pwd.type = show ? 'text' : 'password';
        eyeIcon.innerHTML = show
            ? '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.81 21.81 0 0 1 5.06-6.06M1 1l22 22"/><circle cx="12" cy="12" r="3"/>'
            : '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>';
    });
}

const BASE_URL = 'http://127.0.0.1:5000';

// Login form submission for login.html
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        try {
            const res = await fetch(`${BASE_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include' // Ensure cookies are sent/received for CORS
            });
            if (!res.ok) {
                let msg = 'Invalid username or password';
                try {
                    const err = await res.json();
                    // If backend returns 'Invalid credentials', always show the friendly message
                    if (err && err.error && err.error.toLowerCase().includes('')) {
                        msg = 'Invalid username or password';
                    } else if (err && err.error) {
                        msg =  'Invalid username or password';;
                    } else if (err && err.message) {
                        msg =  'Invalid username or password';;
                    }
                } catch (e) {
                    // fallback: try to get text
                    try { msg = await res.text(); } catch {}
                }
                if (window.showPopupMessage) {
                   // showPopupMessage(msg, 'error');
                } else {
                    // Fallback: create a modern styled popup
                    const popup = document.createElement('div');
                    popup.textContent = msg;
                    popup.style.position = 'fixed';
                    popup.style.top = '32px';
                    popup.style.left = '50%';
                    popup.style.transform = 'translateX(-50%)';
                    popup.style.background = '#23262e';
                    popup.style.color = '#ff4e4e';
                    popup.style.fontWeight = 'bold';
                    popup.style.fontSize = '1.08rem';
                    popup.style.padding = '16px 32px';
                    popup.style.borderRadius = '10px';
                    popup.style.boxShadow = '0 2px 16px #0005';
                    popup.style.zIndex = '99999';
                    document.body.appendChild(popup);
                    setTimeout(()=>popup.remove(), 2500);
                }
                return;
            }
            const data = await res.json();
            // Store token in both cookie and localStorage for maximum compatibility
            document.cookie = `jwt=${data.token}; path=/; SameSite=Strict;`;
            localStorage.setItem('jwt_token', data.token);
            // Save user info from login response in cookie
            document.cookie = `user=${encodeURIComponent(JSON.stringify({id: data.id, username: data.username, role: data.role}))}; path=/; SameSite=Strict;`;
            // Redirect admin to game_management.html, others to index.html
            if (data.role === 'admin') {
                window.location.href = 'game_management.html';
            } else {
                window.location.href = 'index.html';
            }
        } catch (err) {
            if (window.showPopupMessage) {
                showPopupMessage('Network error', 'error');
            } else {
                // Fallback: create a modern styled popup
                const popup = document.createElement('div');
                popup.textContent = 'Network error';
                popup.style.position = 'fixed';
                popup.style.top = '32px';
                popup.style.left = '50%';
                popup.style.transform = 'translateX(-50%)';
                popup.style.background = '#23262e';
                popup.style.color = '#ff4e4e';
                popup.style.fontWeight = 'bold';
                popup.style.fontSize = '1.08rem';
                popup.style.padding = '16px 32px';
                popup.style.borderRadius = '10px';
                popup.style.boxShadow = '0 2px 16px #0005';
                popup.style.zIndex = '99999';
                document.body.appendChild(popup);
                setTimeout(()=>popup.remove(), 2500);
            }
        }
    });
}

// --- NAVBAR USER STATE LOGIC ---
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

function updateNavbarForUser() {
    const userCookie = getCookie('user');
    let user = null;
    try { user = userCookie ? JSON.parse(decodeURIComponent(userCookie)) : null; } catch {}
    const signinBtn = document.getElementById('signinBtn');
    const signupBtn = document.getElementById('signupBtn');
    const userMenu = document.getElementById('userMenu');
    if (user && user.username) {
        if (signinBtn) signinBtn.style.display = 'none';
        if (signupBtn) signupBtn.style.display = 'none';
        if (userMenu) {
            userMenu.style.display = 'block';
            userMenu.textContent = user.username;
        }
    } else {
        if (signinBtn) signinBtn.style.display = '';
        if (signupBtn) signupBtn.style.display = '';
        if (userMenu) userMenu.style.display = 'none';
    }
}

function updateHeaderForUser() {
    const userCookie = getCookie('user');
    let user = null;
    try { user = userCookie ? JSON.parse(decodeURIComponent(userCookie)) : null; } catch {}
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const headerUserMenu = document.getElementById('headerUserMenu');
    if (user && user.username) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (registerBtn) registerBtn.style.display = 'none';
        if (headerUserMenu) {
            headerUserMenu.style.display = 'block';
            headerUserMenu.textContent = user.username;
        }
    } else {
        if (loginBtn) loginBtn.style.display = '';
        if (registerBtn) registerBtn.style.display = '';
        if (headerUserMenu) headerUserMenu.style.display = 'none';
    }
}

function updateHeaderUserMenu() {
    const userCookie = getCookie('user');
    const headerUserMenu = document.getElementById('headerUserMenu');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    if (userCookie) {
        const user = JSON.parse(decodeURIComponent(userCookie));
        document.getElementById('userName').textContent = user.username;
        document.getElementById('userAvatar').textContent = user.username[0].toUpperCase();
        headerUserMenu.style.display = 'flex';
        if (loginBtn) loginBtn.style.display = 'none';
        if (registerBtn) registerBtn.style.display = 'none';
    } else {
        headerUserMenu.style.display = 'none';
        if (loginBtn) loginBtn.style.display = '';
        if (registerBtn) registerBtn.style.display = '';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    updateNavbarForUser && updateNavbarForUser();
    updateHeaderUserMenu();

    // Dropdown logic
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
            // Remove all cookies
            document.cookie = "user=; expires=Thu, 01 Jan 1970 00:00:00; path=/;";
            document.cookie = "jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            localStorage.removeItem('jwt_token');
            localStorage.removeItem('user');
            window.location.href = 'index.html';
        });
    }
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
        registerBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'register.html';
        });
    }

    // Fetch and display games in the main menu
    const userCookie = getCookie('user');
    let user = null;
    try { user = userCookie ? JSON.parse(decodeURIComponent(userCookie)) : null; } catch {}

    fetch(`${BASE_URL}/api/games`)
        .then(res => {
            if (!user || !user.role || user.role !== 'admin') {
                // Hide or disable add/edit/delete UI for non-admins
                const addBtn = document.getElementById('addGameBtn');
                if (addBtn) addBtn.style.display = 'none';
                document.querySelectorAll('.edit-game-btn, .delete-game-btn').forEach(btn => btn.style.display = 'none');
            }
            return res.json();
        })
        .then(games => {
            // --- HERO BANNER FEATURED GAMES ---
            const heroSlider = document.querySelector('.hero-slider');
            const heroContent = document.querySelector('.hero-content');
            if (heroSlider && Array.isArray(games)) {
                heroSlider.innerHTML = '';
                // Sort by most recently added (assuming higher id = newer)
                const featuredGames = [...games].sort((a, b) => b.id - a.id).slice(0, 4);
                let currentIdx = 0;
                function showFeatured(idx) {
                    const game = featuredGames[idx];
                    heroContent.querySelector('h2').textContent = game.title;
                    // Display genre from DB if available
                    const genreElem = heroContent.querySelector('.hero-genre');
                    if (genreElem) {
                        genreElem.textContent = game.genre ? game.genre : '';
                    }
                    // Set up Read More button to show modal
                    const readMoreBtn = document.getElementById('heroReadMoreBtn');
                    if (readMoreBtn) {
                        readMoreBtn.onclick = () => {
                            const modal = document.getElementById('gameDescModal');
                            const descText = document.getElementById('gameDescText');
                            descText.textContent = game.description || 'No description available.';
                            modal.classList.add('active');
                        };
                    }
                    // Set hero banner background image via <img> element
                    const heroBannerBg = document.querySelector('.hero-banner-bg');
                    if (heroBannerBg) {
                        heroBannerBg.src = game.image_url || 'images/games/default.jpg';
                        heroBannerBg.alt = game.title + ' background';
                    }
                    // Remove any backgroundImage styling if present
                    const heroBanner = document.querySelector('.hero-banner');
                    if (heroBanner) {
                        heroBanner.style.backgroundImage = '';
                        heroBanner.style.backgroundSize = '';
                        heroBanner.style.backgroundPosition = '';
                        heroBanner.style.backgroundRepeat = '';
                    }
                    // Highlight active thumb
                    Array.from(heroSlider.children).forEach((el, i) => {
                        el.classList.toggle('active', i === idx);
                    });
                }
                featuredGames.forEach((game, idx) => {
                    const thumb = document.createElement('img');
                    thumb.src = game.image_url || 'images/games/default.jpg';
                    thumb.alt = game.title;
                    thumb.className = 'slider-thumb';
                    thumb.style.cursor = 'pointer';
                    thumb.style.objectFit = 'cover';
                    thumb.style.width = '80px';
                    thumb.style.height = '60px';
                    thumb.addEventListener('click', () => {
                        currentIdx = idx;
                        showFeatured(idx);
                    });
                    heroSlider.appendChild(thumb);
                });
                // Auto-iterate
                setInterval(() => {
                    currentIdx = (currentIdx + 1) % featuredGames.length;
                    showFeatured(currentIdx);
                }, 4000);
                // Show the first game by default
                showFeatured(0);
            }
            // --- SALE CARDS ---
            const saleCards = document.querySelector('.sale-cards');
            if (saleCards && Array.isArray(games)) {
                saleCards.innerHTML = '';
                games.slice(0, 8).forEach(game => {
                    const card = document.createElement('div');
                    card.className = 'sale-card';
                    card.innerHTML = `
                        <img src="${game.image_url || 'images/games/default.jpg'}" alt="${game.title}" class="game-thumb" style="width:100%;height:140px;object-fit:cover;border-radius:10px 10px 0 0;">
                        <div class="game-info">
                            <div class="game-title">${game.title}</div>
                            <div class="game-desc">${game.description ? game.description.substring(0, 60) + (game.description.length > 60 ? '...' : '') : ''}</div>
                            <div class="game-price">${game.price !== undefined && game.price !== null ? `$${game.price.toFixed(2)}` : ''}</div>
                        </div>
                    `;
                    card.style.cursor = 'pointer';
                    card.onclick = () => {
                        window.location.href = `game.html?id=${game.id}`;
                    };
                    saleCards.appendChild(card);
                });
            }
        });

    // Modal close logic
    const gameDescModal = document.getElementById('gameDescModal');
    const gameDescOkBtn = document.getElementById('gameDescOkBtn');
    if (gameDescOkBtn && gameDescModal) {
        gameDescOkBtn.onclick = () => {
            gameDescModal.classList.remove('active');
        };
    }
    // Optional: close modal on outside click
    if (gameDescModal) {
        gameDescModal.addEventListener('click', function(e) {
            if (e.target === gameDescModal) {
                gameDescModal.classList.remove('active');
            }
        });
    }

    // Popup message function
    function showPopupMessage(message, type) {
        const popup = document.createElement('div');
        popup.className = `popup-message ${type}`;
        popup.textContent = message;
        document.body.appendChild(popup);
        setTimeout(() => { popup.remove(); }, 3000);
    }

    // Example: show popup after removing a game from cart
    // showPopupMessage('Game removed from cart', 'success');

    // Display unapproved games in Legendary adventures await section
    function displayUnapprovedAdventures() {
        fetch('http://127.0.0.1:5000/api/allgames')
            .then(res => res.json())
            .then(games => {
                const adventuresContainer = document.querySelector('.adventure-cards');
                if (!adventuresContainer) return;
                adventuresContainer.innerHTML = '';
                // Filter unapproved games and robustly exclude all free games (price 'free', 0, '0', '0.00', 0.00, etc)
                const unapproved = games.filter(g => {
                    const approved = g.approved;
                    const status = (g.status || '').toLowerCase();
                    const isFree = String(g.price).trim().toLowerCase() === 'free' || Number(g.price) === 0;
                    return (
                        (approved === false || approved === 0 || approved === '0' || approved === 'false' || approved === null || typeof approved === 'undefined' ||
                        status === 'pending' || status === 'not approved' || status === 'unapproved' || status === 'waiting' || status === 'awaiting approval')
                        && !isFree
                    );
                });
                // Sort by newest (assuming higher id = newer)
                unapproved.sort((a, b) => (b.id || 0) - (a.id || 0));
                // Show at most 3
                const toShow = unapproved.slice(0, 3);
                if (toShow.length === 0) {
                    adventuresContainer.innerHTML = '<div style="color:#aaa;font-size:1.1em;margin:32px 0;">No adventures pending approval.</div>';
                } else {
                    toShow.forEach(game => {
                        const card = document.createElement('div');
                        card.className = 'adventure-card modern-adventure-card';
                        card.style.cursor = 'pointer';
                        // card.onclick = () => window.location.href = `game.html?id=${game.id}`;
                        card.innerHTML = `
                            <div class="adventure-img-wrap">
                                <img src="${game.image_url || 'images/games/default.jpg'}" alt="${game.title}" class="adventure-img-modern">
                            </div>
                            <div class="adventure-info-modern">
                                <div class="adventure-title-modern">${game.title}</div>
                                <div class="adventure-desc-modern">${game.description ? game.description.substring(0, 60) + (game.description.length > 60 ? '...' : '') : ''}</div>
                            </div>
                        `;
                        adventuresContainer.appendChild(card);
                    });
                }
            });
    }

    // Display free games in Play Free section
    function displayFreeGames() {
        fetch('http://127.0.0.1:5000/api/allgames')
            .then(res => res.json())
            .then(games => {
                const freeContainer = document.querySelector('.playfree-cards');
                if (!freeContainer) return;
                freeContainer.innerHTML = '';
                // Filter games with price 0 or '0' (string or number)
                const freeGames = games.filter(g => Number(g.price) === 0);
                // Sort by newest (assuming higher id = newer)
                freeGames.sort((a, b) => (b.id || 0) - (a.id || 0));
                // Show at most 3
                const toShow = freeGames.slice(0, 3);
                if (toShow.length === 0) {
                    freeContainer.innerHTML = '<div style="color:#aaa;font-size:1.1em;margin:32px 0;">No free games available.</div>';
                } else {
                    toShow.forEach(game => {
                        const card = document.createElement('div');
                        card.className = 'free-card modern-adventure-card';
                        card.style.cursor = 'pointer';
                        card.onclick = () => window.location.href = `game.html?id=${game.id}`;
                        card.innerHTML = `
                            <div class="adventure-img-wrap">
                                <img src="${game.image_url || 'images/games/default.jpg'}" alt="${game.title}" class="adventure-img-modern">
                            </div>
                            <div class="adventure-info-modern">
                                <div class="adventure-title-modern">${game.title}</div>
                                <div class="adventure-desc-modern">${game.description ? game.description.substring(0, 60) + (game.description.length > 60 ? '...' : '') : ''}</div>
                                <div class="adventure-status-modern" style="color:#1ba9ff;">Free</div>
                            </div>
                        `;
                        freeContainer.appendChild(card);
                    });
                }
            });
    }

    displayUnapprovedAdventures();
    displayFreeGames();

    // Add modern styles for adventure cards
    const style = document.createElement('style');
    style.textContent = `
    .modern-adventure-card {
        background: #23262e;
        border-radius: 18px;
        box-shadow: 0 4px 24px #0003;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        transition: transform 0.18s, box-shadow 0.18s;
        min-width: 380px;
        max-width: 550px;
        min-height: 260px;
        margin: 15px 18px;
        padding: 0;
        border: none;
    }
    .modern-adventure-card:hover {
        transform: translateY(-6px) scale(1.03);
        box-shadow: 0 8px 32px #0006;
    }
    .adventure-img-wrap {
        width: 100%;
        height: 200px;
        overflow: hidden;
        background: #181a20;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .adventure-img-modern {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 18px 18px 0 0;
        transition: filter 0.2s;
    }
    .adventure-info-modern {
        padding: 22px 22px 14px 22px;
        display: flex;
        flex-direction: column;
        flex: 1;
        justify-content: flex-start;
    }
    .adventure-title-modern {
        font-weight: 700;
        font-size: 1.22em;
        color: #fff;
        margin-bottom: 8px;
        letter-spacing: 0.01em;
    }
    .adventure-desc-modern {
        color: #b0b0b0;
        font-size: 1.08em;
        margin-bottom: 12px;
        min-height: 32px;
    }
    .adventure-status-modern {
        color: #ff6f61;
        font-size: 1.08em;
        font-weight: 600;
        margin-top: auto;
    }
    .playfree-cards, .adventure-cards {
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap;
        justify-content: flex-start;
        align-items: stretch;
        gap: 0;
        width: 100%;
        overflow-x: auto;
        padding-bottom: 8px;
    }
    @media (max-width: 1800px) {
        .modern-adventure-card { min-width: 340px; max-width: 420px; }
    }
    @media (max-width: 1200px) {
        .modern-adventure-card { min-width: 280px; max-width: 340px; }
    }
    @media (max-width: 900px) {
        .modern-adventure-card { min-width: 96vw; max-width: 99vw; }
        .adventure-img-wrap { height: 140px; }
        .playfree-cards, .adventure-cards { flex-direction: column; align-items: center; }
    }
    `;
    document.head.appendChild(style);
});
