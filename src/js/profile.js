import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { showToast, getFriendlyError } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let selectedData = { gender: null, bloodGroup: null, conditions: [] };

  // Elements
  const globalLoader = document.getElementById('global-loader');
  const skipBtn = document.getElementById('skip-btn');
  const profileForm = document.getElementById('profileForm');
  const saveBtn = document.getElementById('saveBtn');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  
  // Fields
  const fullNameInput = document.getElementById('fullName');
  const dobInput = document.getElementById('dob');
  const mobileInput = document.getElementById('mobile');
  const pincodeInput = document.getElementById('pincode');
  const heightInput = document.getElementById('height');
  const weightInput = document.getElementById('weight');
  const allergiesInput = document.getElementById('allergies');
  const medicationsInput = document.getElementById('medications');
  const emergencyNameInput = document.getElementById('emergencyName');
  const emergencyPhoneInput = document.getElementById('emergencyPhone');
  const emergencyRelationInput = document.getElementById('emergencyRelation');

  // ============ AUTH STATE ============
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.replace('login.html');
      return;
    }
    currentUser = user;
    fullNameInput.value = user.displayName || '';
    
    await loadExistingProfile();
    if (globalLoader) globalLoader.classList.add('hidden');
    updateProgress();
  });

  // Skip profile setup
  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      if (confirm('Skip profile setup? You can complete it later from your dashboard.')) {
        window.location.replace('patient.html');
      }
    });
  }

  // ============ CHIP BINDINGS ============
  
  // Gender chips
  document.querySelectorAll('#gender-chips .chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      const activeChip = e.currentTarget;
      document.querySelectorAll('#gender-chips .chip').forEach(c => c.classList.remove('bg-accent/15', 'border-accent', 'text-accent'));
      activeChip.classList.add('bg-accent/15', 'border-accent', 'text-accent');
      selectedData.gender = activeChip.getAttribute('data-value');
      updateProgress();
    });
  });

  // Blood group chips
  document.querySelectorAll('#blood-chips .chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      const activeChip = e.currentTarget;
      document.querySelectorAll('#blood-chips .chip').forEach(c => c.classList.remove('bg-accent/15', 'border-accent', 'text-accent'));
      activeChip.classList.add('bg-accent/15', 'border-accent', 'text-accent');
      selectedData.bloodGroup = activeChip.getAttribute('data-value');
      updateProgress();
    });
  });

  // Condition chips (Multi-select)
  document.querySelectorAll('#conditions-chips .chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      const activeChip = e.currentTarget;
      const val = activeChip.getAttribute('data-value');
      
      activeChip.classList.toggle('bg-accent/15');
      activeChip.classList.toggle('border-accent');
      activeChip.classList.toggle('text-accent');

      if (activeChip.classList.contains('border-accent')) {
        if (!selectedData.conditions.includes(val)) {
          selectedData.conditions.push(val);
        }
      } else {
        selectedData.conditions = selectedData.conditions.filter(c => c !== val);
      }
      updateProgress();
    });
  });

  // ============ LOAD EXISTING PROFILE ============
  async function loadExistingProfile() {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(userRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.fullName) fullNameInput.value = data.fullName;
        if (data.dob) dobInput.value = data.dob;
        if (data.mobile) mobileInput.value = data.mobile;
        if (data.pincode) pincodeInput.value = data.pincode;
        if (data.height) heightInput.value = data.height;
        if (data.weight) weightInput.value = data.weight;
        if (data.allergies) allergiesInput.value = data.allergies;
        if (data.medications) medicationsInput.value = data.medications;
        if (data.emergencyName) emergencyNameInput.value = data.emergencyName;
        if (data.emergencyPhone) emergencyPhoneInput.value = data.emergencyPhone;
        if (data.emergencyRelation) emergencyRelationInput.value = data.emergencyRelation;
        
        // Restore gender chip
        if (data.gender) {
          selectedData.gender = data.gender;
          document.querySelectorAll('#gender-chips .chip').forEach(c => {
            if (c.getAttribute('data-value') === data.gender) {
              c.classList.add('bg-accent/15', 'border-accent', 'text-accent');
            }
          });
        }
        
        // Restore blood group chip
        if (data.bloodGroup) {
          selectedData.bloodGroup = data.bloodGroup;
          document.querySelectorAll('#blood-chips .chip').forEach(c => {
            if (c.getAttribute('data-value') === data.bloodGroup) {
              c.classList.add('bg-accent/15', 'border-accent', 'text-accent');
            }
          });
        }
        
        // Restore conditions chips
        if (data.conditions && Array.isArray(data.conditions)) {
          selectedData.conditions = data.conditions;
          document.querySelectorAll('#conditions-chips .chip').forEach(c => {
            if (data.conditions.includes(c.getAttribute('data-value'))) {
              c.classList.add('bg-accent/15', 'border-accent', 'text-accent');
            }
          });
        }
      }
    } catch (err) {
      console.error('Load profile error:', err);
    }
  }

  // ============ UPDATE PROGRESS ============
  function updateProgress() {
    const fields = [
      fullNameInput, dobInput, mobileInput, pincodeInput,
      heightInput, weightInput, allergiesInput, medicationsInput,
      emergencyNameInput, emergencyPhoneInput, emergencyRelationInput
    ];
    
    let filled = 0;
    const total = fields.length + 3; // +3 for gender, bloodGroup, conditions
    
    fields.forEach(f => {
      if (f && f.value.trim()) filled++;
    });
    
    if (selectedData.gender) filled++;
    if (selectedData.bloodGroup) filled++;
    if (selectedData.conditions.length > 0) filled++;
    
    const percent = Math.round((filled / total) * 100);
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressText) progressText.textContent = `${percent}% Complete`;
  }

  // Bind input listeners for real-time progress update
  const inputs = [
    fullNameInput, dobInput, mobileInput, pincodeInput,
    heightInput, weightInput, allergiesInput, medicationsInput,
    emergencyNameInput, emergencyPhoneInput, emergencyRelationInput
  ];
  
  inputs.forEach(input => {
    if (input) input.addEventListener('input', updateProgress);
  });

  // ============ SAVE PROFILE ============
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = fullNameInput.value.trim();
      const dob = dobInput.value;
      const mobile = mobileInput.value.trim();
      const emPhone = emergencyPhoneInput.value.trim();

      // Clear errors
      fullNameInput.classList.remove('border-danger');
      dobInput.classList.remove('border-danger');

      // Validate
      if (!name) {
        fullNameInput.classList.add('border-danger');
        showToast('Full name is required', 'error');
        fullNameInput.focus();
        return;
      }
      if (!dob) {
        dobInput.classList.add('border-danger');
        showToast('Date of birth is required', 'error');
        dobInput.focus();
        return;
      }
      if (!selectedData.gender) {
        showToast('Please select your gender', 'error');
        return;
      }
      if (mobile && !/^[0-9]{10}$/.test(mobile)) {
        mobileInput.classList.add('border-danger');
        showToast('Mobile number must be exactly 10 digits', 'error');
        mobileInput.focus();
        return;
      }
      if (emPhone && !/^[0-9]{10}$/.test(emPhone)) {
        emergencyPhoneInput.classList.add('border-danger');
        showToast('Emergency phone must be exactly 10 digits', 'error');
        emergencyPhoneInput.focus();
        return;
      }

      const originalBtnText = saveBtn.innerHTML;
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="inline-block animate-spin rounded-full h-4.5 w-4.5 border-2 border-white/30 border-t-white mr-2"></span> Saving...';

      try {
        const profileData = {
          uid: currentUser.uid,
          email: currentUser.email.toLowerCase(),
          fullName: name,
          dob: dob,
          gender: selectedData.gender,
          bloodGroup: selectedData.bloodGroup || null,
          mobile: mobile || null,
          pincode: pincodeInput.value.trim() || null,
          height: heightInput.value || null,
          weight: weightInput.value || null,
          allergies: allergiesInput.value.trim() || null,
          conditions: selectedData.conditions,
          medications: medicationsInput.value.trim() || null,
          emergencyName: emergencyNameInput.value.trim() || null,
          emergencyPhone: emPhone || null,
          emergencyRelation: emergencyRelationInput.value.trim() || null,
          profileComplete: true,
          updatedAt: serverTimestamp()
        };

        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(userRef, profileData, { merge: true });

        showToast('Profile saved successfully! 🎉', 'success');
        setTimeout(() => {
          window.location.replace('patient.html');
        }, 1500);
      } catch (err) {
        console.error('Save profile error:', err);
        showToast(getFriendlyError(err), 'error');
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
      }
    });
  }
});
