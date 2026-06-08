import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, updateDoc, doc, getDoc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let selectedTimings = [];
  let editingId = null;

  const globalLoader = document.getElementById('global-loader');
  const addModal = document.getElementById('addModal');
  const medForm = document.getElementById('medForm');
  const saveBtn = document.getElementById('saveBtn');
  const modalTitle = document.getElementById('modalTitle');
  const medicinesContainer = document.getElementById('medicines-container');
  const scheduleArea = document.getElementById('schedule-area');
  const scheduleList = document.getElementById('schedule-list');

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
    
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    loadMedicines();
  });

  window.openModal = () => {
    editingId = null;
    if (modalTitle) modalTitle.textContent = '💊 Add Medicine';
    if (medForm) medForm.reset();
    selectedTimings = [];
    
    document.querySelectorAll('.timing-option').forEach(t => {
      t.classList.remove('bg-accent/10', 'border-accent', 'text-accent');
      t.classList.add('bg-surface-2', 'border-border', 'text-white');
    });
    
    if (addModal) {
      addModal.classList.remove('hidden');
      addModal.style.display = 'flex';
    }
    setTimeout(() => document.getElementById('medName').focus(), 100);
  };

  window.closeModal = () => {
    if (addModal) {
      addModal.classList.add('hidden');
      addModal.style.display = 'none';
    }
    editingId = null;
  };

  window.toggleTiming = (el) => {
    const t = el.dataset.time;
    const isActive = el.classList.contains('border-accent');
    
    if (isActive) {
      el.classList.remove('bg-accent/10', 'border-accent', 'text-accent');
      el.classList.add('bg-surface-2', 'border-border', 'text-white');
      selectedTimings = selectedTimings.filter(x => x !== t);
    } else {
      el.classList.add('bg-accent/10', 'border-accent', 'text-accent');
      el.classList.remove('bg-surface-2', 'border-border', 'text-white');
      if (!selectedTimings.includes(t)) selectedTimings.push(t);
    }
  };

  window.updateTimingOptions = () => {
    // Left empty to match legacy structure, can implement logic here later if needed
  };

  if (medForm) {
    medForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const n = document.getElementById('medName').value.trim();
      const d = document.getElementById('medDosage').value.trim();
      const f = document.getElementById('medFreq').value;
      
      if (!n || !d || !f) {
        showToast('Name, dosage and frequency required', 'error');
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
          dosage: d,
          type: document.getElementById('medType').value,
          frequency: f,
          timings: selectedTimings,
          reminderTime: document.getElementById('medReminder').value || null,
          startDate: document.getElementById('medStart').value || null,
          endDate: document.getElementById('medEnd').value || null,
          notes: document.getElementById('medNotes').value.trim() || null,
          active: true,
          updatedAt: serverTimestamp()
        };
        
        if (editingId) {
          await updateDoc(doc(db, 'medications', editingId), data);
          showToast('Medicine updated 🎉', 'success');
        } else {
          data.createdAt = serverTimestamp();
          await addDoc(collection(db, 'medications'), data);
          showToast('Medicine added 🎉', 'success');
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

  function loadMedicines() {
    const q = query(collection(db, 'medications'), where('patientId', '==', currentUser.uid), where('active', '==', true));
    
    onSnapshot(q, (snapshot) => {
      if (!medicinesContainer) return;
      
      const totalMedsEl = document.getElementById('total-meds');
      const todayDosesEl = document.getElementById('today-doses');
      
      if (totalMedsEl) totalMedsEl.textContent = snapshot.size;
      
      let totalDoses = 0;
      
      if (snapshot.empty) {
        medicinesContainer.innerHTML = `
          <div class="col-span-full text-center py-10 border border-dashed border-border rounded-2xl bg-surface/50">
            <div class="text-4xl mb-3 opacity-80">💊</div>
            <h3 class="font-heading font-bold text-white mb-2">No medicines added</h3>
            <p class="text-white/50 text-sm">Click '+ Add Medicine' to start tracking.</p>
          </div>
        `;
        if (todayDosesEl) todayDosesEl.textContent = '0';
        if (scheduleArea) scheduleArea.style.display = 'none';
        return;
      }
      
      let html = '';
      const schedule = {};
      const typeEmojis = { Tablet: '💊', Capsule: '💊', Syrup: '🥤', Injection: '💉', Drops: '💧', Inhaler: '🫁', Cream: '🧴', Other: '📦' };
      const freqMap = { 'Once daily': 1, 'Twice daily': 2, 'Thrice daily': 3, 'Four times daily': 4, 'Every 4 hours': 6, 'Every 6 hours': 4, 'Every 8 hours': 3, 'Weekly': 0, 'As needed': 0 };
      
      snapshot.forEach(d => {
        const m = d.data();
        totalDoses += (freqMap[m.frequency] || 0);
        
        const e = typeEmojis[m.type] || '💊';
        const timingsHtml = (m.timings || []).map(t => `<span class="px-2.5 py-0.5 bg-accent/10 border border-accent/20 text-accent rounded-full text-[10px] font-bold uppercase tracking-wider">${escapeHtml(t)}</span>`).join('');
        
        html += `
          <div class="glass-panel p-5 rounded-2xl border border-border hover:border-accent/40 hover:-translate-y-1 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3 mb-2 flex-wrap">
                <span class="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center shadow-lg text-sm shrink-0">${e}</span>
                <h3 class="font-heading font-bold text-base text-white break-words">${escapeHtml(m.name)}</h3>
                <span class="text-xs text-white/50 font-medium bg-surface-2 px-2 py-0.5 rounded-lg border border-border/50">${escapeHtml(m.dosage)}</span>
              </div>
              
              <div class="flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/60 mt-3 bg-surface-2/30 p-2.5 rounded-xl">
                <span class="flex items-center gap-1.5"><span class="shrink-0">⏱️</span> ${escapeHtml(m.frequency)}</span>
                ${m.reminderTime ? `<span class="flex items-center gap-1.5 text-accent"><span class="shrink-0">🔔</span> ${escapeHtml(m.reminderTime)}</span>` : ''}
                ${m.notes ? `<span class="flex items-center gap-1.5 max-w-[200px] truncate" title="${escapeHtml(m.notes)}"><span class="shrink-0">📝</span> ${escapeHtml(m.notes)}</span>` : ''}
              </div>
              
              ${timingsHtml ? `<div class="flex flex-wrap gap-2 mt-3">${timingsHtml}</div>` : ''}
            </div>
            
            <div class="flex gap-2 w-full sm:w-auto shrink-0 border-t border-border/50 sm:border-none pt-3 sm:pt-0 mt-3 sm:mt-0">
              <button class="flex-1 sm:flex-none px-4 py-2 bg-surface-2 hover:bg-accent border border-border hover:border-accent text-white hover:text-bg text-xs font-bold rounded-xl transition-colors cursor-pointer" onclick="editMedicine('${escapeHtml(d.id)}')">
                ✏️ Edit
              </button>
              <button class="flex-1 sm:flex-none px-4 py-2 bg-danger/10 hover:bg-danger border border-danger/20 hover:border-danger text-danger hover:text-white text-xs font-bold rounded-xl transition-colors cursor-pointer" onclick="deleteMedicine('${escapeHtml(d.id)}','${escapeHtml(m.name)}')">
                🗑️ Delete
              </button>
            </div>
          </div>
        `;
        
        (m.timings || []).forEach(t => {
          if (!schedule[t]) schedule[t] = [];
          schedule[t].push(`${m.name} (${m.dosage})`);
        });
      });
      
      medicinesContainer.innerHTML = html;
      if (todayDosesEl) todayDosesEl.textContent = totalDoses;
      
      // Today's schedule
      const order = ['Morning', 'Before meal', 'Afternoon', 'After meal', 'Evening', 'Night'];
      let scheduleHtml = '';
      
      order.forEach(t => {
        if (schedule[t]) {
          scheduleHtml += `
            <div class="flex justify-between items-center p-3 bg-surface border border-border rounded-xl">
              <div class="font-heading font-bold text-accent text-sm">${t}</div>
              <div class="text-xs text-white/60 text-right font-medium">${schedule[t].map(escapeHtml).join(', ')}</div>
            </div>
          `;
        }
      });
      
      if (scheduleHtml) {
        if (scheduleList) scheduleList.innerHTML = scheduleHtml;
        if (scheduleArea) {
          scheduleArea.style.display = 'block';
          scheduleArea.classList.remove('hidden');
        }
      } else {
        if (scheduleArea) {
          scheduleArea.style.display = 'none';
          scheduleArea.classList.add('hidden');
        }
      }
      
    }, err => {
      if (medicinesContainer) {
        medicinesContainer.innerHTML = `<div class="col-span-full text-center py-10 text-danger border border-danger/30 bg-danger/10 rounded-2xl">Could not load: ${escapeHtml(err.message)}</div>`;
      }
    });
  }

  window.editMedicine = async (id) => {
    try {
      const docSnap = await getDoc(doc(db, 'medications', id));
      if (!docSnap.exists()) return;
      
      const m = docSnap.data();
      editingId = id;
      
      if (modalTitle) modalTitle.textContent = '✏️ Edit Medicine';
      document.getElementById('medName').value = m.name || '';
      document.getElementById('medDosage').value = m.dosage || '';
      document.getElementById('medType').value = m.type || 'Tablet';
      document.getElementById('medFreq').value = m.frequency || '';
      document.getElementById('medReminder').value = m.reminderTime || '';
      document.getElementById('medStart').value = m.startDate || '';
      document.getElementById('medEnd').value = m.endDate || '';
      document.getElementById('medNotes').value = m.notes || '';
      
      selectedTimings = [...(m.timings || [])];
      
      document.querySelectorAll('.timing-option').forEach(t => {
        if (selectedTimings.includes(t.dataset.time)) {
          t.classList.add('bg-accent/10', 'border-accent', 'text-accent');
          t.classList.remove('bg-surface-2', 'border-border', 'text-white');
        } else {
          t.classList.remove('bg-accent/10', 'border-accent', 'text-accent');
          t.classList.add('bg-surface-2', 'border-border', 'text-white');
        }
      });
      
      if (addModal) {
        addModal.classList.remove('hidden');
        addModal.style.display = 'flex';
      }
    } catch (e) {
      showToast('Failed to load: ' + e.message, 'error');
    }
  };

  window.deleteMedicine = async (id, name) => {
    if (!confirm(`Stop tracking ${name}?`)) return;
    try {
      await updateDoc(doc(db, 'medications', id), { active: false });
      showToast(`${name} removed`, 'success');
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
