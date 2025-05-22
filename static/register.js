// register.js - Epic Games style registration
const BASE_URL = 'http://127.0.0.1:5000';

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('registerForm');
    const countryInput = document.getElementById('country');
    const emailInput = document.getElementById('registerEmail');
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const usernameInput = document.getElementById('registerUsername');
    const passwordInput = document.getElementById('registerPassword');
    const newsOptIn = document.getElementById('newsOptIn');
    const terms = document.getElementById('terms');
    const registerBtn = document.getElementById('registerBtn');
    const errorDiv = document.getElementById('registerError');
    const successDiv = document.getElementById('registerSuccess');
    const togglePassword = document.getElementById('togglePassword');

    // Enable/disable button
    function checkFormFilled() {
        registerBtn.disabled = !(
            countryInput.value &&
            emailInput.value &&
            firstNameInput.value &&
            lastNameInput.value &&
            usernameInput.value &&
            passwordInput.value &&
            terms.checked
        );
    }
    [countryInput, emailInput, firstNameInput, lastNameInput, usernameInput, passwordInput, terms].forEach(el => {
        el.addEventListener('input', checkFormFilled);
        el.addEventListener('change', checkFormFilled);
    });

    // Password show/hide with eye icon toggle (like login)
    let passwordVisible = false;
    togglePassword.addEventListener('click', function() {
        passwordVisible = !passwordVisible;
        passwordInput.type = passwordVisible ? 'text' : 'password';
        // Animate/change the eye icon (open/closed)
        const eyeIcon = document.getElementById('eyeIcon');
        if (passwordVisible) {
            eyeIcon.innerHTML = '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/><line x1="4" y1="4" x2="20" y2="20" stroke="#1ba9ff" stroke-width="2"/>';
            eyeIcon.setAttribute('stroke', '#1ba9ff');
        } else {
            eyeIcon.innerHTML = '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>';
            eyeIcon.setAttribute('stroke', '#c7d5e0');
        }
    });

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        errorDiv.textContent = '';
        successDiv.textContent = '';
        registerBtn.disabled = true;
        // Backend expects: username, email, password
        const email = emailInput.value.trim();
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        // Optionally collect extra fields for your own use
        // const country = countryInput.value;
        // const firstName = firstNameInput.value;
        // const lastName = lastNameInput.value;
        try {
            const res = await fetch(`${BASE_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, username, password })
            });
            const data = await res.json();
            if (res.ok) {
                successDiv.textContent = 'Registration successful! Check your email for the OTP.';
                setTimeout(() => {
                    window.location.href = `verifingotp.html?email=${encodeURIComponent(email)}`;
                }, 1200);
            } else {
                errorDiv.textContent = data.error || 'Registration failed.';
                registerBtn.disabled = false;
            }
        } catch (err) {
            errorDiv.textContent = 'Network error.';
            registerBtn.disabled = false;
        }
    });
});
