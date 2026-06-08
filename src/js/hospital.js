import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDoc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let editingId = null;
  let allSaved = [];
  let activeFilter = 'all';

  const globalLoader = document.getElementById('global-loader');
  const searchInput = document.getElementById('searchInput');
  const hospModal = document.getElementById('hospModal');
  const hospForm = document.getElementById('hospForm');
  const saveBtn = document.getElementById('saveBtn');
  const hospModalTitle = document.getElementById('hospModalTitle');

  // Major Indian Hospitals Directory
  const DIRECTORY = [
    { id: 'd1', name: 'AIIMS Delhi', type: 'Government', phone: '01126588500', emergency: '01126588500', address: 'Ansari Nagar, New Delhi', city: 'Delhi', pin: '110029', specialties: ['All specialties', 'Multi-super-specialty', 'Trauma', 'Cardiology', 'Neurology', 'Oncology'], is24x7: true, hasAmbulance: true, hasICU: true, hasAyushman: true, featured: true },
    { id: 'd2', name: 'Apollo Hospitals', type: 'Private', phone: '18605000100', emergency: '18605000100', address: 'Multiple branches across India', city: 'Multi-city', pin: '-', specialties: ['Multi-specialty', 'Cardiology', 'Oncology', 'Transplants', 'Neurology'], is24x7: true, hasAmbulance: true, hasICU: true, hasInsurance: true, featured: true },
    { id: 'd3', name: 'Fortis Healthcare', type: 'Private', phone: '18001022200', emergency: '18001022200', address: 'Multiple branches', city: 'Multi-city', pin: '-', specialties: ['Multi-specialty', 'Cardiology', 'Orthopedics', 'Neurology'], is24x7: true, hasAmbulance: true, hasICU: true, hasInsurance: true },
    { id: 'd4', name: 'Max Healthcare', type: 'Private', phone: '01140554055', address: 'Delhi NCR & other cities', city: 'Multi-city', pin: '-', specialties: ['Multi-specialty', 'Cardiology', 'Cancer', 'Orthopedics'], is24x7: true, hasAmbulance: true, hasICU: true, hasInsurance: true },
    { id: 'd5', name: 'Tata Memorial Hospital', type: 'Trust', phone: '02224177000', address: 'Dr E Borges Road, Parel, Mumbai', city: 'Mumbai', pin: '400012', specialties: ['Cancer treatment', 'Oncology', 'Radiation', 'Chemotherapy'], is24x7: true, hasICU: true, hasAyushman: true },
    { id: 'd6', name: 'KEM Hospital Mumbai', type: 'Government', phone: '02224107000', address: 'Acharya Donde Marg, Parel, Mumbai', city: 'Mumbai', pin: '400012', specialties: ['Multi-specialty', 'Government', 'All departments'], is24x7: true, hasAmbulance: true, hasICU: true, hasAyushman: true },
    { id: 'd7', name: 'PGI Chandigarh', type: 'Government', phone: '01722747585', address: 'Sector 12, Chandigarh', city: 'Chandigarh', pin: '160012', specialties: ['Multi-specialty', 'Research', 'All departments'], is24x7: true, hasAmbulance: true, hasICU: true, hasAyushman: true },
    { id: 'd8', name: 'CMC Vellore', type: 'Trust', phone: '04162281000', address: 'Ida Scudder Road, Vellore', city: 'Vellore', pin: '632004', specialties: ['Multi-specialty', 'Christian Medical College'], is24x7: true, hasAmbulance: true, hasICU: true },
    { id: 'd9', name: 'Manipal Hospitals', type: 'Private', phone: '18001027070', address: 'Multiple branches', city: 'Multi-city', pin: '-', specialties: ['Multi-specialty', 'Cardiology', 'Neurology'], is24x7: true, hasAmbulance: true, hasICU: true, hasInsurance: true },
    { id: 'd10', name: 'Narayana Health', type: 'Private', phone: '08066660000', address: 'Bangalore & other cities', city: 'Multi-city', pin: '-', specialties: ['Cardiac care', 'Multi-specialty', 'Affordable'], is24x7: true, hasAmbulance: true, hasICU: true, hasInsurance: true },
    { id: 'd11', name: 'Sir Ganga Ram Hospital', type: 'Trust', phone: '01142251111', address: 'Rajinder Nagar, New Delhi', city: 'Delhi', pin: '110060', specialties: ['Multi-specialty', 'Cardiology', 'Liver'], is24x7: true, hasAmbulance: true, hasICU: true, hasInsurance: true },
    { id: 'd12', name: 'Christian Medical College Ludhiana', type: 'Trust', phone: '01615028001', address: 'Brown Road, Ludhiana', city: 'Ludhiana', pin: '141008', specialties: ['Multi-specialty', 'All departments'], is24x7: true, hasAmbulance: true, hasICU: true },
    { id: 'd13', name: 'Lilavati Hospital', type: 'Trust', phone: '02226751000', address: 'A-791, Bandra (W), Mumbai', city: 'Mumbai', pin: '400050', specialties: ['Multi-specialty', 'Cardiology', 'Neurology'], is24x7: true, hasAmbulance: true, hasICU: true, hasInsurance: true },
    { id: 'd14', name: 'Yashoda Hospitals Hyderabad', type: 'Private', phone: '04067002424', address: 'Multiple branches Hyderabad', city: 'Hyderabad', pin: '-', specialties: ['Multi-specialty', 'Cardiology', 'Oncology'], is24x7: true, hasAmbulance: true, hasICU: true, hasInsurance: true },
    { id: 'd15', name: 'BJ Medical College Pune', type: 'Government', phone: '02026128000', address: 'Sasoon Road, Pune', city: 'Pune', pin: '411001', specialties: ['Multi-specialty', 'Government', 'Sasoon Hospital'], is24x7: true, hasAmbulance: true, hasICU: true, hasAyushman: true }
  ];

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.replace('login.html');
      return;
    }
    currentUser = user;
    if (globalLoader) globalLoader.style.display = 'none';
    loadSaved();
    renderDirectory();
  });

  // Global methods
  window.switchTab = (name, el) => {
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.remove('text-accent', 'border-accent');
      t.classList.add('text-white/50', 'border-transparent');
    });
    el.classList.remove('text-white/50', 'border-transparent');
    el.classList.add('text-accent', 'border-accent');
    
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.getElementById(name + '-section').classList.remove('hidden');
  };

  window.setFilter = (el) => {
    document.querySelectorAll('.filter-chip').forEach(c => {
      c.classList.remove('bg-accent/10', 'border-accent', 'text-accent');
      c.classList.add('bg-surface', 'border-border', 'text-white/50');
    });
    el.classList.remove('bg-surface', 'border-border', 'text-white/50');
    el.classList.add('bg-accent/10', 'border-accent', 'text-accent');
    
    activeFilter = el.dataset.filter;
    window.filterAll();
  };

  if (searchInput) {
    searchInput.addEventListener('input', () => window.filterAll());
  }

  window.openModal = () => {
    editingId = null;
    if (hospModalTitle) hospModalTitle.innerHTML = '🏥 Add Hospital';
    if (hospForm) hospForm.reset();
    if (hospModal) {
      hospModal.classList.remove('hidden');
      hospModal.style.display = 'flex';
    }
    setTimeout(() => document.getElementById('hospName').focus(), 100);
  };

  window.closeModal = () => {
    if (hospModal) {
      hospModal.classList.add('hidden');
      hospModal.style.display = 'none';
    }
    editingId = null;
  };

  if (hospForm) {
    hospForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const n = document.getElementById('hospName').value.trim();
      const t = document.getElementById('hospType').value;
      const p = document.getElementById('hospPhone').value.trim();
      const a = document.getElementById('hospAddress').value.trim();
      const c = document.getElementById('hospCity').value.trim();
      const pi = document.getElementById('hospPin').value.trim();
      
      if (!n || !t || !p || !a || !c || !pi) {
        showToast('Please fill required fields', 'error');
        return;
      }
      if (!/^[0-9]{6}$/.test(pi)) {
        showToast('PIN must be 6 digits', 'error');
        return;
      }
      
      const oh = saveBtn.innerHTML;
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white mr-2"></span> Saving...';
      
      try {
        const specialtiesRaw = document.getElementById('hospSpecialties').value;
        const specialties = specialtiesRaw ? specialtiesRaw.split(',').map(s => s.trim()).filter(s => s) : [];
        
        const data = {
          patientId: currentUser.uid,
          patientEmail: currentUser.email.toLowerCase(),
          name: n,
          type: t,
          phone: p,
          emergency: document.getElementById('hospEmergency').value.trim() || null,
          specialties: specialties,
          address: a,
          city: c,
          pin: pi,
          is24x7: document.getElementById('opt24x7').checked,
          hasAmbulance: document.getElementById('optAmbulance').checked,
          hasICU: document.getElementById('optICU').checked,
          hasInsurance: document.getElementById('optInsurance').checked,
          hasAyushman: document.getElementById('optAyushman').checked,
          notes: document.getElementById('hospNotes').value.trim() || null,
          updatedAt: serverTimestamp()
        };
        
        if (editingId) {
          await updateDoc(doc(db, 'hospitals', editingId), data);
          showToast('Updated', 'success');
        } else {
          data.createdAt = serverTimestamp();
          await addDoc(collection(db, 'hospitals'), data);
          showToast('Saved 🎉', 'success');
        }
        window.closeModal();
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = oh;
      }
    });
  }

  function renderHospital(h, canEdit) {
    let cardCls = 'border-border hover:border-accent/40 bg-surface';
    if (h.featured) cardCls = 'border-accent bg-gradient-to-br from-accent/5 to-accent-2/5';
    else if (h.type === 'Government') cardCls = 'border-success/40 hover:border-success/60 bg-surface';
    
    let badges = '';
    if (h.featured) badges += '<span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest bg-gradient-to-r from-accent to-accent-2 text-white border-none">⭐ MAJOR</span>';
    if (h.type === 'Government') badges += '<span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest bg-success/10 text-success border border-success/30">🏛️ GOVT</span>';
    else if (h.type === 'Private') badges += '<span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest bg-[#a78bfa]/10 text-[#a78bfa] border border-[#a78bfa]/30">🏢 PRIVATE</span>';
    if (h.is24x7) badges += '<span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest bg-danger/10 text-danger border border-danger/30">🚨 24x7</span>';
    if (h.hasAyushman) badges += '<span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest bg-warning/10 text-warning border border-warning/30">🪪 PMJAY</span>';
    
    let actions = `<a href="tel:${escapeHtml(h.phone)}" class="flex-1 py-2 text-center bg-gradient-to-r from-accent to-accent-2 text-white text-xs font-bold rounded-lg hover:shadow-lg hover:shadow-accent/20 transition-all">📞 Call</a>`;
    if (h.emergency && h.emergency !== h.phone) {
      actions += `<a href="tel:${escapeHtml(h.emergency)}" class="flex-1 py-2 text-center bg-danger/10 text-danger border border-danger/30 hover:bg-danger hover:text-white text-xs font-bold rounded-lg transition-colors">🚨 Emergency</a>`;
    }
    actions += `<a href="https://maps.google.com/?q=${encodeURIComponent(h.name + ', ' + h.address + ', ' + h.city)}" target="_blank" class="flex-1 py-2 text-center bg-surface-2 text-white border border-border hover:border-accent hover:text-accent text-xs font-bold rounded-lg transition-colors">🗺️ Map</a>`;
    
    if (canEdit) {
      actions += `
        <button class="px-3 py-2 bg-surface-2 text-white border border-border hover:border-accent text-xs font-bold rounded-lg transition-colors" onclick="editHosp('${escapeHtml(h.id)}')">✏️</button>
        <button class="px-3 py-2 bg-danger/10 text-danger border border-danger/20 hover:bg-danger hover:text-white text-xs font-bold rounded-lg transition-colors" onclick="deleteHosp('${escapeHtml(h.id)}','${escapeHtml(h.name)}')">🗑️</button>
      `;
    }
    
    let specsHtml = '';
    if (h.specialties && h.specialties.length) {
      specsHtml = '<div class="flex flex-wrap gap-1.5 mt-2">';
      h.specialties.slice(0, 4).forEach(s => {
        specsHtml += `<span class="bg-surface-2 text-white/60 px-2 py-0.5 rounded-full text-[10px] border border-border">${escapeHtml(s)}</span>`;
      });
      if (h.specialties.length > 4) {
        specsHtml += `<span class="bg-surface-2 text-white/60 px-2 py-0.5 rounded-full text-[10px] border border-border">+${h.specialties.length - 4}</span>`;
      }
      specsHtml += '</div>';
    }
    
    return `
      <div class="glass-panel p-5 rounded-2xl border transition-all hover:-translate-y-1 flex flex-col ${cardCls}">
        <div class="flex items-start gap-3 mb-3">
          <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center text-xl shrink-0 shadow-md">🏥</div>
          <div class="flex-1 min-w-0">
            <h3 class="font-heading font-bold text-sm text-white leading-tight mb-1 truncate" title="${escapeHtml(h.name)}">${escapeHtml(h.name)}</h3>
            <p class="text-accent text-[10px] font-bold uppercase tracking-wider">${escapeHtml(h.type)}</p>
          </div>
        </div>
        
        ${badges ? `<div class="flex flex-wrap gap-1.5 mb-3">${badges}</div>` : ''}
        
        <div class="space-y-1.5 mb-4 text-xs text-white/60 flex-1">
          <div class="flex items-start gap-2"><span class="shrink-0">📍</span> <span class="break-words line-clamp-2">${escapeHtml(h.address)}, ${escapeHtml(h.city)}${h.pin && h.pin !== '-' ? ' - ' + escapeHtml(h.pin) : ''}</span></div>
          <div class="flex items-start gap-2"><span class="shrink-0">📞</span> <strong>${escapeHtml(h.phone)}</strong></div>
          ${h.hasAmbulance ? `<div class="flex items-start gap-2"><span class="shrink-0">🚑</span> <span class="text-success font-semibold">Ambulance available</span></div>` : ''}
          ${h.hasICU ? `<div class="flex items-start gap-2"><span class="shrink-0">🏥</span> <span>ICU Available</span></div>` : ''}
          ${specsHtml}
        </div>
        
        <div class="flex flex-wrap gap-2 pt-3 border-t border-border mt-auto">
          ${actions}
        </div>
      </div>
    `;
  }

  function loadSaved() {
    const q = query(collection(db, 'hospitals'), where('patientId', '==', currentUser.uid));
    onSnapshot(q, (snapshot) => {
      allSaved = [];
      snapshot.forEach(d => allSaved.push({ id: d.id, ...d.data() }));
      allSaved.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
      window.filterAll();
    }, err => {
      showToast('Could not load: ' + err.message, 'error');
    });
  }

  function applyFilters(list) {
    const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
    return list.filter(h => {
      if (search) {
        const matches = h.name.toLowerCase().includes(search) || 
                        h.city.toLowerCase().includes(search) || 
                        (h.specialties || []).some(s => s.toLowerCase().includes(search));
        if (!matches) return false;
      }
      if (activeFilter === 'emergency' && !h.is24x7) return false;
      if (activeFilter === 'ambulance' && !h.hasAmbulance) return false;
      if (activeFilter === 'ayushman' && !h.hasAyushman) return false;
      if (activeFilter === 'govt' && h.type !== 'Government') return false;
      if (activeFilter === 'private' && h.type !== 'Private') return false;
      return true;
    });
  }

  window.filterAll = () => {
    // Saved
    const c1 = document.getElementById('saved-list');
    if (c1) {
      const filtered1 = applyFilters(allSaved);
      if (filtered1.length === 0) {
        c1.innerHTML = allSaved.length === 0 
          ? `<div class="col-span-full text-center py-12 border border-dashed border-border rounded-2xl bg-surface/50"><div class="text-4xl mb-3 opacity-80">🏥</div><h3 class="font-heading font-bold text-white mb-2">No saved hospitals</h3><p class="text-xs text-white/50">Add hospitals you trust for quick access.</p></div>` 
          : `<div class="col-span-full text-center py-12 border border-dashed border-border rounded-2xl bg-surface/50"><div class="text-4xl mb-3 opacity-80">🔍</div><p class="text-white/50 text-sm">No matches found in saved hospitals.</p></div>`;
      } else {
        let h = '';
        filtered1.forEach(x => h += renderHospital(x, true));
        c1.innerHTML = h;
      }
    }
    
    // Directory
    renderDirectory();
  };

  function renderDirectory() {
    const c = document.getElementById('directory-list');
    if (!c) return;
    const filtered = applyFilters(DIRECTORY);
    if (filtered.length === 0) {
      c.innerHTML = `<div class="col-span-full text-center py-12 border border-dashed border-border/50 rounded-2xl"><div class="text-4xl mb-3 opacity-80">🔍</div><p class="text-white/50 text-sm">No matches found in directory.</p></div>`;
      return;
    }
    let html = '';
    filtered.forEach(h => html += renderHospital(h, false));
    c.innerHTML = html;
  }

  window.editHosp = async (id) => {
    try {
      const docSnap = await getDoc(doc(db, 'hospitals', id));
      if (!docSnap.exists()) return;
      
      const h = docSnap.data();
      editingId = id;
      
      if (hospModalTitle) hospModalTitle.innerHTML = '✏️ Edit Hospital';
      document.getElementById('hospName').value = h.name || '';
      document.getElementById('hospType').value = h.type || '';
      document.getElementById('hospPhone').value = h.phone || '';
      document.getElementById('hospEmergency').value = h.emergency || '';
      document.getElementById('hospSpecialties').value = (h.specialties || []).join(', ');
      document.getElementById('hospAddress').value = h.address || '';
      document.getElementById('hospCity').value = h.city || '';
      document.getElementById('hospPin').value = h.pin || '';
      document.getElementById('opt24x7').checked = !!h.is24x7;
      document.getElementById('optAmbulance').checked = !!h.hasAmbulance;
      document.getElementById('optICU').checked = !!h.hasICU;
      document.getElementById('optInsurance').checked = !!h.hasInsurance;
      document.getElementById('optAyushman').checked = !!h.hasAyushman;
      document.getElementById('hospNotes').value = h.notes || '';
      
      if (hospModal) {
        hospModal.classList.remove('hidden');
        hospModal.style.display = 'flex';
      }
    } catch (e) {
      showToast('Failed: ' + e.message, 'error');
    }
  };

  window.deleteHosp = async (id, name) => {
    if (!confirm(`Remove ${name}?`)) return;
    try {
      await deleteDoc(doc(db, 'hospitals', id));
      showToast('Removed', 'success');
    } catch (e) {
      showToast('Failed: ' + e.message, 'error');
    }
  };

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      window.closeModal();
    }
  });
});
