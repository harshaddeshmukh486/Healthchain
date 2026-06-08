import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDoc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { showToast } from './toast.js';

const typeIcons = {
  checkup: '🩺',
  vaccination: '💉',
  medicine: '💊',
  appointment: '📅',
  'lab-test': '🔬',
  prescription: '📋',
  exercise: '🏃',
  hydration: '💧',
  diet: '🥗',
  custom: '✨'
};

document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let editingId = null;

  const globalLoader = document.getElementById('global-loader');
  const remModal = document.getElementById('remModal');
  const remForm = document.getElementById('remForm');
  const saveBtn = document.getElementById('saveBtn');

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
    
    const remDate = document.getElementById('remDate');
    if (remDate) {
      remDate.min = new Date().toISOString().split('T')[0];
    }
    
    loadReminders();
  });

  window.openModal = () => {
    editingId = null;
    const title = document.getElementById('remModalTitle');
    if (title) title.textContent = '🔔 Add Reminder';
    
    if (remForm) remForm.reset();
    
    const prio = document.getElementById('remPriority');
    const rep = document.getElementById('remRepeat');
    if (prio) prio.value = 'medium';
    if (rep) rep.value = 'none';
    
    if (remModal) {
      remModal.classList.remove('hidden');
      remModal.style.display = 'flex';
    }
    
    setTimeout(() => {
      const rt = document.getElementById('remTitle');
      if (rt) rt.focus();
    }, 100);
  };

  window.closeModal = () => {
    if (remModal) {
      remModal.classList.add('hidden');
      remModal.style.display = 'none';
    }
    editingId = null;
  };

  window.quickAdd = async (type, title, desc, priority, daysAhead) => {
    try {
      const date = new Date();
      date.setDate(date.getDate() + daysAhead);
      
      await addDoc(collection(db, 'health_reminders'), {
        patientId: currentUser.uid,
        patientEmail: currentUser.email.toLowerCase(),
        type: type,
        title: title,
        description: desc,
        dueDate: date.toISOString().split('T')[0],
        time: null,
        priority: priority,
        repeat: type === 'checkup' || type === 'vaccination' ? 'yearly' : 'none',
        completed: false,
        createdAt: serverTimestamp()
      });
      showToast(`${title} added! 🎉`, 'success');
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  if (remForm) {
    remForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const t = document.getElementById('remType').value;
      const ti = document.getElementById('remTitle').value.trim();
      const d = document.getElementById('remDate').value;
      const p = document.getElementById('remPriority').value;
      
      if (!t || !ti || !d) {
        showToast('Please fill required fields', 'error');
        return;
      }
      
      const originalHtml = saveBtn.innerHTML;
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white mr-2"></span> Saving...';
      
      try {
        const data = {
          patientId: currentUser.uid,
          patientEmail: currentUser.email.toLowerCase(),
          type: t,
          title: ti,
          description: document.getElementById('remDesc').value.trim() || null,
          dueDate: d,
          time: document.getElementById('remTime').value || null,
          priority: p,
          repeat: document.getElementById('remRepeat').value,
          completed: false,
          updatedAt: serverTimestamp()
        };
        
        if (editingId) {
          await updateDoc(doc(db, 'health_reminders', editingId), data);
          showToast('Updated successfully', 'success');
        } else {
          data.createdAt = serverTimestamp();
          await addDoc(collection(db, 'health_reminders'), data);
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

  function loadReminders() {
    const q = query(collection(db, 'health_reminders'), where('patientId', '==', currentUser.uid));
    
    onSnapshot(q, (snapshot) => {
      const overdue = [];
      const upcoming = [];
      const all = [];
      const completed = [];
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const next7 = new Date();
      next7.setDate(next7.getDate() + 7);
      next7.setHours(23, 59, 59, 999);
      
      snapshot.forEach(d => {
        const r = { id: d.id, ...d.data() };
        if (r.completed) {
          completed.push(r);
          return;
        }
        
        const due = new Date(r.dueDate);
        due.setHours(0, 0, 0, 0);
        
        if (due < today) {
          overdue.push(r);
        } else if (due <= next7) {
          upcoming.push(r);
        }
        all.push(r);
      });
      
      overdue.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
      upcoming.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
      all.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
      
      completed.sort((a, b) => {
        const timeA = a.completedAt ? a.completedAt.toMillis() : 0;
        const timeB = b.completedAt ? b.completedAt.toMillis() : 0;
        return timeB - timeA;
      });
      
      const oc = document.getElementById('overdue-count');
      const uc = document.getElementById('upcoming-count');
      const ac = document.getElementById('active-count');
      const tc = document.getElementById('total-count');
      
      if (oc) oc.textContent = overdue.length;
      if (uc) uc.textContent = upcoming.length;
      if (ac) ac.textContent = all.length;
      if (tc) tc.textContent = all.length + completed.length;
      
      renderList('overdue-list', overdue, 'overdue');
      renderList('upcoming-list', upcoming, 'upcoming');
      renderList('all-list', all, 'all');
      renderList('completed-list', completed.slice(0, 10), 'completed');
    }, err => {
      showToast('Could not load reminders: ' + err.message, 'error');
    });
  }

  function renderList(id, list, kind) {
    const c = document.getElementById(id);
    if (!c) return;
    
    if (list.length === 0) {
      const msgs = {
        overdue: 'No overdue reminders',
        upcoming: 'No upcoming reminders',
        all: 'No active reminders',
        completed: 'No completed reminders'
      };
      const emojis = { overdue: '✅', upcoming: '📭', all: '🔔', completed: '📭' };
      
      c.innerHTML = `
        <div class="col-span-full text-center py-8 bg-surface/50 rounded-2xl border border-dashed border-border/50">
          <div class="text-3xl mb-2 opacity-80">${emojis[kind]}</div>
          <p class="text-white/50 text-sm font-medium">${msgs[kind]}</p>
        </div>
      `;
      return;
    }
    
    let html = '';
    list.forEach(r => {
      const icon = typeIcons[r.type] || '🔔';
      const due = new Date(r.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const days = Math.floor((due - today) / (1000 * 60 * 60 * 24));
      const dateStr = due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      
      let timeStr = '';
      if (days < 0) timeStr = `<span class="text-danger font-bold text-xs uppercase tracking-wider">${Math.abs(days)} days overdue</span>`;
      else if (days === 0) timeStr = `<span class="text-warning font-bold text-xs uppercase tracking-wider">Today</span>`;
      else if (days === 1) timeStr = `<span class="text-warning font-bold text-xs uppercase tracking-wider">Tomorrow</span>`;
      else timeStr = `<span class="text-white/50 font-bold text-xs uppercase tracking-wider">In ${days} days</span>`;
      
      let cardCls = 'border-border bg-surface';
      if (kind === 'overdue') cardCls = 'border-danger/30 bg-danger/5';
      else if (kind === 'upcoming') cardCls = 'border-warning/30 bg-warning/5';
      else if (kind === 'completed') cardCls = 'border-border bg-surface/40 opacity-70 grayscale';
      
      const prioStyles = {
        high: 'bg-danger/10 text-danger border-danger/30',
        medium: 'bg-warning/10 text-warning border-warning/30',
        low: 'bg-success/10 text-success border-success/30'
      };
      const priClass = prioStyles[r.priority] || prioStyles.medium;
      
      let actions = '';
      if (!r.completed) {
        actions = `
          <button class="w-10 h-10 rounded-xl bg-success/10 hover:bg-success text-success hover:text-white border border-success/30 hover:border-success flex items-center justify-center transition-colors cursor-pointer" onclick="markDone('${escapeHtml(r.id)}')" title="Mark complete">✓</button>
          <button class="w-10 h-10 rounded-xl bg-surface-2 hover:bg-accent border border-border hover:border-accent text-white/50 hover:text-bg flex items-center justify-center transition-colors cursor-pointer" onclick="editRem('${escapeHtml(r.id)}')" title="Edit">✏️</button>
          <button class="w-10 h-10 rounded-xl bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/20 hover:border-danger flex items-center justify-center transition-colors cursor-pointer" onclick="deleteRem('${escapeHtml(r.id)}','${escapeHtml(r.title)}')" title="Delete">🗑️</button>
        `;
      } else {
        actions = `
          <button class="w-10 h-10 rounded-xl bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/20 hover:border-danger flex items-center justify-center transition-colors cursor-pointer" onclick="deleteRem('${escapeHtml(r.id)}','${escapeHtml(r.title)}')" title="Delete">🗑️</button>
        `;
      }
      
      html += `
        <div class="glass-panel p-4 rounded-xl border ${cardCls} hover:border-accent/40 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div class="flex-1 min-w-0 w-full">
            <div class="flex items-center gap-3 mb-2 flex-wrap">
              <span class="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center text-sm shrink-0 border border-border">${icon}</span>
              <h3 class="font-heading font-bold text-white text-sm sm:text-base break-words">${escapeHtml(r.title)}</h3>
              <span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest border ${priClass}">${escapeHtml(r.priority)}</span>
            </div>
            
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs text-white/60">
              <span class="flex items-center gap-1.5"><span class="text-white/30">📅</span> ${dateStr}</span>
              ${r.time ? `<span class="flex items-center gap-1.5"><span class="text-white/30">⏰</span> ${escapeHtml(r.time)}</span>` : ''}
              ${r.repeat && r.repeat !== 'none' ? `<span class="flex items-center gap-1.5 text-accent"><span class="text-accent/50">🔄</span> ${escapeHtml(r.repeat)}</span>` : ''}
              <div class="w-1 h-1 rounded-full bg-border"></div>
              ${timeStr}
            </div>
            
            ${r.description ? `
              <div class="mt-2 text-xs text-white/40 italic bg-surface-2/50 p-2 rounded-lg border border-border/50">
                ${escapeHtml(r.description)}
              </div>
            ` : ''}
          </div>
          
          <div class="flex gap-2 w-full sm:w-auto justify-end sm:justify-start shrink-0 pt-3 border-t border-border/50 sm:pt-0 sm:border-none">
            ${actions}
          </div>
        </div>
      `;
    });
    
    c.innerHTML = html;
  }

  window.markDone = async (id) => {
    try {
      const docSnap = await getDoc(doc(db, 'health_reminders', id));
      if (!docSnap.exists()) return;
      
      const r = docSnap.data();
      
      await updateDoc(doc(db, 'health_reminders', id), {
        completed: true,
        completedAt: serverTimestamp()
      });
      
      showToast('Marked complete! 🎉', 'success');
      
      // Auto-create next occurrence if repeating
      if (r.repeat && r.repeat !== 'none') {
        const nextDate = new Date(r.dueDate);
        const intervals = { daily: 1, weekly: 7, monthly: 30, quarterly: 90, yearly: 365 };
        
        nextDate.setDate(nextDate.getDate() + (intervals[r.repeat] || 365));
        
        await addDoc(collection(db, 'health_reminders'), {
          ...r,
          dueDate: nextDate.toISOString().split('T')[0],
          completed: false,
          completedAt: null,
          createdAt: serverTimestamp()
        });
        showToast(`Next ${r.repeat} reminder auto-created!`, 'info');
      }
    } catch (e) {
      showToast('Failed to complete: ' + e.message, 'error');
    }
  };

  window.editRem = async (id) => {
    try {
      const docSnap = await getDoc(doc(db, 'health_reminders', id));
      if (!docSnap.exists()) return;
      
      const r = docSnap.data();
      editingId = id;
      
      const title = document.getElementById('remModalTitle');
      if (title) title.textContent = '✏️ Edit Reminder';
      
      document.getElementById('remType').value = r.type || '';
      document.getElementById('remTitle').value = r.title || '';
      document.getElementById('remDesc').value = r.description || '';
      document.getElementById('remDate').value = r.dueDate || '';
      document.getElementById('remTime').value = r.time || '';
      document.getElementById('remPriority').value = r.priority || 'medium';
      document.getElementById('remRepeat').value = r.repeat || 'none';
      
      if (remModal) {
        remModal.classList.remove('hidden');
        remModal.style.display = 'flex';
      }
    } catch (e) {
      showToast('Failed to load: ' + e.message, 'error');
    }
  };

  window.deleteRem = async (id, title) => {
    if (!confirm(`Delete reminder "${title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'health_reminders', id));
      showToast('Deleted', 'success');
    } catch (e) {
      showToast('Failed to delete: ' + e.message, 'error');
    }
  };

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      window.closeModal();
    }
  });
});
