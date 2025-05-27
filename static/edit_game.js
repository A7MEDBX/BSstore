/**
 * Utility to get JWT token from localStorage or cookie
 */
function getJwtToken() {
    let token = localStorage.getItem('jwt_token');
    if (token) return token;
    let match = document.cookie.match(/(?:^|; )jwt=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
    return null;
}

/**
 * Fetch all genres from the backend and populate the genre select input.
 * @param {string} selectedGenre - The genre to select (optional)
 */
async function fetchAndPopulateGenres(selectedGenre = "") {
    try {
        const res = await fetch("http://127.0.0.1:5000/api/genres");
        if (!res.ok) throw new Error("Failed to fetch genres");
        const genres = await res.json();
        const genreSelect = document.getElementById("genre");
        if (genreSelect && Array.isArray(genres)) {
            genreSelect.innerHTML = '';
            genres.forEach(g => {
                const option = document.createElement("option");
                option.value = g.name || g;
                option.textContent = g.name || g;
                if ((g.name || g) === selectedGenre) option.selected = true;
                genreSelect.appendChild(option);
            });
        }
    } catch (err) {
        // fallback: do nothing
    }
}

/**
 * Fetch game details from the backend and populate the edit form.
 * @param {number} gameId - The ID of the game to fetch.
 */
async function fetchGameDetails(gameId) {
    if (!gameId) {
        console.error("Invalid gameId:", gameId);
        return;
    }

    try {
        const response = await fetch(`http://127.0.0.1:5000/api/games/${gameId}`);
        if (!response.ok) throw new Error("Failed to fetch game details.");

        const game = await response.json();

        await fetchAndPopulateGenres(game.genre || "");
        // Defensive: if genre is not in the dropdown, add it as an option
        const genreSelect = document.getElementById("genre");
        if (genreSelect) {
            genreSelect.disabled = false;
            if (game.genre && !Array.from(genreSelect.options).some(opt => opt.value === game.genre)) {
                const opt = document.createElement("option");
                opt.value = game.genre;
                opt.textContent = game.genre;
                genreSelect.appendChild(opt);
            }
            if (game.genre) genreSelect.value = game.genre;
        }
        document.getElementById("title").value = game.title;
        document.getElementById("description").value = game.description;
        document.getElementById("price").value = game.price;
        document.getElementById("status").value = game.status;
        document.getElementById("approval").value = game.approved ? "Approved" : "Not Approved";
        document.getElementById("image_url").value = game.image_url;

        const imagePreview = document.getElementById("imagePreview");
        imagePreview.innerHTML = `<img src="${game.image_url || 'https://via.placeholder.com/150'}" alt="Game Image">`;
    } catch (error) {
        console.error("Error fetching game details:", error);
        alert("Failed to load game details. Please try again.");
    }
}

/**
 * Handle form submission to update the game details.
 */
document.getElementById("editGameForm").addEventListener("submit", async function (event) {
    event.preventDefault();

    const gameId = document.getElementById("editGameForm").dataset.gameId;
    if (!gameId) {
        alert("Invalid game ID. Please try again.");
        return;
    }

    const formData = {
        title: document.getElementById("title").value,
        description: document.getElementById("description").value,
        // Only include genre if not empty
        ...(document.getElementById("genre").value ? { genre: document.getElementById("genre").value } : {}),
        price: document.getElementById("price").value,
        status: document.getElementById("status").value,
        approved: document.getElementById("approval").value === "Approved",
        image_url: document.getElementById("image_url").value,
    };

    try {
        const token = getJwtToken();
        const response = await fetch(`http://127.0.0.1:5000/api/games/${gameId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify(formData),
        });

        if (response.ok) {
            this.showPopover("Game updated successfully!");
            closeEditModal();
            fetchGames(); // Refresh the games list
        } else {
            const error = await response.json();
            alert(`Error: ${error.message}`);
        }
    } catch (error) {
        console.error("Error updating game:", error);
      //  alert("Failed to update the game. Please try again.");
    }
});

/**
 * Close the edit modal.
 */
function closeEditModal() {
    const modal = document.getElementById("editGameModal");
    modal.style.display = "none";
}

// Utility function to set the game ID in the form
function setEditGameId(gameId) {
    document.getElementById("editGameForm").dataset.gameId = gameId;
}

/**
 * Navigate back to the previous page.
 */
function goBack() {
    window.history.back();
}

// On page load, fetch game details (which will load genres)
const gameId = new URLSearchParams(window.location.search).get("id");
if (gameId) {
    fetchGameDetails(gameId);
}