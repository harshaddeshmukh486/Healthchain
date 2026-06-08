import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDoc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let editingId = null;
  let selectedSymptoms = [];
  let allPeriods = [];
  let calMonth = new Date();

  const globalLoader = document.getElementById('global-loader');
  const logModal = document.getElementById('logModal');
  const logForm = document.getElementById('logForm');
  const saveBtn = document.getElementById('saveBtn');
  const modalTitle = document.getElementById('modalTitle');
  const historyList = document.getElementById('historyList');
  const calGrid = document.getElementById('calGrid');

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
    loadPeriods();
  });

  window.openModal = () => {
    editingId = null;
    selectedSymptoms = [];
    if (modalTitle) modalTitle.innerHTML = '🌸 Log Period';
    if (logForm) logForm.reset();
    
    const sd = document.getElementById('startDate');
    if (sd) sd.value = new Date().toISOString().split('T')[0];
    
    document.querySelectorAll('.symptom-chip').forEach(c => {
      c.classList.remove('bg-pink-500/20', 'border-pink-500', 'text-pink-400');
      c.classList.add('bg-surface-2', 'border-border', 'text-white');
    });
    
    if (logModal) {
      logModal.classList.remove('hidden');
      logModal.style.display = 'flex';
    }
  };

  window.closeModal = () => {
    if (logModal) {
      logModal.classList.add('hidden');
      logModal.style.display = 'none';
    }
    editingId = null;
  };

  window.toggleSymptom = (el, s) => {
    const isActive = el.classList.contains('border-pink-500');
    
    if (isActive) {
      el.classList.remove('bg-pink-500/20', 'border-pink-500', 'text-pink-400');
      el.classList.add('bg-surface-2', 'border-border', 'text-white');
      selectedSymptoms = selectedSymptoms.filter(x => x !== s);
    } else {
      el.classList.add('bg-pink-500/20', 'border-pink-500', 'text-pink-400');
      el.classList.remove('bg-surface-2', 'border-border', 'text-white');
      if (!selectedSymptoms.includes(s)) selectedSymptoms.push(s);
    }
  };

  window.logToday = async () => {
    const today = new Date().toISOString().split('T')[0];
    const exists = allPeriods.find(p => p.startDate === today);
    
    if (exists) {
      showToast('Today is already logged', 'info');
      return;
    }
    
    try {
      await addDoc(collection(db, 'period_logs'), {
        patientId: currentUser.uid,
        patientEmail: currentUser.email.toLowerCase(),
        startDate: today,
        endDate: null,
        flow: null,
        symptoms: [],
        mood: null,
        notes: null,
        createdAt: serverTimestamp()
      });
      showToast('Period logged for today! 🌸', 'success');
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  if (logForm) {
    logForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const sd = document.getElementById('startDate').value;
      if (!sd) {
        showToast('Start date required', 'error');
        return;
      }
      
      const originalHtml = saveBtn.innerHTML;
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white mr-2"></span> Saving...';
      
      try {
        const data = {
          patientId: currentUser.uid,
          patientEmail: currentUser.email.toLowerCase(),
          startDate: sd,
          endDate: document.getElementById('endDate').value || null,
          flow: document.getElementById('flow').value || null,
          symptoms: selectedSymptoms,
          mood: document.getElementById('mood').value || null,
          notes: document.getElementById('notes').value.trim() || null,
          updatedAt: serverTimestamp()
        };
        
        if (editingId) {
          await updateDoc(doc(db, 'period_logs', editingId), data);
          showToast('Updated successfully', 'success');
        } else {
          data.createdAt = serverTimestamp();
          await addDoc(collection(db, 'period_logs'), data);
          showToast('Saved successfully 🌸', 'success');
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

  function loadPeriods() {
    const q = query(collection(db, 'period_logs'), where('patientId', '==', currentUser.uid));
    
    onSnapshot(q, (snapshot) => {
      allPeriods = [];
      snapshot.forEach(d => allPeriods.push({ id: d.id, ...d.data() }));
      allPeriods.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
      
      updateOverview();
      renderCalendar();
      renderHistory();
    }, err => {
      showToast('Could not load data: ' + err.message, 'error');
    });
  }

  function calculateCycleStats() {
    if (allPeriods.length < 2) return { avgCycle: 28, nextPeriod: null, ovulation: null, currentDay: null, phase: 'unknown' };
    
    const cycles = [];
    for (let i = 1; i < allPeriods.length; i++) {
      const days = Math.floor((new Date(allPeriods[i].startDate) - new Date(allPeriods[i-1].startDate)) / (1000 * 60 * 60 * 24));
      if (days > 15 && days < 60) cycles.push(days);
    }
    
    const avgCycle = cycles.length > 0 ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length) : 28;
    const last = allPeriods[allPeriods.length - 1];
    const lastDate = new Date(last.startDate);
    
    const nextPeriod = new Date(lastDate);
    nextPeriod.setDate(nextPeriod.getDate() + avgCycle);
    
    const ovulation = new Date(lastDate);
    ovulation.setDate(ovulation.getDate() + avgCycle - 14);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysSinceLast = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
    const currentDay = daysSinceLast + 1;
    
    let phase = 'unknown';
    if (currentDay >= 1 && currentDay <= 5) phase = 'menstrual';
    else if (currentDay >= 6 && currentDay <= 13) phase = 'follicular';
    else if (currentDay >= 14 && currentDay <= 16) phase = 'ovulation';
    else if (currentDay >= 17 && currentDay <= avgCycle) phase = 'luteal';
    
    return { avgCycle, nextPeriod, ovulation, currentDay, phase };
  }

  function updateOverview() {
    const stats = calculateCycleStats();
    
    const phaseBadge = document.getElementById('phaseBadge');
    const cycleDay = document.getElementById('cycleDay');
    const cycleLabel = document.getElementById('cycleLabel');
    const nextPeriod = document.getElementById('nextPeriod');
    const ovulation = document.getElementById('ovulation');
    const avgCycle = document.getElementById('avgCycle');
    
    if (allPeriods.length === 0) {
      if (cycleDay) cycleDay.textContent = '-';
      if (cycleLabel) cycleLabel.textContent = 'No data yet';
      if (nextPeriod) nextPeriod.textContent = '-';
      if (ovulation) ovulation.textContent = '-';
      if (avgCycle) avgCycle.textContent = '-';
      
      if (phaseBadge) {
        phaseBadge.className = 'px-4 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-surface-2 text-white/50 border border-border inline-block mb-3';
        phaseBadge.textContent = 'Add first period to start';
      }
      return;
    }
    
    if (stats.currentDay && stats.currentDay > 0) {
      if (cycleDay) cycleDay.textContent = `Day ${stats.currentDay}`;
      if (cycleLabel) cycleLabel.textContent = 'of your current cycle';
    } else {
      if (cycleDay) cycleDay.textContent = allPeriods.length;
      if (cycleLabel) cycleLabel.textContent = 'periods logged';
    }
    
    const phaseLabels = {
      menstrual: '🩸 Menstrual Phase',
      follicular: '🌱 Follicular Phase',
      ovulation: '⚡ Ovulation',
      luteal: '🌙 Luteal Phase',
      unknown: '📊 Track to predict'
    };
    
    const phaseClasses = {
      menstrual: 'bg-danger/10 text-danger border-danger/30',
      follicular: 'bg-success/10 text-success border-success/30',
      ovulation: 'bg-warning/10 text-warning border-warning/30',
      luteal: 'bg-[#a78bfa]/10 text-[#a78bfa] border-[#a78bfa]/30',
      unknown: 'bg-surface-2 text-white/50 border-border'
    };
    
    if (phaseBadge) {
      phaseBadge.className = `px-4 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest border inline-block mb-3 ${phaseClasses[stats.phase]}`;
      phaseBadge.textContent = phaseLabels[stats.phase];
    }
    
    if (nextPeriod) nextPeriod.textContent = stats.nextPeriod ? stats.nextPeriod.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-';
    if (ovulation) ovulation.textContent = stats.ovulation ? stats.ovulation.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-';
    if (avgCycle) avgCycle.textContent = stats.avgCycle + ' days';
  }

  window.navMonth = (dir) => {
    calMonth.setMonth(calMonth.getMonth() + dir);
    renderCalendar();
  };

  function renderCalendar() {
    if (!calGrid) return;
    
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    
    const calMonthEl = document.getElementById('calMonth');
    if (calMonthEl) {
      calMonthEl.textContent = calMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    }
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const stats = calculateCycleStats();
    const periodDates = new Set();
    const predictedDates = new Set();
    const ovulationDates = new Set();
    const fertileDates = new Set();
    
    // Mark logged periods
    allPeriods.forEach(p => {
      const start = new Date(p.startDate);
      const end = p.endDate ? new Date(p.endDate) : new Date(start.getTime() + 5 * 24 * 60 * 60 * 1000);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() === month && d.getFullYear() === year) {
          periodDates.add(d.getDate());
        }
      }
    });
    
    // Predict next periods
    if (allPeriods.length >= 2 && stats.nextPeriod) {
      for (let i = 0; i < 3; i++) {
        const predicted = new Date(stats.nextPeriod);
        predicted.setDate(predicted.getDate() + i * stats.avgCycle);
        
        for (let d = 0; d < 5; d++) {
          const date = new Date(predicted);
          date.setDate(date.getDate() + d);
          if (date.getMonth() === month && date.getFullYear() === year && !periodDates.has(date.getDate())) {
            predictedDates.add(date.getDate());
          }
        }
        
        // Ovulation
        const ov = new Date(predicted);
        ov.setDate(ov.getDate() - 14);
        if (ov.getMonth() === month && ov.getFullYear() === year) {
          ovulationDates.add(ov.getDate());
        }
        
        // Fertile window (5 days before ovulation + ovulation day)
        for (let d = -5; d <= 1; d++) {
          const fd = new Date(ov);
          fd.setDate(fd.getDate() + d);
          if (fd.getMonth() === month && fd.getFullYear() === year && 
              !ovulationDates.has(fd.getDate()) && 
              !periodDates.has(fd.getDate()) && 
              !predictedDates.has(fd.getDate())) {
            fertileDates.add(fd.getDate());
          }
        }
      }
    }
    
    let html = `
      <div class="text-center text-[10px] text-white/50 font-bold py-1.5 uppercase tracking-wider">Sun</div>
      <div class="text-center text-[10px] text-white/50 font-bold py-1.5 uppercase tracking-wider">Mon</div>
      <div class="text-center text-[10px] text-white/50 font-bold py-1.5 uppercase tracking-wider">Tue</div>
      <div class="text-center text-[10px] text-white/50 font-bold py-1.5 uppercase tracking-wider">Wed</div>
      <div class="text-center text-[10px] text-white/50 font-bold py-1.5 uppercase tracking-wider">Thu</div>
      <div class="text-center text-[10px] text-white/50 font-bold py-1.5 uppercase tracking-wider">Fri</div>
      <div class="text-center text-[10px] text-white/50 font-bold py-1.5 uppercase tracking-wider">Sat</div>
    `;
    
    for (let i = 0; i < firstDay; i++) {
      html += `<div class="aspect-square"></div>`;
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      
      let cls = 'aspect-square flex items-center justify-center rounded-xl text-xs font-bold transition-all border border-transparent cursor-pointer ';
      
      if (date.getTime() === today.getTime()) {
        cls += 'ring-2 ring-accent ring-offset-2 ring-offset-surface ';
      }
      
      if (periodDates.has(d)) {
        cls += 'bg-pink-500 text-white shadow-lg shadow-pink-500/30 hover:brightness-110 ';
      } else if (predictedDates.has(d)) {
        cls += 'bg-pink-500/20 text-pink-400 border-dashed border-pink-500/50 hover:bg-pink-500/30 ';
      } else if (ovulationDates.has(d)) {
        cls += 'bg-warning/20 text-warning border-warning/50 hover:bg-warning/30 ';
      } else if (fertileDates.has(d)) {
        cls += 'bg-success/15 text-success/90 hover:bg-success/25 ';
      } else {
        cls += 'bg-surface-2 text-white/80 hover:border-pink-500/50 hover:bg-surface ';
      }
      
      html += `<div class="${cls}">${d}</div>`;
    }
    
    calGrid.innerHTML = html;
  }

  function renderHistory() {
    if (!historyList) return;
    
    if (allPeriods.length === 0) {
      historyList.innerHTML = `
        <div class="col-span-full text-center py-10 border border-dashed border-border rounded-2xl bg-surface/50">
          <div class="text-4xl mb-3 opacity-80">🌸</div>
          <p class="text-white/50 text-sm">No periods logged yet.</p>
          <p class="text-[10px] text-white/40 mt-1 uppercase tracking-wider">Tap "Log Period" to start</p>
        </div>
      `;
      return;
    }
    
    let html = '';
    [...allPeriods].reverse().slice(0, 15).forEach(p => {
      const start = new Date(p.startDate);
      const dateStr = start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      
      let duration = '';
      if (p.endDate) {
        const days = Math.floor((new Date(p.endDate) - start) / (1000 * 60 * 60 * 24)) + 1;
        duration = `${days} day${days !== 1 ? 's' : ''}`;
      }
      
      html += `
        <div class="glass-panel p-4 rounded-xl border border-border hover:border-pink-500/50 transition-all flex justify-between items-center bg-surface group">
          <div class="flex-1 min-w-0">
            <h4 class="font-heading font-bold text-sm text-white mb-1">🌸 ${dateStr}</h4>
            <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
              ${duration ? `<span class="flex items-center gap-1"><span class="text-white/30">⏱️</span> ${duration}</span>` : ''}
              ${p.flow ? `<span class="flex items-center gap-1"><span class="text-white/30">💧</span> ${escapeHtml(p.flow)}</span>` : ''}
              ${p.mood ? `<span>${escapeHtml(p.mood)}</span>` : ''}
              ${p.symptoms && p.symptoms.length ? `<span class="flex items-center gap-1"><span class="text-white/30">📝</span> ${p.symptoms.length} symptoms</span>` : ''}
            </div>
          </div>
          
          <div class="flex gap-2 shrink-0">
            <button class="w-8 h-8 rounded-lg bg-surface-2 hover:bg-pink-500/20 text-white/50 hover:text-pink-400 border border-border hover:border-pink-500/50 flex items-center justify-center transition-colors" onclick="editLog('${escapeHtml(p.id)}')">✏️</button>
            <button class="w-8 h-8 rounded-lg bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/20 hover:border-danger flex items-center justify-center transition-colors" onclick="deleteLog('${escapeHtml(p.id)}','${dateStr}')">🗑️</button>
          </div>
        </div>
      `;
    });
    
    historyList.innerHTML = html;
  }

  window.editLog = async (id) => {
    try {
      const docSnap = await getDoc(doc(db, 'period_logs', id));
      if (!docSnap.exists()) return;
      
      const p = docSnap.data();
      editingId = id;
      selectedSymptoms = [...(p.symptoms || [])];
      
      if (modalTitle) modalTitle.textContent = '✏️ Edit Period';
      document.getElementById('startDate').value = p.startDate || '';
      document.getElementById('endDate').value = p.endDate || '';
      document.getElementById('flow').value = p.flow || '';
      document.getElementById('mood').value = p.mood || '';
      document.getElementById('notes').value = p.notes || '';
      
      document.querySelectorAll('.symptom-chip').forEach(c => {
        // Strip emoji from chip text
        const symptomName = c.textContent.replace(/^[^\s]+\s/, '');
        if (selectedSymptoms.includes(symptomName)) {
          c.classList.add('bg-pink-500/20', 'border-pink-500', 'text-pink-400');
          c.classList.remove('bg-surface-2', 'border-border', 'text-white');
        } else {
          c.classList.remove('bg-pink-500/20', 'border-pink-500', 'text-pink-400');
          c.classList.add('bg-surface-2', 'border-border', 'text-white');
        }
      });
      
      if (logModal) {
        logModal.classList.remove('hidden');
        logModal.style.display = 'flex';
      }
    } catch (e) {
      showToast('Failed to load: ' + e.message, 'error');
    }
  };

  window.deleteLog = async (id, date) => {
    if (!confirm(`Delete period from ${date}?`)) return;
    try {
      await deleteDoc(doc(db, 'period_logs', id));
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
