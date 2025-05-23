// games.js - Epic Games Store style for games.html
const BASE_URL = 'http://127.0.0.1:5000';

const gamesGrid = document.getElementById('gamesGrid');
const genresCarousel = document.getElementById('genresCarousel');
const sidebarKeywordInput = document.getElementById('sidebarKeywordInput');
const resetFilters = document.getElementById('resetFilters');
const filterGenre = document.getElementById('filterGenre');
const showDropdown = document.getElementById('showDropdown');
const egSearchBar = document.getElementById('egSearchBar');

let allGames = [];
let genres = [];
let filters = {
    keyword: '',
    genre: [],
    show: 'new',
};

// Fetch games and genres
async function fetchGamesAndGenres() {
    try {
        const [gamesRes, genresRes] = await Promise.all([
            fetch(`${BASE_URL}/api/games`).then(r => r.json()).catch(() => []),
            fetch(`${BASE_URL}/api/categories`).then(r => r.json()).catch(() => [])
        ]);
        allGames = Array.isArray(gamesRes) && gamesRes.length ? gamesRes : [];
        genres = Array.isArray(genresRes) && genresRes.length ? genresRes : [];
        renderGenresCarousel();
        renderGenreFilters();
        renderGames();
    } catch (err) {
        gamesGrid.innerHTML = '<div style="color:#ff6f61;text-align:center;padding:32px;">Failed to load games.</div>';
    }
}

function renderGenresCarousel() {
    genresCarousel.innerHTML = '';
    if (!genres || !genres.length) {
        genresCarousel.innerHTML = '<div class="no-results">No genres available.</div>';
        return;
    }
    genres.forEach(genre => {
        const card = document.createElement('div');
        card.className = 'eg-genre-card';
        card.innerHTML = `
            <div class="eg-genre-covers">
                <img src="${genre.image_url || 'images/games/default.jpg'}" alt="${genre.name}" class="eg-genre-cover-img">
            </div>
            <div class="eg-genre-card-title">${genre.name}</div>
        `;
        card.onclick = () => {
            filters.genre = [genre.name];
            renderGames();
            document.querySelectorAll('.eg-genre-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
        };
        genresCarousel.appendChild(card);
    });
}

function renderGenreFilters() {
    filterGenre.innerHTML = '';
    genres.forEach(genre => {
        const label = document.createElement('label');
        label.className = 'sidebar-checkbox-label';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = genre.name;
        input.checked = filters.genre.includes(genre.name);
        input.addEventListener('change', () => {
            if (input.checked) filters.genre.push(genre.name);
            else filters.genre = filters.genre.filter(g => g !== genre.name);
            renderGames();
        });
        label.appendChild(input);
        label.appendChild(document.createTextNode(genre.name));
        filterGenre.appendChild(label);
    });
}

function renderGames() {
    let filtered = allGames.filter(game => {
        if (filters.keyword && !game.title.toLowerCase().includes(filters.keyword.toLowerCase())) return false;
        if (filters.genre.length && (!game.genre || !filters.genre.includes(game.genre))) return false;
        if (filters.show === 'free' && game.price > 0) return false;
        return true;
    });
    if (filters.show === 'new') filtered = filtered.sort((a, b) => (b.id || 0) - (a.id || 0));
    if (filters.show === 'top') filtered = filtered.sort((a, b) => (b.sales || 0) - (a.sales || 0));
    if (filters.show === 'upcoming') filtered = filtered.filter(g => g.status && g.status.toLowerCase().includes('coming'));
    if (!filtered.length) {
        gamesGrid.innerHTML = '<div class="no-results">No games found.</div>';
        return;
    }
    gamesGrid.innerHTML = '';
    filtered.forEach(game => {
        const card = document.createElement('div');
        card.className = 'eg-game-card';
        card.innerHTML = `
            <div class="eg-game-card-img-wrap">
                <img src="${game.image_url || 'images/games/default.jpg'}" alt="${game.title}" class="eg-game-card-img">
            </div>
            <div class="eg-game-card-meta">Base Game</div>
            <div class="eg-game-card-title">${game.title}</div>
            <div class="eg-game-card-badges">
                ${game.badge ? `<span class="eg-game-card-badge">${game.badge}</span>` : ''}
                ${game.price === 0 ? '<span class="eg-game-card-badge free">Free</span>' : ''}
            </div>
            <div class="eg-game-card-price">${game.price !== undefined ? (game.price === 0 ? 'Free' : `$${game.price.toFixed(2)}`) : ''}</div>
        `;
        card.onclick = () => window.location.href = `game.html?id=${game.id}`;
        gamesGrid.appendChild(card);
    });
}

sidebarKeywordInput && sidebarKeywordInput.addEventListener('input', e => {
    filters.keyword = e.target.value;
    renderGames();
});
resetFilters && resetFilters.addEventListener('click', (e) => {
    e.preventDefault();
    filters = { keyword: '', genre: [], show: filters.show };
    sidebarKeywordInput.value = '';
    document.querySelectorAll('.eg-filters-accordion input[type="checkbox"]').forEach(cb => cb.checked = false);
    renderGames();
});
showDropdown && showDropdown.addEventListener('change', e => {
    filters.show = e.target.value;
    renderGames();
});
egSearchBar && egSearchBar.addEventListener('input', e => {
    filters.keyword = e.target.value;
    renderGames();
});
document.addEventListener('DOMContentLoaded', fetchGamesAndGenres);
