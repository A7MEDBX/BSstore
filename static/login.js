// Disable all alerts globally
window.alert = function() {};

// Attach forgot password event after DOM is loaded
window.addEventListener('DOMContentLoaded', function() {
    const forgotLink = document.getElementById('loginForgotLink');
    if (forgotLink) {
        forgotLink.addEventListener('click', async function(e) {
            e.preventDefault();
            if (typeof showResetEmailPopup !== 'function') {
                if (window.showPopupMessage) {
                    showPopupMessage('Reset popup not available', 'error');
                } else {
                    alert('Reset popup not available');
                }
                return;
            }
            const email = await showResetEmailPopup();
            if (email) {
                localStorage.setItem('resetEmail', email);
                window.location.href = 'resetpassword.html' + (email ? ('?email=' + encodeURIComponent(email)) : '');
            }
        });
    }
});
