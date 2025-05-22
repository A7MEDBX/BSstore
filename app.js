document.addEventListener('DOMContentLoaded', () => {
    // Fetch and display games in the main menu for everyone (guests and logged-in users)
    fetch('/api/games')
        .then(res => res.json())
        .then(games => {
            const saleCards = document.querySelector('.sale-cards');
            if (saleCards && Array.isArray(games)) {
                saleCards.innerHTML = '';
                games.forEach(game => {
                    const card = document.createElement('div');
                    card.className = 'sale-card';
                    card.innerHTML = `
                        <img src="${game.image_url || 'images/games/default.jpg'}" alt="${game.title}" class="game-thumb">
                        <div class="game-info">
                            <div class="game-title">${game.title}</div>
                            <div class="game-desc">${game.description ? game.description.substring(0, 60) + (game.description.length > 60 ? '...' : '') : ''}</div>
                            <div class="game-price">${game.price !== undefined && game.price !== null ? `€${game.price.toFixed(2)}` : ''}</div>
                        </div>
                    `;
                    saleCards.appendChild(card);
                });
            }
        });
});