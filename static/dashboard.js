const BASE_URL = 'https://a7medbx.pythonanywhere.com/';

// Helper function to get JWT token
function getToken() {
    let token = localStorage.getItem('jwt_token');
    if (token) return token;
    // Fallback to cookies if you use them (ensure consistent naming)
    let match = document.cookie.match(/(?:^|; )jwt_token=([^;]*)/); // Or just 'jwt'
    if (match) {
        try { return decodeURIComponent(match[1]); } catch(e) { console.error("Error decoding cookie token:", e); return null;}
    }
    match = document.cookie.match(/(?:^|; )jwt=([^;]*)/);
    if (match) {
        try { return decodeURIComponent(match[1]); } catch(e) { console.error("Error decoding cookie token:", e); return null;}
    }
    return null;
}

// Modern Toast Notification
function showToast(message, type = 'success') {
    let toast = document.createElement('div');
    // Basic class for general toast styling (you can define this in your CSS)
    toast.className = 'toast-notification'; 
    
    // Type-specific class for coloring
    if (type === 'error') {
        toast.classList.add('toast-error');
        toast.style.background = '#e53935'; // Default error red
    } else if (type === 'success') {
        toast.classList.add('toast-success');
        toast.style.background = '#1ba9ff'; // Default success blue
    } else {
        toast.classList.add('toast-info');
        toast.style.background = '#23262e'; // Default info dark
    }

    toast.textContent = message;
    
    // Core styles applied via JavaScript
    toast.style.position = 'fixed';
    toast.style.top = '20px'; // Initial position for animation
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.padding = '12px 25px';
    toast.style.color = 'white';
    toast.style.borderRadius = '8px';
    toast.style.zIndex = '10000';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease-out, top 0.3s ease-out';
    toast.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
    toast.style.textAlign = 'center';
    toast.style.fontFamily = "'Segoe UI', Arial, sans-serif"; // Example font
    toast.style.fontSize = '1rem';

    // --- WIDTH CONTROL ---
    toast.style.maxWidth = '450px'; // Max width for the toast
    toast.style.width = 'auto';     // Allows it to be narrower for short messages
    toast.style.minWidth = '280px'; // Optional: prevent it from being too tiny
    // --- END WIDTH CONTROL ---
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.top = '40px'; // Slide down to final position
    }, 50); 

    // Animate out and remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.top = '20px'; // Slide back up
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300); // Wait for fade out animation
    }, 3000); // Message visible for 3 seconds
}


document.addEventListener('DOMContentLoaded', async () => {
    let userId = null; // Will be set after fetching from cookie

    // --- Function to get user ID from your 'user' cookie ---
    function getUserIdFromCookie() {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; user=`); // Assuming your cookie storing user info is named 'user'
        if (parts.length === 2) {
            try {
                const userObjString = parts.pop().split(';').shift();
                const userObj = JSON.parse(decodeURIComponent(userObjString));
                return userObj.id;
            } catch (e) {
                console.error("Error parsing user cookie:", e);
                return null;
            }
        }
        return null;
    }

    // --- Load initial user data ---
    async function loadInitialUserData() {
        userId = getUserIdFromCookie(); 
        if (!userId) {
            console.error('User ID not found in cookie. User might not be logged in or cookie is missing/misnamed.');
            showToast('You need to be logged in to view account details.', 'error');
            // Optional: Redirect to login page after a delay
            // setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            return false; // Indicate failure to load
        }

        const token = getToken(); 
        console.log('Initial load: Retrieved token:', token ? 'Token exists' : 'No token found');
        
        if (!token) {
            console.error('JWT token not found for initial data load.');
            showToast('Authentication token not found. Please log in again.', 'error');
            // Optional: Redirect to login page
            return false;
        }

        const headers = { 'Authorization': `Bearer ${token}` };
        console.log('Initial load: Request headers:', headers);
        
        try {
            const response = await fetch(`${BASE_URL}/api/users/${userId}`, {
                headers: headers
            });
            console.log('Initial load: Response status:', response.status);

            const responseData = await response.json(); // Try to get JSON regardless of status for error messages
            if (!response.ok) {
                console.error('Initial load: Response headers:', Object.fromEntries(response.headers.entries()));
                throw new Error(responseData.error || `Failed to fetch user data: ${response.status}`);
            }
            
            // userData = responseData; // Store if needed globally, not strictly necessary for just populating
            document.getElementById('display-name').value = responseData.username || '';
            document.getElementById('email').value = responseData.email || '';
            return true; // Indicate success
        } catch (error) {
            console.error('Error loading user data:', error);
            showToast(error.message || 'Failed to load user data. Please try logging in again.', 'error');
            // Optional: Redirect to login page
            return false;
        }
    }

    const initialLoadSuccess = await loadInitialUserData();
    if (!initialLoadSuccess) {
        // Disable form elements if initial load failed
        document.querySelectorAll('#account-settings-form input, #account-settings-form button').forEach(el => el.disabled = true);
        return; // Stop further event listener setup
    }


    // --- Edit/Save logic for display name ---
    const displayNameInput = document.getElementById('display-name');
    const editDisplayNameBtn = document.getElementById('edit-display-name');
    let displayNameEditing = false;

    if (editDisplayNameBtn && displayNameInput) {
        editDisplayNameBtn.addEventListener('click', async () => {
            if (!userId) { 
                showToast('User information not loaded. Please refresh.', 'error');
                return;
            }
            if (!displayNameEditing) {
                displayNameInput.disabled = false;
                displayNameInput.focus();
                editDisplayNameBtn.innerHTML = '<i class="fas fa-check"></i>';
                displayNameEditing = true;
            } else {
                const newName = displayNameInput.value.trim();
                if (!newName) {
                    showToast('Display name cannot be empty.', 'error');
                    return;
                }
                try {
                    const token = getToken();
                    if (!token) {
                        showToast('Authentication error. Please log in again.', 'error');
                        return;
                    }
                    const res = await fetch(`${BASE_URL}/api/users/${userId}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ username: newName })
                    });
                    const result = await res.json();
                    if (!res.ok) {
                        throw new Error(result.error || result.message || 'Failed to update display name.');
                    }
                    
                    if (result.user && typeof result.user.username !== 'undefined') {
                        displayNameInput.value = result.user.username;
                    } else {
                        console.warn('Updated username not found in PATCH response. UI might not reflect change.');
                    }
                    
                    displayNameInput.disabled = true;
                    editDisplayNameBtn.innerHTML = '<i class="fas fa-pen"></i>';
                    displayNameEditing = false;
                    showToast(result.message || 'Display name updated!', 'success');
                } catch (err) {
                    showToast('Error updating display name: ' + err.message, 'error');
                }
            }
        });
    }

    // --- Edit/Save logic for email ---
    const emailInput = document.getElementById('email');
    const editEmailBtn = document.getElementById('edit-email');
    let emailEditing = false;

    if (editEmailBtn && emailInput) {
        editEmailBtn.addEventListener('click', async () => {
            if (!userId) {
                showToast('User information not loaded. Please refresh.', 'error');
                return;
            }
            if (!emailEditing) {
                emailInput.disabled = false;
                emailInput.focus();
                editEmailBtn.innerHTML = '<i class="fas fa-check"></i>';
                emailEditing = true;
            } else {
                const newEmail = emailInput.value.trim();
                if (!newEmail) { 
                    showToast('Email cannot be empty.', 'error');
                    return;
                }
                // Basic email validation
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
                    showToast('Please enter a valid email address.', 'error');
                    return;
                }
                try {
                    const token = getToken();
                    if (!token) {
                        showToast('Authentication error. Please log in again.', 'error');
                        return;
                    }
                    const res = await fetch(`${BASE_URL}/api/users/${userId}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ email: newEmail })
                    });
                    const result = await res.json();
                    if (!res.ok) {
                         throw new Error(result.error || result.message || 'Failed to update email.');
                    }

                    if (result.user && typeof result.user.email !== 'undefined') {
                        emailInput.value = result.user.email;
                    } else {
                         console.warn('Updated email not found in PATCH response. UI might not reflect change.');
                    }
                    
                    emailInput.disabled = true;
                    editEmailBtn.innerHTML = '<i class="fas fa-pen"></i>';
                    emailEditing = false;
                    showToast(result.message || 'Email updated!', 'success'); 
                } catch (err) {
                    showToast('Error updating email: ' + err.message, 'error');
                }
            }
        });
    }

    // --- Change Password logic ---
    const changePasswordBtn = document.getElementById('change-password-btn');
    const oldPasswordInput = document.getElementById('old-password');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');

    if (changePasswordBtn && oldPasswordInput && newPasswordInput && confirmPasswordInput) {
        changePasswordBtn.addEventListener('click', async () => {
            if (!userId) {
                showToast('User information not loaded. Please refresh.', 'error');
                return;
            }
            const oldPassword = oldPasswordInput.value;
            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            if (!oldPassword || !newPassword || !confirmPassword) {
                showToast('All password fields are required.', 'error');
                return;
            }
            if (newPassword.length < 8) {
                showToast('New password must be at least 8 characters.', 'error');
                return;
            }
            if (newPassword !== confirmPassword) {
                showToast('New password and confirmation do not match.', 'error');
                return;
            }
            
            changePasswordBtn.disabled = true;
            try {
                const token = getToken();
                if (!token) {
                    showToast('Authentication error. Please log in again.', 'error');
                    changePasswordBtn.disabled = false;
                    return;
                }
                const res = await fetch(`${BASE_URL}/api/users/${userId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
                });
                const result = await res.json();
                if (!res.ok) {
                    throw new Error(result.error || result.message || 'Failed to change password.');
                }
                showToast(result.message || 'Password changed successfully!', 'success');
                oldPasswordInput.value = '';
                newPasswordInput.value = '';
                confirmPasswordInput.value = '';
            } catch (err) {
                showToast('Error changing password: ' + err.message, 'error');
            } finally {
                changePasswordBtn.disabled = false;
            }
        });
    }

    // --- Delete Account logic ---
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', () => {
            if (!userId) {
                showToast('User information not loaded. Please refresh.', 'error');
                return;
            }
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-box">
                    <div class="modal-title">Delete Account</div>
                    <div class="modal-msg">Are you sure you want to delete your account? This action cannot be undone. All your data will be permanently lost.</div>
                    <div class="modal-actions">
                        <button class="modal-confirm-delete">Yes, Delete My Account</button> 
                        <button class="modal-cancel-delete">Cancel</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            const style = document.createElement('style');
            // More refined modal styling
            style.textContent = `
                .modal-overlay { position: fixed; z-index: 10001; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s ease; }
                .modal-box { background: #282c34; color: #abb2bf; border-radius: 10px; padding: 30px; width: 90%; max-width: 450px; box-shadow: 0 8px 25px rgba(0,0,0,0.3); text-align: center; transform: scale(0.95); transition: transform 0.3s ease; }
                .modal-overlay.active { opacity: 1; }
                .modal-overlay.active .modal-box { transform: scale(1); }
                .modal-title { font-size: 1.5rem; font-weight: 600; margin-bottom: 15px; color: #e06c75; } /* Error-like color for delete */
                .modal-msg { font-size: 1rem; margin-bottom: 25px; line-height: 1.6; }
                .modal-actions { display: flex; gap: 15px; justify-content: center; margin-top: 10px; }
                .modal-actions button { border: none; border-radius: 6px; padding: 12px 24px; font-size: 1rem; font-weight: 500; cursor: pointer; transition: background-color 0.2s, transform 0.1s; }
                .modal-actions button:active { transform: scale(0.98); }
                .modal-confirm-delete { background: #e06c75; color: #fff; }
                .modal-confirm-delete:hover { background: #c95f69; }
                .modal-cancel-delete { background: #4b5263; color: #fff; }
                .modal-cancel-delete:hover { background: #5a6273; }
            `;
            document.head.appendChild(style);
            
            // Trigger modal animation
            setTimeout(() => modal.classList.add('active'), 10);


            modal.querySelector('.modal-cancel-delete').onclick = () => {
                modal.classList.remove('active');
                setTimeout(() => {
                    if (modal.parentNode) modal.remove();
                    if (style.parentNode) style.remove();
                }, 300);
            };
            modal.querySelector('.modal-confirm-delete').onclick = async () => {
                modal.querySelector('.modal-confirm-delete').disabled = true;
                modal.querySelector('.modal-cancel-delete').disabled = true;
                try {
                    const token = getToken();
                    if (!token) {
                        showToast('Authentication error. Please log in again.', 'error');
                        modal.querySelector('.modal-confirm-delete').disabled = false;
                        modal.querySelector('.modal-cancel-delete').disabled = false;
                        return;
                    }
                    const res = await fetch(`${BASE_URL}/api/users/${userId}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    const result = await res.json();
                    if (!res.ok) {
                        throw new Error(result.error || result.message || 'Failed to delete account.');
                    }
                    showToast(result.message || 'Account deleted successfully. Redirecting...', 'success');
                    
                    localStorage.removeItem('jwt_token');
                    document.cookie = 'jwt_token=; Max-Age=0; path=/; SameSite=Lax;';
                    document.cookie = 'jwt=; Max-Age=0; path=/; SameSite=Lax;';
                    document.cookie = 'user=; Max-Age=0; path=/; SameSite=Lax;'; 
                    setTimeout(() => { window.location.href = 'login.html'; }, 2000);
                } catch (err) {
                    showToast('Error deleting account: ' + err.message, 'error');
                    modal.querySelector('.modal-confirm-delete').disabled = false;
                    modal.querySelector('.modal-cancel-delete').disabled = false;
                } 
                // Don't remove modal immediately on error, let user see message from toast.
                // Modal removal on success is handled by page redirect.
            };
        });
    }
});