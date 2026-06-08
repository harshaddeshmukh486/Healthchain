import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let allChildren = [];
  let activeChildId = null;
  let allGivenVaccines = [];

  const globalLoader = document.getElementById('global-loader');
  const mainContent = document.getElementById('mainContent');
  const noChildState = document.getElementById('noChildState');
  const childTabs = document.getElementById('childTabs');

  const childModal = document.getElementById('childModal');
  const childForm = document.getElementById('childForm');
  const givenModal = document.getElementById('givenModal');
  const givenForm = document.getElementById('givenForm');
  
  const saveChildBtn = document.getElementById('saveChildBtn');
  const markBtn = document.getElementById('markBtn');

  // IAP Recommended Vaccination Schedule (months from birth)
  const IAP_SCHEDULE = [
    { id: 'bcg', name: 'BCG', ageMonths: 0, description: 'Tuberculosis prevention', ageLabel: 'At birth' },
    { id: 'opv0', name: 'OPV-0', ageMonths: 0, description: 'Polio (oral)', ageLabel: 'At birth' },
    { id: 'hepb', name: 'Hepatitis B-1', ageMonths: 0, description: 'Hepatitis B prevention', ageLabel: 'At birth' },
    { id: 'rota1', name: 'Rotavirus-1', ageMonths: 1.5, description: 'Rotavirus diarrhea', ageLabel: '6 weeks' },
    { id: 'opv1', name: 'OPV-1', ageMonths: 1.5, description: 'Polio', ageLabel: '6 weeks' },
    { id: 'hepb2', name: 'Hepatitis B-2', ageMonths: 1.5, description: 'Hepatitis B 2nd dose', ageLabel: '6 weeks' },
    { id: 'dtwp1', name: 'DTwP/DTaP-1', ageMonths: 1.5, description: 'Diphtheria, Tetanus, Pertussis', ageLabel: '6 weeks' },
    { id: 'hib1', name: 'Hib-1', ageMonths: 1.5, description: 'Haemophilus influenzae type B', ageLabel: '6 weeks' },
    { id: 'pcv1', name: 'PCV-1', ageMonths: 1.5, description: 'Pneumococcal vaccine', ageLabel: '6 weeks' },
    { id: 'ipv1', name: 'IPV-1', ageMonths: 1.5, description: 'Inactivated Polio Vaccine', ageLabel: '6 weeks' },
    { id: 'rota2', name: 'Rotavirus-2', ageMonths: 2.5, description: 'Rotavirus 2nd dose', ageLabel: '10 weeks' },
    { id: 'opv2', name: 'OPV-2', ageMonths: 2.5, description: 'Polio 2nd dose', ageLabel: '10 weeks' },
    { id: 'dtwp2', name: 'DTwP/DTaP-2', ageMonths: 2.5, description: 'DTwP 2nd dose', ageLabel: '10 weeks' },
    { id: 'hib2', name: 'Hib-2', ageMonths: 2.5, description: 'Hib 2nd dose', ageLabel: '10 weeks' },
    { id: 'pcv2', name: 'PCV-2', ageMonths: 2.5, description: 'PCV 2nd dose', ageLabel: '10 weeks' },
    { id: 'ipv2', name: 'IPV-2', ageMonths: 2.5, description: 'IPV 2nd dose', ageLabel: '10 weeks' },
    { id: 'rota3', name: 'Rotavirus-3', ageMonths: 3.5, description: 'Rotavirus 3rd dose', ageLabel: '14 weeks' },
    { id: 'opv3', name: 'OPV-3', ageMonths: 3.5, description: 'Polio 3rd dose', ageLabel: '14 weeks' },
    { id: 'dtwp3', name: 'DTwP/DTaP-3', ageMonths: 3.5, description: 'DTwP 3rd dose', ageLabel: '14 weeks' },
    { id: 'hib3', name: 'Hib-3', ageMonths: 3.5, description: 'Hib 3rd dose', ageLabel: '14 weeks' },
    { id: 'pcv3', name: 'PCV-3', ageMonths: 3.5, description: 'PCV 3rd dose', ageLabel: '14 weeks' },
    { id: 'ipv3', name: 'IPV-3', ageMonths: 3.5, description: 'IPV 3rd dose', ageLabel: '14 weeks' },
    { id: 'hepb3', name: 'Hepatitis B-3', ageMonths: 6, description: 'Hepatitis B 3rd dose', ageLabel: '6 months' },
    { id: 'flu1', name: 'Influenza-1', ageMonths: 6, description: 'First flu vaccine', ageLabel: '6 months' },
    { id: 'flu2', name: 'Influenza-2', ageMonths: 7, description: 'Flu booster (4 weeks after 1st)', ageLabel: '7 months' },
    { id: 'mmr1', name: 'MMR-1', ageMonths: 9, description: 'Measles, Mumps, Rubella', ageLabel: '9 months' },
    { id: 'typhoid1', name: 'Typhoid Conjugate', ageMonths: 9, description: 'Typhoid prevention', ageLabel: '9 months' },
    { id: 'mmr2', name: 'MMR-2', ageMonths: 15, description: 'MMR booster', ageLabel: '15 months' },
    { id: 'varicella1', name: 'Varicella-1', ageMonths: 15, description: 'Chickenpox prevention', ageLabel: '15 months' },
    { id: 'pcvbooster', name: 'PCV Booster', ageMonths: 15, description: 'PCV booster dose', ageLabel: '15 months' },
    { id: 'hepa1', name: 'Hepatitis A-1', ageMonths: 12, description: 'Hepatitis A prevention', ageLabel: '12 months' },
    { id: 'hepa2', name: 'Hepatitis A-2', ageMonths: 18, description: 'Hepatitis A 2nd dose', ageLabel: '18 months' },
    { id: 'dtwpb1', name: 'DTwP Booster-1', ageMonths: 18, description: 'DTwP first booster', ageLabel: '18 months' },
    { id: 'opvb', name: 'OPV Booster', ageMonths: 18, description: 'Polio booster', ageLabel: '18 months' },
    { id: 'hibb', name: 'Hib Booster', ageMonths: 18, description: 'Hib booster', ageLabel: '18 months' },
    { id: 'varicella2', name: 'Varicella-2', ageMonths: 60, description: 'Chickenpox booster', ageLabel: '5 years' },
    { id: 'mmr3', name: 'MMR-3', ageMonths: 60, description: 'MMR 3rd dose', ageLabel: '5 years' },
    { id: 'dtwpb2', name: 'DTwP Booster-2', ageMonths: 60, description: 'DTwP second booster', ageLabel: '5 years' },
    { id: 'tdap', name: 'Tdap', ageMonths: 120, description: 'Adult Tetanus, Diphtheria, Pertussis', ageLabel: '10 years' },
    { id: 'hpv1', name: 'HPV-1', ageMonths: 108, description: 'HPV vaccine (girls 9-14yr)', ageLabel: '9-14 years' },
    { id: 'hpv2', name: 'HPV-2', ageMonths: 114, description: 'HPV 2nd dose (6 months later)', ageLabel: '9-14 years' }
  ];

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  onAuthStateChanged(auth, async (u) => {
    if (!u) {
      window.location.replace('login.html');
      return;
    }
    currentUser = u;
    if (globalLoader) globalLoader.style.display = 'none';
    loadChildren();
  });

  // Expose global methods for inline event handlers
  window.openChildModal = () => {
    childModal.classList.remove('hidden');
    childModal.style.display = 'flex';
    setTimeout(() => document.getElementById('childName').focus(), 100);
  };
  
  window.closeChildModal = () => {
    childModal.classList.add('hidden');
    childModal.style.display = 'none';
    childForm.reset();
  };

  window.saveChild = async () => {
    const n = document.getElementById('childName').value.trim();
    const d = document.getElementById('childDob').value;
    if (!n || !d) { showToast('Name and DOB required', 'error'); return; }
    
    const oh = saveChildBtn.innerHTML;
    saveChildBtn.disabled = true;
    saveChildBtn.innerHTML = '<span class="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white mr-2"></span> Adding...';
    
    try {
      const ref = await addDoc(collection(db, 'children'), {
        patientId: currentUser.uid,
        patientEmail: currentUser.email.toLowerCase(),
        name: n,
        dob: d,
        gender: document.getElementById('childGender').value || null,
        bloodGroup: document.getElementById('childBlood').value || null,
        createdAt: serverTimestamp()
      });
      showToast(`${n} added! 🎉`, 'success');
      window.closeChildModal();
      activeChildId = ref.id;
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      saveChildBtn.disabled = false;
      saveChildBtn.innerHTML = oh;
    }
  };

  if (childForm) {
    childForm.addEventListener('submit', (e) => {
      e.preventDefault();
      window.saveChild();
    });
  }

  function loadChildren() {
    const q = query(collection(db, 'children'), where('patientId', '==', currentUser.uid));
    onSnapshot(q, (snapshot) => {
      allChildren = [];
      snapshot.forEach(doc => allChildren.push({ id: doc.id, ...doc.data() }));
      allChildren.sort((a, b) => (a.createdAt?.toDate() || 0) - (b.createdAt?.toDate() || 0));
      renderChildTabs();
      
      if (allChildren.length > 0) {
        if (!activeChildId || !allChildren.find(c => c.id === activeChildId)) activeChildId = allChildren[0].id;
        mainContent.style.display = 'block';
        noChildState.style.display = 'none';
        loadGivenVaccines();
      } else {
        mainContent.style.display = 'none';
        noChildState.style.display = 'block';
      }
    }, err => {
      showToast('Could not load children: ' + err.message, 'error');
    });
  }

  function renderChildTabs() {
    let html = '';
    allChildren.forEach(child => {
      const age = getAge(child.dob);
      const cls = child.id === activeChildId 
        ? 'bg-accent/10 border-accent text-accent' 
        : 'bg-surface-2 border-border text-white hover:border-accent hover:text-accent transition-colors';
      const emoji = child.gender === 'Female' ? '👧' : child.gender === 'Male' ? '👦' : '👶';
      
      html += `
        <button class="px-4 py-2 border rounded-full cursor-pointer text-xs font-bold flex items-center gap-2 ${cls}" onclick="selectChild('${escapeHtml(child.id)}')">
          <span class="text-base">${emoji}</span> ${escapeHtml(child.name)} <span class="opacity-70 text-[10px] font-medium">(${age})</span>
        </button>
      `;
    });
    
    html += `<button class="px-4 py-2 border border-dashed border-border bg-transparent text-white/50 rounded-full cursor-pointer text-xs font-bold hover:text-accent hover:border-accent transition-colors" onclick="openChildModal()">+ Add Child</button>`;
    childTabs.innerHTML = html;
  }

  window.selectChild = (id) => {
    activeChildId = id;
    renderChildTabs();
    loadGivenVaccines();
  };

  function getAge(dob) {
    if (!dob) return '';
    const months = Math.floor((Date.now() - new Date(dob).getTime()) / (30.44 * 24 * 60 * 60 * 1000));
    if (months < 12) return `${months}mo`;
    if (months < 24) return `${Math.floor(months / 12)}y ${months % 12}m`;
    return `${Math.floor(months / 12)}y`;
  }

  function loadGivenVaccines() {
    if (!activeChildId) return;
    const q = query(collection(db, 'child_vaccines'), where('childId', '==', activeChildId));
    onSnapshot(q, (snapshot) => {
      allGivenVaccines = [];
      snapshot.forEach(doc => allGivenVaccines.push({ id: doc.id, ...doc.data() }));
      renderSchedule();
    }, err => {
      showToast('Could not load vaccines: ' + err.message, 'error');
    });
  }

  function renderSchedule() {
    const child = allChildren.find(c => c.id === activeChildId);
    if (!child) return;
    
    const dob = new Date(child.dob);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    
    const overdue = [], upcoming = [], given = [], future = [];
    
    IAP_SCHEDULE.forEach(v => {
      const givenRecord = allGivenVaccines.find(g => g.vaccineId === v.id);
      const dueDate = new Date(dob);
      dueDate.setDate(dueDate.getDate() + v.ageMonths * 30.44);
      const daysUntilDue = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));
      
      const enriched = { ...v, givenRecord, dueDate, daysUntilDue };
      
      if (givenRecord) given.push(enriched);
      else if (daysUntilDue < -7) overdue.push(enriched);
      else if (daysUntilDue >= -7 && daysUntilDue <= 30) upcoming.push(enriched);
      else if (daysUntilDue > 30) future.push(enriched);
    });
    
    overdue.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
    upcoming.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
    given.sort((a, b) => new Date(b.givenRecord.dateGiven) - new Date(a.givenRecord.dateGiven));
    future.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
    
    document.getElementById('given-count').textContent = given.length;
    document.getElementById('due-count').textContent = upcoming.length;
    document.getElementById('overdue-count').textContent = overdue.length;
    document.getElementById('total-count').textContent = IAP_SCHEDULE.length;
    
    renderList('overdue-list', overdue, 'overdue');
    renderList('upcoming-list', upcoming, 'upcoming');
    renderList('given-list', given, 'given');
    renderList('future-list', future.slice(0, 15), 'future');
  }

  function renderList(id, list, kind) {
    const c = document.getElementById(id);
    if (!c) return;
    
    if (list.length === 0) {
      const msgs = { overdue: 'All vaccines on track!', upcoming: 'No upcoming vaccines in 30 days.', given: 'No vaccines marked as given yet.', future: 'No future vaccines.' };
      const emojis = { overdue: '✅', upcoming: '📭', given: '💉', future: '📋' };
      c.innerHTML = `
        <div class="text-center py-8 border border-dashed border-border rounded-2xl bg-surface/50">
          <span class="text-3xl block mb-2 opacity-80">${emojis[kind]}</span>
          <p class="text-xs text-white/50">${msgs[kind]}</p>
        </div>`;
      return;
    }
    
    let html = '';
    list.forEach(v => {
      let cardCls = '', badge = '', timeStr = '';
      if (kind === 'given') {
        cardCls = 'bg-success/5 border-success/30 hover:border-success/50';
        badge = '<span class="bg-success/10 text-success border border-success/30 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest shrink-0">✓ GIVEN</span>';
        const givenDate = new Date(v.givenRecord.dateGiven);
        timeStr = `Given ${givenDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      } else if (kind === 'overdue') {
        cardCls = 'bg-danger/5 border-danger/40 hover:border-danger/60';
        badge = '<span class="bg-danger/10 text-danger border border-danger/30 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest shrink-0">🚨 OVERDUE</span>';
        timeStr = `<strong class="text-danger">${Math.abs(v.daysUntilDue)} days overdue</strong>`;
      } else if (kind === 'upcoming') {
        cardCls = 'bg-warning/5 border-warning/40 hover:border-warning/60';
        badge = '<span class="bg-warning/10 text-warning border border-warning/30 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest shrink-0">⏰ DUE SOON</span>';
        if (v.daysUntilDue < 0) timeStr = `<strong class="text-warning">${Math.abs(v.daysUntilDue)} days overdue</strong>`;
        else if (v.daysUntilDue === 0) timeStr = `<strong class="text-warning">Due today</strong>`;
        else timeStr = `<strong class="text-warning">Due in ${v.daysUntilDue} days</strong>`;
      } else {
        cardCls = 'bg-surface border-border hover:border-accent/40';
        badge = '<span class="bg-surface-2 text-white/50 border border-border px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest shrink-0">📅 FUTURE</span>';
        timeStr = `In ${Math.floor(v.daysUntilDue / 30)} months`;
      }
      
      let actions = '';
      if (kind !== 'given') {
        actions = `<button class="px-3 py-2 bg-gradient-to-r from-success to-emerald-600 hover:shadow-lg hover:shadow-success/20 text-white border-none rounded-xl text-[10px] font-bold cursor-pointer transition-all" onclick="openGivenModal('${escapeHtml(v.id)}','${escapeHtml(v.name)}')">✓ Mark Given</button>`;
      } else {
        actions = `<button class="px-3 py-2 bg-transparent border border-border hover:border-danger hover:text-danger text-white/60 rounded-xl text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1" onclick="undoGiven('${escapeHtml(v.givenRecord.id)}','${escapeHtml(v.name)}')">↶ Undo</button>`;
      }
      
      html += `
        <div class="glass-panel p-5 rounded-2xl border transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${cardCls}">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1.5 flex-wrap">
              <span class="w-7 h-7 bg-gradient-to-br from-accent to-accent-2 rounded-lg flex items-center justify-center text-[11px] text-white shrink-0 shadow-md">💉</span>
              <h4 class="font-heading font-bold text-sm text-white">${escapeHtml(v.name)}</h4>
              ${badge}
            </div>
            <div class="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-white/50 mt-2">
              <span class="flex items-center gap-1">📅 <strong class="text-white/80">${escapeHtml(v.ageLabel)}</strong></span>
              <span class="flex items-center gap-1">📝 ${escapeHtml(v.description)}</span>
              <span class="flex items-center gap-1">${timeStr}</span>
            </div>
            ${v.givenRecord && v.givenRecord.center ? `<div class="text-[10px] text-white/40 mt-2 flex items-center gap-1">🏥 ${escapeHtml(v.givenRecord.center)}</div>` : ''}
          </div>
          <div class="shrink-0 w-full md:w-auto flex justify-end">
            ${actions}
          </div>
        </div>
      `;
    });
    c.innerHTML = html;
  }

  window.openGivenModal = (vacId, vacName) => {
    document.getElementById('givenVacId').value = vacId;
    document.getElementById('givenTitle').textContent = `✓ Mark ${vacName} Given`;
    if (givenForm) givenForm.reset();
    document.getElementById('givenDate').value = new Date().toISOString().split('T')[0];
    givenModal.classList.remove('hidden');
    givenModal.style.display = 'flex';
  };

  window.closeGivenModal = () => {
    givenModal.classList.add('hidden');
    givenModal.style.display = 'none';
  };

  window.markGiven = async () => {
    const vacId = document.getElementById('givenVacId').value;
    const date = document.getElementById('givenDate').value;
    if (!vacId || !date) { showToast('Date required', 'error'); return; }
    
    const v = IAP_SCHEDULE.find(x => x.id === vacId);
    if (!v) return;
    
    const oh = markBtn.innerHTML;
    markBtn.disabled = true;
    markBtn.innerHTML = '<span class="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white mr-2"></span> Saving...';
    
    try {
      await addDoc(collection(db, 'child_vaccines'), {
        patientId: currentUser.uid,
        childId: activeChildId,
        vaccineId: vacId,
        vaccineName: v.name,
        dateGiven: date,
        center: document.getElementById('givenCenter').value.trim() || null,
        batch: document.getElementById('givenBatch').value.trim() || null,
        notes: document.getElementById('givenNotes').value.trim() || null,
        createdAt: serverTimestamp()
      });
      showToast(`${v.name} marked as given! 🎉`, 'success');
      window.closeGivenModal();
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      markBtn.disabled = false;
      markBtn.innerHTML = oh;
    }
  };

  if (givenForm) {
    givenForm.addEventListener('submit', (e) => {
      e.preventDefault();
      window.markGiven();
    });
  }

  window.undoGiven = async (id, name) => {
    if (!confirm(`Mark ${name} as not given?`)) return;
    try {
      await deleteDoc(doc(db, 'child_vaccines', id));
      showToast('Undone', 'success');
    } catch (e) {
      showToast('Failed: ' + e.message, 'error');
    }
  };

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      window.closeChildModal();
      window.closeGivenModal();
    }
  });
});
