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
    show: 'top', // Default to top sellers
};
let currentPage = 1;
const GAMES_PER_PAGE = 9;
let priceSlider = null;
let priceSliderValue = null;

// Add price filter to filters object
filters.price = 100; // Default max price

// Fetch games and genres
async function fetchGamesAndGenres() {
    try {
        const [gamesRes, genresRes] = await Promise.all([
            fetch(`${BASE_URL}/api/games`).then(r => r.json()).catch(() => []),
            fetch(`${BASE_URL}/api/genres`).then(r => r.json()).catch(() => [])
        ]);
        allGames = Array.isArray(gamesRes) && gamesRes.length ? gamesRes : [];
        genres = Array.isArray(genresRes) && genresRes.length ? genresRes : [];
        renderGenreFilters();
        renderGames();
    } catch (err) {
        gamesGrid.innerHTML = '<div style="color:#ff6f61;text-align:center;padding:32px;">Failed to load games.</div>';
    }
}

function renderGenreFilters() {
    filterGenre.innerHTML = '';
    genres.forEach(genre => {
        const label = document.createElement('label');
        label.className = 'sidebar-checkbox-label';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = genre;
        input.checked = filters.genre.includes(genre);
        input.addEventListener('change', () => {
            if (input.checked) filters.genre.push(genre);
            else filters.genre = filters.genre.filter(g => g !== genre);
            resetToFirstPageAndRender();
        });
        label.appendChild(input);
        label.appendChild(document.createTextNode(genre));
        filterGenre.appendChild(label);
    });
}

function setupPriceSlider() {
    priceSlider = document.getElementById('priceSlider');
    priceSliderValue = document.getElementById('priceSliderValue');
    if (!priceSlider) return;
    priceSlider.addEventListener('input', function() {
        filters.price = parseInt(this.value);
        priceSliderValue.textContent = `$${filters.price}`;
        resetToFirstPageAndRender();
    });
    // Set initial value
    priceSlider.value = filters.price;
    priceSliderValue.textContent = `$${filters.price}`;
}

function renderGames() {
    let filtered = allGames.filter(game => {
        if (filters.keyword && !game.title.toLowerCase().includes(filters.keyword.toLowerCase())) return false;
        if (filters.genre.length && (!game.genre || !filters.genre.includes(game.genre))) return false;
        if (filters.show === 'free' && game.price > 0) return false;
        if (filters.price !== undefined && game.price !== undefined && game.price > filters.price) return false;
        return true;
    });
    if (filters.show === 'new') filtered = filtered.sort((a, b) => ((b.id || 0) - (a.id || 0)));
    if (filters.show === 'top') filtered = filtered.sort((a, b) => ((b.sales || 0) - (a.sales || 0)));
    if (filters.show === 'upcoming') filtered = filtered.filter(g => g.status && g.status.toLowerCase().includes('coming'));
    if (!filtered.length) {
        gamesGrid.innerHTML = '<div class="no-results">No games found.</div>';
        renderPagination(0, 0);
        return;
    }
    // Pagination logic
    const totalPages = Math.ceil(filtered.length / GAMES_PER_PAGE);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    const startIdx = (currentPage - 1) * GAMES_PER_PAGE;
    const endIdx = startIdx + GAMES_PER_PAGE;
    const pageGames = filtered.slice(startIdx, endIdx);
    gamesGrid.innerHTML = '';
    pageGames.forEach(game => {
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
    renderPagination(currentPage, totalPages);
}

function renderPagination(current, total) {
    let pagination = document.getElementById('egPagination');
    if (!pagination) {
        pagination = document.createElement('div');
        pagination.id = 'egPagination';
        pagination.className = 'eg-pagination';
        gamesGrid.parentNode.appendChild(pagination);
    }
    if (total <= 1) {
        pagination.innerHTML = '';
        return;
    }
    let html = '';
    if (current > 1) {
        html += `<button class="eg-page-btn" data-page="${current - 1}">&lt;</button>`;
    }
    // Show up to 5 page numbers, with ellipsis if needed
    let start = Math.max(1, current - 2);
    let end = Math.min(total, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);
    for (let i = start; i <= end; i++) {
        html += `<button class="eg-page-btn${i === current ? ' active' : ''}" data-page="${i}">${i}</button>`;
    }
    if (end < total) {
        html += `<span class="eg-page-ellipsis">...</span>`;
        html += `<button class="eg-page-btn" data-page="${total}">${total}</button>`;
    }
    if (current < total) {
        html += `<button class="eg-page-btn" data-page="${current + 1}">&gt;</button>`;
    }
    pagination.innerHTML = html;
    pagination.onclick = function(e) {
        if (e.target.classList.contains('eg-page-btn')) {
            currentPage = parseInt(e.target.getAttribute('data-page'));
            renderGames();
            window.scrollTo({ top: gamesGrid.offsetTop - 60, behavior: 'smooth' });
        }
    };
}

// Reset currentPage when filters change
function resetToFirstPageAndRender() {
    currentPage = 1;
    renderGames();
}

sidebarKeywordInput && sidebarKeywordInput.addEventListener('input', e => {
    filters.keyword = e.target.value;
    resetToFirstPageAndRender();
});
resetFilters && resetFilters.addEventListener('click', (e) => {
    e.preventDefault();
    filters = { keyword: '', genre: [], show: filters.show, price: 100 };
    sidebarKeywordInput.value = '';
    document.querySelectorAll('.eg-filters-accordion input[type="checkbox"]').forEach(cb => cb.checked = false);
    priceSlider.value = filters.price;
    priceSliderValue.textContent = `$${filters.price}`;
    resetToFirstPageAndRender();
});
showDropdown && showDropdown.addEventListener('change', e => {
    filters.show = e.target.value;
    resetToFirstPageAndRender();
});
egSearchBar && egSearchBar.addEventListener('input', e => {
    filters.keyword = e.target.value;
    resetToFirstPageAndRender();
});
document.addEventListener('DOMContentLoaded', () => {
    if (showDropdown) {
        showDropdown.value = 'top';
        filters.show = showDropdown.value; // Sync filter with dropdown
    }
    fetchGamesAndGenres();
    setupPriceSlider();
    // Generic accordion logic for all accordions (price, genre, etc.)
    document.querySelectorAll('.eg-accordion-btn').forEach(btn => {
        btn.classList.remove('active');
        const panel = btn.nextElementSibling;
        if (panel) {
            panel.style.maxHeight = '0';
            panel.style.overflow = 'hidden';
            panel.style.transition = 'max-height 0.3s cubic-bezier(0.4,0,0.2,1)';
        }
        btn.addEventListener('click', function() {
            const panel = this.nextElementSibling;
            const isOpen = this.classList.contains('active');
            if (isOpen) {
                this.classList.remove('active');
                panel.style.maxHeight = '0';
                panel.style.overflow = 'hidden';
            } else {
                this.classList.add('active');
                panel.style.overflow = 'visible';
                panel.style.maxHeight = panel.scrollHeight + 'px';
            }
        });
    });
});
