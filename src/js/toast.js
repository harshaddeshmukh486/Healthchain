// Toast System for HealthChain

export function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('hc-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'hc-toast-container';
    container.className = 'fixed top-5 right-5 z-[99999] flex flex-col gap-3 max-w-[320px] pointer-events-none';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'flex items-center gap-3 px-4 py-3 rounded-xl border bg-surface/95 backdrop-blur-md shadow-2xl transition-all duration-300 pointer-events-auto cursor-pointer max-w-full break-words text-sm translate-x-5 opacity-0';
  
  // Custom classes for different types
  if (type === 'success') {
    toast.className += ' border-success text-success';
  } else if (type === 'error') {
    toast.className += ' border-danger text-danger';
  } else if (type === 'warning') {
    toast.className += ' border-warning text-warning';
  } else {
    toast.className += ' border-accent text-accent';
  }

  const icons = { success: '✅', error: '⚠️', info: 'ℹ️', warning: '⚡' };
  toast.innerHTML = `
    <span class="text-base flex-shrink-0">${icons[type] || 'ℹ️'}</span>
    <span class="flex-1 leading-snug text-white font-medium">${message}</span>
    <span class="opacity-50 text-xs flex-shrink-0 ml-1 hover:opacity-100 transition-opacity">✕</span>
  `;

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.remove('translate-x-5', 'opacity-0');
  });

  const remove = () => {
    toast.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  };

  toast.addEventListener('click', remove);
  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(remove, duration);
  }
}

const ERROR_MAP = {
  'network-request-failed': 'Internet connection check karein.',
  'permission-denied': 'Aapke paas is record ki permission nahi hai.',
  'not-found': 'Data nahi mila.',
  'deadline-exceeded': 'Server slow hai. Thodi der mein try karein.',
  'already-exists': 'Yeh data pehle se majood hai.',
  'unauthenticated': 'Session expire ho gaya. Phir se login karein.',
  'resource-exhausted': 'Bahut zyada request. Ek minute baad try karein.',
  'auth/wrong-password': 'Password galat hai.',
  'auth/user-not-found': 'Yeh email registered nahi hai.',
  'auth/email-already-in-use': 'Yeh email already use ho raha hai.',
  'auth/weak-password': 'Password kam se kam 6 characters ka hona chahiye.',
  'auth/invalid-email': 'Sahi email address daalein.',
  'auth/too-many-requests': 'Bahut zyada tries. Thodi der baad try karein.',
  'auth/network-request-failed': 'Internet check karein.',
  'auth/popup-closed-by-user': 'Google sign-in cancel kiya gaya.'
};

export function getFriendlyError(err) {
  if (!err) return 'Kuch galat hua. Dobara try karein.';
  const code = err.code || '';
  const msg = err.message || '';
  
  for (const key of Object.keys(ERROR_MAP)) {
    if (code.includes(key) || msg.includes(key)) return ERROR_MAP[key];
  }
  
  if (msg.includes('offline') || msg.includes('network')) return 'Internet connectivity issue hai.';
  if (msg.includes('timeout')) return 'Server response slow hai. Dobara try karein.';
  return msg || 'Kuch galat hua. Phir se try karein.';
}
