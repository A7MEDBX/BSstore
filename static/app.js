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
                let msg = 'Login failed';
                try {
                    const err = await res.json();
                    msg = err.error || err.message || msg;
                } catch (e) {
                    // fallback: try to get text
                    try { msg = await res.text(); } catch {}
                }
                alert(msg);
                return;
            }
            const data = await res.json();
            // Store token in both cookie and localStorage for maximum compatibility
            document.cookie = `jwt=${data.token}; path=/; SameSite=Strict;`;
            localStorage.setItem('jwt_token', data.token);
            // Save user info from login response in cookie
            document.cookie = `user=${encodeURIComponent(JSON.stringify({id: data.id, username: data.username}))}; path=/; SameSite=Strict;`;
            // Optionally fetch user profile (if you want more info)
            // const profileRes = await fetch('/api/me', {
            //     headers: { 'Authorization': `Bearer ${data.token}` },
            //     credentials: 'include'
            // });
            // if (profileRes.ok) {
            //     const user = await profileRes.json();
            //     document.cookie = `user=${encodeURIComponent(JSON.stringify(user))}; path=/; SameSite=Strict;`;
            // }
            window.location.href = 'index.html';
        } catch (err) {
            alert('Login error: ' + err);
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
            document.cookie = "user=; expires=Thu, 01 Jan 1970 00:00:00; path=/;";
            document.cookie = "jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            logoutAndClearCookies();
            window.location.reload();
        });
    }
  function logoutAndClearCookies() {
        // Remove all cookies
        document.cookie.split(';').forEach(function(c) {
            document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date(0).toUTCString() + ';path=/');
        });
        // Optionally clear localStorage/sessionStorage
        localStorage.removeItem('user');
        // Redirect to login or home
        window.location.href = 'login.html';
    }
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
        registerBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'register.html';
        });
    }

    // Fetch and display games in the main menu
    fetch(`${BASE_URL}/api/games`)
        .then(res => res.json())
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
});
