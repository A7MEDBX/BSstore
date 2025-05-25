// (empty or original header.js content before cart system was added)

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
    updateHeaderUserMenu();
    if (typeof initCartHeader === 'function') {
        initCartHeader();
    }
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
    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            document.cookie = "user=; expires=Thu, 01 Jan 1970 00:00:00; path=/;";
            document.cookie = "jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            window.location.reload();
        });
    }
});