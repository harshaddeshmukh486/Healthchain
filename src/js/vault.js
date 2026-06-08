import { auth, db, cloudinaryConfig } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { showToast, getFriendlyError } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let selectedFile = null;
  let uploadMode = ''; // 'ins' or 'vac'
  let insuranceUnsubscribe = null;
  let vaccineUnsubscribe = null;

  // Elements
  const globalLoader = document.getElementById('global-loader');
  
  // Modals
  const insuranceModal = document.getElementById('insuranceModal');
  const insForm = document.getElementById('insForm');
  const insTitle = document.getElementById('insTitle');
  const insIdInput = document.getElementById('insId');
  const insTypeSelect = document.getElementById('insType');
  const insProviderInput = document.getElementById('insProvider');
  const insNumberInput = document.getElementById('insNumber');
  const insSumInput = document.getElementById('insSum');
  const insPremiumInput = document.getElementById('insPremium');
  const insStartInput = document.getElementById('insStart');
  const insExpiryInput = document.getElementById('insExpiry');
  const insPhoneInput = document.getElementById('insPhone');
  const insMembersInput = document.getElementById('insMembers');
  const insNotesInput = document.getElementById('insNotes');
  const insFileInput = document.getElementById('insFile');
  const insFileLabel = document.getElementById('insFileLabel');
  const insFileText = document.getElementById('insFileText');
  const insProgress = document.getElementById('insProgress');
  const insProgressBar = document.getElementById('insProgressBar');
  const insSaveBtn = document.getElementById('insSaveBtn');

  const vaccineModal = document.getElementById('vaccineModal');
  const vacForm = document.getElementById('vacForm');
  const vacTitle = document.getElementById('vacTitle');
  const vacIdInput = document.getElementById('vacId');
  const vacNameSelect = document.getElementById('vacName');
  const otherVacGroup = document.getElementById('otherVacGroup');
  const vacOtherInput = document.getElementById('vacOther');
  const vacDoseSelect = document.getElementById('vacDose');
  const vacDateInput = document.getElementById('vacDate');
  const vacCenterInput = document.getElementById('vacCenter');
  const vacBatchInput = document.getElementById('vacBatch');
  const vacNextInput = document.getElementById('vacNext');
  const vacFileInput = document.getElementById('vacFile');
  const vacFileLabel = document.getElementById('vacFileLabel');
  const vacFileText = document.getElementById('vacFileText');
  const vacProgress = document.getElementById('vacProgress');
  const vacProgressBar = document.getElementById('vacProgressBar');
  const vacSaveBtn = document.getElementById('vacSaveBtn');

  // Stats
  const insCountEl = document.getElementById('ins-count');
  const vacCountEl = document.getElementById('vac-count');
  const expCountEl = document.getElementById('exp-count');

  // Lists
  const insuranceList = document.getElementById('insurance-list');
  const vaccineList = document.getElementById('vaccine-list');

  // ============ AUTH STATE ============
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.replace('login.html');
      return;
    }
    currentUser = user;
    if (globalLoader) globalLoader.classList.add('hidden');
    loadVaultData();
  });

  // ============ CLOUDINARY UPLOAD ============
  async function uploadFile(file, onProgress) {
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', cloudinaryConfig.uploadPreset);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/auto/upload`);

      xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable && onProgress) {
          onProgress((e.loaded / e.total) * 100);
        }
      });

      xhr.onload = () => {
        if (xhr.status === 200) {
          const res = JSON.parse(xhr.responseText);
          resolve({ url: res.secure_url, publicId: res.public_id, format: res.format });
        } else {
          reject(new Error('Cloudinary Upload error: ' + xhr.responseText));
        }
      };

      xhr.onerror = () => reject(new Error('Cloudinary network connection failed.'));
      xhr.send(fd);
    });
  }

  // ============ MODAL CONTROLS ============
  window.openModal = function(type) {
    selectedFile = null;
    uploadMode = type;
    
    if (type === 'insurance') {
      insForm.reset();
      insIdInput.value = '';
      insTitle.textContent = '🛡️ Add Insurance Policy';
      insFileLabel.classList.remove('file-selected');
      insFileText.textContent = '📎 Click to attach file (optional)';
      insProgress.style.display = 'none';
      insuranceModal.classList.add('show');
      setTimeout(() => insTypeSelect.focus(), 100);
    } else {
      vacForm.reset();
      vacIdInput.value = '';
      vacTitle.textContent = '💉 Add Vaccination';
      otherVacGroup.style.display = 'none';
      vacFileLabel.classList.remove('file-selected');
      vacFileText.textContent = '📎 Click to attach file (optional)';
      vacProgress.style.display = 'none';
      vaccineModal.classList.add('show');
      setTimeout(() => vacNameSelect.focus(), 100);
    }
  };

  window.closeModal = function(type) {
    selectedFile = null;
    if (type === 'insurance') {
      insuranceModal.classList.remove('show');
    } else {
      vaccineModal.classList.remove('show');
    }
  };

  // Other Vaccine visibility toggle
  if (vacNameSelect) {
    vacNameSelect.addEventListener('change', () => {
      otherVacGroup.style.display = vacNameSelect.value === 'Other' ? 'block' : 'none';
    });
  }

  // ============ FILE INPUT CHANGE HANDLERS ============
  window.handleFile = function(e, type) {
    const file = e.target.files[0];
    const label = type === 'ins' ? insFileLabel : vacFileLabel;
    const txt = type === 'ins' ? insFileText : vacFileText;

    if (!file) {
      selectedFile = null;
      txt.textContent = '📎 Click to attach file (optional)';
      label.classList.remove('file-selected');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('File size must be less than 5MB', 'error');
      e.target.value = '';
      selectedFile = null;
      txt.textContent = '📎 Click to attach file (optional)';
      label.classList.remove('file-selected');
      return;
    }

    selectedFile = file;
    txt.textContent = `✅ ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    label.classList.add('file-selected');
  };

  // ============ TABS SWITCHING ============
  window.switchTab = function(tabName, btn) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(tabName + '-section').classList.add('active');
  };

  // ============ SAVE INSURANCE ============
  window.saveInsurance = async function() {
    const originalText = insSaveBtn.innerHTML;
    insSaveBtn.disabled = true;
    insSaveBtn.innerHTML = '<span class="btn-spinner"></span> Saving...';

    try {
      let docUrl = null;
      let docPublicId = null;

      if (selectedFile) {
        insProgress.style.display = 'block';
        const uploadRes = await uploadFile(selectedFile, (progress) => {
          insProgressBar.style.width = progress + '%';
          insSaveBtn.innerHTML = `<span class="btn-spinner"></span> Uploading ${Math.round(progress)}%`;
        });
        docUrl = uploadRes.url;
        docPublicId = uploadRes.publicId;
      }

      const id = insIdInput.value;
      const data = {
        patientId: currentUser.uid,
        patientEmail: currentUser.email.toLowerCase(),
        policyType: insTypeSelect.value,
        provider: insProviderInput.value.trim(),
        policyNumber: insNumberInput.value.trim(),
        sumInsured: Number(insSumInput.value) || null,
        premium: Number(insPremiumInput.value) || null,
        startDate: insStartInput.value,
        expiryDate: insExpiryInput.value,
        helpline: insPhoneInput.value.trim() || null,
        members: insMembersInput.value.trim() || null,
        notes: insNotesInput.value.trim() || null,
        updatedAt: serverTimestamp()
      };

      if (docUrl) {
        data.fileUrl = docUrl;
        data.filePublicId = docPublicId;
        data.fileName = selectedFile.name;
      }

      if (id) {
        await updateDoc(doc(db, 'insurance', id), data);
        showToast('Insurance policy updated successfully!', 'success');
      } else {
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, 'insurance'), data);
        showToast('Insurance policy added successfully!', 'success');
      }

      closeModal('insurance');
    } catch (err) {
      console.error(err);
      showToast(getFriendlyError(err), 'error');
    } finally {
      insSaveBtn.disabled = false;
      insSaveBtn.innerHTML = originalText;
    }
  };

  // ============ SAVE VACCINATION ============
  window.saveVaccine = async function() {
    const originalText = vacSaveBtn.innerHTML;
    vacSaveBtn.disabled = true;
    vacSaveBtn.innerHTML = '<span class="btn-spinner"></span> Saving...';

    try {
      let docUrl = null;
      let docPublicId = null;

      if (selectedFile) {
        vacProgress.style.display = 'block';
        const uploadRes = await uploadFile(selectedFile, (progress) => {
          vacProgressBar.style.width = progress + '%';
          vacSaveBtn.innerHTML = `<span class="btn-spinner"></span> Uploading ${Math.round(progress)}%`;
        });
        docUrl = uploadRes.url;
        docPublicId = uploadRes.publicId;
      }

      const id = vacIdInput.value;
      const vacName = vacNameSelect.value === 'Other' ? vacOtherInput.value.trim() : vacNameSelect.value;
      
      const data = {
        patientId: currentUser.uid,
        patientEmail: currentUser.email.toLowerCase(),
        vaccineName: vacName,
        dose: vacDoseSelect.value || null,
        dateTaken: vacDateInput.value,
        center: vacCenterInput.value.trim() || null,
        batchNumber: vacBatchInput.value.trim() || null,
        nextDueDate: vacNextInput.value || null,
        notes: vacNotesInput.value.trim() || null,
        updatedAt: serverTimestamp()
      };

      if (docUrl) {
        data.fileUrl = docUrl;
        data.filePublicId = docPublicId;
        data.fileName = selectedFile.name;
      }

      if (id) {
        await updateDoc(doc(db, 'vaccinations', id), data);
        showToast('Vaccination entry updated!', 'success');
      } else {
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, 'vaccinations'), data);
        showToast('Vaccination entry saved!', 'success');
      }

      closeModal('vaccine');
    } catch (err) {
      console.error(err);
      showToast(getFriendlyError(err), 'error');
    } finally {
      vacSaveBtn.disabled = false;
      vacSaveBtn.innerHTML = originalText;
    }
  };

  // ============ LOAD VAULT DATA ============
  let insList = [];
  let vacList = [];

  function loadVaultData() {
    // 1. Insurance Policies query
    const insQuery = query(collection(db, 'insurance'), where('patientId', '==', currentUser.uid));
    insuranceUnsubscribe = onSnapshot(insQuery, (snap) => {
      insList = [];
      snap.forEach(d => insList.push({ id: d.id, ...d.data() }));
      renderInsurance();
      calculateStats();
    }, () => showToast('Failed to load insurance data', 'error'));

    // 2. Vaccinations query
    const vacQuery = query(collection(db, 'vaccinations'), where('patientId', '==', currentUser.uid));
    vaccineUnsubscribe = onSnapshot(vacQuery, (snap) => {
      vacList = [];
      snap.forEach(d => vacList.push({ id: d.id, ...d.data() }));
      renderVaccines();
      calculateStats();
    }, () => showToast('Failed to load vaccine data', 'error'));
  }

  // RENDER INSURANCE LIST
  function renderInsurance() {
    insuranceList.innerHTML = '';
    if (insList.length === 0) {
      insuranceList.innerHTML = `
        <div class="empty-state">
          <div class="emoji">🛡️</div>
          <h3>No insurance policies</h3>
          <p style="margin-top:8px;font-size:0.85rem">Add your health insurance policies for quick access during emergencies.</p>
        </div>`;
      return;
    }

    const now = new Date();
    now.setHours(0,0,0,0);
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    insList.forEach(item => {
      const expDate = new Date(item.expiryDate);
      let badgeHtml = '<span class="expiry-badge badge-active">Active</span>';
      let cardClass = 'vault-card';

      if (expDate < now) {
        badgeHtml = '<span class="expiry-badge badge-expired">Expired</span>';
        cardClass += ' expired border-danger/30';
      } else if (expDate <= thirtyDaysLater) {
        badgeHtml = '<span class="expiry-badge badge-expiring">Due Soon</span>';
        cardClass += ' expiring border-warning/30';
      }

      const sumStr = item.sumInsured ? '₹' + item.sumInsured.toLocaleString('en-IN') : '-';
      const premStr = item.premium ? '₹' + item.premium.toLocaleString('en-IN') : '-';
      const fileHtml = item.fileUrl 
        ? `<a href="${item.fileUrl}" target="_blank" rel="noopener" class="action-btn">📎 View Policy</a>`
        : '';

      const card = document.createElement('div');
      card.className = cardClass;
      card.innerHTML = `
        ${badgeHtml}
        <div class="card-header">
          <div class="card-icon icon-insurance">🛡️</div>
          <div class="card-title">
            <h3>${item.provider}</h3>
            <p>${item.policyType}</p>
          </div>
        </div>
        <div class="card-body">
          <div class="card-row"><span>Policy No:</span><span>${item.policyNumber}</span></div>
          <div class="card-row"><span>Sum Insured:</span><span>${sumStr}</span></div>
          <div class="card-row"><span>Premium:</span><span>${premStr}</span></div>
          <div class="card-row"><span>Expiry:</span><span>${new Date(item.expiryDate).toLocaleDateString('en-IN')}</span></div>
          ${item.members ? `<div class="card-row"><span>Covered:</span><span>${item.members}</span></div>` : ''}
          ${item.helpline ? `<div class="card-row"><span>Helpline:</span><a href="tel:${item.helpline}" style="color:var(--accent);text-decoration:none;">${item.helpline}</a></div>` : ''}
        </div>
        <div class="card-actions">
          ${fileHtml}
          <button class="action-btn edit-btn" data-id="${item.id}">Edit</button>
          <button class="action-btn danger delete-btn" data-id="${item.id}">Delete</button>
        </div>`;

      // Bind events
      card.querySelector('.edit-btn').addEventListener('click', () => editInsurance(item.id));
      card.querySelector('.delete-btn').addEventListener('click', () => deleteItem('insurance', item.id));

      insuranceList.appendChild(card);
    });
  }

  // RENDER VACCINES LIST
  function renderVaccines() {
    vaccineList.innerHTML = '';
    if (vacList.length === 0) {
      vaccineList.innerHTML = `
        <div class="empty-state">
          <div class="emoji">💉</div>
          <h3>No vaccinations recorded</h3>
          <p style="margin-top:8px;font-size:0.85rem">Track your vaccination history and get due date reminders.</p>
        </div>`;
      return;
    }

    vacList.forEach(item => {
      const dateStr = new Date(item.dateTaken).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const nextStr = item.nextDueDate ? new Date(item.nextDueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
      const doseStr = item.dose || 'Standard';
      
      const fileHtml = item.fileUrl 
        ? `<a href="${item.fileUrl}" target="_blank" rel="noopener" class="action-btn">📎 View Cert</a>`
        : '';

      const card = document.createElement('div');
      card.className = 'vault-card';
      card.innerHTML = `
        <div class="card-header">
          <div class="card-icon icon-vaccine">💉</div>
          <div class="card-title">
            <h3>${item.vaccineName}</h3>
            <p>${doseStr}</p>
          </div>
        </div>
        <div class="card-body">
          <div class="card-row"><span>Date Taken:</span><span>${dateStr}</span></div>
          <div class="card-row"><span>Next Due:</span><span style="${item.nextDueDate ? 'color:var(--warning);font-weight:bold;' : ''}">${nextStr}</span></div>
          ${item.center ? `<div class="card-row"><span>Center:</span><span>${item.center}</span></div>` : ''}
          ${item.batchNumber ? `<div class="card-row"><span>Batch No:</span><span>${item.batchNumber}</span></div>` : ''}
          ${item.notes ? `<div class="card-row"><span>Notes:</span><span>${item.notes}</span></div>` : ''}
        </div>
        <div class="card-actions">
          ${fileHtml}
          <button class="action-btn edit-btn" data-id="${item.id}">Edit</button>
          <button class="action-btn danger delete-btn" data-id="${item.id}">Delete</button>
        </div>`;

      // Bind events
      card.querySelector('.edit-btn').addEventListener('click', () => editVaccine(item.id));
      card.querySelector('.delete-btn').addEventListener('click', () => deleteItem('vaccine', item.id));

      vaccineList.appendChild(card);
    });
  }

  // ============ STATS CALCULATION ============
  function calculateStats() {
    let activeIns = insList.length;
    let activeVac = vacList.length;
    let warningCount = 0;

    const now = new Date();
    now.setHours(0,0,0,0);
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Count expiring policies
    insList.forEach(item => {
      const expDate = new Date(item.expiryDate);
      if (expDate <= thirtyDaysLater) warningCount++;
    });

    // Count upcoming vaccine due dates
    vacList.forEach(item => {
      if (item.nextDueDate) {
        const dueDate = new Date(item.nextDueDate);
        if (dueDate >= now && dueDate <= thirtyDaysLater) warningCount++;
      }
    });

    if (insCountEl) insCountEl.textContent = activeIns;
    if (vacCountEl) vacCountEl.textContent = activeVac;
    if (expCountEl) expCountEl.textContent = warningCount;
  }

  // ============ EDIT HANDLERS ============
  async function editInsurance(id) {
    try {
      const docSnap = await getDoc(doc(db, 'insurance', id));
      if (!docSnap.exists()) return;
      const d = docSnap.data();

      openModal('insurance');
      insTitle.textContent = '✏️ Edit Insurance Policy';
      insIdInput.value = id;
      insTypeSelect.value = d.policyType || '';
      insProviderInput.value = d.provider || '';
      insNumberInput.value = d.policyNumber || '';
      insSumInput.value = d.sumInsured || '';
      insPremiumInput.value = d.premium || '';
      insStartInput.value = d.startDate || '';
      insExpiryInput.value = d.expiryDate || '';
      insPhoneInput.value = d.helpline || '';
      insMembersInput.value = d.members || '';
      insNotesInput.value = d.notes || '';

      if (d.fileName) {
        insFileText.textContent = `✅ ${d.fileName}`;
        insFileLabel.classList.add('file-selected');
      }
    } catch (err) {
      showToast('Failed to load policy data', 'error');
    }
  }

  async function editVaccine(id) {
    try {
      const docSnap = await getDoc(doc(db, 'vaccinations', id));
      if (!docSnap.exists()) return;
      const d = docSnap.data();

      openModal('vaccine');
      vacTitle.textContent = '✏️ Edit Vaccination Entry';
      vacIdInput.value = id;

      const defaultVaccines = ['BCG', 'Hepatitis B', 'OPV', 'DPT', 'MMR', 'Chickenpox', 'Typhoid', 'Rotavirus', 'Pneumococcal', 'Hib', 'COVID-19', 'Influenza', 'Tetanus', 'Hepatitis A', 'HPV', 'Pneumonia', 'Shingles', 'Meningococcal', 'Yellow Fever', 'Japanese Encephalitis', 'Rabies', 'Cholera'];
      
      if (defaultVaccines.includes(d.vaccineName)) {
        vacNameSelect.value = d.vaccineName;
        otherVacGroup.style.display = 'none';
      } else {
        vacNameSelect.value = 'Other';
        otherVacGroup.style.display = 'block';
        vacOtherInput.value = d.vaccineName;
      }

      vacDoseSelect.value = d.dose || '';
      vacDateInput.value = d.dateTaken || '';
      vacCenterInput.value = d.center || '';
      vacBatchInput.value = d.batchNumber || '';
      vacNextInput.value = d.nextDueDate || '';
      vacNotesInput.value = d.notes || '';

      if (d.fileName) {
        vacFileText.textContent = `✅ ${d.fileName}`;
        vacFileLabel.classList.add('file-selected');
      }
    } catch (err) {
      showToast('Failed to load vaccination data', 'error');
    }
  }

  // ============ DELETE HANDLER ============
  async function deleteItem(type, id) {
    const typeLabel = type === 'insurance' ? 'policy' : 'vaccination record';
    if (!confirm(`Delete this ${typeLabel} permanently?`)) return;

    try {
      await deleteDoc(doc(db, type, id));
      showToast('Deleted successfully', 'success');
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'error');
    }
  }

  // Bind close modal on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal('insurance');
      closeModal('vaccine');
    }
  });
});
