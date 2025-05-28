// resetpassword.js - OTP + new password logic for resetpassword.html

const BASE_URL = 'https://a7medbx.pythonanywhere.com';

document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const otpInputs = Array.from(document.querySelectorAll('.otp-input'));
    const resetBtn = document.getElementById('resetBtn');
    const resendOtpBtn = document.getElementById('resendOtpBtn');
    const changeEmailBtn = document.getElementById('changeEmailBtn');
    const otpError = document.getElementById('otpError');
    const otpSuccess = document.getElementById('otpSuccess');
    const otpEmailDisplay = document.getElementById('otpEmailDisplay');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');

    // Get email from query string
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email');
    if (email && otpEmailDisplay) {
        // Mask email for privacy
        const masked = email.replace(/(\w)[^@]*(@.*)/, (m, a, b) => a + '***' + b);
        otpEmailDisplay.textContent = masked;
    }

    // OTP input logic (auto-advance, backspace, paste)
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

    // Enable button only if all fields are filled and passwords match
    function checkFormFilled() {
        const otpFilled = otpInputs.every(input => input.value.length === 1);
        const pwd = newPassword.value;
        const cpwd = confirmPassword.value;
        const pwdsMatch = pwd && cpwd && pwd === cpwd;
        resetBtn.disabled = !(otpFilled && pwdsMatch);
    }
    newPassword.addEventListener('input', checkFormFilled);
    confirmPassword.addEventListener('input', checkFormFilled);

    // Form submit
    document.getElementById('resetForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        if (resetBtn.disabled) return;
        const otp = otpInputs.map(i => i.value).join('');
        const pwd = newPassword.value;
        otpError.textContent = '';
        otpSuccess.textContent = '';
        resetBtn.disabled = true;
        try {
            const res = await fetch(`${BASE_URL}/api/password_reset/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp, new_password: pwd })
            });
            const data = await res.json();
            if (res.ok) {
                otpSuccess.textContent = '';
                showRegistrationCompletePopup();
                setTimeout(() => window.location.href = 'login.html', 2500);
            } else {
                otpError.textContent = data.error || 'Reset failed.';
                resetBtn.disabled = false;
            }
        } catch (err) {
            otpError.textContent = 'Network error.';
            resetBtn.disabled = false;
        }
    });

    // Resend OTP with 1-minute timer
    let resendTimer = 60;
    let resendInterval;
    const resendBtnText = resendOtpBtn.textContent;
    function startResendTimer() {
        resendOtpBtn.disabled = true;
        resendOtpBtn.textContent = `Resend request (01:00)`;
        resendTimer = 60;
        resendInterval = setInterval(() => {
            resendTimer--;
            resendOtpBtn.textContent = `Resend request (00:${resendTimer.toString().padStart(2, '0')})`;
            if (resendTimer <= 0) {
                clearInterval(resendInterval);
                resendOtpBtn.disabled = false;
                resendOtpBtn.textContent = resendBtnText;
            }
        }, 1000);
    }
    startResendTimer();
    resendOtpBtn.onclick = async function() {
        otpError.textContent = '';
        otpSuccess.textContent = '';
        resendOtpBtn.disabled = true;
        startResendTimer();
        try {
            const res = await fetch(`${BASE_URL}/api/resend_otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            await res.json();
            otpSuccess.textContent = 'A new code has been sent.';
        } catch (err) {
            otpError.textContent = 'Failed to resend code.';
        }
    };

    // Change email
    changeEmailBtn.onclick = function() {
        window.location.href = 'register.html';
    };

    // Modern registration complete popup
    function showRegistrationCompletePopup() {
        let popup = document.createElement('div');
        popup.className = 'registration-complete-popup';
        popup.innerHTML = `
            <div class="popup-content">
                <svg width="48" height="48" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#1ba9ff"/><path d="M7 13l3 3 7-7" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <div class="popup-title">Password Reset!</div>
                <div class="popup-msg">Your password has been updated.<br>Redirecting to sign in...</div>
            </div>
        `;
        document.body.appendChild(popup);
        setTimeout(() => { popup.classList.add('show'); }, 10);
        setTimeout(() => { popup.classList.remove('show'); setTimeout(()=>popup.remove(), 400); }, 2400);
    }
});
