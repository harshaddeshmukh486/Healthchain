import { auth, db, cloudinaryConfig } from './firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  addDoc, 
  getDocs,
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
} from 'firebase/firestore';
import QRCode from 'qrcode';
import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let selectedFile = null;
  let reportsUnsubscribe = null;
  let doctorsUnsubscribe = null;
  // In-memory store for client-side search/filter
  let allReports = [];

  // Elements
  const globalLoader = document.getElementById('global-loader');
  const displayNameEl = document.getElementById('display-name');
  const welcomeNameEl = document.getElementById('welcome-name');
  const profileBanner = document.getElementById('profile-banner');
  const profileBannerTitle = document.getElementById('profile-banner-title');
  const profileBannerDesc = document.getElementById('profile-banner-desc');
  const logoutBtn = document.getElementById('logout-btn');
  const reportForm = document.getElementById('reportForm');
  const addReportFormContainer = document.getElementById('add-report-form');
  const toggleAddReportBtn = document.getElementById('toggle-add-report-btn');
  const cancelAddReportBtn = document.getElementById('cancel-add-report-btn');
  const fileInput = document.getElementById('reportFile');
  const fileLabel = document.getElementById('fileLabel');
  const fileLabelText = document.getElementById('fileLabelText');
  const uploadProgress = document.getElementById('uploadProgress');
  const uploadProgressBar = document.getElementById('uploadProgressBar');
  const saveReportBtn = document.getElementById('saveReportBtn');
  const reportsContainer = document.getElementById('reports-container');
  const qrcodeContainer = document.getElementById('qrcode');
  const doctorEmailInput = document.getElementById('doctorEmail');
  const grantBtn = document.getElementById('grantBtn');
  const authorizedDoctorsList = document.getElementById('authorized-doctors-list');
  const hashModal = document.getElementById('hashModal');
  const modalHash = document.getElementById('modalHash');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  // Stats Elements
  const totalReportsCount = document.getElementById('total-reports-count');
  const abnormalCount = document.getElementById('abnormal-count');
  const hashedCount = document.getElementById('hashed-count');

  // Search / Filter elements
  const reportSearch = document.getElementById('report-search');
  const reportFilterStatus = document.getElementById('report-filter-status');

  // Delete modal elements
  const deleteModal = document.getElementById('delete-report-modal');
  const delModalTitle = document.getElementById('del-modal-title');
  const delModalDesc = document.getElementById('del-modal-desc');
  const delModalCancel = document.getElementById('del-modal-cancel');
  const delModalConfirm = document.getElementById('del-modal-confirm');
  let pendingDeleteId = null;
  let pendingDeleteName = null;

  // ============ AUTHENTICATION STATE ============
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      const name = user.displayName || (user.email ? user.email.split('@')[0] : 'Patient');
      if (displayNameEl) displayNameEl.textContent = name;
      if (welcomeNameEl) welcomeNameEl.textContent = name;
      if (globalLoader) globalLoader.classList.add('hidden');
      
      await checkProfile();
      await generateHealthIdentityQR(user);
      loadReports();
      loadDoctors();
    } else {
      window.location.replace('login.html');
    }
  });

  // Cleanup listeners on page unload
  window.addEventListener('beforeunload', () => {
    if (reportsUnsubscribe) reportsUnsubscribe();
    if (doctorsUnsubscribe) doctorsUnsubscribe();
  });

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm("Are you sure you want to logout?")) {
        if (reportsUnsubscribe) reportsUnsubscribe();
        if (doctorsUnsubscribe) doctorsUnsubscribe();
        signOut(auth).then(() => window.location.replace('login.html'));
      }
    });
  }

  // ============ PROFILE COMPLETION CHECK ============
  async function checkProfile() {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(userRef);
      if (!profileBanner) return;

      if (!docSnap.exists() || !docSnap.data().profileComplete) {
        profileBanner.classList.remove('hidden');
        profileBanner.style.display = 'flex';
        if (profileBannerTitle) profileBannerTitle.textContent = 'Complete Your Health Profile';
        if (profileBannerDesc) profileBannerDesc.textContent = 'Add blood group, allergies, and emergency contact for better care.';
      } else {
        const data = docSnap.data();
        const missing = [];
        if (!data.bloodGroup || data.bloodGroup === 'Unknown') missing.push('blood group');
        if (!data.emergencyPhone) missing.push('emergency contact');
        
        if (missing.length > 0) {
          profileBanner.classList.remove('hidden');
          profileBanner.style.display = 'flex';
          if (profileBannerTitle) profileBannerTitle.textContent = 'Profile Incomplete';
          if (profileBannerDesc) profileBannerDesc.textContent = `Add your ${missing.join(' and ')} for better care.`;
        } else {
          // Profile is fully complete — hide banner
          profileBanner.classList.add('hidden');
          profileBanner.style.display = 'none';
        }
      }
    } catch (err) {
      console.error('Profile check error:', err);
    }
  }

  // ============ IDENTITY QR GENERATOR ============
  async function generateHealthIdentityQR(user) {
    try {
      const qrData = JSON.stringify({
        v: 1,
        id: user.uid,
        email: user.email.toLowerCase(),
        platform: 'healthchain'
      });
      
      if (!qrcodeContainer) return;
      qrcodeContainer.innerHTML = '';
      
      const canvas = document.createElement('canvas');
      qrcodeContainer.appendChild(canvas);
      
      await QRCode.toCanvas(canvas, qrData, {
        width: 180,
        height: 180,
        margin: 1,
        color: {
          dark: '#060a12',
          light: '#ffffff'
        }
      });
    } catch (e) {
      console.error('QR creation failed:', e);
      if (qrcodeContainer) {
        qrcodeContainer.innerHTML = '<p class="text-xs text-danger/80 py-10">QR Code Generation Failed</p>';
      }
    }
  }

  // ============ CRYPTO HASHING UTILS ============
  async function generateRealHash(dataStr) {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(dataStr);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function hashFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ============ CLOUDINARY UPLOAD ============
  async function uploadToCloudinary(file, onProgress) {
    return new Promise((resolve, reject) => {
      if (!cloudinaryConfig.cloudName || !cloudinaryConfig.uploadPreset) {
        reject(new Error('Cloudinary not configured. Check .env file.'));
        return;
      }
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', cloudinaryConfig.uploadPreset);
      
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
          resolve({
            url: res.secure_url,
            publicId: res.public_id,
            format: res.format
          });
        } else {
          reject(new Error('Upload failed: ' + xhr.responseText));
        }
      };
      
      xhr.onerror = () => reject(new Error('Cloudinary network connection failed.'));
      xhr.send(formData);
    });
  }

  // ============ ADD REPORT TOGGLE ============
  function toggleAddReport() {
    if (!addReportFormContainer) return;
    const isHidden = addReportFormContainer.classList.contains('hidden');
    if (isHidden) {
      addReportFormContainer.classList.remove('hidden');
      const nameInput = document.getElementById('reportName');
      if (nameInput) nameInput.focus();
    } else {
      addReportFormContainer.classList.add('hidden');
      if (reportForm) reportForm.reset();
      clearFileSelection();
    }
  }

  if (toggleAddReportBtn) toggleAddReportBtn.addEventListener('click', toggleAddReport);
  if (cancelAddReportBtn) cancelAddReportBtn.addEventListener('click', toggleAddReport);

  // File Selector handler
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) {
        clearFileSelection();
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('File must be smaller than 5MB', 'error');
        fileInput.value = '';
        clearFileSelection();
        return;
      }
      selectedFile = file;
      if (fileLabelText) fileLabelText.textContent = `✅ ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      if (fileLabel) fileLabel.classList.add('border-success', 'text-success');
    });
  }

  function clearFileSelection() {
    selectedFile = null;
    if (fileInput) fileInput.value = '';
    if (fileLabelText) fileLabelText.textContent = '📎 Click to attach report file (Optional)';
    if (fileLabel) fileLabel.classList.remove('border-success', 'text-success');
    if (uploadProgress) uploadProgress.classList.add('hidden');
    if (uploadProgressBar) uploadProgressBar.style.width = '0%';
  }

  // ============ SAVE REPORT ============
  if (reportForm) {
    reportForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const reportNameInput = document.getElementById('reportName');
      const reportValueInput = document.getElementById('reportValue');
      const reportStatusSelect = document.getElementById('reportStatus');
      const reportCategorySelect = document.getElementById('reportCategory');

      const name = reportNameInput.value.trim();
      const value = reportValueInput.value.trim();
      const status = reportStatusSelect.value;
      const category = reportCategorySelect.value;

      // Validate
      reportNameInput.classList.remove('border-danger');
      reportValueInput.classList.remove('border-danger');

      if (!name) {
        reportNameInput.classList.add('border-danger');
        showToast('Report name is required', 'error');
        reportNameInput.focus();
        return;
      }
      if (!value) {
        reportValueInput.classList.add('border-danger');
        showToast('Key findings / values are required', 'error');
        reportValueInput.focus();
        return;
      }

      const originalBtnText = saveReportBtn.innerHTML;
      saveReportBtn.disabled = true;
      saveReportBtn.innerHTML = '<span class="inline-block animate-spin rounded-full h-4.5 w-4.5 border-2 border-white/30 border-t-white mr-2"></span> Hashing...';

      try {
        const timeStamp = Date.now();
        
        // Step 1: Create cryptographic record hash
        const hashObj = JSON.stringify({
          patient: currentUser.email.toLowerCase(),
          reportName: name,
          findings: value,
          status: status,
          category: category,
          createdAt: timeStamp
        });
        const recordHashVal = await generateRealHash(hashObj);

        let fileHashVal = null;
        let fileNameVal = null;
        let fileUrlVal = null;
        let filePublicIdVal = null;
        let fileFormatVal = null;

        // Step 2: Upload file if selected
        if (selectedFile) {
          saveReportBtn.innerHTML = '<span class="inline-block animate-spin rounded-full h-4.5 w-4.5 border-2 border-white/30 border-t-white mr-2"></span> Hashing File...';
          fileHashVal = await hashFile(selectedFile);
          fileNameVal = selectedFile.name;
          
          saveReportBtn.innerHTML = '<span class="inline-block animate-spin rounded-full h-4.5 w-4.5 border-2 border-white/30 border-t-white mr-2"></span> Uploading...';
          if (uploadProgress) uploadProgress.classList.remove('hidden');
          
          const uploadRes = await uploadToCloudinary(selectedFile, (progress) => {
            if (uploadProgressBar) uploadProgressBar.style.width = `${progress}%`;
            saveReportBtn.innerHTML = `<span class="inline-block animate-spin rounded-full h-4.5 w-4.5 border-2 border-white/30 border-t-white mr-2"></span> Uploading ${Math.round(progress)}%`;
          });
          
          fileUrlVal = uploadRes.url;
          filePublicIdVal = uploadRes.publicId;
          fileFormatVal = uploadRes.format;
        }

        saveReportBtn.innerHTML = '<span class="inline-block animate-spin rounded-full h-4.5 w-4.5 border-2 border-white/30 border-t-white mr-2"></span> Securing...';

        // Step 3: Add doc to Firestore
        await addDoc(collection(db, "reports"), {
          patientId: currentUser.uid,
          patientEmail: currentUser.email.toLowerCase(),
          reportName: name,
          findings: value,
          status: status,
          category: category,
          recordHash: recordHashVal,
          fileHash: fileHashVal,
          fileName: fileNameVal,
          fileUrl: fileUrlVal,
          filePublicId: filePublicIdVal,
          fileFormat: fileFormatVal,
          hashAlgorithm: 'SHA-256',
          createdAt: timeStamp,
          date: serverTimestamp()
        });

        showToast('Record secured with SHA-256 hash! 🔐', 'success');
        
        // Reset form
        reportForm.reset();
        clearFileSelection();
        toggleAddReport();
      } catch (err) {
        console.error('Save report failed:', err);
        showToast(err.message || 'Failed to save record', 'error');
      } finally {
        saveReportBtn.disabled = false;
        saveReportBtn.innerHTML = originalBtnText;
      }
    });
  }

  // ============ LOAD REPORTS ============
  function loadReports() {
    // Query without orderBy to avoid needing a composite index on both patientEmail + date
    // We'll sort client-side for reliability
    const q = query(
      collection(db, "reports"),
      where("patientEmail", "==", currentUser.email.toLowerCase())
    );

    reportsUnsubscribe = onSnapshot(q, (snapshot) => {
      // Store all reports in memory for client-side filtering
      allReports = [];
      snapshot.forEach((reportDoc) => {
        allReports.push({ id: reportDoc.id, ...reportDoc.data() });
      });

      // Sort by date descending (most recent first)
      allReports.sort((a, b) => {
        const dateA = a.date?.toDate?.() || new Date(a.createdAt || 0);
        const dateB = b.date?.toDate?.() || new Date(b.createdAt || 0);
        return dateB - dateA;
      });

      renderReports();
    }, (err) => {
      console.error('Load reports error:', err);
      showToast('Failed to load records. Check internet.', 'error');
    });
  }

  // ============ RENDER REPORTS (with filter support) ============
  function renderReports() {
    const searchVal = (reportSearch?.value || '').toLowerCase().trim();
    const statusFilter = reportFilterStatus?.value || '';

    // Apply filters
    const filtered = allReports.filter(r => {
      const matchSearch = !searchVal || 
        r.reportName?.toLowerCase().includes(searchVal) || 
        r.findings?.toLowerCase().includes(searchVal) ||
        r.category?.toLowerCase().includes(searchVal);
      const matchStatus = !statusFilter || r.status === statusFilter;
      return matchSearch && matchStatus;
    });

    // Update stat counters based on ALL reports (not filtered)
    const totalCount = allReports.length;
    const abCount = allReports.filter(r => r.status === 'Abnormal').length;
    if (totalReportsCount) totalReportsCount.textContent = totalCount;
    if (hashedCount) hashedCount.textContent = totalCount;
    if (abnormalCount) abnormalCount.textContent = abCount;

    if (!reportsContainer) return;
    reportsContainer.innerHTML = '';

    if (allReports.length === 0) {
      // No records at all
      reportsContainer.innerHTML = `
        <div class="text-center py-12 px-6 border border-dashed border-border rounded-2xl bg-surface/30">
          <span class="text-3xl block mb-3">📭</span>
          <h3 class="font-heading font-bold text-sm text-white/80 mb-1">No Records Found</h3>
          <p class="text-xs text-white/40 max-w-[260px] mx-auto leading-relaxed">Click "+ Add Report" above to secure your first health record.</p>
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      // Records exist but filter returned nothing
      reportsContainer.innerHTML = `
        <div class="text-center py-10 px-6 border border-dashed border-border rounded-2xl bg-surface/30">
          <span class="text-2xl block mb-2">🔍</span>
          <h3 class="font-heading font-bold text-sm text-white/80 mb-1">No Match Found</h3>
          <p class="text-xs text-white/40">Try a different search term or clear the filter.</p>
        </div>
      `;
      return;
    }

    filtered.forEach((r) => {
      const docDate = r.date?.toDate
        ? r.date.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : r.createdAt 
          ? new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          : 'Just now';
      const isAbnormal = r.status === 'Abnormal';
      const hash = r.recordHash || 'N/A';
      const displayHash = hash.substring(0, 14);
      
      const card = document.createElement('div');
      card.className = 'glass-panel p-5 rounded-2xl border border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-4';
      
      const fileLinkHtml = r.fileUrl 
        ? `<a href="${r.fileUrl}" target="_blank" rel="noopener" class="text-xs text-accent hover:underline flex items-center gap-1">📎 ${r.fileName || 'View File'}</a>` 
        : '';

      const categoryBadge = r.category 
        ? `<span class="bg-accent-2/15 text-accent-2 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">${r.category}</span>` 
        : '';

      card.innerHTML = `
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2 mb-2">
            ${categoryBadge}
            <span class="text-xs text-white/40 font-medium">📅 ${docDate}</span>
          </div>
          <h4 class="font-heading font-bold text-base text-white mb-2 truncate">${r.reportName}</h4>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <button class="text-white/40 hover:text-accent font-mono transition-colors text-[10px] tracking-wide text-left record-hash-btn" data-hash="${hash}">
              🔗 ${displayHash}...
            </button>
            ${fileLinkHtml}
          </div>
          <p class="mt-3 text-sm text-white/70 font-medium border-t border-border/40 pt-2.5 leading-relaxed">${r.findings}</p>
        </div>
        <div class="flex md:flex-col items-center justify-between md:items-end flex-shrink-0 border-t border-border/40 md:border-none pt-3 md:pt-0 gap-3">
          <span class="px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isAbnormal ? 'bg-danger/10 text-danger border border-danger/20' : 'bg-success/10 text-success border border-success/20'}">
            ${r.status}
          </span>
          <button class="delete-report-btn text-white/30 hover:text-danger text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer" data-id="${r.id}" data-name="${r.reportName}">
            🗑️ Delete
          </button>
        </div>
      `;

      // Bind hash click
      card.querySelector('.record-hash-btn').addEventListener('click', (e) => {
        showHashDetailsModal(e.target.getAttribute('data-hash'));
      });

      // Bind delete click
      card.querySelector('.delete-report-btn').addEventListener('click', (e) => {
        const btn = e.currentTarget;
        showDeleteReportModal(btn.getAttribute('data-id'), btn.getAttribute('data-name'));
      });

      reportsContainer.appendChild(card);
    });
  }

  // ============ SEARCH / FILTER BINDINGS ============
  if (reportSearch) {
    reportSearch.addEventListener('input', () => renderReports());
  }
  if (reportFilterStatus) {
    reportFilterStatus.addEventListener('change', () => renderReports());
  }

  // ============ DELETE REPORT MODAL ============
  function showDeleteReportModal(id, name) {
    pendingDeleteId = id;
    pendingDeleteName = name;
    if (delModalTitle) delModalTitle.textContent = `Delete "${name}"?`;
    if (delModalDesc) delModalDesc.textContent = 'This action cannot be undone. The SHA-256 secured record will be permanently removed.';
    if (deleteModal) {
      deleteModal.style.display = 'flex';
      deleteModal.classList.remove('hidden');
    }
  }

  function hideDeleteModal() {
    pendingDeleteId = null;
    pendingDeleteName = null;
    if (deleteModal) {
      deleteModal.style.display = 'none';
      deleteModal.classList.add('hidden');
    }
  }

  if (delModalCancel) delModalCancel.addEventListener('click', hideDeleteModal);
  if (deleteModal) {
    deleteModal.addEventListener('click', (e) => {
      if (e.target === deleteModal) hideDeleteModal();
    });
  }

  if (delModalConfirm) {
    delModalConfirm.addEventListener('click', async () => {
      if (!pendingDeleteId) return;
      const id = pendingDeleteId;
      hideDeleteModal();
      try {
        await deleteDoc(doc(db, 'reports', id));
        showToast('Report deleted successfully', 'success');
      } catch (err) {
        console.error('Delete report error:', err);
        showToast('Failed to delete: ' + err.message, 'error');
      }
    });
  }

  // ============ HASH MODAL ============
  function showHashDetailsModal(hashValue) {
    if (!hashModal || !modalHash) return;
    modalHash.textContent = hashValue;
    hashModal.classList.remove('hidden');
    
    modalHash.onclick = () => {
      navigator.clipboard.writeText(hashValue)
        .then(() => showToast('Hash copied to clipboard! 📋', 'success'))
        .catch(() => showToast('Hold-press to select and copy', 'info'));
    };
  }

  function closeHashModal() {
    if (hashModal) hashModal.classList.add('hidden');
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeHashModal);
  if (hashModal) {
    hashModal.addEventListener('click', (e) => {
      if (e.target === hashModal) closeHashModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeHashModal();
      hideDeleteModal();
    }
  });

  // ============ GRANT DOCTOR ACCESS ============
  const doctorAccessForm = document.getElementById('doctorAccessForm');
  if (doctorAccessForm) {
    doctorAccessForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = doctorEmailInput.value.trim().toLowerCase();
      
      if (!email) {
        showToast("Please enter doctor's email", 'error');
        doctorEmailInput.focus();
        return;
      }
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!re.test(email)) {
        showToast('Please enter a valid email address', 'error');
        doctorEmailInput.focus();
        return;
      }
      if (email === currentUser.email.toLowerCase()) {
        showToast("You cannot grant access to yourself", 'error');
        return;
      }

      const originalText = grantBtn.innerHTML;
      grantBtn.disabled = true;
      grantBtn.innerHTML = '<span class="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white"></span>';

      try {
        // Check if already exists
        const q = query(
          collection(db, "doctor_access"),
          where("patientId", "==", currentUser.uid),
          where("doctorEmail", "==", email)
        );
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          showToast(`Dr. ${email} already has access`, 'warning');
          doctorEmailInput.value = '';
          return;
        }

        await addDoc(collection(db, "doctor_access"), {
          patientId: currentUser.uid,
          patientEmail: currentUser.email.toLowerCase(),
          doctorEmail: email,
          grantedAt: serverTimestamp()
        });

        showToast(`Access granted to ${email} ✅`, 'success');
        doctorEmailInput.value = '';
      } catch (err) {
        console.error('Grant failed:', err);
        showToast('Failed to grant access: ' + err.message, 'error');
      } finally {
        grantBtn.disabled = false;
        grantBtn.innerHTML = originalText;
      }
    });
  }

  // ============ LOAD AUTHORIZED DOCTORS ============
  function loadDoctors() {
    const q = query(
      collection(db, "doctor_access"),
      where("patientId", "==", currentUser.uid)
    );

    doctorsUnsubscribe = onSnapshot(q, (snapshot) => {
      if (!authorizedDoctorsList) return;
      authorizedDoctorsList.innerHTML = '';

      if (snapshot.empty) {
        authorizedDoctorsList.innerHTML = `
          <p class="text-xs text-white/30 text-center py-4">No doctors authorized yet.</p>
        `;
        return;
      }

      snapshot.forEach((accessDoc) => {
        const d = accessDoc.data();
        const docId = accessDoc.id;
        const email = d.doctorEmail;
        
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-3.5 bg-surface-2/80 border border-border rounded-xl gap-3 text-sm';
        item.innerHTML = `
          <div class="min-w-0">
            <h5 class="font-heading font-bold text-white/90 text-xs">👨‍⚕️ Doctor</h5>
            <p class="text-xs text-white/50 truncate font-mono mt-0.5">${email}</p>
          </div>
          <button class="revoke-btn text-xs text-danger font-bold hover:underline cursor-pointer flex-shrink-0 bg-danger/10 border border-danger/20 px-2.5 py-1.5 rounded-lg transition-colors" data-id="${docId}" data-email="${email}">
            Revoke
          </button>
        `;

        item.querySelector('.revoke-btn').addEventListener('click', (e) => {
          const btn = e.currentTarget;
          revokeAccess(btn.getAttribute('data-id'), btn.getAttribute('data-email'));
        });

        authorizedDoctorsList.appendChild(item);
      });
    }, (err) => {
      console.error('Load doctors failed:', err);
      if (authorizedDoctorsList) {
        authorizedDoctorsList.innerHTML = `
          <p class="text-xs text-danger/80 text-center py-4">Failed to load authorized list.</p>
        `;
      }
    });
  }

  // Revoke Access
  async function revokeAccess(id, email) {
    if (!confirm(`Revoke access for ${email}?`)) return;
    try {
      await deleteDoc(doc(db, "doctor_access", id));
      showToast(`Access revoked from ${email}`, 'success');
    } catch (err) {
      console.error('Revoke access error:', err);
      showToast('Failed to revoke access: ' + err.message, 'error');
    }
  }
});
