import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  const globalLoader = document.getElementById('global-loader');
  const statusArea = document.getElementById('status-area');
  const formPanel = document.getElementById('form-panel');
  const verifyForm = document.getElementById('verifyForm');
  const submitBtn = document.getElementById('submitBtn');

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.replace('login.html');
      return;
    }
    currentUser = user;
    const nameInput = document.getElementById('docName');
    if (nameInput && !nameInput.value) {
      nameInput.value = user.displayName || '';
    }
    
    await loadStatus();
    if (globalLoader) globalLoader.style.display = 'none';
  });

  async function loadStatus() {
    try {
      const docRef = doc(db, 'doctor_verifications', currentUser.uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        statusArea.innerHTML = `
          <div class="glass-panel border border-accent/20 bg-accent/5 rounded-2xl p-5 mb-6 flex items-center gap-4 animate-fade-up">
            <div class="text-3xl shrink-0">📝</div>
            <div>
              <h3 class="font-heading font-bold text-accent text-sm mb-1">Not Submitted</h3>
              <p class="text-[11px] text-white/60">Submit your registration to start accessing patient records securely.</p>
            </div>
          </div>`;
        return;
      }

      const d = docSnap.data();
      
      if (d.status === 'pending') {
        statusArea.innerHTML = `
          <div class="glass-panel border border-warning/30 bg-warning/10 rounded-2xl p-5 mb-6 flex items-center gap-4 animate-fade-up">
            <div class="text-3xl shrink-0 animate-pulse">⏳</div>
            <div>
              <h3 class="font-heading font-bold text-warning text-sm mb-1">Verification Pending</h3>
              <p class="text-[11px] text-white/60">Your details are under review by our medical board. Usually takes 24-48 hours.</p>
            </div>
          </div>`;
          
        formPanel.innerHTML = `
          <div class="text-center py-6 animate-fade-up">
            <h3 class="font-heading font-bold text-xl mb-2 flex justify-center items-center gap-2">Submission Received <span class="text-success">✓</span></h3>
            <p class="text-xs text-white/50 mb-6">We're reviewing your details with the medical council.</p>
            
            <div class="bg-surface-2 border border-border rounded-xl p-5 text-left max-w-sm mx-auto">
              <div class="flex justify-between py-2 border-b border-border/50 text-xs"><span class="text-white/40">Name</span> <strong class="text-white">${escapeHtml(d.name)}</strong></div>
              <div class="flex justify-between py-2 border-b border-border/50 text-xs"><span class="text-white/40">Registration</span> <strong class="text-white">${escapeHtml(d.mci)}</strong></div>
              <div class="flex justify-between py-2 border-b border-border/50 text-xs"><span class="text-white/40">Council</span> <strong class="text-white">${escapeHtml(d.council)}</strong></div>
              <div class="flex justify-between py-2 text-xs"><span class="text-white/40">Specialization</span> <strong class="text-white">${escapeHtml(d.specialization)}</strong></div>
            </div>
          </div>`;
          
      } else if (d.status === 'verified') {
        statusArea.innerHTML = `
          <div class="glass-panel border border-success/30 bg-success/10 rounded-2xl p-5 mb-6 flex items-center gap-4 animate-fade-up">
            <div class="text-3xl shrink-0">✅</div>
            <div>
              <h3 class="font-heading font-bold text-success text-sm mb-1">Verified Doctor</h3>
              <p class="text-[11px] text-success/80">You have full access to patient records. Verified by HealthChain.</p>
            </div>
          </div>`;
          
        formPanel.innerHTML = `
          <div class="text-center py-8 animate-fade-up">
            <div class="text-6xl mb-4">🏆</div>
            <h3 class="font-heading font-extrabold text-2xl mb-2">Successfully Verified</h3>
            <p class="text-xs text-white/50 mb-8">Your professional account is fully activated.</p>
            
            <div class="bg-surface-2 border border-border rounded-xl p-6 text-left max-w-md mx-auto mb-8 shadow-lg shadow-black/20">
              <div class="flex justify-between py-2.5 border-b border-border/50 text-xs"><span class="text-white/40">Name</span> <strong class="text-white">${escapeHtml(d.name)}</strong></div>
              <div class="flex justify-between py-2.5 border-b border-border/50 text-xs"><span class="text-white/40">Registration</span> <strong class="text-white">${escapeHtml(d.mci)}</strong></div>
              <div class="flex justify-between py-2.5 border-b border-border/50 text-xs"><span class="text-white/40">Council</span> <strong class="text-white">${escapeHtml(d.council)}</strong></div>
              <div class="flex justify-between py-2.5 border-b border-border/50 text-xs"><span class="text-white/40">Specialization</span> <strong class="text-white">${escapeHtml(d.specialization)}</strong></div>
              <div class="flex justify-between py-2.5 border-b border-border/50 text-xs"><span class="text-white/40">Hospital</span> <strong class="text-white">${escapeHtml(d.hospital || 'N/A')}</strong></div>
              <div class="flex justify-between py-2.5 text-xs"><span class="text-white/40">Status</span> <span class="bg-success/20 text-success px-2 py-0.5 rounded text-[10px] font-bold">VERIFIED ✓</span></div>
            </div>
            
            <a href="doctor.html" class="inline-flex items-center gap-2 py-3 px-8 bg-gradient-to-r from-accent to-accent-2 text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-accent/20 transition-all">
              Go to Dashboard →
            </a>
          </div>`;
          
      } else if (d.status === 'rejected') {
        statusArea.innerHTML = `
          <div class="glass-panel border border-danger/30 bg-danger/10 rounded-2xl p-5 mb-6 flex items-center gap-4 animate-fade-up">
            <div class="text-3xl shrink-0">❌</div>
            <div>
              <h3 class="font-heading font-bold text-danger text-sm mb-1">Verification Failed</h3>
              <p class="text-[11px] text-danger/80">${escapeHtml(d.rejectionReason || 'Please re-submit with correct details.')}</p>
            </div>
          </div>`;
      }
    } catch (err) {
      console.error('Error loading verification status:', err);
      showToast('Could not load status. Please refresh.', 'error');
    }
  }

  if (verifyForm) {
    verifyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const n = document.getElementById('docName').value.trim();
      const m = document.getElementById('docMci').value.trim();
      const c = document.getElementById('docCouncil').value;
      const y = document.getElementById('docYear').value;
      const s = document.getElementById('docSpec').value;
      const mob = document.getElementById('docMobile').value.trim();
      const city = document.getElementById('docCity').value.trim();
      const state = document.getElementById('docState').value.trim();
      
      if (!n || !m || !c || !y || !s || !mob || !city || !state) {
        showToast('Please fill all required fields', 'error');
        return;
      }
      
      if (!/^[0-9]{10}$/.test(mob)) {
        showToast('Mobile must be a valid 10-digit number', 'error');
        return;
      }
      
      const originalHtml = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white mr-2"></span> Submitting...';
      
      try {
        await setDoc(doc(db, 'doctor_verifications', currentUser.uid), {
          uid: currentUser.uid,
          email: currentUser.email.toLowerCase(),
          name: n,
          mci: m,
          council: c,
          registrationYear: parseInt(y, 10),
          specialization: s,
          hospital: document.getElementById('docHospital').value.trim() || null,
          city: city,
          state: state,
          mobile: mob,
          experience: document.getElementById('docExp').value || null,
          status: 'pending',
          submittedAt: serverTimestamp()
        });
        
        showToast('Submitted! Verification in 24-48 hours 🎉', 'success');
        setTimeout(() => loadStatus(), 1000);
        
      } catch (err) {
        console.error('Submission error:', err);
        showToast('Error: ' + err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
      }
    });
  }
});
