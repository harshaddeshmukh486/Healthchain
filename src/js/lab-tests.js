import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let selectedColl = 'Home';
  let selectedTest = null;

  const globalLoader = document.getElementById('global-loader');
  const searchInput = document.getElementById('searchInput');
  const testsCatalog = document.getElementById('tests-catalog');
  const bookingsList = document.getElementById('bookings-list');
  const bookModal = document.getElementById('bookModal');
  const bookForm = document.getElementById('bookForm');
  const bookBtn = document.getElementById('bookBtn');

  const TESTS = [
    { id: 'cbc', name: 'Complete Blood Count (CBC)', icon: '🩸', desc: 'Checks RBC, WBC, hemoglobin, platelets', price: 300 },
    { id: 'sugar', name: 'Blood Sugar (Fasting + PP)', icon: '🍬', desc: 'Diabetes screening test', price: 200 },
    { id: 'thyroid', name: 'Thyroid Profile (T3, T4, TSH)', icon: '🦋', desc: 'Thyroid function evaluation', price: 550 },
    { id: 'lipid', name: 'Lipid Profile', icon: '❤️', desc: 'Cholesterol & cardiac risk', price: 600 },
    { id: 'liver', name: 'Liver Function Test (LFT)', icon: '🟫', desc: 'Liver health & enzymes', price: 550 },
    { id: 'kidney', name: 'Kidney Function Test (KFT)', icon: '🟧', desc: 'Creatinine, urea, electrolytes', price: 500 },
    { id: 'vitd', name: 'Vitamin D (25-OH)', icon: '☀️', desc: 'Vitamin D deficiency check', price: 1200 },
    { id: 'vitb12', name: 'Vitamin B12', icon: '💊', desc: 'B12 deficiency screening', price: 700 },
    { id: 'iron', name: 'Iron Studies', icon: '⚡', desc: 'Iron, ferritin, TIBC', price: 800 },
    { id: 'urine', name: 'Urine Routine + Microscopy', icon: '🧪', desc: 'UTI, kidney function', price: 200 },
    { id: 'hba1c', name: 'HbA1c (Glycated Hemoglobin)', icon: '📊', desc: '3-month diabetes monitoring', price: 450 },
    { id: 'esr', name: 'ESR (Erythrocyte Sedimentation)', icon: '🔬', desc: 'Inflammation marker', price: 150 },
    { id: 'crp', name: 'CRP (C-Reactive Protein)', icon: '🔥', desc: 'Inflammation & infection', price: 400 },
    { id: 'dengue', name: 'Dengue NS1 + IgM/IgG', icon: '🦟', desc: 'Dengue infection diagnosis', price: 1200 },
    { id: 'malaria', name: 'Malaria Antigen + Smear', icon: '🦟', desc: 'Malaria parasite detection', price: 350 },
    { id: 'typhoid', name: 'Typhoid (Widal Test)', icon: '🦠', desc: 'Salmonella infection', price: 300 },
    { id: 'covid', name: 'COVID-19 RT-PCR', icon: '🦠', desc: 'COVID-19 infection test', price: 500 },
    { id: 'preg', name: 'Pregnancy Test (Beta hCG)', icon: '👶', desc: 'Pregnancy confirmation', price: 400 },
    { id: 'fullbody', name: 'Full Body Checkup (60+ tests)', icon: '🏥', desc: 'Comprehensive health screening', price: 1999 },
    { id: 'cardiac', name: 'Cardiac Risk Profile', icon: '💓', desc: 'Heart disease risk assessment', price: 1500 }
  ];

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
    
    const testDate = document.getElementById('testDate');
    if (testDate) testDate.min = new Date().toISOString().split('T')[0];
    
    renderTests();
    loadBookings();
  });

  window.renderTests = (filter = '') => {
    if (!testsCatalog) return;
    
    const f = filter.toLowerCase().trim();
    const filtered = f ? TESTS.filter(t => t.name.toLowerCase().includes(f) || t.desc.toLowerCase().includes(f)) : TESTS;
    
    if (filtered.length === 0) {
      testsCatalog.innerHTML = `
        <div class="col-span-full text-center py-12 border border-dashed border-border rounded-2xl bg-surface/50">
          <div class="text-4xl mb-3 opacity-80">🔍</div>
          <p class="text-white/50 text-sm">No tests found matching your search.</p>
        </div>`;
      return;
    }
    
    let html = '';
    filtered.forEach(t => {
      html += `
        <div class="glass-panel p-5 rounded-2xl border border-border hover:border-accent/40 hover:-translate-y-1 transition-all flex flex-col group">
          <div class="flex items-start gap-4 mb-4">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/10 to-accent-2/10 border border-accent/20 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
              ${t.icon}
            </div>
            <div>
              <h3 class="font-heading font-bold text-base text-white leading-tight mb-1">${escapeHtml(t.name)}</h3>
              <p class="text-xs text-white/50 leading-relaxed">${escapeHtml(t.desc)}</p>
            </div>
          </div>
          
          <div class="mt-auto pt-4 border-t border-border flex justify-between items-center">
            <span class="font-heading font-extrabold text-lg text-accent">₹${t.price}</span>
            <button class="px-5 py-2 bg-gradient-to-r from-accent to-accent-2 text-white text-xs font-bold rounded-xl hover:shadow-lg hover:shadow-accent/20 transition-all cursor-pointer" onclick="openBookModal('${t.id}')">
              Book Test →
            </button>
          </div>
        </div>
      `;
    });
    testsCatalog.innerHTML = html;
  };

  window.filterTests = () => {
    if (searchInput) renderTests(searchInput.value);
  };

  if (searchInput) {
    searchInput.addEventListener('input', window.filterTests);
  }

  window.openBookModal = (id) => {
    selectedTest = TESTS.find(t => t.id === id);
    if (!selectedTest) return;
    
    const modalTestName = document.getElementById('modalTestName');
    const modalTestDesc = document.getElementById('modalTestDesc');
    const sumTestName = document.getElementById('sumTestName');
    const sumPrice = document.getElementById('sumPrice');
    
    if (modalTestName) modalTestName.textContent = 'Book: ' + selectedTest.name;
    if (modalTestDesc) modalTestDesc.textContent = selectedTest.desc;
    if (sumTestName) sumTestName.textContent = selectedTest.name;
    if (sumPrice) sumPrice.textContent = '₹' + selectedTest.price;
    
    updateTotal();
    
    if (bookModal) {
      bookModal.classList.remove('hidden');
      bookModal.style.display = 'flex';
    }
  };

  window.closeModal = () => {
    if (bookModal) {
      bookModal.classList.add('hidden');
      bookModal.style.display = 'none';
    }
    if (bookForm) bookForm.reset();
    
    selectedColl = 'Home';
    document.querySelectorAll('.coll-type').forEach((c, i) => {
      if (i === 0) {
        c.classList.add('border-accent', 'bg-accent/10');
        c.classList.remove('border-border', 'bg-surface-2');
      } else {
        c.classList.remove('border-accent', 'bg-accent/10');
        c.classList.add('border-border', 'bg-surface-2');
      }
    });
  };

  window.selectColl = (el) => {
    document.querySelectorAll('.coll-type').forEach(c => {
      c.classList.remove('border-accent', 'bg-accent/10');
      c.classList.add('border-border', 'bg-surface-2');
    });
    el.classList.add('border-accent', 'bg-accent/10');
    el.classList.remove('border-border', 'bg-surface-2');
    
    selectedColl = el.dataset.type;
    updateTotal();
  };

  function updateTotal() {
    if (!selectedTest) return;
    const homeFee = selectedColl === 'Home' ? 100 : 0;
    const sumHome = document.getElementById('sumHome');
    const sumTotal = document.getElementById('sumTotal');
    
    if (sumHome) sumHome.innerHTML = selectedColl === 'Home' ? '<span class="text-danger">+ ₹100</span>' : '<span class="text-white/40">No charge</span>';
    if (sumTotal) sumTotal.innerHTML = `<span class="text-accent text-lg font-bold">₹${selectedTest.price + homeFee}</span>`;
  }

  if (bookForm) {
    bookForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedTest) return;
      
      const dt = document.getElementById('testDate').value;
      const tm = document.getElementById('testTime').value;
      const mob = document.getElementById('testMobile').value.trim();
      
      if (!dt || !tm || !mob) {
        showToast('Please fill required fields', 'error');
        return;
      }
      if (!/^[0-9]{10}$/.test(mob)) {
        showToast('Mobile must be 10 digits', 'error');
        return;
      }
      
      const originalHtml = bookBtn.innerHTML;
      bookBtn.disabled = true;
      bookBtn.innerHTML = '<span class="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white mr-2"></span> Booking...';
      
      try {
        const homeFee = selectedColl === 'Home' ? 100 : 0;
        await addDoc(collection(db, 'lab_bookings'), {
          patientId: currentUser.uid,
          patientEmail: currentUser.email.toLowerCase(),
          patientName: currentUser.displayName || currentUser.email.split('@')[0],
          testId: selectedTest.id,
          testName: selectedTest.name,
          testPrice: selectedTest.price,
          collectionType: selectedColl,
          collectionFee: homeFee,
          totalAmount: selectedTest.price + homeFee,
          labName: document.getElementById('labName').value.trim() || null,
          bookingDate: dt,
          bookingTime: tm,
          address: document.getElementById('testAddress').value.trim() || null,
          mobile: mob,
          notes: document.getElementById('testNotes').value.trim() || null,
          status: 'scheduled',
          createdAt: serverTimestamp()
        });
        
        showToast('Test booked! 🎉 Confirmation will come via SMS', 'success');
        window.closeModal();
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      } finally {
        bookBtn.disabled = false;
        bookBtn.innerHTML = originalHtml;
      }
    });
  }

  function loadBookings() {
    const q = query(collection(db, 'lab_bookings'), where('patientId', '==', currentUser.uid));
    
    onSnapshot(q, (snapshot) => {
      if (!bookingsList) return;
      
      if (snapshot.empty) {
        bookingsList.innerHTML = `
          <div class="col-span-full text-center py-10 border border-dashed border-border rounded-2xl bg-surface/50">
            <div class="text-4xl mb-3 opacity-80">🔬</div>
            <p class="text-white/50 text-sm">No tests booked yet.</p>
          </div>`;
        return;
      }
      
      const list = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate));
      
      let html = '';
      list.forEach(b => {
        const dateStr = new Date(b.bookingDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        
        let statusClass = 'bg-surface-2 text-white/50 border-border';
        let statusText = 'Unknown';
        
        if (b.status === 'scheduled') {
          statusClass = 'bg-warning/10 text-warning border-warning/30';
          statusText = 'Scheduled';
        } else if (b.status === 'collected') {
          statusClass = 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/30';
          statusText = 'Sample Collected';
        } else if (b.status === 'completed') {
          statusClass = 'bg-success/10 text-success border-success/30';
          statusText = 'Completed';
        } else if (b.status === 'cancelled') {
          statusClass = 'bg-danger/10 text-danger border-danger/30';
          statusText = 'Cancelled';
        }
        
        const collIcon = b.collectionType === 'Home' ? '🏠' : '🏥';
        
        let actions = '';
        if (b.status === 'scheduled') {
          actions = `
            <button class="flex-1 px-3 py-2 bg-surface-2 hover:bg-[#3B82F6] hover:text-white border border-border text-[#3B82F6] text-[10px] font-bold rounded-lg transition-colors" onclick="markCollected('${escapeHtml(b.id)}')">
              📦 Mark Collected
            </button>
            <button class="flex-[0.5] px-3 py-2 bg-danger/10 hover:bg-danger border border-danger/20 text-danger hover:text-white text-[10px] font-bold rounded-lg transition-colors" onclick="cancelBooking('${escapeHtml(b.id)}','${escapeHtml(b.testName)}')">
              ✕ Cancel
            </button>
          `;
        } else if (b.status === 'collected') {
          actions = `
            <button class="w-full px-3 py-2 bg-success/10 hover:bg-success border border-success/30 text-success hover:text-white text-[10px] font-bold rounded-lg transition-colors" onclick="markCompleted('${escapeHtml(b.id)}')">
              ✓ Results Received
            </button>
          `;
        } else {
          actions = `
            <button class="w-full px-3 py-2 bg-danger/10 hover:bg-danger border border-danger/20 text-danger hover:text-white text-[10px] font-bold rounded-lg transition-colors" onclick="deleteBooking('${escapeHtml(b.id)}','${escapeHtml(b.testName)}')">
              🗑️ Delete Record
            </button>
          `;
        }
        
        html += `
          <div class="glass-panel p-5 rounded-2xl border border-border transition-all flex flex-col h-full bg-surface">
            <div class="flex justify-between items-start gap-4 mb-4">
              <div class="flex-1 min-w-0">
                <h3 class="font-heading font-bold text-sm text-white truncate" title="${escapeHtml(b.testName)}">🔬 ${escapeHtml(b.testName)}</h3>
              </div>
              <span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest border ${statusClass} shrink-0">${statusText}</span>
            </div>
            
            <div class="grid grid-cols-2 gap-y-3 gap-x-2 text-xs text-white/60 mb-5 flex-1 bg-surface-2/50 rounded-xl p-3 border border-border/50">
              <div class="flex items-center gap-1.5"><span class="shrink-0 text-white/40">📅</span> <strong class="text-white">${dateStr}</strong></div>
              <div class="flex items-center gap-1.5"><span class="shrink-0 text-white/40">⏰</span> <strong class="text-white">${formatTime(b.bookingTime)}</strong></div>
              <div class="flex items-center gap-1.5 col-span-2"><span class="shrink-0 text-white/40">${collIcon}</span> <span class="text-white">${escapeHtml(b.collectionType)}</span></div>
              <div class="flex items-center gap-1.5 col-span-2"><span class="shrink-0 text-white/40">💰</span> <strong class="text-accent">₹${b.totalAmount}</strong></div>
              ${b.labName ? `<div class="flex items-center gap-1.5 col-span-2"><span class="shrink-0 text-white/40">🏥</span> <span class="text-white truncate">${escapeHtml(b.labName)}</span></div>` : ''}
              ${b.mobile ? `<div class="flex items-center gap-1.5 col-span-2"><span class="shrink-0 text-white/40">📞</span> <span class="text-white">${escapeHtml(b.mobile)}</span></div>` : ''}
            </div>
            
            <div class="flex gap-2 pt-3 border-t border-border mt-auto">
              ${actions}
            </div>
          </div>
        `;
      });
      bookingsList.innerHTML = html;
      
    }, err => {
      showToast('Could not load: ' + err.message, 'error');
    });
  }

  window.markCollected = async (id) => {
    try {
      await updateDoc(doc(db, 'lab_bookings', id), {
        status: 'collected',
        collectedAt: serverTimestamp()
      });
      showToast('Marked as collected', 'success');
    } catch (e) {
      showToast('Failed: ' + e.message, 'error');
    }
  };

  window.markCompleted = async (id) => {
    try {
      await updateDoc(doc(db, 'lab_bookings', id), {
        status: 'completed',
        completedAt: serverTimestamp()
      });
      showToast('Marked as completed', 'success');
    } catch (e) {
      showToast('Failed: ' + e.message, 'error');
    }
  };

  window.cancelBooking = async (id, name) => {
    if (!confirm(`Cancel ${name}?`)) return;
    try {
      await updateDoc(doc(db, 'lab_bookings', id), {
        status: 'cancelled'
      });
      showToast('Cancelled', 'success');
    } catch (e) {
      showToast('Failed: ' + e.message, 'error');
    }
  };

  window.deleteBooking = async (id, name) => {
    if (!confirm(`Delete ${name} permanently?`)) return;
    try {
      await deleteDoc(doc(db, 'lab_bookings', id));
      showToast('Deleted', 'success');
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
