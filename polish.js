/**
 * HealthChain Polish System v1.0
 * Bhai isko har HTML file mein add karo — saari 10 improvements auto apply hongi!
 * Usage: <script src="polish.js"></script> — </body> se pehle
 */

(function() {
'use strict';

// ============================================================
// 1. DESIGN TOKENS — Consistent colors, fonts, sizes
// ============================================================
const style = document.createElement('style');
style.textContent = `
  /* === GLOBAL TOKENS === */
  :root {
    --bg: #060a12;
    --surface: #0d1520;
    --surface2: #141f30;
    --border: #1a2535;
    --accent: #00d4ff;
    --accent2: #7c3aed;
    --text: #e8f0ff;
    --text-muted: #6b7a99;
    --success: #10b981;
    --danger: #ef4444;
    --warning: #f59e0b;
    --pink: #ec4899;
    --radius: 12px;
    --radius-lg: 18px;
    --font-heading: 'Syne', sans-serif;
    --font-body: 'DM Sans', sans-serif;
    --shadow: 0 8px 32px rgba(0,0,0,0.4);
    --shadow-accent: 0 8px 25px rgba(0,212,255,0.15);
  }

  /* === TYPOGRAPHY SYSTEM === */
  body { font-family: var(--font-body); font-size: 16px; line-height: 1.6; }
  h1 { font-family: var(--font-heading); font-size: clamp(1.6rem, 4vw, 2.2rem); font-weight: 800; line-height: 1.2; }
  h2 { font-family: var(--font-heading); font-size: clamp(1.1rem, 3vw, 1.4rem); font-weight: 700; }
  h3 { font-family: var(--font-heading); font-size: clamp(0.95rem, 2vw, 1.1rem); font-weight: 700; }
  p  { font-size: 0.92rem; line-height: 1.7; }
  small, .text-sm { font-size: 0.8rem; }

  /* === CONSISTENT BUTTONS === */
  .btn, button.btn {
    padding: 10px 20px;
    border-radius: var(--radius);
    font-weight: 600;
    font-size: 0.88rem;
    font-family: var(--font-body);
    cursor: pointer;
    border: none;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
  }
  .btn:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
  .btn:active { transform: translateY(0); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }

  .btn-primary {
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    color: white;
  }
  .btn-primary:hover { box-shadow: var(--shadow-accent); }

  .btn-outline {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text);
  }
  .btn-outline:hover { border-color: var(--accent); color: var(--accent); }

  .btn-danger {
    background: rgba(239,68,68,0.1);
    color: var(--danger);
    border: 1px solid rgba(239,68,68,0.2);
  }
  .btn-danger:hover { background: rgba(239,68,68,0.2); }

  /* === FORM INPUTS — Consistent === */
  .input-field, input[type="text"], input[type="email"],
  input[type="password"], input[type="number"], select, textarea {
    font-family: var(--font-body);
    background: var(--surface2);
    border: 1.5px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    padding: 11px 14px;
    font-size: 0.92rem;
    transition: border-color 0.2s;
    width: 100%;
    outline: none;
  }
  .input-field:focus, input:focus, select:focus, textarea:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(0,212,255,0.1);
  }
  .input-field.error, input.error {
    border-color: var(--danger);
    box-shadow: 0 0 0 3px rgba(239,68,68,0.1);
  }
  .input-field.success, input.success {
    border-color: var(--success);
  }

  /* === VALIDATION MESSAGES === */
  .field-error {
    color: var(--danger);
    font-size: 0.78rem;
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 5px;
    animation: hc-fadeIn 0.2s ease;
  }
  .field-success {
    color: var(--success);
    font-size: 0.78rem;
    margin-top: 4px;
    animation: hc-fadeIn 0.2s ease;
  }

  /* === SKELETON LOADER === */
  .hc-skeleton {
    background: linear-gradient(90deg, var(--surface) 25%, var(--surface2) 50%, var(--surface) 75%);
    background-size: 200% 100%;
    animation: hc-shimmer 1.5s infinite;
    border-radius: var(--radius);
    display: block;
  }
  @keyframes hc-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* === EMPTY STATE === */
  .hc-empty-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-muted);
    animation: hc-fadeIn 0.4s ease;
  }
  .hc-empty-icon {
    width: 64px;
    height: 64px;
    background: var(--surface2);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
    font-size: 1.8rem;
    border: 1px solid var(--border);
  }
  .hc-empty-state h3 { color: var(--text); margin-bottom: 8px; font-size: 1rem; }
  .hc-empty-state p { font-size: 0.85rem; line-height: 1.6; }

  /* === TOAST SYSTEM === */
  #hc-toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 99999;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 320px;
    pointer-events: none;
  }
  .hc-toast {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px 18px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: var(--shadow);
    animation: hc-toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1);
    pointer-events: all;
    font-size: 0.88rem;
    font-family: var(--font-body);
    color: var(--text);
    cursor: pointer;
    max-width: 100%;
    word-break: break-word;
  }
  .hc-toast.removing { animation: hc-toastOut 0.3s ease forwards; }
  .hc-toast.success { border-color: var(--success); }
  .hc-toast.error   { border-color: var(--danger); }
  .hc-toast.info    { border-color: var(--accent); }
  .hc-toast.warning { border-color: var(--warning); }
  .hc-toast-icon { font-size: 1.1rem; flex-shrink: 0; }
  .hc-toast-msg  { flex: 1; line-height: 1.4; }
  .hc-toast-close { opacity: 0.5; font-size: 1rem; flex-shrink: 0; }

  /* === ANIMATIONS === */
  @keyframes hc-fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes hc-toastIn {
    from { opacity: 0; transform: translateX(100%); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes hc-toastOut {
    from { opacity: 1; transform: translateX(0); }
    to   { opacity: 0; transform: translateX(100%); }
  }
  @keyframes hc-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes hc-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* === PAGE ENTRY ANIMATION === */
  .hc-fade-in {
    animation: hc-fadeIn 0.5s ease forwards;
    opacity: 0;
  }
  .hc-fade-in-delay-1 { animation-delay: 0.1s; }
  .hc-fade-in-delay-2 { animation-delay: 0.2s; }
  .hc-fade-in-delay-3 { animation-delay: 0.3s; }

  /* === LOADING SPINNER === */
  .hc-spinner {
    border: 3px solid rgba(0,212,255,0.2);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: hc-spin 0.8s linear infinite;
    display: inline-block;
    flex-shrink: 0;
  }
  .hc-spinner-sm { width: 14px; height: 14px; border-width: 2px; }
  .hc-spinner-md { width: 28px; height: 28px; }
  .hc-spinner-lg { width: 48px; height: 48px; border-width: 4px; }

  /* === PAGE LOADER === */
  #hc-page-loader {
    position: fixed; top: 0; left: 0;
    width: 100%; height: 100%;
    background: var(--bg);
    z-index: 99998;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    transition: opacity 0.4s ease;
  }
  #hc-page-loader.hiding {
    opacity: 0;
    pointer-events: none;
  }
  #hc-page-loader .hc-loader-logo {
    font-family: var(--font-heading);
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--text);
  }
  #hc-page-loader .hc-loader-logo span {
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  #hc-page-loader p {
    color: var(--text-muted);
    font-size: 0.85rem;
    animation: hc-pulse 1.5s infinite;
  }

  /* === CARDS — Consistent === */
  .hc-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 20px;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .hc-card:hover { border-color: rgba(0,212,255,0.3); box-shadow: var(--shadow-accent); }

  /* === BADGE === */
  .hc-badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .hc-badge-success { background: rgba(16,185,129,0.1); color: var(--success); }
  .hc-badge-danger  { background: rgba(239,68,68,0.1);  color: var(--danger);  }
  .hc-badge-accent  { background: rgba(0,212,255,0.1);  color: var(--accent);  }
  .hc-badge-purple  { background: rgba(124,58,237,0.15); color: #a78bfa; }

  /* === MOBILE RESPONSIVE === */
  @media (max-width: 768px) {
    h1 { font-size: 1.5rem; }
    h2 { font-size: 1.1rem; }
    .hc-card { padding: 15px; }
    .btn { padding: 10px 16px; }
    /* Larger touch targets */
    button, a, .btn, input, select {
      min-height: 44px;
    }
    /* Fix horizontal scroll */
    body { overflow-x: hidden; }
    img { max-width: 100%; height: auto; }
  }

  /* === ONBOARDING OVERLAY === */
  #hc-onboarding {
    position: fixed; top: 0; left: 0;
    width: 100%; height: 100%;
    background: rgba(6,10,18,0.95);
    z-index: 99997;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    backdrop-filter: blur(8px);
    animation: hc-fadeIn 0.4s ease;
  }
  .hc-onboarding-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 24px;
    padding: 32px;
    max-width: 420px;
    width: 100%;
    text-align: center;
  }
  .hc-onboarding-step { display: none; }
  .hc-onboarding-step.active { display: block; animation: hc-fadeIn 0.3s ease; }
  .hc-onboarding-icon {
    width: 72px; height: 72px;
    background: linear-gradient(135deg, rgba(0,212,255,0.1), rgba(124,58,237,0.1));
    border: 1px solid rgba(0,212,255,0.3);
    border-radius: 20px;
    display: flex; align-items: center; justify-content: center;
    font-size: 2rem;
    margin: 0 auto 20px;
  }
  .hc-onboarding-dots {
    display: flex; justify-content: center; gap: 8px; margin: 20px 0;
  }
  .hc-onboarding-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--border);
    transition: background 0.2s, transform 0.2s;
  }
  .hc-onboarding-dot.active {
    background: var(--accent);
    transform: scale(1.3);
  }

  /* === ERROR FRIENDLY MESSAGES === */
  .hc-error-friendly {
    background: rgba(239,68,68,0.05);
    border: 1px solid rgba(239,68,68,0.2);
    border-radius: var(--radius);
    padding: 14px 16px;
    color: var(--danger);
    font-size: 0.88rem;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    animation: hc-fadeIn 0.3s ease;
  }

  /* === ICONS — SVG wrapper === */
  .hc-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px; height: 20px;
    flex-shrink: 0;
  }
  .hc-icon svg { width: 100%; height: 100%; }

  /* Nav active state */
  nav a:hover, nav a:focus { color: var(--accent); }

  /* Smooth scroll */
  html { scroll-behavior: smooth; }

  /* Focus visible */
  :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`;
document.head.appendChild(style);


// ============================================================
// 2. TOAST SYSTEM — Better notifications
// ============================================================
const toastContainer = document.createElement('div');
toastContainer.id = 'hc-toast-container';
document.body.appendChild(toastContainer);

const ERROR_MAP = {
  'network-request-failed': 'Internet connection nahi hai. Check karo.',
  'permission-denied': 'Permission nahi hai. Login dobara karo.',
  'not-found': 'Data nahi mila.',
  'deadline-exceeded': 'Server slow hai. Thodi der mein retry karo.',
  'already-exists': 'Yeh pehle se exist karta hai.',
  'unauthenticated': 'Session expire ho gaya. Dobara login karo.',
  'resource-exhausted': 'Too many requests. 1 minute baad retry karo.',
  'auth/wrong-password': 'Password galat hai.',
  'auth/user-not-found': 'Email registered nahi hai.',
  'auth/email-already-in-use': 'Yeh email already use ho raha hai.',
  'auth/weak-password': 'Password kam se kam 6 characters ka hona chahiye.',
  'auth/invalid-email': 'Email address valid nahi hai.',
  'auth/too-many-requests': 'Bahut zyada tries. Thodi der baad try karo.',
  'auth/network-request-failed': 'Internet nahi hai. Check karo.',
};

function getFriendlyError(err) {
  if (!err) return 'Kuch galat hua. Dobara try karo.';
  const code = err.code || '';
  const msg = err.message || '';
  for (const key of Object.keys(ERROR_MAP)) {
    if (code.includes(key) || msg.includes(key)) return ERROR_MAP[key];
  }
  if (msg.includes('offline') || msg.includes('network')) return 'Internet nahi hai. Check karo.';
  if (msg.includes('timeout')) return 'Server response slow hai. Retry karo.';
  if (msg.includes('quota')) return 'Daily limit reach hua. Kal try karo.';
  return 'Kuch galat hua. Dobara try karo.';
}

window.HC = window.HC || {};

window.HC.toast = function(msg, type = 'info', duration = 4000) {
  const icons = { success: '✅', error: '⚠️', info: 'ℹ️', warning: '⚡' };
  const t = document.createElement('div');
  t.className = `hc-toast ${type}`;
  t.innerHTML = `
    <span class="hc-toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="hc-toast-msg">${msg}</span>
    <span class="hc-toast-close">✕</span>
  `;
  const remove = () => {
    t.classList.add('removing');
    setTimeout(() => t.remove(), 300);
  };
  t.addEventListener('click', remove);
  toastContainer.appendChild(t);
  if (duration > 0) setTimeout(remove, duration);
  return remove;
};

window.HC.toastError = function(err) {
  window.HC.toast(getFriendlyError(err), 'error');
};

// Override old showToast if exists
window.showToast = function(msg, type) {
  const typeMap = { success: 'success', error: 'error', info: 'info' };
  window.HC.toast(msg, typeMap[type] || 'info');
};


// ============================================================
// 3. PAGE LOADER
// ============================================================
window.HC.showLoader = function(msg = 'Loading...') {
  let loader = document.getElementById('hc-page-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'hc-page-loader';
    loader.innerHTML = `
      <div class="hc-loader-logo">Health<span>Chain</span></div>
      <div class="hc-spinner hc-spinner-lg"></div>
      <p id="hc-loader-msg">${msg}</p>
    `;
    document.body.appendChild(loader);
  } else {
    const m = document.getElementById('hc-loader-msg');
    if (m) m.textContent = msg;
    loader.classList.remove('hiding');
    loader.style.display = 'flex';
  }
  return loader;
};

window.HC.hideLoader = function() {
  const loader = document.getElementById('hc-page-loader');
  if (!loader) return;
  loader.classList.add('hiding');
  setTimeout(() => { loader.style.display = 'none'; }, 400);

  // Also hide old global-loader if exists
  const old = document.getElementById('global-loader');
  if (old) old.style.display = 'none';
};

// Hide old loader when HC.hideLoader is called
const origHide = window.HC.hideLoader;


// ============================================================
// 4. SKELETON LOADERS
// ============================================================
window.HC.skeleton = {
  card: (lines = 3) => {
    const div = document.createElement('div');
    div.className = 'hc-card';
    div.style.marginBottom = '12px';
    let html = '<div class="hc-skeleton" style="height:12px;width:60%;margin-bottom:10px"></div>';
    for (let i = 0; i < lines; i++) {
      const w = [90, 75, 85][i % 3];
      html += `<div class="hc-skeleton" style="height:10px;width:${w}%;margin-bottom:8px"></div>`;
    }
    div.innerHTML = html;
    return div;
  },

  list: (count = 3, container) => {
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      container.appendChild(window.HC.skeleton.card());
    }
  }
};


// ============================================================
// 5. EMPTY STATES — Better messages
// ============================================================
window.HC.emptyState = function(icon, title, desc, btnText, btnAction) {
  const div = document.createElement('div');
  div.className = 'hc-empty-state';
  div.innerHTML = `
    <div class="hc-empty-icon">${icon}</div>
    <h3>${title}</h3>
    <p>${desc}</p>
    ${btnText ? `<button class="btn btn-primary" style="margin-top:16px" onclick="${btnAction}">${btnText}</button>` : ''}
  `;
  return div.outerHTML;
};

// Common empty states
window.HC.emptyStates = {
  reports: () => window.HC.emptyState('📄', 'Koi Record Nahi', 'Apna pehla medical record add karo. Secured with SHA-256!', '+ Add Report', 'toggleAddReport && toggleAddReport()'),
  doctors: () => window.HC.emptyState('👨‍⚕️', 'Koi Doctor Nahi', "Doctor ka email daalo aur 'Grant' karo.", null, null),
  medicines: () => window.HC.emptyState('💊', 'Koi Medicine Nahi', 'Apni medicines aur reminders add karo.', null, null),
  appointments: () => window.HC.emptyState('📅', 'Koi Appointment Nahi', 'Appointment book karo.', null, null),
  generic: (item) => window.HC.emptyState('📭', `Koi ${item || 'Data'} Nahi`, 'Abhi koi data nahi hai. Add karo!', null, null),
};


// ============================================================
// 6. FORM VALIDATION — Real-time
// ============================================================
window.HC.validate = {
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  phone: (v) => /^[6-9]\d{9}$/.test(v.replace(/\s/g, '')),
  required: (v) => v && v.trim().length > 0,
  minLen: (v, n) => v && v.trim().length >= n,
  maxLen: (v, n) => !v || v.trim().length <= n,

  showError: (inputEl, msg) => {
    inputEl.classList.add('error');
    inputEl.classList.remove('success');
    let err = inputEl.parentElement.querySelector('.field-error');
    if (!err) {
      err = document.createElement('div');
      err.className = 'field-error';
      inputEl.parentElement.appendChild(err);
    }
    err.innerHTML = `<span>⚠️</span> ${msg}`;
  },

  showSuccess: (inputEl) => {
    inputEl.classList.remove('error');
    inputEl.classList.add('success');
    const err = inputEl.parentElement.querySelector('.field-error');
    if (err) err.remove();
  },

  clear: (inputEl) => {
    inputEl.classList.remove('error', 'success');
    const err = inputEl.parentElement && inputEl.parentElement.querySelector('.field-error');
    if (err) err.remove();
  },

  // Auto-validate inputs with data-validate attribute
  // Usage: <input data-validate="required,email" data-label="Email">
  init: () => {
    document.querySelectorAll('[data-validate]').forEach(input => {
      input.addEventListener('blur', () => {
        const rules = input.getAttribute('data-validate').split(',');
        const label = input.getAttribute('data-label') || 'Field';
        const v = input.value;

        if (rules.includes('required') && !window.HC.validate.required(v)) {
          window.HC.validate.showError(input, `${label} required hai`);
          return;
        }
        if (rules.includes('email') && v && !window.HC.validate.email(v)) {
          window.HC.validate.showError(input, 'Valid email daalo');
          return;
        }
        if (rules.includes('phone') && v && !window.HC.validate.phone(v)) {
          window.HC.validate.showError(input, 'Valid 10-digit mobile number daalo');
          return;
        }
        if (v) window.HC.validate.showSuccess(input);
        else window.HC.validate.clear(input);
      });

      input.addEventListener('input', () => {
        if (input.classList.contains('error')) {
          window.HC.validate.clear(input);
        }
      });
    });
  }
};


// ============================================================
// 7. ANIMATIONS — Fade in on scroll
// ============================================================
window.HC.animations = {
  init: () => {
    // Fade in elements as they appear
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });

      document.querySelectorAll('.stat-card, .feature-link, .panel, .hc-card, .report-card').forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(16px)';
        el.style.transition = `opacity 0.4s ease ${i * 0.05}s, transform 0.4s ease ${i * 0.05}s`;
        observer.observe(el);
      });
    }

    // Hover effects on feature links
    document.querySelectorAll('.feature-link').forEach(el => {
      el.addEventListener('mouseenter', () => {
        el.style.borderColor = 'var(--accent)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.borderColor = '';
      });
    });
  }
};


// ============================================================
// 8. ICONS — SVG replacements for common emojis
// ============================================================
const SVG_ICONS = {
  '📄': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  '💊': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3"/><circle cx="18" cy="18" r="3"/><path d="M22 22l-1.5-1.5"/></svg>`,
  '🔔': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  '👤': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  '🏥': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  '🔐': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  '📅': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  '⚠️': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
};

window.HC.icons = {
  get: (emoji) => SVG_ICONS[emoji] || emoji,
};


// ============================================================
// 9. ONBOARDING — First time users
// ============================================================
window.HC.onboarding = {
  show: (steps, storageKey) => {
    if (localStorage.getItem(storageKey)) return;

    const overlay = document.createElement('div');
    overlay.id = 'hc-onboarding';
    let current = 0;

    const render = () => {
      const step = steps[current];
      overlay.innerHTML = `
        <div class="hc-onboarding-card">
          <div class="hc-onboarding-icon">${step.icon}</div>
          <h2 style="margin-bottom:10px">${step.title}</h2>
          <p style="color:var(--text-muted);font-size:0.9rem;line-height:1.6">${step.desc}</p>
          <div class="hc-onboarding-dots">
            ${steps.map((_, i) => `<div class="hc-onboarding-dot ${i === current ? 'active' : ''}"></div>`).join('')}
          </div>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
            ${current > 0 ? `<button class="btn btn-outline" onclick="window._hcOnboardPrev()">← Back</button>` : ''}
            ${current < steps.length - 1
              ? `<button class="btn btn-primary" onclick="window._hcOnboardNext()">Next →</button>`
              : `<button class="btn btn-primary" onclick="window._hcOnboardDone()">🚀 Shuru Karo!</button>`
            }
          </div>
          <button onclick="window._hcOnboardDone()" style="background:none;border:none;color:var(--text-muted);font-size:0.8rem;margin-top:12px;cursor:pointer;font-family:var(--font-body)">Skip karo</button>
        </div>
      `;
    };

    window._hcOnboardNext = () => { current++; render(); };
    window._hcOnboardPrev = () => { current--; render(); };
    window._hcOnboardDone = () => {
      localStorage.setItem(storageKey, '1');
      overlay.style.animation = 'none';
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.3s';
      setTimeout(() => overlay.remove(), 300);
    };

    render();
    document.body.appendChild(overlay);
  }
};


// ============================================================
// 10. AUTO-INIT — Saab kuch start karo
// ============================================================
function init() {
  // Animations
  window.HC.animations.init();

  // Form validation
  window.HC.validate.init();

  // Stagger page content
  const main = document.querySelector('.dashboard-container, main, .container');
  if (main) {
    main.style.opacity = '0';
    main.style.transform = 'translateY(12px)';
    main.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    requestAnimationFrame(() => {
      main.style.opacity = '1';
      main.style.transform = 'translateY(0)';
    });
  }

  // Intercept Firebase errors globally
  window.addEventListener('unhandledrejection', (e) => {
    if (e.reason && e.reason.code) {
      console.warn('Firebase error caught by polish.js:', e.reason.code);
    }
  });
}

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
