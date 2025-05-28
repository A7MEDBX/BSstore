// Base URL for your API
const BASE_URL = 'http://127.0.0.1:5000'; // Make sure this is correct

// Modern popup message fallback (your code - looks good)
if (typeof window.showPopupMessage !== 'function') {
    window.showPopupMessage = function (msg, type = 'info') {
        // ... (your existing popup code - keep it) ...
        let popup = document.createElement('div');
        popup.textContent = msg;
        popup.className = 'modern-popup-message ' + (type || 'info');
        // Basic styling (you likely have this in CSS or more elaborate)
        popup.style.position = 'fixed';
        popup.style.top = '32px';
        popup.style.left = '50%';
        popup.style.transform = 'translateX(-50%)';
        popup.style.background = type === 'error' ? '#e53935' : (type === 'success' ? '#1ba9ff' : '#23262e');
        popup.style.color = '#fff';
        popup.style.padding = '16px 32px';
        popup.style.borderRadius = '10px';
        popup.style.fontSize = '1.1rem';
        popup.style.fontWeight = '600';
        popup.style.zIndex = 9999;
        popup.style.boxShadow = '0 2px 16px #0005';
        document.body.appendChild(popup);
        // Fade out and remove
        popup.style.transition = 'opacity 0.3s ease-out';
        setTimeout(() => { popup.style.opacity = '0'; }, 1800);
        setTimeout(() => { popup.remove(); }, 2300);
    };
}

// Function to get the JWT token (from localStorage first, then cookie)
function getAuthToken() {
    let token = localStorage.getItem('jwt_token');
    if (!token) {
        const match = document.cookie.match(/(?:^|; )jwt=([^;]*)/);
        if (match) {
            try {
                token = decodeURIComponent(match[1]);
            } catch (e) {
                console.error("Error decoding JWT from cookie:", e);
                token = null;
            }
        }
    }
    return token;
}

// Function to handle redirection to login if token is invalid/expired
function redirectToLogin(message = 'Your session has expired or you are not logged in. Please log in again.') {
    if (window.showPopupMessage) showPopupMessage(message, 'error');
    // Clear potentially invalid token
    localStorage.removeItem('jwt_token'); 
    // Clear cookie if you are also setting it (this is a basic way, might need path/domain)
    document.cookie = "jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"; 
    
    // Redirect to your login page
    // Ensure you have a login.html or similar
    window.location.href = '/login.html'; // Adjust if your login page is different
}

// Fetch wishlist from API and render
async function fetchWishlist() {
    const token = getAuthToken();

    if (!token) {
        console.log('No token found, cannot fetch wishlist.');
        // Don't show popup here, let the calling function decide or handle UI
        // If called directly on page load, it's okay for wishlist to be empty if not logged in.
        return []; // Return empty array or handle as needed
    }

    try {
        const res = await fetch(`${BASE_URL}/api/wishlist`, {
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json' // Good practice, though not always needed for GET
            }
        });

        if (res.status === 401) { // Unauthorized - token likely invalid or expired
            redirectToLogin('Your session has expired. Please log in again to view your wishlist.');
            return []; // Stop further processing
        }

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: 'Failed to fetch wishlist. Server returned an error.' }));
            console.error("Failed to fetch wishlist:", res.status, errorData);
            if (window.showPopupMessage) showPopupMessage(errorData.error || `Error: ${res.statusText}`, 'error');
            return [];
        }

        return await res.json();

    } catch (err) {
        console.error("Network error or other issue fetching wishlist:", err);
        if (window.showPopupMessage) showPopupMessage('Could not connect to server to get wishlist. Please check your connection.', 'error');
        return [];
    }
}

// Render wishlist items (your existing function with minor safety)
function renderWishlist(wishlistData) { // Changed parameter name for clarity
    const list = document.getElementById('wishlistList');
    if (!list) {
        console.error('Wishlist container #wishlistList not found.');
        return;
    }
    list.innerHTML = ''; // Clear previous items

    // The backend now returns a list of objects where each object has a 'game' property
    // and 'wishlist_item_id', 'date_added'
    const games = wishlistData.map(item => ({ ...item.game, wishlist_item_id: item.id, date_added: item.date_added }));


    if (!games || !games.length) {
        list.innerHTML = '<div style="color:#aaa;font-size:1.15rem;margin:32px 0;">Your wishlist is empty. Add some games!</div>';
        return;
    }

    games.forEach(game => { // game here is the game object from the nested structure
        const card = document.createElement('div');
        card.className = 'wishlist-card'; // Ensure this class is styled
        card.innerHTML = `
            <img src="${game.image_url || 'https://via.placeholder.com/120x180?text=No+Image'}" alt="${game.title || 'Game Image'}">
            <div class="wishlist-info">
                <div class="wishlist-title">${game.title || 'Untitled Game'}</div>
                <div class="wishlist-price">${game.currency || '$'} ${game.price !== undefined && game.price !== null ? game.price.toLocaleString() : 'N/A'}</div>
                <div class="wishlist-pegi">
                    <span class="wishlist-pegi-badge">PEGI ${game.pegi || 18}</span> 
                    <span class="wishlist-pegi-desc">${game.pegi_desc || 'Content Descriptors Unavailable'}</span>
                </div>
                <div class="wishlist-epic-reward">
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#ffe082"/><path d="M8 12l2.5 2.5L16 9" stroke="#23262e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    ${game.reward || 'Special offer details here.'}
                </div>
                <div class="wishlist-actions">
                    <button class="wishlist-remove" data-game-id="${game.id}">Remove</button>
                    <button class="wishlist-addcart" data-game-id="${game.id}">Add To Cart</button>
                </div>
            </div>
        `;

        // Event Listeners for Remove and Add to Cart
        const removeButton = card.querySelector('.wishlist-remove');
        if (removeButton) {
            removeButton.onclick = async function () {
                await handleRemoveFromWishlist(game.id, this); // Pass game.id
            };
        }

        const addToCartButton = card.querySelector('.wishlist-addcart');
        if (addToCartButton) {
            addToCartButton.onclick = async () => {
                await handleAddToCart(game.id); // Pass game.id
            };
        }
        list.appendChild(card);
    });
}

// Handler for removing from wishlist
async function handleRemoveFromWishlist(gameId, buttonElement) {
    const token = getAuthToken();
    if (!token) {
        redirectToLogin('You must be logged in to modify your wishlist.');
        return;
    }

    if (buttonElement) buttonElement.disabled = true; // Prevent multiple clicks

    try {
        const resp = await fetch(`${BASE_URL}/api/wishlist/${gameId}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (resp.status === 401) {
            redirectToLogin('Your session has expired. Please log in again.');
            return;
        }

        if (resp.ok) {
            if (window.showPopupMessage) showPopupMessage('Removed from wishlist!', 'success');
            loadWishlist(); // Reload the wishlist to reflect changes
        } else {
            const data = await resp.json().catch(() => ({ error: 'Failed to remove from wishlist.' }));
            if (window.showPopupMessage) showPopupMessage(data.error || 'Failed to remove from wishlist.', 'error');
        }
    } catch (err) {
        console.error("Error removing from wishlist:", err);
        if (window.showPopupMessage) showPopupMessage('Network error. Could not remove from wishlist.', 'error');
    } finally {
        if (buttonElement) {
             // Re-enable button after a short delay
            setTimeout(() => { buttonElement.disabled = false; }, 1000);
        }
    }
}

// Handler for adding to cart
async function handleAddToCart(gameId) {
    const token = getAuthToken();
    if (!token) {
        redirectToLogin('You must be logged in to add items to your cart.');
        return;
    }

    try {
        const resp = await fetch(`${BASE_URL}/api/cart`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ game_id: gameId })
        });

        if (resp.status === 401) {
            redirectToLogin('Your session has expired. Please log in again.');
            return;
        }
        
        const data = await resp.json(); // Always try to parse JSON

        if (resp.ok) {
            if (window.showPopupMessage) showPopupMessage(data.message || 'Added to cart!', 'success');
        } else {
            if (window.showPopupMessage) showPopupMessage(data.error || 'Failed to add to cart.', 'error');
        }
    } catch (err) {
        console.error("Error adding to cart:", err);
        if (window.showPopupMessage) showPopupMessage('Network error. Could not add to cart.', 'error');
    }
}

// Main function to load and render the wishlist
async function loadWishlist() {
    const wishlistItems = await fetchWishlist(); // This now returns the raw API response
    if (wishlistItems) { // Check if fetchWishlist didn't return undefined due to redirect
        renderWishlist(wishlistItems);
    }
}

// Load wishlist when the DOM is ready
document.addEventListener('DOMContentLoaded', loadWishlist);