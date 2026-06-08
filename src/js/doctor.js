import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  query, 
  where, 
  orderBy 
} from 'firebase/firestore';
import { Html5Qrcode } from 'html5-qrcode';
import { showToast, getFriendlyError } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
  let currentDoctor = null;
  let currentPatientEmail = null;
  const uniquePatientsServed = new Set();
  let totalRecordsViewed = 0;
  // In-memory store for AI brief (structured data, not DOM text)
  let loadedReportsData = [];

  // Elements
  const globalLoader = document.getElementById('global-loader');
  const docBadge = document.getElementById('doc-badge');
  const logoutBtn = document.getElementById('logout-btn');
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const accessDeniedCard = document.getElementById('access-denied');
  const accessDeniedMsg = document.getElementById('access-denied-msg');
  const patientSection = document.getElementById('patient-section');
  const displayEmail = document.getElementById('display-email');
  const dynamicReports = document.getElementById('dynamic-reports');
  const totalPatientsEl = document.getElementById('total-patients');
  const totalRecordsEl = document.getElementById('total-records');

  // Scanner Elements
  const scannerModal = document.getElementById('scanner-modal');
  const scannerHeader = document.getElementById('scanner-header');
  const scannerStatusText = document.getElementById('scanner-status-text');
  const successFlash = document.getElementById('success-flash');
  const startScanBtn = document.getElementById('start-scan-btn');
  const cancelScanBtn = document.getElementById('cancel-scan-btn');

  // Prescription Elements
  const micBtn = document.getElementById('micBtn');
  const rxBox = document.getElementById('rx-box');
  const langSelect = document.getElementById('lang-select');
  const whatsappBtn = document.getElementById('whatsapp-btn');

  // Gemini API Elements
  const apiBanner = document.getElementById('api-banner');
  const apiKeyInput = document.getElementById('api-key-input');
  const saveKeyBtn = document.getElementById('save-key-btn');
  const aiBriefBtn = document.getElementById('aiBriefBtn');
  const aiBriefDiv = document.getElementById('ai-brief');

  // ============ AUTHENTICATION STATE ============
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentDoctor = user;
      const name = user.displayName || (user.email ? user.email.split('@')[0] : 'Doctor');
      if (docBadge) {
        docBadge.innerHTML = `
          <div class="w-7 h-7 bg-gradient-to-br from-success to-accent rounded-full flex items-center justify-center text-xs font-bold text-bg mr-2">
            ${name[0].toUpperCase()}
          </div>
          <span class="text-xs font-semibold text-white/80">Dr. ${name}</span>
        `;
      }
      if (globalLoader) globalLoader.classList.add('hidden');
      checkApiKey();
    } else {
      window.location.replace('login.html');
    }
  });

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm("Are you sure you want to logout?")) {
        signOut(auth).then(() => window.location.replace('login.html'));
      }
    });
  }

  // ============ GEMINI API KEY MANAGEMENT ============
  function checkApiKey() {
    const key = localStorage.getItem('hc_gemini_key');
    if (!key) {
      if (apiBanner) apiBanner.classList.remove('hidden');
    } else {
      if (apiBanner) apiBanner.classList.add('hidden');
      // Show obfuscated key in input placeholder
      if (apiKeyInput) apiKeyInput.placeholder = `Current: ${key.substring(0,8)}••••••••••••`;
    }
  }

  if (saveKeyBtn) {
    saveKeyBtn.addEventListener('click', () => {
      const key = apiKeyInput.value.trim();
      if (!key) {
        showToast('Please enter your API key', 'error');
        return;
      }
      if (!key.startsWith('AIza') || key.length < 30) {
        showToast('Invalid key format. Key should start with AIzaSy...', 'error');
        return;
      }
      localStorage.setItem('hc_gemini_key', key);
      if (apiBanner) apiBanner.classList.add('hidden');
      apiKeyInput.value = '';
      showToast('Gemini API key saved! Clinical Brief tool is ready.', 'success');
    });
  }

  // ============ QR SCANNER SYSTEM ============
  let html5QrcodeScanner = null;
  let scannerActive = false;

  function playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch(e) {}
  }

  function startScanner() {
    if (scannerModal) scannerModal.classList.remove('hidden');
    scannerActive = true;
    
    if (scannerHeader) {
      scannerHeader.classList.remove('text-success');
      scannerHeader.querySelector('h2').textContent = '⬡ SCANNING PATIENT QR';
      scannerHeader.querySelector('p').textContent = 'ALIGN QR CODE IN FRAME';
    }
    if (scannerStatusText) scannerStatusText.textContent = 'CAMERA ACTIVE — SCANNING...';

    html5QrcodeScanner = new Html5Qrcode("reader");
    html5QrcodeScanner.start(
      { facingMode: "environment" },
      { fps: 15, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 },
      (text) => {
        if (!scannerActive) return;
        scannerActive = false;
        onScanSuccess(text);
      },
      (errorMessage) => {
        // Silent error callback to avoid flooding console logs
      }
    ).catch((err) => {
      console.error('Scanner init failed:', err);
      if (scannerStatusText) scannerStatusText.textContent = 'CAMERA ERROR — CHECK PERMISSIONS';
      showToast('Camera access denied. Please grant permission.', 'error');
    });
  }

  function stopScanner() {
    scannerActive = false;
    if (html5QrcodeScanner) {
      html5QrcodeScanner.stop().catch(() => {});
      html5QrcodeScanner = null;
    }
    if (scannerModal) scannerModal.classList.add('hidden');
  }

  function onScanSuccess(text) {
    if (successFlash) {
      successFlash.classList.remove('hidden');
      setTimeout(() => successFlash.classList.add('hidden'), 400);
    }
    
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    playBeep();
    
    if (scannerHeader) {
      scannerHeader.classList.add('text-success');
      scannerHeader.querySelector('h2').textContent = '✓ QR DETECTED!';
      scannerHeader.querySelector('p').textContent = 'VERIFYING PERMISSIONS...';
    }
    if (scannerStatusText) scannerStatusText.textContent = '✓ SCAN SUCCESSFUL';

    let patientEmail = null;
    try {
      const parsed = JSON.parse(text.trim());
      if (parsed && parsed.platform === 'healthchain' && parsed.email) {
        patientEmail = parsed.email.toLowerCase();
      } else if (parsed && parsed.email) {
        patientEmail = parsed.email.toLowerCase();
      }
    } catch(e) {
      const trimmed = text.trim().toLowerCase();
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (re.test(trimmed)) {
        patientEmail = trimmed;
      }
    }

    if (!patientEmail) {
      setTimeout(() => {
        stopScanner();
        showToast('Invalid QR code. Not a HealthChain identity.', 'error');
      }, 1000);
      return;
    }

    setTimeout(() => {
      stopScanner();
      fetchPatientData(patientEmail);
    }, 800);
  }

  if (startScanBtn) startScanBtn.addEventListener('click', startScanner);
  if (cancelScanBtn) cancelScanBtn.addEventListener('click', stopScanner);

  // ============ MANUAL SEARCH ============
  function manualSearch() {
    const email = searchInput.value.trim().toLowerCase();
    
    if (!email) {
      searchInput.classList.add('border-danger');
      showToast("Please enter patient email", 'error');
      searchInput.focus();
      return;
    }
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) {
      searchInput.classList.add('border-danger');
      showToast("Please enter a valid email", 'error');
      searchInput.focus();
      return;
    }
    
    searchInput.classList.remove('border-danger');
    fetchPatientData(email);
  }

  // Bind manual search forms
  const searchForm = document.getElementById('searchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      manualSearch();
    });
  }

  // Clear search error
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchInput.classList.remove('border-danger');
    });
  }

  // ============ FETCH PATIENT DATA ============
  async function fetchPatientData(patientEmail) {
    if (!currentDoctor) {
      showToast('Please sign in again.', 'error');
      return;
    }

    patientSection.classList.add('hidden');
    accessDeniedCard.classList.add('hidden');
    aiBriefDiv.classList.remove('show');

    // Loading status on search button
    searchBtn.disabled = true;
    const originalBtnText = searchBtn.innerHTML;
    searchBtn.innerHTML = '<span class="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></span>';

    try {
      const doctorEmail = currentDoctor.email.toLowerCase();
      currentPatientEmail = patientEmail;

      // 🚨 STEP 1: CHECK DOCTOR PERMISSIONS IN doctor_access
      const accessQuery = query(
        collection(db, "doctor_access"),
        where("doctorEmail", "==", doctorEmail),
        where("patientEmail", "==", patientEmail)
      );
      const accessSnap = await getDocs(accessQuery);

      if (accessSnap.empty) {
        // No permission document
        accessDeniedCard.classList.remove('hidden');
        if (accessDeniedMsg) {
          accessDeniedMsg.innerHTML = `
            Patient <strong>${patientEmail}</strong> has not granted you access to their records.<br><br>
            Ask the patient to add your doctor account email <strong>${doctorEmail}</strong> in their dashboard.
          `;
        }
        accessDeniedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast('Access not authorized by patient', 'warning');
        return;
      }

      // Permission granted: load profile + reports
      patientSection.classList.remove('hidden');
      if (displayEmail) displayEmail.textContent = patientEmail;
      dynamicReports.innerHTML = `<p class="text-xs text-accent col-span-full">⏳ Loading authorized findings...</p>`;
      patientSection.scrollIntoView({ behavior: 'smooth' });

      // STEP 2: Fetch clinical reports
      const reportsQuery = query(
        collection(db, "reports"),
        where("patientEmail", "==", patientEmail),
        orderBy("date", "desc")
      );
      const reportsSnap = await getDocs(reportsQuery);

      if (reportsSnap.empty) {
        dynamicReports.innerHTML = `<p class="text-xs text-white/40 col-span-full py-4">No records stored for this patient.</p>`;
        loadedReportsData = [];
        return;
      }

      // Store structured data for AI brief
      loadedReportsData = [];
      let reportsHtml = '';
      reportsSnap.forEach((reportDoc) => {
        const d = reportDoc.data();
        loadedReportsData.push(d);
        const hash = d.recordHash || '';
        const shortHash = hash ? hash.substring(0, 14) + '...' : 'N/A';
        const isAbnormal = d.status === 'Abnormal';
        
        reportsHtml += `
          <div class="bg-bg border border-border p-4 rounded-xl flex flex-col justify-between">
            <div>
              <span class="bg-accent-2/15 text-accent-2 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider block w-max mb-2">
                ${d.category || 'Record'}
              </span>
              <h5 class="text-xs font-semibold text-white/50 mb-1.5">${d.reportName}</h5>
              <div class="text-base font-bold tracking-tight mb-2 ${isAbnormal ? 'text-danger' : 'text-success'}">${d.findings}</div>
            </div>
            <div class="border-t border-border/50 pt-2 flex items-center justify-between text-[10px] text-white/30 font-mono">
              <span>Status: ${d.status}</span>
              <span title="${hash}">🔗 ${shortHash}</span>
            </div>
          </div>`;
      });
      
      dynamicReports.innerHTML = reportsHtml;

      // Update counters
      uniquePatientsServed.add(patientEmail);
      totalRecordsViewed += reportsSnap.size;
      
      if (totalPatientsEl) totalPatientsEl.textContent = uniquePatientsServed.size;
      if (totalRecordsEl) totalRecordsEl.textContent = totalRecordsViewed;

      showToast(`Fetched ${reportsSnap.size} patient clinical records`, 'success');
    } catch (err) {
      console.error('Fetch patient data error:', err);
      dynamicReports.innerHTML = `<p class="text-xs text-danger col-span-full">Error retrieving logs: ${err.message}</p>`;
      showToast('Database read failed', 'error');
    } finally {
      searchBtn.disabled = false;
      searchBtn.innerHTML = originalBtnText;
    }
  }

  // ============ SPEECH DICTATION SYSTEM ============
  let recognizing = false;
  let recognition = null;
  let currentLang = 'en-IN';

  function initSpeech() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      return false;
    }
    const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = currentLang;

    recognition.onstart = () => {
      recognizing = true;
      if (micBtn) {
        micBtn.classList.add('animate-pulse', 'bg-red-600');
        micBtn.textContent = '🔴 Dictating...';
      }
    };

    recognition.onresult = (e) => {
      let resultText = '';
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) {
          resultText += e.results[i][0].transcript;
        }
      }
      if (resultText && rxBox) {
        rxBox.value += resultText + " ";
      }
    };

    recognition.onend = () => {
      recognizing = false;
      if (micBtn) {
        micBtn.classList.remove('animate-pulse', 'bg-red-600');
        micBtn.textContent = '🎤 Tap to Dictate';
      }
    };

    recognition.onerror = (e) => {
      recognizing = false;
      if (micBtn) {
        micBtn.classList.remove('animate-pulse', 'bg-red-600');
        micBtn.textContent = '🎤 Tap to Dictate';
      }
      if (e.error !== 'no-speech') {
        showToast('Dictation error: ' + e.error, 'error');
      }
    };

    return true;
  }

  initSpeech();

  if (langSelect) {
    langSelect.addEventListener('change', () => {
      currentLang = langSelect.value;
      if (recognition) {
        recognition.lang = currentLang;
      }
      const label = langSelect.options[langSelect.selectedIndex].text;
      showToast(`Language switched: ${label}`, 'info');
    });
  }

  if (micBtn) {
    micBtn.addEventListener('click', () => {
      if (!recognition) {
        showToast('Web Speech API is not supported on this browser. Try Chrome.', 'error');
        return;
      }
      if (recognizing) {
        recognition.stop();
        return;
      }
      try {
        recognition.start();
      } catch (e) {
        showToast('Speech recognition failed to start. Retry.', 'error');
      }
    });
  }

  // ============ WHATSAPP PRESCRIPTION FORWARDING ============
  if (whatsappBtn) {
    whatsappBtn.addEventListener('click', () => {
      const rxText = rxBox.value.trim();
      if (!rxText) {
        showToast('Please dictate or type a prescription first', 'warning');
        rxBox.focus();
        return;
      }
      const docName = currentDoctor.displayName || currentDoctor.email.split('@')[0];
      const patient = currentPatientEmail || 'Patient';
      
      const whatsappMsg = `*HealthChain E-Prescription* 🏥\n\n👨‍⚕️ *Doctor:* Dr. ${docName}\n👤 *Patient:* ${patient}\n📅 *Date:* ${new Date().toLocaleDateString('en-IN')}\n\n*Prescription:*\n${rxText}\n\n_— Secured with SHA-256 record integrity hashing_\n_HealthChain Platform_`;
      window.open(`https://wa.me/?text=${encodeURIComponent(whatsappMsg)}`, '_blank');
    });
  }

  // ============ CLINICAL BRIEF GENERATION (GEMINI) ============
  if (aiBriefBtn) {
    aiBriefBtn.addEventListener('click', async () => {
      if (loadedReportsData.length === 0) {
        showToast('Fetch patient records first.', 'warning');
        return;
      }

      const apiKey = localStorage.getItem('hc_gemini_key');
      if (!apiKey) {
        if (apiBanner) apiBanner.classList.remove('hidden');
        showToast('Please set your Gemini API key.', 'warning');
        if (apiKeyInput) apiKeyInput.focus();
        return;
      }

      const originalBtnText = aiBriefBtn.innerHTML;
      aiBriefBtn.disabled = true;
      aiBriefBtn.innerHTML = '<span class="inline-block animate-spin rounded-full h-4.5 w-4.5 border-2 border-white/30 border-t-white mr-2"></span> Generating...';

      if (aiBriefDiv) {
        aiBriefDiv.classList.add('show');
        aiBriefDiv.innerHTML = `
          <h4 class="font-heading font-bold text-accent mb-3 flex items-center gap-2">🤖 Clinical Brief Analysis</h4>
          <p class="text-xs text-white/50 animate-pulse">Gemini AI is analyzing records... ⏳</p>
        `;
        aiBriefDiv.scrollIntoView({ behavior: 'smooth' });
      }

      try {
        // Build structured prompt from in-memory data (not DOM text)
        if (loadedReportsData.length === 0) {
          showToast('No report data loaded. Fetch patient first.', 'warning');
          if (aiBriefDiv) aiBriefDiv.classList.remove('show');
          return;
        }

        const recordsText = loadedReportsData.map((r, i) =>
          `Record ${i + 1}: ${r.category || 'General'} — ${r.reportName}\nFindings: ${r.findings}\nStatus: ${r.status}\nDate: ${r.date?.toDate?.()?.toLocaleDateString('en-IN') || 'Unknown'}`
        ).join('\n\n');

        const prompt = `You are a medical AI assistant helping a doctor quickly understand a patient's health records.

Patient Records (Structured):
${recordsText}

Provide a professional clinical brief in this exact format:

**Risk Summary:** (2 lines max, highlight critical concerns)

**Recommended Actions:**
- Action 1 (specific and actionable)
- Action 2 (specific and actionable)
- Action 3 (specific and actionable)

**Follow-up:** (1 line suggesting timing)

Keep it concise, medically accurate, and in English. Don't speculate beyond the data provided.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            safetySettings: [
              { category: "HARM_CATEGORY_MEDICAL", threshold: "BLOCK_NONE" }
            ]
          })
        });

        const data = await response.json();

        if (data.error) throw new Error(data.error.message);
        if (!data.candidates || !data.candidates[0]) throw new Error('No candidates returned');

        const analysisText = data.candidates[0].content.parts[0].text;

        // Render Markdown highlights
        let parsedHtml = analysisText
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
        
        parsedHtml = parsedHtml.replace(/\*\*(.*?)\*\*/g, '<strong class="text-accent font-semibold">$1</strong>');
        parsedHtml = parsedHtml.replace(/\n/g, '<br>');
        parsedHtml = parsedHtml.replace(/(?:^|<br>)- (.+?)(?=<br>|$)/g, '<li class="ml-4 list-disc text-white/80 my-1">$1</li>');
        parsedHtml = parsedHtml.replace(/(<li class="ml-4 list-disc text-white\/80 my-1">.+?<\/li>)+/g, '<ul class="my-2">$1</ul>');

        if (aiBriefDiv) {
          aiBriefDiv.innerHTML = `
            <h4 class="font-heading font-bold text-accent mb-3 flex items-center gap-2">🤖 Clinical Brief Analysis</h4>
            <div class="text-xs leading-relaxed text-white/80">${parsedHtml}</div>
            <p class="mt-4 pt-3 border-t border-border/50 text-[10px] text-white/45">⚠️ AI-generated analysis — verify with standard diagnostic practices.</p>
          `;
        }
        showToast('Clinical brief created', 'success');
      } catch (err) {
        console.error('AI brief failure:', err);
        if (aiBriefDiv) {
          aiBriefDiv.innerHTML = `
            <h4 class="font-heading font-bold text-danger mb-3">❌ Analysis Generation Failed</h4>
            <p class="text-xs text-white/65">${err.message || 'Unknown server error.'}</p>
            <p class="text-[10px] text-white/45 mt-2">Check your API Key settings.</p>
          `;
        }
        showToast('Failed to create Brief', 'error');
      } finally {
        aiBriefBtn.disabled = false;
        aiBriefBtn.innerHTML = originalBtnText;
      }
    });
  }

  // Keyboard shortcut listener to close scanner modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && scannerModal && !scannerModal.classList.contains('hidden')) {
      stopScanner();
    }
  });
});
