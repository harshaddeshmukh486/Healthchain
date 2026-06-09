import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { showToast } from './toast.js';
import { connectWallet, storeHashOnBlockchain } from './web3.js';

document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let userBlocks = [];

  const blocksContainer = document.getElementById('blocks-container');
  const totalBlocksEl = document.getElementById('total-blocks');
  const verifiedCountEl = document.getElementById('verified-count');
  const tamperedCountEl = document.getElementById('tampered-count');
  const verifyInput = document.getElementById('verify-input');
  const verifyBtn = document.getElementById('verifyBtn');
  const verifyResult = document.getElementById('verify-result');
  const connectWalletBtn = document.getElementById('connectWalletBtn');
  const walletStatus = document.getElementById('wallet-status');

  if (connectWalletBtn) {
    connectWalletBtn.addEventListener('click', async () => {
      const address = await connectWallet();
      if (address && address !== "NO_METAMASK") {
        connectWalletBtn.classList.add('hidden');
        walletStatus.classList.remove('hidden');
        walletStatus.textContent = `Connected: ${address.substring(0,6)}...${address.substring(38)}`;
      }
    });
  }

  // Utility
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function shortHash(hash, len = 16) {
    if (!hash) return 'N/A';
    return hash.substring(0, len) + '...';
  }

  async function generateRealHash(data) {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Auth check
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.replace('login.html');
      return;
    }
    currentUser = user;
    buildChain();
  });

  async function buildChain() {
    if (!blocksContainer) return;
    
    try {
      const q = query(
        collection(db, "reports"),
        where("patientEmail", "==", currentUser.email.toLowerCase()),
        orderBy("date", "asc")
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        blocksContainer.innerHTML = `
          <div class="text-center py-10 border border-dashed border-border rounded-2xl bg-surface">
            <span class="text-4xl block mb-3 opacity-50">📭</span>
            <h3 class="font-heading font-bold text-lg text-white mb-2">Your Chain is Empty</h3>
            <p class="text-sm text-white/50 mb-4">Add your first health record to start building your chain.</p>
            <a href="patient.html" class="text-accent hover:underline text-sm font-bold">+ Add First Record →</a>
          </div>`;
        if (totalBlocksEl) totalBlocksEl.textContent = '0';
        if (verifiedCountEl) verifiedCountEl.textContent = '0';
        if (tamperedCountEl) tamperedCountEl.textContent = '0';
        return;
      }

      const GENESIS_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';
      let previousHash = GENESIS_HASH;
      let verifiedCount = 0;
      let tamperedCount = 0;
      userBlocks = [];

      let html = `
        <div class="flex flex-col">
          <div class="glass-panel p-6 rounded-2xl border border-accent-2/40 bg-accent-2/5 transition-colors hover:border-accent-2/60">
            <div class="flex justify-between items-start mb-3 gap-3 flex-wrap">
              <div class="flex-1 min-w-0">
                <div class="font-heading font-extrabold text-xs text-white/50 mb-1">GENESIS BLOCK #0</div>
                <div class="font-heading font-bold text-base text-white">HealthChain Initialized</div>
                <div class="text-[10px] text-white/40 mt-0.5">Start of your medical timeline</div>
              </div>
              <span class="bg-success/10 text-success border border-success/30 px-3 py-1 rounded-full text-[10px] font-bold shrink-0">✅ Verified</span>
            </div>
            <div class="mt-4">
              <div class="text-[9px] text-white/40 mb-1 tracking-wider uppercase font-bold">Hash</div>
              <div class="font-mono text-[10px] text-accent bg-bg border border-border rounded-lg p-2.5 break-all cursor-pointer hover:border-accent transition-colors copy-hash-btn" data-hash="${GENESIS_HASH}" title="Click to copy">${GENESIS_HASH}</div>
            </div>
          </div>
          <div class="flex justify-center py-2">
            <div class="w-0.5 h-8 bg-gradient-to-b from-accent-2 to-accent opacity-40"></div>
          </div>
      `;

      let blockNum = 0;
      const docs = [];
      snap.forEach(doc => docs.push(doc));

      for (let i = 0; i < docs.length; i++) {
        const docSnap = docs[i];
        blockNum++;
        const d = docSnap.data();
        const storedHash = d.recordHash || d.blockchainHash || null;

        let computedHash = null;
        let isVerified = true;

        if (d.createdAt && d.hashAlgorithm === 'SHA-256') {
          const hashInput = JSON.stringify({
            patient: d.patientEmail,
            reportName: d.reportName,
            findings: d.findings,
            status: d.status,
            category: d.category, // Added category to match patient.js
            createdAt: d.createdAt
          });
          computedHash = await generateRealHash(hashInput);
          isVerified = computedHash === storedHash;
        }

        if (isVerified) verifiedCount++;
        else tamperedCount++;

        const dateStr = d.date ? d.date.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent';
        const displayHash = storedHash || 'No hash (legacy record)';

        userBlocks.push({
          blockNum,
          reportName: d.reportName,
          findings: d.findings,
          status: d.status,
          hash: storedHash,
          prevHash: previousHash,
          date: dateStr,
          verified: isVerified
        });

        const cardBorderClass = isVerified ? 'border-border hover:border-accent/30' : 'border-danger/50 bg-danger/5 hover:border-danger/70';
        const badgeHtml = isVerified 
          ? `<span class="bg-success/10 text-success border border-success/30 px-3 py-1 rounded-full text-[10px] font-bold shrink-0">✅ Verified</span>`
          : `<span class="bg-danger/10 text-danger border border-danger/30 px-3 py-1 rounded-full text-[10px] font-bold shrink-0">⚠️ Tamper Detected</span>`;

        const web3BtnHtml = isVerified && storedHash ? `
            <div class="mt-4 pt-4 border-t border-border flex justify-end">
              <button class="store-web3-btn px-4 py-2 bg-gradient-to-r from-accent to-accent-2 text-white text-[10px] font-bold rounded-lg hover:shadow-lg hover:shadow-accent/20 transition-all cursor-pointer flex items-center gap-2" data-hash="${escapeHtml(storedHash)}" data-uid="${escapeHtml(currentUser.uid)}">
                🦊 Store on Polygon
              </button>
            </div>
        ` : '';

        html += `
          <div class="glass-panel p-6 rounded-2xl border transition-colors ${cardBorderClass}">
            <div class="flex justify-between items-start mb-3 gap-3 flex-wrap">
              <div class="flex-1 min-w-0">
                <div class="font-heading font-extrabold text-xs text-white/50 mb-1">BLOCK #${blockNum}</div>
                <div class="font-heading font-bold text-base text-white break-words">${escapeHtml(d.reportName || 'Untitled')}</div>
                <div class="text-[10px] text-white/40 mt-0.5">${escapeHtml(dateStr)}</div>
              </div>
              ${badgeHtml}
            </div>
            
            <div class="text-xs text-white/60 mb-4 leading-relaxed">
              <strong class="text-white/80">Findings:</strong> ${escapeHtml(d.findings || 'N/A')}<br>
              <strong class="text-white/80">Status:</strong> ${escapeHtml(d.status || 'Normal')}
            </div>
            
            <div>
              <div class="text-[9px] text-white/40 mb-1 tracking-wider uppercase font-bold">Hash</div>
              <div class="font-mono text-[10px] text-accent bg-bg border border-border rounded-lg p-2.5 break-all cursor-pointer hover:border-accent transition-colors copy-hash-btn" data-hash="${escapeHtml(storedHash || '')}" title="Click to copy">${escapeHtml(displayHash)}</div>
            </div>
            
            <div class="mt-2">
              <div class="text-[9px] text-white/40 mb-1 tracking-wider uppercase font-bold">Prev Hash</div>
              <div class="font-mono text-[10px] text-accent-2 bg-bg border border-border rounded-lg p-2.5 break-all cursor-pointer hover:border-accent-2 transition-colors copy-hash-btn" data-hash="${escapeHtml(previousHash)}" title="Click to copy">${escapeHtml(shortHash(previousHash, 32))}</div>
            </div>
            
            ${!isVerified ? `
            <div class="mt-3 p-3 bg-danger/10 border border-danger/20 rounded-xl text-xs text-danger leading-relaxed">
              ⚠️ <strong class="font-bold">Tamper Alert:</strong> Stored hash does not match computed hash. Record may have been modified maliciously.
            </div>` : ''}
            
            ${web3BtnHtml}
          </div>
        `;

        if (i < docs.length - 1) {
          html += `<div class="flex justify-center py-2"><div class="w-0.5 h-8 bg-gradient-to-b from-accent to-accent opacity-40"></div></div>`;
        }

        previousHash = storedHash || previousHash;
      }

      html += `</div>`;
      blocksContainer.innerHTML = html;

      // Add copy listeners
      document.querySelectorAll('.copy-hash-btn').forEach(el => {
        el.addEventListener('click', (e) => {
          const h = e.currentTarget.getAttribute('data-hash');
          if (h) {
            navigator.clipboard.writeText(h).then(() => showToast('Hash copied to clipboard! 📋', 'success'))
              .catch(() => showToast('Hold-press to select', 'info'));
          }
        });
      });

      // Add Web3 store listeners
      document.querySelectorAll('.store-web3-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const h = e.currentTarget.getAttribute('data-hash');
          const uid = e.currentTarget.getAttribute('data-uid');
          
          e.currentTarget.disabled = true;
          const originalText = e.currentTarget.innerHTML;
          e.currentTarget.innerHTML = '⏳ Processing...';
          
          const result = await storeHashOnBlockchain(uid, h);
          if (result && result.success) {
            e.currentTarget.innerHTML = '✅ Secured On-Chain';
            e.currentTarget.classList.replace('from-accent', 'from-success');
            e.currentTarget.classList.replace('to-accent-2', 'to-success');
          } else {
            e.currentTarget.disabled = false;
            e.currentTarget.innerHTML = originalText;
          }
        });
      });

      if (totalBlocksEl) totalBlocksEl.textContent = blockNum;
      if (verifiedCountEl) verifiedCountEl.textContent = verifiedCount;
      if (tamperedCountEl) tamperedCountEl.textContent = tamperedCount;

      if (tamperedCount > 0) {
        showToast(`⚠️ ${tamperedCount} tampered record(s) detected!`, 'error');
      } else if (blockNum > 0) {
        showToast(`Chain verified securely! 🔐`, 'success');
      }

    } catch (err) {
      console.error('Build chain error:', err);
      blocksContainer.innerHTML = `
        <div class="text-center py-10 border border-danger/30 rounded-2xl bg-danger/5">
          <span class="text-3xl block mb-3 opacity-80">⚠️</span>
          <h3 class="font-heading font-bold text-base text-danger mb-2">Could not load chain</h3>
          <p class="text-xs text-danger/80">${escapeHtml(err.message || 'Please refresh the page.')}</p>
        </div>`;
      showToast('Failed to load ledger', 'error');
    }
  }

  // Verification Logic
  if (verifyBtn && verifyInput) {
    verifyBtn.addEventListener('click', () => {
      const input = verifyInput.value.trim();
      
      if (!input) {
        showToast('Please enter a hash to verify', 'error');
        verifyInput.focus();
        return;
      }

      verifyBtn.disabled = true;
      const originalText = verifyBtn.innerHTML;
      verifyBtn.innerHTML = '<span class="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white mr-2"></span> Verifying...';

      setTimeout(() => {
        const normalizedInput = input.toLowerCase();
        verifyResult.className = 'mt-4 p-4 rounded-xl text-sm leading-relaxed hidden';
        verifyResult.innerHTML = '';
        verifyResult.classList.remove('hidden');

        if (normalizedInput === '0x0000000000000000000000000000000000000000000000000000000000000000' || normalizedInput === '0x0000000000000000') {
          verifyResult.classList.add('bg-accent/10', 'border', 'border-accent/20', 'text-accent', 'block');
          verifyResult.innerHTML = `ℹ️ <strong>Genesis Block</strong> — This is the starting block of your chain.`;
        } else {
          const match = userBlocks.find(b => b.hash && b.hash.toLowerCase() === normalizedInput);
          if (match) {
            if (match.verified) {
              verifyResult.classList.add('bg-success/10', 'border', 'border-success/30', 'text-success', 'block');
              verifyResult.innerHTML = `
                ✅ <strong>Verified!</strong> This hash belongs to your chain and integrity is intact.
                <div class="mt-3 pt-3 border-t border-success/30 opacity-90 text-[11px] leading-relaxed">
                  <strong>Block #${match.blockNum}:</strong> ${escapeHtml(match.reportName)}<br>
                  <strong>Date:</strong> ${escapeHtml(match.date)}<br>
                  <strong>Status:</strong> ${escapeHtml(match.status)}
                </div>`;
            } else {
              verifyResult.classList.add('bg-danger/10', 'border', 'border-danger/30', 'text-danger', 'block');
              verifyResult.innerHTML = `
                ⚠️ <strong>Tamper Alert!</strong> This hash exists but the record has been modified maliciously.
                <div class="mt-3 pt-3 border-t border-danger/30 opacity-90 text-[11px] leading-relaxed">
                  <strong>Block #${match.blockNum}:</strong> ${escapeHtml(match.reportName)}<br>
                  Stored hash does not match the computed hash.
                </div>`;
            }
          } else {
            verifyResult.classList.add('bg-danger/10', 'border', 'border-danger/30', 'text-danger', 'block');
            verifyResult.innerHTML = `❌ <strong>Not Found!</strong> This hash does not belong to any record in your chain.`;
          }
        }

        verifyBtn.disabled = false;
        verifyBtn.innerHTML = originalText;
      }, 600);
    });

    verifyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        verifyBtn.click();
      }
    });
  }
});
