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
        // Get JWT token for authorization
        let token = localStorage.getItem('jwt_token');
        if (!token) {
            const match = document.cookie.match(/(?:^|; )jwt=([^;]*)/);
            if (match) token = decodeURIComponent(match[1]);
        }

        const response = await fetch(`http://127.0.0.1:5000/api/games/${gameId}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error("Failed to fetch game details.");
        }

        const game = await response.json();

        // Make sure we have valid data before setting form values
        if (!game || typeof game !== 'object') {
            throw new Error("Invalid game data received");
        }

        // Set form values with proper type checking
        const form = document.getElementById("editGameForm");
        form.dataset.gameId = gameId;

        document.getElementById("title").value = game.title || '';
        document.getElementById("description").value = game.description || '';
        document.getElementById("price").value = typeof game.price === 'number' ? game.price : '';
        document.getElementById("genre").value = game.genre || '';
        document.getElementById("status").value = game.status || 'draft';
        document.getElementById("approval").value = game.approved ? "Approved" : "Not Approved";
        document.getElementById("image_url").value = game.image_url || '';

        // Update image preview with fallback
        const imagePreview = document.getElementById("imagePreview");
        const imgSrc = game.image_url || 'images/games/default.jpg';
        imagePreview.innerHTML = `<img src="${imgSrc}" alt="Game Image" onerror="this.src='images/games/default.jpg'">`;

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

    const gameId = this.dataset.gameId;
    if (!gameId) {
        alert("Invalid game ID. Please try again.");
        return;
    }

    // Get JWT token
    let token = localStorage.getItem('jwt_token');
    if (!token) {
        const match = document.cookie.match(/(?:^|; )jwt=([^;]*)/);
        if (match) token = decodeURIComponent(match[1]);
    }

    if (!token) {
        alert("You must be logged in to edit games.");
        return;
    }

    // Validate and format the data
    const formData = {
        title: document.getElementById("title").value.trim(),
        description: document.getElementById("description").value.trim(),
        genre: document.getElementById("genre").value.trim(),
        price: parseFloat(document.getElementById("price").value) || 0,
        status: document.getElementById("status").value,
        approved: document.getElementById("approval").value === "Approved",
        image_url: document.getElementById("image_url").value.trim()
    };

    // Basic validation
    if (!formData.title) {
        alert("Title is required");
        return;
    }

    try {
        const response = await fetch(`http://127.0.0.1:5000/api/games/${gameId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
            alert("Game updated successfully!");
            closeEditModal();
            if (typeof fetchGames === 'function') {
                fetchGames(); // Refresh the games list
            }
        } else {
            throw new Error(data.error || 'Failed to update game');
        }
    } catch (error) {
        console.error("Error updating game:", error);
        alert(error.message || "Failed to update the game. Please try again.");
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

// Fetch game details on page load
const gameId = new URLSearchParams(window.location.search).get("id");
if (gameId) {
    console.log("Game ID in openEditModal:", gameId);
    fetchGameDetails(gameId);
}