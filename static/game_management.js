/**
 * Fetch all games from the backend API and display them in the grid.
 */
async function fetchGames() {
    try {
        const response = await fetch('http://127.0.0.1:5000/api/games');
        if (!response.ok) throw new Error("Failed to fetch games.");
        const games = await response.json();
        renderGamesGrid(games);
    } catch (error) {
        console.error('Error fetching games:', error);
        displayNoGamesMessage();
    }
}

/**
 * Render the games in the grid as clickable cards.
 * @param {Array} games - List of games to display.
 */
function renderGamesGrid(games) {
    const gamesGrid = document.getElementById("gamesGrid");
    gamesGrid.innerHTML = ""; // Clear existing content
    gamesGrid.style.display = "grid";
    gamesGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(220px, 1fr))";
    gamesGrid.style.gap = "24px";
    gamesGrid.style.overflow = "visible";
    gamesGrid.style.justifyItems = "center";

    if (games.length === 0) {
        displayNoGamesMessage();
        return;
    }

    games.forEach(game => {
        const gameCard = document.createElement("div");
        gameCard.className = "sale-card";
        gameCard.dataset.gameId = game.id;
        gameCard.style.width = "220px";
        gameCard.style.height = "300px";
        gameCard.style.minWidth = "220px";
        gameCard.style.minHeight = "300px";
        gameCard.style.background = "#2a2a3b";
        gameCard.style.borderRadius = "12px";
        gameCard.innerHTML = `
            <div style="position:relative;width:100%;height:100%;display:flex;flex-direction:column;justify-content:space-between;align-items:stretch;">
                <div style="flex:1;display:flex;align-items:center;justify-content:center;">
                    <img class="game-thumb" src="${game.image_url || 'https://via.placeholder.com/220x160'}" alt="${game.title}" style="width:90%;height:160px;object-fit:cover;border-radius:12px 12px 0 0;box-shadow:none;">
                </div>
                <div style="padding:12px 10px 10px 10px;display:flex;flex-direction:column;gap:8px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;">
                        <span style="font-size:1em;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px;">${game.title}</span>
                        <span style="background:#1ba9ff;color:#fff;font-size:0.9em;font-weight:600;padding:2px 8px;border-radius:6px;max-width:60px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${game.genre ? game.genre : ''}</span>
                    </div>
                    <div style="display:flex;align-items:center;justify-content:space-between;">
                        <span style="font-weight:bold;font-size:1em;color:#66c0f4;">${game.price ? `$${game.price}` : 'Free'}</span>
                        <button class="edit-btn" style="background:#23272f;color:#fff;border:none;padding:6px 14px;border-radius:7px;cursor:pointer;transition:background 0.2s;font-weight:600;">Edit</button>
                    </div>
                </div>
            </div>
        `;
        gameCard.querySelector('.edit-btn').addEventListener("click", e => {
            e.stopPropagation();
            openEditModal(game.id);
        });
        gamesGrid.appendChild(gameCard);
    });
}

/**
 * Display a "No Games" message when no games are available.
 */
function displayNoGamesMessage() {
    const gamesGrid = document.getElementById("gamesGrid");
    gamesGrid.innerHTML = `
        <div class="no-games-message">
            <p>No games available at the moment.</p>
        </div>
    `;
}

/**
 * Open the edit modal and load game details for editing.
 * @param {number} gameId - The ID of the game to edit.
 */
function openEditModal(gameId) {
    if (!gameId) {
        console.error("Invalid gameId:", gameId);
        alert("Failed to open the game editor. Please try again.");
        return;
    }
    const modal = document.getElementById("editGameModal");
    modal.style.display = "flex"; // Use flex for centering
    document.body.style.overflow = 'hidden'; // Prevent background scroll
    document.getElementById("editGameForm").dataset.gameId = gameId;
    fetchGameDetails(gameId);
}

/**
 * Close the edit modal.
 */
function closeEditModal() {
    const modal = document.getElementById("editGameModal");
    modal.style.display = "none";
    document.body.style.overflow = '';
}

/**
 * Filter games based on the search input.
 */
function filterGames() {
    const searchInput = document.getElementById("search").value.toLowerCase();
    const gameCards = document.querySelectorAll(".sale-card");
    let hasVisibleGames = false;

    gameCards.forEach(card => {
        // Find the title span inside the card
        const titleSpan = card.querySelector("span");
        const title = titleSpan ? titleSpan.textContent.toLowerCase() : "";
        const isVisible = searchInput === "" || title.includes(searchInput);
        card.style.display = isVisible ? "block" : "none";
        if (isVisible) hasVisibleGames = true;
    });

    const noGamesMessage = document.querySelector(".no-games-message");
    if (noGamesMessage) {
        noGamesMessage.style.display = hasVisibleGames ? "none" : "block";
    }
}

// Preview image when editing game
document.getElementById("image_url").addEventListener("input", function() {
    const url = this.value;
    const preview = document.getElementById("imagePreview");
    preview.innerHTML = url ? `<img src="${url}" alt="Preview">` : "";
});

// Handle form submit for editing game
const editGameForm = document.getElementById("editGameForm");
if (editGameForm) {
    editGameForm.onsubmit = async function(e) {
        e.preventDefault();
        const gameId = this.dataset.gameId;
        const data = {
            title: document.getElementById("title").value,
            description: document.getElementById("description").value,
            genre: document.getElementById("genre").value,
            price: document.getElementById("price").value,
            status: document.getElementById("status").value,
            approval: document.getElementById("approval").value,
            image_url: document.getElementById("image_url").value
        };
        try {
            const res = await fetch(`http://127.0.0.1:5000/api/games/${gameId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error("Failed to update game");
            closeEditModal();
            fetchGames();
        } catch (err) {
            alert("Failed to update game: " + err.message);
        }
    };
}

// When opening modal, show image preview
function fetchGameDetails(gameId) {
    fetch(`http://127.0.0.1:5000/api/games/${gameId}`)
        .then(res => res.json())
        .then(game => {
            // Left column: text fields
            document.getElementById("title").value = game.title || "";
            document.getElementById("description").value = game.description || "";
            document.getElementById("genre").value = game.genre || "";
            document.getElementById("price").value = game.price || "";
            document.getElementById("status").value = game.status || "draft";
            document.getElementById("approval").value = game.approval || "Not Approved";
            document.getElementById("image_url").value = game.image_url || "";
            // Right column: image preview
            const preview = document.getElementById("imagePreview");
            preview.innerHTML = game.image_url ? `<img src="${game.image_url}" alt="Preview">` : "";
        });
}

window.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('editGameForm');
    if (form) {
        // إعداد التصميم الرئيسي للـ form
        form.style.display = 'flex';
        form.style.flexDirection = 'row'; // ← لجعل الحقول على اليسار والصورة على اليمين
        form.style.alignItems = 'flex-end';
        form.style.justifyContent = 'space-between';
        form.style.gap = '32px';
        form.style.position = 'relative';
        form.style.height = 'auto';
        form.style.minHeight = 'auto'; // السماح للارتفاع بالتكيف مع المحتوى
        form.style.paddingBottom = '64px'; // مساحة للأزرار في الأسفل

        // --- العمود الأيمن: الصورة ومعاينتها (form-right)
        const right = form.querySelector('.form-right');
        if (right) {
            right.style.display = 'flex';
            right.style.flexDirection = 'column';
            right.style.alignItems = 'flex-end';
            right.style.gap = '8px'; // تقليل المسافة بين العناصر
            right.style.width = '200px'; // تقليل العرض
            right.style.maxWidth = '220px';

            const preview = document.getElementById('imagePreview');
            if (preview) {
                preview.style.width = '170px'; // تقليل حجم الصورة
                preview.style.height = '120px';
                preview.style.display = 'block';
                preview.style.background = '#23232e';
                preview.style.borderRadius = '10px';
                preview.style.marginBottom = '6px';
            }

            const imageLabel = right.querySelector('.image-label');
            if (imageLabel) {
                imageLabel.style.textAlign = 'right';
                imageLabel.style.marginBottom = '2px';
            }

            const imageInput = right.querySelector('#image_url');
            if (imageInput) {
                imageInput.style.width = '100%';
                imageInput.style.maxWidth = '100%';
            }
        }

        // --- العمود الأيسر: الحقول (form-left)
        const left = form.querySelector('.form-left');
        if (left) {
            left.style.display = 'flex';
            left.style.flexDirection = 'column';
            left.style.gap = '10px'; // تقليل المسافة بين الحقول
            left.style.flex = '1';
            left.querySelectorAll('input, select, textarea').forEach(el => {
                el.style.width = '100%';
                el.style.boxSizing = 'border-box';
                el.style.maxWidth = '100%';
                el.style.fontSize = '17px';
                el.style.padding = '10px 16px'; // زيادة الحشو
                el.style.height = '44px'; // زيادة الارتفاع
                el.style.borderRadius = '8px';
            });
        }

        // --- أزرار المودال: في الزاوية اليمنى السفلية
        const modalButtons = document.querySelector('.form-actions');
        if (modalButtons && form) {
            modalButtons.style.display = 'flex';
            modalButtons.style.justifyContent = 'flex-end';
            modalButtons.style.gap = '12px'; // تقليل المسافة بين الأزرار
            modalButtons.style.position = 'absolute';
            modalButtons.style.right = '24px';
            modalButtons.style.bottom = '20px';
            modalButtons.style.width = 'auto';
            modalButtons.style.background = 'transparent';
            if (form.lastElementChild !== modalButtons) {
                form.appendChild(modalButtons);
            }
        }
        form.style.paddingBottom = '56px'; // تقليل المسافة السفلية
    }
});

// Fetch and display games on page load
window.onload = fetchGames;