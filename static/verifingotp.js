// verifingotp.js - Handles OTP verification for classic registration flow
const BASE_URL = 'http://127.0.0.1:5000';

document.addEventListener('DOMContentLoaded', function() {
    const otpInputs = Array.from(document.querySelectorAll('.otp-input'));
    const verifyBtn = document.getElementById('verifyOtpBtn');
    const errorDiv = document.getElementById('verifyOtpError');
    const successDiv = document.getElementById('verifyOtpSuccess');
    const otpEmailDisplay = document.getElementById('otpEmailDisplay');

    // Get email from query string
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email');
    if (email && otpEmailDisplay) {
        const masked = email.replace(/(\w)[^@]*(@.*)/, (m, a, b) => a + '***' + b);
        otpEmailDisplay.textContent = masked;
    }

    // OTP input logic
    otpInputs.forEach((input, idx) => {
        input.addEventListener('input', function(e) {
            const value = e.target.value.replace(/\D/g, '');
            e.target.value = value;
            if (value && idx < otpInputs.length - 1) {
                otpInputs[idx + 1].focus();
            }
            checkFormFilled();
        });
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && !e.target.value && idx > 0) {
                otpInputs[idx - 1].focus();
            }
        });
        input.addEventListener('paste', function(e) {
            const paste = (e.clipboardData || window.clipboardData).getData('text');
            if (/^\d{6}$/.test(paste)) {
                otpInputs.forEach((input, i) => input.value = paste[i]);
                otpInputs[5].focus();
                checkFormFilled();
                e.preventDefault();
            }
        });
    });

    function checkFormFilled() {
        const otpFilled = otpInputs.every(input => input.value.length === 1);
        verifyBtn.disabled = !otpFilled;
    }

    document.getElementById('verifyOtpForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        if (verifyBtn.disabled) return;
        const otp = otpInputs.map(i => i.value).join('');
        errorDiv.textContent = '';
        successDiv.textContent = '';
        verifyBtn.disabled = true;
        try {
            const res = await fetch(`${BASE_URL}/api/verify_otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp })
            });
            const data = await res.json();
            if (res.ok) {
                // Show modern popup like reset password
                showVerificationCompletePopup();
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2400);
            } else {
                errorDiv.textContent = data.error || 'Verification failed.';
                verifyBtn.disabled = false;
            }
        } catch (err) {
            errorDiv.textContent = 'Network error.';
            verifyBtn.disabled = false;
        }
    });
});

// Modern verification complete popup (like reset password)
function showVerificationCompletePopup() {
    let popup = document.createElement('div');
    popup.className = 'registration-complete-popup';
    popup.innerHTML = `
        <div class="popup-content">
            <svg width="48" height="48" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#1ba9ff"/><path d="M7 13l3 3 7-7" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <div class="popup-title">Email Verified!</div>
            <div class="popup-msg">Your account has been verified.<br>Redirecting to sign in...</div>
        </div>
    `;
    document.body.appendChild(popup);
    setTimeout(() => { popup.classList.add('show'); }, 10);
    setTimeout(() => { popup.classList.remove('show'); setTimeout(()=>popup.remove(), 400); }, 2400);
}
