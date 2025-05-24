// library.js - Loads and renders the user's library in library.html
const BASE_URL = 'http://127.0.0.1:5000';

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

function getUser() {
    const userCookie = getCookie('user');
    try { return userCookie ? JSON.parse(decodeURIComponent(userCookie)) : null; } catch { return null; }
}

function getJwtToken() {
    let token = localStorage.getItem('jwt_token');
    if (token) return token;
    let match = document.cookie.match(/(?:^|; )jwt_token=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
    match = document.cookie.match(/(?:^|; )jwt=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
    return null;
}

async function fetchUserLibrary() {
    const token = getJwtToken();
    if (!token) return [];
    const res = await fetch(`${BASE_URL}/api/userlibrary`, {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
    });
    if (!res.ok) return [];
    return await res.json();
}

function renderLibraryGames(games) {
    const grid = document.getElementById('libraryGamesGrid');
    grid.innerHTML = '';
    if (!games.length) {
        grid.innerHTML = '<div style="color:#ff6f61;text-align:center;padding:32px;">No games in your library yet.</div>';
        return;
    }
    games.forEach(game => {
        const card = document.createElement('div');
        card.className = 'library-game-card';
        card.innerHTML = `
            <div class="library-game-content">
                <img src="${game.image_url || 'images/games/default.jpg'}" alt="${game.title}" class="library-game-img">
                <div class="library-game-info">
                    <div class="library-game-title">${game.title}</div>
                    <div class="library-game-achievements">${game.achievements || 0} Achievements</div>
                    <div class="library-game-install"><span class="material-icons">download</span> Install</div>
                </div>
                ${game.addon ? `<div class="library-game-addon">${game.addon}</div>` : ''}
            </div>
        `;
        grid.appendChild(card);
    });
}

async function loadLibrary(sort = 'recent', search = '') {
    let games = await fetchUserLibrary();
    // Fake sort/search for now (backend can be improved later)
    if (search) {
        games = games.filter(g => g.title.toLowerCase().includes(search.toLowerCase()));
    }
    if (sort === 'az') {
        games.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === 'za') {
        games.sort((a, b) => b.title.localeCompare(a.title));
    } // else default: recent (assume backend returns in correct order)
    renderLibraryGames(games);
}

document.addEventListener('DOMContentLoaded', () => {
    // Initial load
    loadLibrary();
    // Sort dropdown
    document.getElementById('librarySortDropdown').addEventListener('change', e => {
        loadLibrary(e.target.value, document.getElementById('librarySearchInput').value);
    });
    // Search input
    document.getElementById('librarySearchInput').addEventListener('input', e => {
        loadLibrary(document.getElementById('librarySortDropdown').value, e.target.value);
    });
    // Refresh button
    document.getElementById('refreshLibraryBtn').addEventListener('click', () => {
        loadLibrary(document.getElementById('librarySortDropdown').value, document.getElementById('librarySearchInput').value);
    });
    // View toggle (grid/list, only grid implemented for now)
    document.getElementById('gridViewBtn').addEventListener('click', function() {
        this.classList.add('active');
        document.getElementById('listViewBtn').classList.remove('active');
        document.getElementById('libraryGamesGrid').classList.remove('list-view');
    });
    document.getElementById('listViewBtn').addEventListener('click', function() {
        this.classList.add('active');
        document.getElementById('gridViewBtn').classList.remove('active');
        document.getElementById('libraryGamesGrid').classList.add('list-view');
    });
});
