import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  const globalLoader = document.getElementById('global-loader');
  const membersContainer = document.getElementById('members-container');
  const addModal = document.getElementById('addModal');
  const memberForm = document.getElementById('memberForm');
  const saveBtn = document.getElementById('saveBtn');

  const relationEmojis = { Father: '👨', Mother: '👩', Spouse: '💑', Son: '👦', Daughter: '👧', Brother: '👨', Sister: '👩', Grandfather: '👴', Grandmother: '👵', Uncle: '👨', Aunt: '👩', Other: '👤' };

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
    loadMembers();
  });

  window.openAddModal = () => {
    addModal.classList.remove('hidden');
    addModal.style.display = 'flex';
    setTimeout(() => document.getElementById('memberName').focus(), 100);
  };

  window.closeAddModal = () => {
    addModal.classList.add('hidden');
    addModal.style.display = 'none';
    if (memberForm) memberForm.reset();
  };

  if (memberForm) {
    memberForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const n = document.getElementById('memberName').value.trim();
      const r = document.getElementById('memberRelation').value;
      
      if (!n || !r) {
        showToast('Name and relationship required', 'error');
        return;
      }
      
      const originalHtml = saveBtn.innerHTML;
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white mr-2"></span> Saving...';
      
      try {
        await addDoc(collection(db, 'family_members'), {
          ownerId: currentUser.uid,
          ownerEmail: currentUser.email.toLowerCase(),
          name: n,
          relation: r,
          dob: document.getElementById('memberDob').value || null,
          gender: document.getElementById('memberGender').value || null,
          bloodGroup: document.getElementById('memberBlood').value || null,
          mobile: document.getElementById('memberMobile').value || null,
          allergies: document.getElementById('memberAllergies').value.trim() || null,
          createdAt: serverTimestamp()
        });
        showToast('Member added successfully! 🎉', 'success');
        window.closeAddModal();
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalHtml;
      }
    });
  }

  function loadMembers() {
    const q = query(collection(db, 'family_members'), where('ownerId', '==', currentUser.uid));
    
    onSnapshot(q, (snapshot) => {
      if (!membersContainer) return;
      
      let html = `
        <div class="glass-panel p-6 rounded-2xl border border-accent relative bg-gradient-to-br from-accent/5 to-accent-2/5 hover:-translate-y-1 transition-transform">
          <span class="absolute top-3 right-3 bg-accent text-bg px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest">YOU</span>
          <div class="w-14 h-14 rounded-full bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center text-2xl mb-4 shadow-lg shadow-accent/20">👤</div>
          <h3 class="font-heading font-bold text-lg text-white mb-1">${escapeHtml(currentUser.displayName || currentUser.email.split('@')[0])}</h3>
          <p class="text-accent text-xs font-bold mb-4">Self (Account Owner)</p>
          
          <div class="space-y-1.5 mb-5 text-xs text-white/50">
            <div class="flex justify-between"><span class="text-white/40">Email:</span> <span class="text-white">${escapeHtml(currentUser.email)}</span></div>
          </div>
          
          <a href="patient.html" class="block w-full py-2.5 bg-accent/10 border border-accent/20 hover:bg-accent text-accent hover:text-bg text-center text-xs font-bold rounded-xl transition-colors">
            📊 My Records
          </a>
        </div>
      `;
      
      if (snapshot.empty) {
        html += `
          <div class="glass-panel p-10 rounded-2xl border border-dashed border-border flex flex-col items-center justify-center text-center col-span-1 md:col-span-2">
            <div class="text-5xl mb-3 opacity-80">👨‍👩‍👧</div>
            <h3 class="font-heading font-bold text-lg text-white mb-2">No family members</h3>
            <p class="text-xs text-white/50 mb-4">Click '+ Add Family Member' to manage records for your loved ones.</p>
          </div>
        `;
      } else {
        snapshot.forEach(docSnap => {
          const m = docSnap.data();
          const emoji = relationEmojis[m.relation] || '👤';
          const age = m.dob ? Math.floor((Date.now() - new Date(m.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
          
          let infoHtml = '';
          if (age !== null) infoHtml += `<div class="flex justify-between py-1 border-b border-border/50"><span class="text-white/40">Age:</span> <span class="text-white">${age} years</span></div>`;
          if (m.gender) infoHtml += `<div class="flex justify-between py-1 border-b border-border/50"><span class="text-white/40">Gender:</span> <span class="text-white">${escapeHtml(m.gender)}</span></div>`;
          if (m.bloodGroup) infoHtml += `<div class="flex justify-between py-1 border-b border-border/50"><span class="text-white/40">Blood:</span> <span class="text-white">${escapeHtml(m.bloodGroup)}</span></div>`;
          if (m.allergies) infoHtml += `<div class="flex justify-between py-1"><span class="text-white/40">Allergies:</span> <span class="text-white truncate max-w-[120px]" title="${escapeHtml(m.allergies)}">${escapeHtml(m.allergies)}</span></div>`;

          html += `
            <div class="glass-panel p-6 rounded-2xl border border-border hover:border-accent/40 hover:-translate-y-1 transition-all group">
              <div class="w-14 h-14 rounded-full bg-surface-2 border border-border flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">${emoji}</div>
              <h3 class="font-heading font-bold text-lg text-white mb-1">${escapeHtml(m.name)}</h3>
              <p class="text-white/50 text-xs font-bold mb-4 uppercase tracking-wider">${escapeHtml(m.relation)}</p>
              
              <div class="space-y-0.5 mb-5 text-[11px] text-white/70 bg-surface-2/50 rounded-xl p-3 border border-border/50">
                ${infoHtml || '<div class="text-center text-white/30 py-2">No additional details</div>'}
              </div>
              
              <div class="flex gap-2">
                <button class="flex-[3] py-2.5 bg-surface-2 hover:bg-accent border border-border hover:border-accent text-white hover:text-bg text-xs font-bold rounded-xl transition-colors" onclick="viewRecords('${escapeHtml(docSnap.id)}','${escapeHtml(m.name)}')">
                  📊 Records
                </button>
                <button class="flex-1 py-2.5 bg-danger/10 hover:bg-danger border border-danger/20 hover:border-danger text-danger hover:text-white text-xs flex items-center justify-center rounded-xl transition-colors" onclick="deleteMember('${escapeHtml(docSnap.id)}','${escapeHtml(m.name)}')">
                  🗑️
                </button>
              </div>
            </div>
          `;
        });
      }
      
      membersContainer.innerHTML = html;
    }, err => {
      if (membersContainer) {
        membersContainer.innerHTML = `<div class="col-span-full text-center py-10 text-danger border border-danger/30 bg-danger/10 rounded-2xl">Could not load: ${escapeHtml(err.message)}</div>`;
      }
    });
  }

  window.viewRecords = (id, name) => {
    showToast(`Opening ${name}'s records...`, 'info');
    setTimeout(() => { window.location.href = `patient.html?member=${encodeURIComponent(id)}`; }, 800);
  };

  window.deleteMember = async (id, name) => {
    if (!confirm(`Remove ${name} from your family?\n\nTheir records will not be deleted.`)) return;
    try {
      await deleteDoc(doc(db, 'family_members', id));
      showToast(`${name} removed`, 'success');
    } catch (e) {
      showToast('Failed: ' + e.message, 'error');
    }
  };

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      window.closeAddModal();
    }
  });
});
