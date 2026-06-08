import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDoc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { showToast } from './toast.js';

// Demo verified pharmacies (can be moved to Firestore later)
const DEMO_VERIFIED = [
  { id: 'demo1', name: 'Deshmukh Medical & General Store', owner: 'Deshmukh Family', phone: '9876543210', address: 'Main Road, Pusad', city: 'Pusad', pin: '445204', openTime: '08:00', closeTime: '22:00', specialty: 'Family-run pharmacy with all medicines, generics & Ayurveda', is24x7: false, hasDelivery: true, hasWhatsapp: true, hasGeneric: true, verified: true, featured: true, license: 'MH/PUSAD/12345' },
  { id: 'demo2', name: 'Apollo Pharmacy', phone: '18605000101', address: 'Multiple branches across India', city: 'Multiple', pin: '-', openTime: '08:00', closeTime: '23:00', specialty: "India's largest pharmacy chain. Online + offline.", is24x7: true, hasDelivery: true, hasWhatsapp: true, hasGeneric: true, verified: true },
  { id: 'demo3', name: '1mg Pharmacy', phone: '09999335550', address: 'Online platform — pan India', city: 'Online', pin: '-', openTime: '00:00', closeTime: '23:59', specialty: 'Online medicines + lab tests + doctor consultation', is24x7: true, hasDelivery: true, hasWhatsapp: false, hasGeneric: true, verified: true },
  { id: 'demo4', name: 'Jan Aushadhi Kendra', phone: '18001801124', address: 'Government generic medicine stores nationwide', city: 'Multi-city', pin: '-', openTime: '09:00', closeTime: '21:00', specialty: 'Generic medicines at 50-90% lower prices. Government scheme.', is24x7: false, hasDelivery: false, hasWhatsapp: false, hasGeneric: true, verified: true }
];

document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let editingId = null;
  let allSaved = [];
  let allVerified = [];

  const globalLoader = document.getElementById('global-loader');
  const pharmModal = document.getElementById('pharmModal');
  const pharmForm = document.getElementById('pharmForm');
  const saveBtn = document.getElementById('saveBtn');
  const searchInput = document.getElementById('searchInput');

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function formatTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hr = parseInt(h, 10);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const h12 = hr % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  }

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.replace('login.html');
      return;
    }
    currentUser = user;
    if (globalLoader) globalLoader.style.display = 'none';
    loadSaved();
    loadVerified();
  });

  window.switchTab = (name, el) => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('border-accent', 'text-accent'));
    document.querySelectorAll('.tab').forEach(t => t.classList.add('border-transparent', 'text-white/50'));
    
    el.classList.add('border-accent', 'text-accent');
    el.classList.remove('border-transparent', 'text-white/50');
    
    document.querySelectorAll('.section').forEach(s => {
      s.classList.remove('block');
      s.classList.add('hidden');
    });
    
    const target = document.getElementById(name + '-section');
    if (target) {
      target.classList.remove('hidden');
      target.classList.add('block');
    }
  };

  window.openModal = () => {
    editingId = null;
    const title = document.getElementById('pharmModalTitle');
    if (title) title.textContent = '🏪 Add Pharmacy';
    if (pharmForm) pharmForm.reset();
    
    const po = document.getElementById('pharmOpen');
    const pc = document.getElementById('pharmClose');
    if (po) po.value = '09:00';
    if (pc) pc.value = '22:00';
    
    if (pharmModal) {
      pharmModal.classList.remove('hidden');
      pharmModal.style.display = 'flex';
    }
    setTimeout(() => {
      const pn = document.getElementById('pharmName');
      if (pn) pn.focus();
    }, 100);
  };

  window.closeModal = () => {
    if (pharmModal) {
      pharmModal.classList.add('hidden');
      pharmModal.style.display = 'none';
    }
    editingId = null;
  };

  if (pharmForm) {
    pharmForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const n = document.getElementById('pharmName').value.trim();
      const ph = document.getElementById('pharmPhone').value.trim();
      const ad = document.getElementById('pharmAddress').value.trim();
      const ci = document.getElementById('pharmCity').value.trim();
      const pi = document.getElementById('pharmPin').value.trim();
      
      if (!n || !ph || !ad || !ci || !pi) {
        showToast('Please fill required fields', 'error');
        return;
      }
      
      if (!/^[0-9]{10}$/.test(ph)) {
        showToast('Phone must be 10 digits', 'error');
        return;
      }
      
      if (!/^[0-9]{6}$/.test(pi)) {
        showToast('PIN must be 6 digits', 'error');
        return;
      }
      
      const originalHtml = saveBtn.innerHTML;
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white mr-2"></span> Saving...';
      
      try {
        const data = {
          patientId: currentUser.uid,
          patientEmail: currentUser.email.toLowerCase(),
          name: n,
          owner: document.getElementById('pharmOwner').value.trim() || null,
          phone: ph,
          license: document.getElementById('pharmLicense').value.trim() || null,
          address: ad,
          city: ci,
          pin: pi,
          openTime: document.getElementById('pharmOpen').value || null,
          closeTime: document.getElementById('pharmClose').value || null,
          specialty: document.getElementById('pharmSpecialty').value.trim() || null,
          is24x7: document.getElementById('opt24x7').checked,
          hasDelivery: document.getElementById('optDelivery').checked,
          hasWhatsapp: document.getElementById('optWhatsapp').checked,
          hasGeneric: document.getElementById('optGeneric').checked,
          notes: document.getElementById('pharmNotes').value.trim() || null,
          updatedAt: serverTimestamp()
        };
        
        if (editingId) {
          await updateDoc(doc(db, 'pharmacies', editingId), data);
          showToast('Updated successfully', 'success');
        } else {
          data.createdAt = serverTimestamp();
          await addDoc(collection(db, 'pharmacies'), data);
          showToast('Saved successfully 🎉', 'success');
        }
        window.closeModal();
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalHtml;
      }
    });
  }

  function renderPharmacy(p, isVerified) {
    const cardCls = p.featured ? 'border-accent bg-gradient-to-br from-accent/5 to-accent-2/5' : (isVerified ? 'border-success/40' : 'border-border bg-surface');
    
    let badges = '';
    if (p.featured) badges += '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-accent to-accent-2 text-white">⭐ FEATURED</span>';
    if (isVerified && !p.featured) badges += '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-success/10 text-success border border-success/30">✓ VERIFIED</span>';
    if (p.is24x7) badges += '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-warning/10 text-warning border border-warning/30">⏰ 24x7</span>';
    if (p.hasDelivery) badges += '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#a78bfa]/10 text-[#a78bfa] border border-[#a78bfa]/30">🚚 Delivery</span>';
    
    let actions = `<a href="tel:${escapeHtml(p.phone)}" class="flex-1 text-center py-2 bg-gradient-to-r from-accent to-accent-2 text-white text-xs font-bold rounded-xl transition-all hover:shadow-lg hover:shadow-accent/20 cursor-pointer">📞 Call</a>`;
    
    if (p.hasWhatsapp) {
      actions += `<a href="https://wa.me/91${escapeHtml(p.phone)}" target="_blank" class="flex-1 text-center py-2 bg-[#25D366]/10 hover:bg-[#25D366] text-[#25D366] hover:text-white border border-[#25D366]/30 hover:border-[#25D366] text-xs font-bold rounded-xl transition-colors cursor-pointer">💬 WhatsApp</a>`;
    }
    
    actions += `<a href="https://maps.google.com/?q=${encodeURIComponent(p.address + ', ' + p.city + ' ' + p.pin)}" target="_blank" class="flex-1 text-center py-2 bg-surface-2 hover:bg-surface border border-border hover:border-accent text-white/70 hover:text-white text-xs font-bold rounded-xl transition-colors cursor-pointer">🗺️ Map</a>`;
    
    if (!isVerified) {
      actions += `
        <button class="px-3 py-2 bg-surface-2 hover:bg-accent border border-border hover:border-accent text-white/70 hover:text-bg text-xs rounded-xl transition-colors cursor-pointer" onclick="editPharm('${escapeHtml(p.id)}')">✏️</button>
        <button class="px-3 py-2 bg-danger/10 hover:bg-danger border border-danger/20 hover:border-danger text-danger hover:text-white text-xs rounded-xl transition-colors cursor-pointer" onclick="deletePharm('${escapeHtml(p.id)}','${escapeHtml(p.name)}')">🗑️</button>
      `;
    }
    
    const hours = p.is24x7 ? 'Open 24x7' : (p.openTime && p.closeTime ? `${formatTime(p.openTime)} - ${formatTime(p.closeTime)}` : 'Hours not set');
    
    return `
      <div class="glass-panel p-5 rounded-2xl border ${cardCls} hover:border-accent/50 hover:-translate-y-1 transition-all flex flex-col h-full">
        <div class="flex items-start gap-4 mb-3">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center text-xl shrink-0 shadow-lg">🏪</div>
          <div class="flex-1 min-w-0">
            <h3 class="font-heading font-bold text-base text-white break-words leading-tight mb-1">${escapeHtml(p.name)}</h3>
            ${p.owner ? `<p class="text-[10px] text-accent font-bold uppercase tracking-wider truncate">${escapeHtml(p.owner)}</p>` : ''}
          </div>
        </div>
        
        ${badges ? `<div class="flex flex-wrap gap-1.5 mb-4">${badges}</div>` : ''}
        
        <div class="flex flex-col gap-2.5 text-xs text-white/60 mb-5 flex-1">
          <div class="flex items-start gap-2">
            <span class="shrink-0 text-white/40">📍</span>
            <span class="break-words leading-snug">${escapeHtml(p.address)}, ${escapeHtml(p.city)} - ${escapeHtml(p.pin)}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="shrink-0 text-white/40">📞</span>
            <strong class="text-white font-medium">${escapeHtml(p.phone)}</strong>
          </div>
          <div class="flex items-center gap-2">
            <span class="shrink-0 text-white/40">⏰</span>
            <span>${hours}</span>
          </div>
          ${p.specialty ? `
            <div class="flex items-start gap-2">
              <span class="shrink-0 text-white/40">💊</span>
              <span class="leading-snug">${escapeHtml(p.specialty)}</span>
            </div>
          ` : ''}
          ${p.hasGeneric ? `
            <div class="flex items-center gap-2">
              <span class="shrink-0 text-success">✓</span>
              <span class="text-success/80">Generic medicines available</span>
            </div>
          ` : ''}
        </div>
        
        <div class="flex flex-wrap gap-2 pt-4 border-t border-border/50 mt-auto">
          ${actions}
        </div>
      </div>
    `;
  }

  function loadSaved() {
    const q = query(collection(db, 'pharmacies'), where('patientId', '==', currentUser.uid));
    
    onSnapshot(q, (snapshot) => {
      allSaved = [];
      snapshot.forEach(d => allSaved.push({ id: d.id, ...d.data() }));
      allSaved.sort((a, b) => {
        const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      renderSaved(searchInput ? searchInput.value : '');
    }, err => {
      showToast('Could not load saved pharmacies: ' + err.message, 'error');
    });
  }

  function renderSaved(filter = '') {
    const c = document.getElementById('saved-list');
    if (!c) return;
    
    const f = filter.toLowerCase().trim();
    const filtered = f ? allSaved.filter(p => p.name.toLowerCase().includes(f) || p.city.toLowerCase().includes(f) || String(p.pin).includes(f)) : allSaved;
    
    if (filtered.length === 0) {
      c.innerHTML = allSaved.length === 0 
        ? `<div class="col-span-full text-center py-12 border border-dashed border-border rounded-2xl bg-surface/50">
            <div class="text-4xl mb-3 opacity-80">🏪</div>
            <h3 class="font-heading font-bold text-white mb-2">No saved pharmacies</h3>
            <p class="text-white/50 text-sm">Click '+ Add Pharmacy' to save your trusted shops.</p>
           </div>`
        : `<div class="col-span-full text-center py-10 bg-surface/50 rounded-2xl">
            <div class="text-3xl mb-2 opacity-50">🔍</div>
            <p class="text-white/50">No matches found in saved.</p>
           </div>`;
      return;
    }
    
    let html = '';
    filtered.forEach(p => html += renderPharmacy(p, false));
    c.innerHTML = html;
  }

  function loadVerified() {
    allVerified = [...DEMO_VERIFIED];
    renderVerified(searchInput ? searchInput.value : '');
    
    // Fetch from Firestore
    onSnapshot(collection(db, 'verified_pharmacies'), (snapshot) => {
      const fromDb = [];
      snapshot.forEach(d => fromDb.push({ id: d.id, ...d.data() }));
      allVerified = [...DEMO_VERIFIED, ...fromDb];
      renderVerified(searchInput ? searchInput.value : '');
    }, () => {});
  }

  function renderVerified(filter = '') {
    const c = document.getElementById('verified-list');
    if (!c) return;
    
    const f = filter.toLowerCase().trim();
    const filtered = f ? allVerified.filter(p => p.name.toLowerCase().includes(f) || p.city.toLowerCase().includes(f) || String(p.pin).includes(f)) : allVerified;
    
    if (filtered.length === 0) {
      c.innerHTML = `<div class="col-span-full text-center py-10 bg-surface/50 rounded-2xl"><div class="text-3xl mb-2 opacity-50">🔍</div><p class="text-white/50">No matches found in verified.</p></div>`;
      return;
    }
    
    let html = '';
    filtered.forEach(p => html += renderPharmacy(p, true));
    c.innerHTML = html;
  }

  window.filterPharmacies = () => {
    const v = searchInput ? searchInput.value : '';
    renderSaved(v);
    renderVerified(v);
  };

  window.editPharm = async (id) => {
    try {
      const docSnap = await getDoc(doc(db, 'pharmacies', id));
      if (!docSnap.exists()) return;
      
      const p = docSnap.data();
      editingId = id;
      
      const title = document.getElementById('pharmModalTitle');
      if (title) title.textContent = '✏️ Edit Pharmacy';
      
      document.getElementById('pharmName').value = p.name || '';
      document.getElementById('pharmOwner').value = p.owner || '';
      document.getElementById('pharmPhone').value = p.phone || '';
      document.getElementById('pharmLicense').value = p.license || '';
      document.getElementById('pharmAddress').value = p.address || '';
      document.getElementById('pharmCity').value = p.city || '';
      document.getElementById('pharmPin').value = p.pin || '';
      document.getElementById('pharmOpen').value = p.openTime || '09:00';
      document.getElementById('pharmClose').value = p.closeTime || '22:00';
      document.getElementById('pharmSpecialty').value = p.specialty || '';
      document.getElementById('opt24x7').checked = !!p.is24x7;
      document.getElementById('optDelivery').checked = !!p.hasDelivery;
      document.getElementById('optWhatsapp').checked = !!p.hasWhatsapp;
      document.getElementById('optGeneric').checked = !!p.hasGeneric;
      document.getElementById('pharmNotes').value = p.notes || '';
      
      if (pharmModal) {
        pharmModal.classList.remove('hidden');
        pharmModal.style.display = 'flex';
      }
    } catch (e) {
      showToast('Failed to load: ' + e.message, 'error');
    }
  };

  window.deletePharm = async (id, name) => {
    if (!confirm(`Remove ${name} from saved?`)) return;
    try {
      await deleteDoc(doc(db, 'pharmacies', id));
      showToast('Removed', 'success');
    } catch (e) {
      showToast('Failed to remove: ' + e.message, 'error');
    }
  };

  if (searchInput) {
    searchInput.addEventListener('input', window.filterPharmacies);
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      window.closeModal();
    }
  });
});
