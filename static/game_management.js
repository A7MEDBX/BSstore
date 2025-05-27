// Utility to get JWT token from localStorage or cookie
function getJwtToken() {
    let token = localStorage.getItem('jwt_token');
    if (token) return token;
    let match = document.cookie.match(/(?:^|; )jwt=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
    return null;
}

/**
 * Fetch all games from the backend API and display them in the grid.
 */
async function fetchGames() {
    try {
        const response = await fetch('http://127.0.0.1:5000/api/allgames');
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
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                        <span style="font-weight:bold;font-size:1em;color:#66c0f4;">${game.price ? `$${game.price}` : 'Free'}</span>
                        <div style="display:flex;gap:8px;">
                            <button class="delete-btn" style="background:linear-gradient(90deg,#ff4f4f 0%,#ff1b1b 100%);color:#fff;border:none;padding:6px 8px;min-width:60px;max-width:80px;border-radius:7px;cursor:pointer;transition:background 0.2s;font-weight:600;box-shadow:0 2px 8px 0 rgba(255,31,31,0.10);">Delete</button>
                            <button class="edit-btn" style="background:#23272f;color:#fff;border:none;padding:6px 14px;border-radius:7px;cursor:pointer;transition:background 0.2s;font-weight:600;">Edit</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        // Delete button event
        gameCard.querySelector('.delete-btn').addEventListener("click", e => {
            e.stopPropagation();
            showDeleteConfirmationPopup(async () => {
                try {
                    const res = await fetch(`http://127.0.0.1:5000/api/games/${game.id}`, { 
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + getJwtToken() }
                    });
                    const data = await res.json();
                    showPopupMessage('Game deleted successfully!', 'success');
                    fetchGames();
                } catch {
                    showPopupMessage('Failed to delete game.', 'error');
                }
            });
        });
        // Edit button event
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
        showPopupMessage("Failed to open the game editor. Please try again.", "error");
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
            // Fix: convert approval dropdown to boolean
            approval: document.getElementById("approval").value === "Approved",
            image_url: document.getElementById("image_url").value,
            download_url: document.getElementById("download_url").value
        };
        const token = getJwtToken();
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/games/${gameId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify(data)
            });
            if (response.ok) {
                showPopupMessage('Game updated successfully!', 'success');
                closeEditModal();
                fetchGames();
                return;
            }
            let errorMsg = 'Failed to update game. Please try again.';
            try {
                const error = await response.json();
                errorMsg = `Error: ${error.message || error.error || errorMsg}`;
            } catch {}
            showPopupMessage(errorMsg, 'error');
        } catch (error) {
            showPopupMessage('Failed to update game. Please try again.', 'error');
        }
    };
    // Make sure Cancel/Back button closes the modal
    const backBtn = document.querySelector('.back-btn, .cancel-btn');
    if (backBtn) {
        backBtn.onclick = function(e) {
            e.preventDefault();
            closeEditModal();
        };
    }
}

// When opening modal, show image preview
function fetchGameDetails(gameId) {
    fetch(`http://127.0.0.1:5000/api/games/${gameId}`)
        .then(res => {
            if (!res.ok) throw new Error('Failed to fetch game details.');
            return res.json();
        })
        .then(game => {
            // Defensive: handle both array and object (Supabase may return [game] or game)
            if (Array.isArray(game)) game = game[0] || {};
            if (!game || typeof game !== 'object') throw new Error('No game data returned.');
            document.getElementById("title").value = game.title || "";
            document.getElementById("download_url").value = game.download_url || "";
            document.getElementById("description").value = game.description || "";
            document.getElementById("genre").value = game.genre || "";
            document.getElementById("price").value = game.price || "";
            document.getElementById("status").value = game.status || "draft";
            const approvalValue = (typeof game.approval !== 'undefined') ? game.approval : game.approved;
            document.getElementById("approval").value = approvalValue === true ? "Approved" : "Not Approved";
            document.getElementById("image_url").value = game.image_url || "";
            document.getElementById("download_url").value = game.download_url || "";
            const preview = document.getElementById("imagePreview");
            preview.innerHTML = game.image_url ? `<img src="${game.image_url}" alt="Preview">` : "";
        })
        .catch(err => {
            showPopupMessage('Failed to load game details. Please try again.', 'error');
            console.error('Error loading game details:', err);
        });
}

window.addEventListener('DOMContentLoaded', function () {
    // --- ADMIN PAGE ACCESS CONTROL ---
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }
    let user = null;
    try {
        const userCookie = getCookie('user');
        user = userCookie ? JSON.parse(decodeURIComponent(userCookie)) : null;
    } catch {}
    if (!user || user.role !== 'admin') {
        // Block page, show popup, redirect after 3s
        document.body.innerHTML = '';
        const popup = document.createElement('div');
        popup.textContent = 'You do not have access to this page.';
        popup.style.position = 'fixed';
        popup.style.top = '50%';
        popup.style.left = '50%';
        popup.style.transform = 'translate(-50%, -50%)';
        popup.style.background = '#23262e';
        popup.style.color = '#fff';
        popup.style.fontWeight = 'bold';
        popup.style.fontSize = '1.2rem';
        popup.style.padding = '32px 48px';
        popup.style.borderRadius = '12px';
        popup.style.boxShadow = '0 4px 24px #0005';
        popup.style.zIndex = '99999';
        document.body.appendChild(popup);
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 3000);
        return;
    }

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

    // Apply the same modern CSS to the Add Game form as the Edit form
    const addForm = document.getElementById('addGameForm');
    if (addForm) {
        addForm.style.display = 'flex';
        addForm.style.flexDirection = 'row';
        addForm.style.alignItems = 'flex-end';
        addForm.style.justifyContent = 'space-between';
        addForm.style.gap = '32px';
        addForm.style.position = 'relative';
        addForm.style.height = 'auto';
        addForm.style.minHeight = 'auto';
        addForm.style.paddingBottom = '64px';

        // Right column (form-right)
        const right = addForm.querySelector('.form-right');
        if (right) {
            right.style.display = 'flex';
            right.style.flexDirection = 'column';
            right.style.alignItems = 'flex-end';
            right.style.gap = '8px';
            right.style.width = '200px';
            right.style.maxWidth = '220px';
            const preview = document.getElementById('addImagePreview');
            if (preview) {
                preview.style.width = '170px';
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
            const imageInput = right.querySelector('#add_image_url');
            if (imageInput) {
                imageInput.style.width = '100%';
                imageInput.style.maxWidth = '100%';
            }
        }
        // Left column (form-left)
        const left = addForm.querySelector('.form-left');
        if (left) {
            left.style.display = 'flex';
            left.style.flexDirection = 'column';
            left.style.gap = '10px';
            left.style.flex = '1';
            left.querySelectorAll('input, select, textarea').forEach(el => {
                el.style.width = '100%';
                el.style.boxSizing = 'border-box';
                el.style.maxWidth = '100%';
                el.style.fontSize = '17px';
                el.style.padding = '10px 16px';
                el.style.height = '44px';
                el.style.borderRadius = '8px';
            });
        }
        // Modal buttons
        const modalButtons = addForm.querySelector('.form-actions');
        if (modalButtons && addForm) {
            modalButtons.style.display = 'flex';
            modalButtons.style.justifyContent = 'flex-end';
            modalButtons.style.gap = '12px';
            modalButtons.style.position = 'absolute';
            modalButtons.style.right = '24px';
            modalButtons.style.bottom = '20px';
            modalButtons.style.width = 'auto';
            modalButtons.style.background = 'transparent';
            if (addForm.lastElementChild !== modalButtons) {
                addForm.appendChild(modalButtons);
            }
        }
        addForm.style.paddingBottom = '56px';
    }

    // --- LOGOUT UTILITY ---
    function logoutAndRedirect() {
        // Remove all relevant cookies
        document.cookie = 'jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = 'jwt_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = 'user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        // Remove from localStorage
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user');
        // Redirect to login
        window.location.href = 'login.html';
    }

    // Example: attach to a logout/sign out button if present
    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
        signOutBtn.onclick = function(e) {
            e.preventDefault();
            logoutAndRedirect();
        };
    }
});

// Modern popup message function
function showPopupMessage(message, type = "info") {
    let popup = document.createElement("div");
    popup.className = `popup-message popup-${type}`;
    popup.textContent = message;
    document.body.appendChild(popup);
    setTimeout(() => {
        popup.classList.add("show");
    }, 10);
    setTimeout(() => {
        popup.classList.remove("show");
        setTimeout(() => popup.remove(), 300);
    }, 3000);
}

// Fetch and display games on page load
window.onload = fetchGames;

// Add Game Modal (structure matches Edit Game Modal for CSS compatibility)
const addGameModalHtml = `
<div id="addGameModal" class="modal">
    <div class="modal-content">
        <span class="close-btn" onclick="closeAddGameModal()">&times;</span>
        <form id="addGameForm" autocomplete="off">
            <div class="edit-flex-row">
                <div class="form-left">
                    <label for="add_title">Game title:</label>
                    <input type="text" id="add_title" name="title" placeholder="Enter game title">
                    <label for="add_description">Description:</label>
                    <input type="text" id="add_description" name="description" placeholder="Enter game description">
                    <label for="add_genre">Genre:</label>
                    <input type="text" id="add_genre" name="genre" placeholder="Enter genre">
                    <label for="add_price">Price:</label>
                    <input type="number" id="add_price" name="price" placeholder="Enter game price">
                    <label for="add_release_date">Release Date:</label>
                    <input type="date" id="add_release_date" name="release_date" placeholder="Enter release date">
                    <label for="add_status">Status:</label>
                    <select id="add_status" name="status">
                        <option value="draft">Draft</option>
                        <option value="under_review">Under Review</option>
                        <option value="published">Published</option>
                        <option value="suspended">Suspended</option>
                    </select>
                    <label for="add_approval">Approval:</label>
                    <select id="add_approval" name="approval">
                        <option value="Approved">Approved</option>
                        <option value="Not Approved">Not Approved</option>
                    </select>
                </div>
                <div class="form-right">
                    <div class="image-preview" id="addImagePreview"></div>
                    <label for="add_image_url" class="image-label">Image URL:</label>
                    <input type="text" id="add_image_url" name="image_url" placeholder="Enter image URL">
                    <label for="add_download_url">Download URL:</label>
                    <input type="text" id="add_download_url" name="download_url" placeholder="Enter download URL">
                </div>
            </div>
            <div class="form-actions">
                <button type="button" class="back-btn" onclick="closeAddGameModal()">Cancel</button>
                <button type="submit" class="save-btn">Add</button>
            </div>
        </form>
    </div>
</div>
`;

// Only insert the Add Game modal if it does not already exist
if (!document.getElementById('addGameModal')) {
    document.body.insertAdjacentHTML('beforeend', addGameModalHtml);
}

// Show Add Game Modal
const addGameBtn = document.getElementById('addGameBtn');
if (addGameBtn) {
    addGameBtn.style.background = 'linear-gradient(90deg,#1ba9ff 0%,#4f8cff 100%)';
    addGameBtn.style.color = '#fff';
    addGameBtn.style.fontWeight = '700';
    addGameBtn.style.fontSize = '17px';
    addGameBtn.style.border = 'none';
    addGameBtn.style.borderRadius = '8px';
    addGameBtn.style.padding = '12px 32px';
    addGameBtn.style.boxShadow = '0 2px 8px 0 rgba(31,38,135,0.10)';
    addGameBtn.style.transition = 'background 0.2s, box-shadow 0.2s';
    addGameBtn.style.cursor = 'pointer';
    addGameBtn.style.marginLeft = '16px';
    addGameBtn.onmouseover = function() {
        addGameBtn.style.background = 'linear-gradient(90deg,#4f8cff 0%,#1ba9ff 100%)';
        addGameBtn.style.boxShadow = '0 4px 16px 0 rgba(31,38,135,0.18)';
    };
    addGameBtn.onmouseout = function() {
        addGameBtn.style.background = 'linear-gradient(90deg,#1ba9ff 0%,#4f8cff 100%)';
        addGameBtn.style.boxShadow = '0 2px 8px 0 rgba(31,38,135,0.10)';
    };
}

addGameBtn.addEventListener('click', function() {
    document.getElementById('addGameModal').style.display = 'block';
});

function closeAddGameModal() {
    document.getElementById('addGameModal').style.display = 'none';
}

// Live image preview for Add Game
const addImageUrlInput = document.getElementById('add_image_url');
const addImagePreview = document.getElementById('addImagePreview');
addImageUrlInput.addEventListener('input', function() {
    addImagePreview.innerHTML = `<img src="${addImageUrlInput.value || 'https://via.placeholder.com/150'}" alt="Game Image">`;
});

// Handle Add Game Form Submission
const addGameForm = document.getElementById('addGameForm');
addGameForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    const formData = {
        title: document.getElementById('add_title').value,
        description: document.getElementById('add_description').value,
        genre: document.getElementById('add_genre').value,
        price: document.getElementById('add_price').value,
        release_date: document.getElementById('add_release_date').value,
        status: document.getElementById('add_status').value,
        approved: document.getElementById('add_approval').value === 'Approved',
        image_url: document.getElementById('add_image_url').value,
        download_url: document.getElementById('add_download_url').value
    };
    const token = getJwtToken();
    try {
        const response = await fetch('http://127.0.0.1:5000/api/games', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(formData)
        });
        if (response.ok) {
            showPopupMessage('Game added successfully!', 'success');
            closeAddGameModal();
            fetchGames();
        } else {
            const error = await response.json();
            showPopupMessage(`Error: ${error.message}`, 'error');
        }
    } catch (error) {
        showPopupMessage('Failed to add game. Please try again.', 'error');
    }
});

// Modern confirmation popup for delete
function showDeleteConfirmationPopup(onConfirm) {
    // Remove any existing confirmation popup
    const old = document.getElementById('delete-confirm-popup');
    if (old) old.remove();
    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'delete-confirm-popup';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(20,22,28,0.55)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '10000';
    // Modal box
    const box = document.createElement('div');
    box.className = 'modal-box';
    box.style.background = '#23272f';
    box.style.color = '#fff';
    box.style.borderRadius = '14px';
    box.style.padding = '36px 32px 24px 32px';
    box.style.minWidth = '340px';
    box.style.boxShadow = '0 8px 32px rgba(0,0,0,0.28)';
    box.style.textAlign = 'center';
    box.innerHTML = `
        <div class="modal-title">Delete Game</div>
        <div class="modal-msg">Are you sure you want to delete this game?</div>
        <div class="modal-actions" style="display:flex;gap:18px;justify-content:center;margin-top:24px;">
            <button class="modal-confirm" style="background:linear-gradient(90deg,#ff4f4f 60%,#ff6f61 100%);color:#fff;border:none;border-radius:7px;padding:10px 32px;font-size:1rem;font-weight:600;cursor:pointer;transition:background 0.18s;box-shadow:0 2px 8px rgba(255,77,79,0.08);">Delete</button>
            <button class="modal-cancel" style="background:#23272f;color:#fff;border:1px solid #444;border-radius:7px;padding:10px 32px;font-size:1rem;font-weight:600;cursor:pointer;transition:background 0.18s,color 0.18s;">Cancel</button>
        </div>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    // Button logic
    box.querySelector('.modal-cancel').onclick = () => overlay.remove();
    box.querySelector('.modal-confirm').onclick = () => {
        overlay.remove();
        onConfirm();
    };
}