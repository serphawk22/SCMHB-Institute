/**
 * SCM Hub Operations Portal — Powered by SERP Hawk CRM
 * Authentication & Session Management System
 */

(function () {
  'use strict';

  const AUTH_KEY = 'scm_crm_user_session';
  const CRM_USER_KEY = 'crm_user';

  // API Base URL resolution
  const getApiBaseUrl = function () {
    if (window.API_BASE_URL) return window.API_BASE_URL.replace(/\/+$/, '');
    const origin = window.location.origin;
    if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes(':3005')) {
      return 'http://127.0.0.1:8000';
    }
    return origin.replace(/\/+$/, '');
  };

  // Real accounts seeded in the CRM backend (see main.py `_ensure_user`).
  const DEMO_USERS = {
    admin: {
      email: 'admin@serphawk.com',
      password: 'Admin123!',
      name: 'Admin',
      role: 'Admin',
      avatar: 'A'
    },
    demo: {
      email: 'demo@serphawk.com',
      password: 'DemoPass123!',
      name: 'Demo User',
      role: 'Demo',
      avatar: 'D'
    },
    employee: {
      email: 'varshit@gmail.com',
      password: 'Admin123!',
      name: 'Varshit',
      role: 'Employee',
      avatar: 'V'
    }
  };

  // The main CRM application (Next.js dashboard). Once the showcase login
  // authenticates against the backend, the user is handed off here.
  // Override at runtime with `window.CRM_APP_URL` if the CRM runs elsewhere.
  function getCrmAppUrl() {
    if (typeof window.CRM_APP_URL === 'string' && window.CRM_APP_URL.trim() !== '') {
      return window.CRM_APP_URL.trim();
    }
    if (typeof window.CRM_DASHBOARD_URL === 'string' && window.CRM_DASHBOARD_URL.trim() !== '') {
      return window.CRM_DASHBOARD_URL.trim();
    }

    const loc = window.location;
    const isLocalHost = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';

    // When the showcase is hosted on the same origin as the CRM (e.g. served
    // from the CRM's /showcase path, or the same production domain), the CRM
    // dashboard is this origin's root — and localStorage is shared, so the CRM
    // can read the `crm_user` session we just wrote.
    if (!isLocalHost || loc.port === '3000') {
      return loc.origin.replace(/\/+$/, '') + '/';
    }

    // Local dev: the standalone showcase usually runs on :3005 while the
    // Next.js CRM runs on :3000.
    return loc.protocol + '//' + loc.hostname + ':3000/';
  }

  // A stored payload only counts as a session if it carries a usable identity
  function isValidSession(user) {
    return !!user && typeof user === 'object' && typeof user.email === 'string' && user.email.trim() !== '';
  }

  // Get current user session
  window.getCurrentUser = function () {
    try {
      const data = localStorage.getItem(AUTH_KEY) || localStorage.getItem(CRM_USER_KEY);
      if (!data) return null;
      const user = JSON.parse(data);
      return isValidSession(user) ? user : null;
    } catch (e) {
      return null;
    }
  };

  // Set user session
  window.setCurrentUser = function (user) {
    if (!user) return;
    const sessionStr = JSON.stringify(user);
    localStorage.setItem(AUTH_KEY, sessionStr);
    localStorage.setItem(CRM_USER_KEY, sessionStr);
  };

  // Clear session (Logout)
  window.clearUserSession = function () {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(CRM_USER_KEY);
  };

  // Check route protection on pages
  window.checkAuthProtection = function () {
    const path = window.location.pathname;
    const isLogoutPage = path.endsWith('logout.html');

    // Logout always terminates any lingering session
    if (isLogoutPage) {
      window.clearUserSession();
      return false;
    }

    // The login page must always render so "Sign In" reliably opens it.
    // (Redirect handoff to the CRM happens after a successful submit, not on load.)
    return false;
  };

  // Email validation regex
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Initialize login page logic
  function initLoginPage() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const submitBtn = document.getElementById('submitLoginBtn');
    const loginError = document.getElementById('loginError');

    function hideError() {
      if (loginError) {
        loginError.style.display = 'none';
        loginError.innerText = '';
      }
    }

    function showError(msg) {
      if (loginError) {
        loginError.innerText = msg;
        loginError.style.display = 'block';
      } else if (window.showToast) {
        window.showToast(msg, 'error');
      }
    }

    // Hide error when user types
    if (emailInput) emailInput.addEventListener('input', hideError);
    if (passwordInput) passwordInput.addEventListener('input', hideError);

    // Password visibility toggle
    if (togglePasswordBtn && passwordInput) {
      togglePasswordBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePasswordBtn.innerHTML = type === 'password'
          ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
          : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
      });
    }

    // Demo Fill Quick Buttons
    document.querySelectorAll('.demo-fill-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const role = btn.getAttribute('data-role');
        const creds = DEMO_USERS[role];
        if (creds && emailInput && passwordInput) {
          emailInput.value = creds.email;
          passwordInput.value = creds.password;
          hideError();
          if (window.showToast) window.showToast(`Loaded ${creds.role} (${creds.name}) credentials`, 'info');
        }
      });
    });

    // Form Submission
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError();

      const email = emailInput ? emailInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value.trim() : '';

      // Validation Checks
      if (!email) {
        showError('Please enter your work email address.');
        emailInput?.focus();
        return;
      }

      if (!isValidEmail(email)) {
        showError('Please enter a valid email address (e.g. name@scmhub.com).');
        emailInput?.focus();
        return;
      }

      if (!password) {
        showError('Please enter your password.');
        passwordInput?.focus();
        return;
      }

      // Set Loading State
      const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 0.8s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> Authenticating...`;
      }

      const API_BASE_URL = getApiBaseUrl();
      let authenticatedUser = null;
      let errorMessage = null;

      try {
        const response = await fetch(`${API_BASE_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data.user) {
          // Preserve the full backend user payload. The main CRM reads
          // localStorage['crm_user'] and requires `id`, `email` and `role`,
          // and may also use tenant_id and other fields.
          authenticatedUser = Object.assign({}, data.user, {
            email: data.user.email,
            name: data.user.full_name || data.user.name || email.split('@')[0],
            role: data.user.role || 'Admissions Officer',
            avatar: (data.user.full_name || data.user.name || email).charAt(0).toUpperCase()
          });
        } else if (response.status === 401 || response.status === 403 || response.status === 400) {
          errorMessage = data.detail || 'Invalid email or password. Please verify your credentials.';
        } else {
          errorMessage = data.detail || `Authentication failed (HTTP ${response.status}).`;
        }
      } catch (networkError) {
        // No offline bypass: authentication must come from the backend so the
        // main CRM receives a valid, recognised session.
        errorMessage = `Unable to connect to the CRM API at ${API_BASE_URL}. Please make sure the backend is running, then try again.`;
      }

      if (authenticatedUser) {
        window.setCurrentUser(authenticatedUser);
        if (window.showToast) window.showToast(`Welcome back, ${authenticatedUser.name}! Redirecting to your dashboard...`, 'success');
        setTimeout(() => {
          window.location.href = getCrmAppUrl();
        }, 500);
      } else {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHtml;
        }
        showError(errorMessage || 'Invalid credentials. Please try again.');
      }
    });

    // Forgot Password Modal
    const forgotLink = document.getElementById('forgotPasswordLink');
    const forgotModal = document.getElementById('forgotPasswordModal');
    const closeForgotBtn = document.getElementById('closeForgotModalBtn');
    const resetForm = document.getElementById('resetPasswordForm');

    if (forgotLink && forgotModal) {
      forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        forgotModal.classList.add('active');
      });
    }

    if (closeForgotBtn && forgotModal) {
      closeForgotBtn.addEventListener('click', (e) => {
        e.preventDefault();
        forgotModal.classList.remove('active');
      });
    }

    if (resetForm) {
      resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInputModal = resetForm.querySelector('input[type="email"]');
        const email = emailInputModal ? emailInputModal.value.trim() : '';

        if (!email || !isValidEmail(email)) {
          if (window.showToast) window.showToast('Please enter a valid work email address.', 'error');
          return;
        }

        const API_BASE_URL = getApiBaseUrl();
        try {
          await fetch(`${API_BASE_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          });
        } catch (err) {
          // ignore network error for demo
        }

        if (forgotModal) forgotModal.classList.remove('active');
        if (window.showToast) window.showToast(`Password reset link sent to ${email}`, 'success');
      });
    }
  }

  // Logout Flow handler — clears the session and returns to the landing page
  window.performLogout = function () {
    if (confirm('Are you sure you want to sign out from the SCM Hub Operations Portal?')) {
      window.clearUserSession();
      window.location.replace('index.html');
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (checkAuthProtection()) return;
    initLoginPage();
  });
})();
