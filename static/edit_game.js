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

        document.getElementById("title").value = game.title;
        document.getElementById("description").value = game.description;
        document.getElementById("price").value = game.price;
        document.getElementById("genre").value = game.genre;
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
        genre: document.getElementById("genre").value,
        price: document.getElementById("price").value,
        status: document.getElementById("status").value,
        approved: document.getElementById("approval").value === "Approved",
        image_url: document.getElementById("image_url").value,
    };

    try {
        const response = await fetch(`http://127.0.0.1:5000/api/games/${gameId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(formData),
        });

        if (response.ok) {
            alert("Game updated successfully!");
            closeEditModal();
            fetchGames(); // Refresh the games list
        } else {
            const error = await response.json();
            alert(`Error: ${error.message}`);
        }
    } catch (error) {
        console.error("Error updating game:", error);
        alert("Failed to update the game. Please try again.");
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