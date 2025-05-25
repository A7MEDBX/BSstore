const BASE_URL = 'http://127.0.0.1:5000';
function getToken() {
    let token = localStorage.getItem('jwt_token');
    if (token) return token;
    let match = document.cookie.match(/(?:^|; )jwt_token=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
    match = document.cookie.match(/(?:^|; )jwt=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
    return null;
}
document.addEventListener('DOMContentLoaded', async () => {
    let userId = null;
    let userData = null;    // Get userId from cookie and fetch user data from /api/users/<id>
    try {
        function getCookie(name) {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
        }
        const userCookie = getCookie('user');
        if (!userCookie) throw new Error('User not logged in');
        const userObj = JSON.parse(decodeURIComponent(userCookie));
        userId = userObj.id;
        const token = localStorage.getItem('jwt_token');
        console.log('Retrieved token:', token ? 'Token exists' : 'No token found');
        
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        console.log('Request headers:', headers);
        
        const response = await fetch(`${BASE_URL}/api/users/${userId}`, {
            headers: headers
        });
        console.log('Response status:', response.status);
        if (!response.ok) {
            console.error('Response headers:', Object.fromEntries(response.headers.entries()));
            throw new Error(`Failed to fetch user data: ${response.status}`);
        }
        userData = await response.json();
        // document.getElementById('account-id').textContent = userData.id; // Removed: no longer in HTML
        document.getElementById('display-name').value = userData.username;
        document.getElementById('email').value = userData.email;
    } catch (error) {
        console.error('Error loading user data:', error);
        alert('Failed to load user data. Please log in again.');
    }

    // Modern Toast Notification
    function showToast(message, type = 'success') {
        let toast = document.createElement('div');
        toast.className = 'toast toast-' + (type === 'error' ? 'error' : 'success');
        toast.textContent = message;
        toast.style.opacity = '0';
        toast.style.zIndex = '10000';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '1'; }, 30);
        setTimeout(() => {
            toast.style.animation = 'toastOut 0.18s forwards';
            setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 200);
        }, 2600);
    }

    // Edit/Save logic for display name
    const displayNameInput = document.getElementById('display-name');
    const editDisplayNameBtn = document.getElementById('edit-display-name');
    let displayNameEditing = false;
    editDisplayNameBtn.addEventListener('click', async () => {
        if (!displayNameEditing) {
            displayNameInput.disabled = false;
            displayNameInput.focus();
            editDisplayNameBtn.innerHTML = '<i class="fas fa-check"></i>';
            displayNameEditing = true;
        } else {
            // Save
            const newName = displayNameInput.value.trim();
            if (!newName) return showToast('Display name cannot be empty.', 'error');
            try {
                const token = getToken();
                const res = await fetch(`${BASE_URL}/api/users/${userId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ username: newName })
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Failed to update');
                displayNameInput.value = result.username;
                displayNameInput.disabled = true;
                editDisplayNameBtn.innerHTML = '<i class="fas fa-pen"></i>';
                displayNameEditing = false;
                showToast('Display name updated!', 'success');
            } catch (err) {
                showToast('Error updating display name: ' + err.message, 'error');
            }
        }
    });

    // Edit/Save logic for email
    const emailInput = document.getElementById('email');
    const editEmailBtn = document.getElementById('edit-email');
    let emailEditing = false;
    editEmailBtn.addEventListener('click', async () => {
        if (!emailEditing) {
            emailInput.disabled = false;
            emailInput.focus();
            editEmailBtn.innerHTML = '<i class="fas fa-check"></i>';
            emailEditing = true;
        } else {
            // Save
            const newEmail = emailInput.value.trim();
            if (!newEmail) return showToast('Email cannot be empty.', 'error');
            try {
                const token = getToken();
                const res = await fetch(`${BASE_URL}/api/users/${userId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ email: newEmail })
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Failed to update');
                emailInput.value = result.email;
                emailInput.disabled = true;
                editEmailBtn.innerHTML = '<i class="fas fa-pen"></i>';
                emailEditing = false;
                showToast('Email updated!', 'success');
            } catch (err) {
                showToast('Error updating email: ' + err.message, 'error');
            }
        }
    });

    // Change Password logic
    const changePasswordBtn = document.getElementById('change-password-btn');
    const oldPasswordInput = document.getElementById('old-password');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', async () => {
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
                const res = await fetch(`${BASE_URL}/api/users/${userId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || result.message || 'Failed to change password');
                showToast('Password changed successfully!', 'success');
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

    // Delete Account logic
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', () => {
            // Create modern modal
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-box">
                    <div class="modal-title">Delete Account</div>
                    <div class="modal-msg">Are you sure you want to delete your account? This action cannot be undone.</div>
                    <div class="modal-actions">
                        <button class="modal-confirm">Delete</button>
                        <button class="modal-cancel">Cancel</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            // Style (minimal, for demo)
            const style = document.createElement('style');
            style.textContent = `
                .modal-overlay { position: fixed; z-index: 9999; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; }
                .modal-box { background: #23272f; color: #fff; border-radius: 12px; padding: 32px 28px 20px 28px; min-width: 320px; box-shadow: 0 8px 32px rgba(0,0,0,0.25); text-align: center; }
                .modal-title { font-size: 1.3rem; font-weight: 600; margin-bottom: 12px; }
                .modal-msg { font-size: 1rem; margin-bottom: 24px; }
                .modal-actions { display: flex; gap: 16px; justify-content: center; }
                .modal-confirm { background: #ff4d4f; color: #fff; border: none; border-radius: 6px; padding: 8px 24px; font-size: 1rem; cursor: pointer; transition: background 0.2s; }
                .modal-confirm:hover { background: #d9363e; }
                .modal-cancel { background: #23272f; color: #fff; border: 1px solid #444; border-radius: 6px; padding: 8px 24px; font-size: 1rem; cursor: pointer; transition: background 0.2s, color 0.2s; }
                .modal-cancel:hover { background: #fff; color: #23272f; }
            `;
            document.head.appendChild(style);
            // Button logic
            modal.querySelector('.modal-cancel').onclick = () => {
                modal.remove();
                style.remove();
            };
            modal.querySelector('.modal-confirm').onclick = async () => {
                modal.querySelector('.modal-confirm').disabled = true;
                try {
                    const token = getToken();
                    const res = await fetch(`${BASE_URL}/api/users/${userId}`, {
                        method: 'DELETE',
                        headers: {
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        }
                    });
                    const result = await res.json();
                    if (!res.ok) throw new Error(result.error || result.message || 'Failed to delete account');
                    showToast('Account deleted. Goodbye!', 'success');
                    // Log out: clear tokens/cookies and redirect
                    localStorage.removeItem('jwt_token');
                    document.cookie = 'jwt=; Max-Age=0; path=/;';
                    document.cookie = 'user=; Max-Age=0; path=/;';
                    setTimeout(() => { window.location.href = 'login.html'; }, 1200);
                } catch (err) {
                    showToast('Error deleting account: ' + err.message, 'error');
                } finally {
                    modal.remove();
                    style.remove();
                }
            };
        });
    }
});