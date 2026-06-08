import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { showToast } from './toast.js';

let currentUser = null;
let userReports = [];
let selectedLanguage = 'English';

// Elements
const globalLoader = document.getElementById('global-loader');
const modeRecordsBtn = document.getElementById('mode-records');
const modeManualBtn = document.getElementById('mode-manual');
const recordsModeDiv = document.getElementById('records-mode');
const manualModeDiv = document.getElementById('manual-mode');

const reportsList = document.getElementById('reports-list');
const reportInput = document.getElementById('report-input');
const demoBtn = document.getElementById('demoBtn');

const runBtn1 = document.getElementById('runBtn1');
const runBtn2 = document.getElementById('runBtn2');

const stepsCard = document.getElementById('steps-card');
const resultCard = document.getElementById('result-card');

// ============ AUTH STATE ============
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace('login.html');
    return;
  }
  currentUser = user;
  if (globalLoader) globalLoader.classList.add('hidden');
  loadUserRecords();
});

// ============ LOAD PATIENT RECORDS ============
async function loadUserRecords() {
  try {
    const q = query(
      collection(db, "reports"),
      where("patientEmail", "==", currentUser.email.toLowerCase()),
      orderBy("date", "desc")
    );
    const snap = await getDocs(q);
    userReports = [];
    
    if (snap.empty) {
      reportsList.innerHTML = `
        <div class="text-center py-6 text-xs text-white/30 border border-dashed border-border rounded-xl">
          <span class="text-xl block mb-1">📭</span>
          <p>No medical records yet.</p>
          <p class="mt-2 text-accent"><a href="patient.html" class="hover:underline">+ Add your first record →</a></p>
        </div>`;
      return;
    }
    
    let html = '';
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      userReports.push({ id: docSnap.id, ...d });
      const isAbnormal = d.status === 'Abnormal';
      const dateStr = d.date ? d.date.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Recent';
      
      html += `
        <label class="flex items-start gap-3 p-3.5 bg-surface-2 border border-border hover:border-accent/40 rounded-xl cursor-pointer transition-colors select-none report-checkbox-item" for="rep-${docSnap.id}">
          <input type="checkbox" id="rep-${docSnap.id}" value="${docSnap.id}" class="w-4 h-4 mt-0.5 cursor-pointer accent-accent" data-id="${docSnap.id}">
          <div class="min-w-0 flex-1">
            <div class="font-heading font-bold text-xs text-white/95 flex items-center gap-1.5">
              ${d.reportName}
              <span class="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${isAbnormal ? 'bg-danger/10 text-danger border border-danger/25' : 'bg-success/10 text-success border border-success/25'}">${d.status}</span>
            </div>
            <div class="text-[10px] text-white/40 mt-1 truncate">${d.findings} • 📅 ${dateStr}</div>
          </div>
        </label>`;
    });
    
    reportsList.innerHTML = html;

    // Bind event listeners for checks
    document.querySelectorAll('#reports-list input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const label = e.target.closest('.report-checkbox-item');
        if (e.target.checked) {
          label.classList.add('border-accent', 'bg-accent/[0.03]');
        } else {
          label.classList.remove('border-accent', 'bg-accent/[0.03]');
        }
      });
    });

  } catch (err) {
    console.error('Load records error:', err);
    reportsList.innerHTML = `<p class="text-xs text-danger text-center py-6">Failed to load diagnostics logs.</p>`;
  }
}

// ============ MODE SWITCHING ============
function switchMode(mode) {
  modeRecordsBtn.classList.toggle('border-accent', mode === 'records');
  modeRecordsBtn.classList.toggle('text-accent', mode === 'records');
  modeRecordsBtn.classList.toggle('border-border', mode !== 'records');
  modeRecordsBtn.classList.toggle('text-white/50', mode !== 'records');
  
  modeManualBtn.classList.toggle('border-accent', mode === 'manual');
  modeManualBtn.classList.toggle('text-accent', mode === 'manual');
  modeManualBtn.classList.toggle('border-border', mode !== 'manual');
  modeManualBtn.classList.toggle('text-white/50', mode !== 'manual');

  if (mode === 'records') {
    recordsModeDiv.classList.remove('hidden');
    manualModeDiv.classList.add('hidden');
  } else {
    recordsModeDiv.classList.add('hidden');
    manualModeDiv.classList.remove('hidden');
  }
}

if (modeRecordsBtn) modeRecordsBtn.addEventListener('click', () => switchMode('records'));
if (modeManualBtn) modeManualBtn.addEventListener('click', () => switchMode('manual'));

// ============ LANG CHIP SELECTION ============
document.querySelectorAll('.lang-selector button').forEach(chip => {
  chip.addEventListener('click', (e) => {
    const activeChip = e.currentTarget;
    selectedLanguage = activeChip.getAttribute('data-lang');
    
    document.querySelectorAll('.lang-selector button').forEach(c => {
      c.classList.remove('bg-accent/15', 'border-accent', 'text-accent');
      c.classList.add('bg-surface-2', 'border-border', 'text-white/50');
    });
    
    // Find chips across both tabs and select the active lang
    document.querySelectorAll(`.lang-selector button[data-lang="${selectedLanguage}"]`).forEach(c => {
      c.classList.remove('bg-surface-2', 'border-border', 'text-white/50');
      c.classList.add('bg-accent/15', 'border-accent', 'text-accent');
    });
  });
});

// Try Demo
if (demoBtn) {
  demoBtn.addEventListener('click', () => {
    reportInput.value = `Hemoglobin: 8.5 g/dL\nBlood Sugar: 180 mg/dL\nBP: 145/95 mmHg\nWBC: 11000 /μL\nCholesterol: 240 mg/dL`;
    runAgentFromPaste();
  });
}

// Run from records
if (runBtn1) {
  runBtn1.addEventListener('click', () => {
    const checked = document.querySelectorAll('#reports-list input[type="checkbox"]:checked');
    if (checked.length === 0) {
      showToast('Select at least one record to analyze', 'warning');
      return;
    }

    let clinicalText = '';
    checked.forEach(cb => {
      const report = userReports.find(r => r.id === cb.getAttribute('data-id'));
      if (report) {
        clinicalText += `${report.reportName}: ${report.findings} (Status: ${report.status})\n`;
      }
    });

    runAIAnalysis(clinicalText, runBtn1);
  });
}

// Run from manual paste
if (runBtn2) {
  runBtn2.addEventListener('click', () => {
    const pasteData = reportInput.value.trim();
    if (!pasteData) {
      showToast('Paste report values first', 'warning');
      reportInput.focus();
      return;
    }
    runAIAnalysis(pasteData, runBtn2);
  });
}

function runAgentFromPaste() {
  const pasteData = reportInput.value.trim();
  if (pasteData) runAIAnalysis(pasteData, runBtn2);
}

// ============ RUN CORE AI ANALYSIS ============
async function runAIAnalysis(clinicalInput, activeBtn) {
  stepsCard.classList.remove('hidden');
  resultCard.classList.add('hidden');
  resultCard.innerHTML = '';
  resetSteps();
  stepsCard.scrollIntoView({ behavior: 'smooth' });

  activeBtn.disabled = true;
  const originalBtnHTML = activeBtn.innerHTML;
  activeBtn.innerHTML = '<span class="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-1.5"></span> Connecting to Secure API...';

  let currentStep = 0;
  let analysisFinished = false;

  function updateStepUI() {
    if (currentStep > 0 && currentStep <= 5) {
      const prevCircle = document.getElementById('s' + currentStep);
      const prevText = document.getElementById('t' + currentStep);
      if (prevCircle) { prevCircle.className = 'w-6 h-6 rounded-full bg-success text-bg flex items-center justify-center font-bold text-[10px]'; prevCircle.textContent = '✓'; }
      if (prevText) prevText.className = 'text-white/80 font-medium';
    }
    currentStep++;
    if (currentStep <= 5) {
      const activeCircle = document.getElementById('s' + currentStep);
      const activeText = document.getElementById('t' + currentStep);
      if (activeCircle) { activeCircle.className = 'w-6 h-6 rounded-full bg-accent/20 border-2 border-accent text-accent flex items-center justify-center font-bold text-[10px] animate-spin'; activeCircle.textContent = '⟳'; }
      if (activeText) activeText.className = 'text-accent font-semibold';
    }
  }

  updateStepUI(); // Step 1
  setTimeout(() => { if (!analysisFinished) updateStepUI(); }, 600); // Step 2
  setTimeout(() => { if (!analysisFinished) updateStepUI(); }, 1200); // Step 3

  try {
    const langDirective = selectedLanguage === 'Hindi' 
      ? 'Respond in Hindi using Devanagari script.'
      : selectedLanguage === 'Marathi'
      ? 'Respond in Marathi using Devanagari script.'
      : 'Respond in English.';

    const prompt = `You are a medical AI assistant helping a patient in India understand their health records. Be accurate, empathetic, and actionable.

Patient's Health Records:
${clinicalInput}

Provide analysis in this EXACT markdown format (use ** for bold, - for bullets):

## Summary
(2-3 lines: overall health snapshot)

## Key Findings
- **[Metric Name]:** [Value] — [brief note: critical/warning/normal and why]
- (repeat for each metric)

## Recommended Actions
- [Specific action 1]
- [Specific action 2]
- [Specific action 3]

## When to See a Doctor
(1-2 lines about urgency)

${langDirective} Keep it concise and practical. Don't diagnose — only highlight patterns and suggest consultation.`;

    // 🔴 NEW: Sending request to the secure backend instead of directly to Google API
    const response = await fetch(`/api/gemini`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt })
    });

    const resData = await response.json();
    
    if (!response.ok || resData.error) {
      throw new Error(resData.error || 'Server error occurred');
    }
    
    if (!resData.candidates || !resData.candidates[0]) {
      throw new Error('No candidate returned from AI');
    }

    const rawText = resData.candidates[0].content.parts[0].text;

    analysisFinished = true;
    while (currentStep <= 5) updateStepUI();

    // Safe HTML Rendering
    let safeHtml = rawText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    
    safeHtml = safeHtml.replace(/^## (.+)$/gm, '<h3 class="font-heading font-bold text-accent text-sm mt-4 mb-2">$1</h3>');
    safeHtml = safeHtml.replace(/\*\*(.*?)\*\*/g, '<strong class="text-accent font-semibold">$1</strong>');
    safeHtml = safeHtml.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-white/85 my-1">$1</li>');
    safeHtml = safeHtml.replace(/(<li class="ml-4 list-disc text-white\/85 my-1">.+?<\/li>\n?)+/g, (match) => `<ul class="my-2">${match.replace(/\n/g, '')}</ul>`);
    
    safeHtml = safeHtml.split(/\n\n+/).map(p => {
      p = p.trim();
      if (!p) return '';
      if (p.startsWith('<h3') || p.startsWith('<ul')) return p;
      return `<p class="my-2 text-xs leading-relaxed text-white/75">${p.replace(/\n/g, '<br>')}</p>`;
    }).join('');

    setTimeout(() => {
      resultCard.innerHTML = `
        <div class="flex justify-between items-center pb-3 border-b border-border mb-4">
          <h4 class="font-heading font-bold text-sm text-white">🤖 Secure AI Health Analysis</h4>
          <span class="px-2 py-0.5 bg-success/15 border border-success/30 text-success rounded text-[9px] font-bold">COMPLETE</span>
        </div>
        <div class="ai-output text-xs leading-relaxed">${safeHtml}</div>
        <div class="bg-yellow/5 border border-yellow/20 rounded-xl p-3.5 mt-5 leading-relaxed text-[10px] text-white/50">
          <strong>⚠️ Disclaimer:</strong> This clinical overview is for informational support only. Always coordinate diagnostic changes with a doctor.
        </div>
        <div class="grid grid-cols-3 gap-2 mt-5">
          <button class="py-2.5 bg-surface border border-border text-white/80 hover:text-white rounded-lg text-xs font-semibold cursor-pointer" id="copyResultBtn">📋 Copy</button>
          <button class="py-2.5 bg-[#25D366] text-white rounded-lg text-xs font-bold cursor-pointer" id="shareResultBtn">📲 Share</button>
          <button class="py-2.5 bg-surface border border-border text-danger hover:bg-danger/10 rounded-lg text-xs font-semibold cursor-pointer" id="clearResultBtn">🗑️ Clear</button>
        </div>`;
      
      resultCard.classList.remove('hidden');
      resultCard.scrollIntoView({ behavior: 'smooth' });
      showToast('Analysis completed securely!', 'success');

      // Bind result events
      document.getElementById('copyResultBtn').onclick = () => {
        const outTxt = document.querySelector('.ai-output').innerText;
        navigator.clipboard.writeText(outTxt).then(() => showToast('Copied to clipboard', 'success')).catch(() => showToast('Select to copy', 'info'));
      };

      document.getElementById('shareResultBtn').onclick = () => {
        const outTxt = document.querySelector('.ai-output').innerText;
        const wMsg = `*HealthChain AI Analysis* 🏥\n\n${outTxt}\n\n_⚠️ AI-generated clinical assistance._`;
        window.open(`https://wa.me/?text=${encodeURIComponent(wMsg)}`, '_blank');
      };

      document.getElementById('clearResultBtn').onclick = () => {
        resultCard.classList.add('hidden');
        stepsCard.classList.add('hidden');
        resetSteps();
        reportInput.value = '';
        document.querySelectorAll('#reports-list input[type="checkbox"]').forEach(c => {
          c.checked = false;
          c.closest('.report-checkbox-item')?.classList.remove('border-accent', 'bg-accent/[0.03]');
        });
        showToast('Result cleared', 'info');
      };
    }, 400);

  } catch (err) {
    console.error(err);
    analysisFinished = true;
    resultCard.innerHTML = `
      <div class="pb-3 border-b border-border mb-4">
        <h4 class="font-heading font-bold text-sm text-danger">❌ AI Analysis Failed</h4>
      </div>
      <p class="text-xs text-white/50 leading-relaxed">${err.message || 'Error connecting to Secure AI Backend.'}</p>
      <p class="text-[10px] text-white/35 mt-2">Check internet connection or server logs.</p>`;
    resultCard.classList.remove('hidden');
    showToast('AI analysis failed', 'error');
  } finally {
    activeBtn.disabled = false;
    activeBtn.innerHTML = originalBtnHTML;
  }
}

function resetSteps() {
  for (let i = 1; i <= 5; i++) {
    const s = document.getElementById('s' + i);
    const t = document.getElementById('t' + i);
    if (s) { s.className = 'w-6 h-6 rounded-full bg-border flex items-center justify-center font-bold text-[10px] text-white/50'; s.textContent = i; }
    if (t) t.className = 'text-white/45';
  }
}
