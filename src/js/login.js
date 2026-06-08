import { auth, db } from './firebase.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signInWithRedirect, 
  getRedirectResult, 
  onAuthStateChanged, 
  GoogleAuthProvider 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { showToast, getFriendlyError } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
  const globalLoader = document.getElementById('global-loader');
  const loaderText = document.getElementById('loader-text');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const googleBtn = document.getElementById('googleBtn');
  const passwordToggle = document.getElementById('passwordToggle');
  const authForm = document.getElementById('authForm');

  let selectedRole = localStorage.getItem('selectedRole') || 'patient';
  selectRole(selectedRole);

  // Flag to prevent race condition between getRedirectResult and onAuthStateChanged
  let redirectHandled = false;

  // ============ ROLE SELECTION ============
  function selectRole(role) {
    selectedRole = role;
    localStorage.setItem('selectedRole', role);
    
    const patientCard = document.getElementById('patient-card');
    const doctorCard = document.getElementById('doctor-card');
    const loginTitle = document.getElementById('login-title');
    
    if (patientCard && doctorCard) {
      patientCard.classList.toggle('border-accent', role === 'patient');
      patientCard.classList.toggle('shadow-accent/10', role === 'patient');
      patientCard.classList.toggle('border-border', role !== 'patient');
      patientCard.setAttribute('aria-checked', role === 'patient');
      
      doctorCard.classList.toggle('border-accent', role === 'doctor');
      doctorCard.classList.toggle('shadow-accent/10', role === 'doctor');
      doctorCard.classList.toggle('border-border', role !== 'doctor');
      doctorCard.setAttribute('aria-checked', role === 'doctor');
      
      // Update checkmark visibility
      const patientCheck = patientCard.querySelector('.selected-badge');
      const doctorCheck = doctorCard.querySelector('.selected-badge');
      if (patientCheck) patientCheck.style.opacity = role === 'patient' ? '1' : '0';
      if (doctorCheck) doctorCheck.style.opacity = role === 'doctor' ? '1' : '0';
    }
    
    if (loginTitle) {
      loginTitle.textContent = `Login as a ${role.charAt(0).toUpperCase() + role.slice(1)}`;
    }
  }

  // Bind role selectors
  window.selectRole = selectRole;
  
  const patientCard = document.getElementById('patient-card');
  const doctorCard = document.getElementById('doctor-card');
  if (patientCard) {
    patientCard.addEventListener('click', () => selectRole('patient'));
    patientCard.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectRole('patient');
      }
    });
  }
  if (doctorCard) {
    doctorCard.addEventListener('click', () => selectRole('doctor'));
    doctorCard.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectRole('doctor');
      }
    });
  }

  // ============ PASSWORD TOGGLE ============
  if (passwordToggle) {
    passwordToggle.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      passwordToggle.textContent = isPassword ? '🙈' : '👁';
      passwordToggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
  }

  // ============ BUTTON LOADING STATES ============
  function setButtonLoading(btn, isLoading) {
    if (isLoading) {
      btn.disabled = true;
      btn.dataset.original = btn.innerHTML;
      btn.innerHTML = '<span class="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2"></span> Please wait...';
    } else {
      btn.disabled = false;
      if (btn.dataset.original) btn.innerHTML = btn.dataset.original;
    }
  }

  // ============ 1. CATCH GOOGLE REDIRECT RESULT ============
  getRedirectResult(auth).then((result) => {
    if (result && result.user) {
      redirectHandled = true;
      const u = result.user;
      if (loaderText) loaderText.textContent = "Setting up your profile...";
      if (globalLoader) globalLoader.classList.remove('hidden');
      
      const userRef = doc(db, "users", u.uid);
      setDoc(userRef, {
        uid: u.uid, 
        email: u.email.toLowerCase(), 
        name: u.displayName || "User", 
        role: selectedRole,
        lastLogin: serverTimestamp()
      }, { merge: true }).then(() => {
        window.location.replace(selectedRole === 'patient' ? 'patient.html' : 'doctor.html');
      }).catch((err) => {
        if (globalLoader) globalLoader.classList.add('hidden');
        showToast(getFriendlyError(err), 'error');
      });
    }
  }).catch((err) => {
    if (globalLoader) globalLoader.classList.add('hidden');
    if (err.code && err.code !== 'auth/popup-closed-by-user') {
      showToast(getFriendlyError(err), 'error');
    }
  });

  // ============ 2. CHECK LOGIN STATUS (auto-redirect) ============
  onAuthStateChanged(auth, (user) => {
    // Don't redirect if getRedirectResult is handling it (race condition guard)
    if (redirectHandled) return;

    if (user) {
      const userRef = doc(db, "users", user.uid);
      getDoc(userRef).then((docSnap) => {
        const savedRole = docSnap.exists() && docSnap.data().role ? docSnap.data().role : selectedRole;
        window.location.replace(savedRole === 'patient' ? 'patient.html' : 'doctor.html');
      }).catch(() => {
        // Fallback if Firestore fails
        window.location.replace(selectedRole === 'patient' ? 'patient.html' : 'doctor.html');
      });
    } else {
      setTimeout(() => {
        if (globalLoader) globalLoader.classList.add('hidden');
      }, 500);
    }
  });

  // ============ 3. GOOGLE LOGIN ============
  if (googleBtn) {
    googleBtn.addEventListener('click', () => {
      if (globalLoader) {
        globalLoader.classList.remove('hidden');
        if (loaderText) loaderText.textContent = "Connecting to Google...";
      }
      import('firebase/auth').then(({ signInWithPopup }) => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).then((result) => {
          redirectHandled = true;
          const u = result.user;
          if (loaderText) loaderText.textContent = "Setting up your profile...";
          
          const userRef = doc(db, "users", u.uid);
          setDoc(userRef, {
            uid: u.uid, 
            email: u.email.toLowerCase(), 
            name: u.displayName || "User", 
            role: selectedRole,
            lastLogin: serverTimestamp()
          }, { merge: true }).then(() => {
            window.location.replace(selectedRole === 'patient' ? 'patient.html' : 'doctor.html');
          }).catch((err) => {
            if (globalLoader) globalLoader.classList.add('hidden');
            showToast(getFriendlyError(err), 'error');
          });
        }).catch((err) => {
          if (globalLoader) globalLoader.classList.add('hidden');
          if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
            showToast(getFriendlyError(err), 'error');
          }
        });
      });
    });
  }

  // ============ Validation helper ============
  function validateInputs(email, pass) {
    let isValid = true;
    
    // Clear previous errors
    emailInput.classList.remove('border-danger');
    passwordInput.classList.remove('border-danger');

    if (!email) {
      emailInput.classList.add('border-danger');
      showToast('Email is required', 'error');
      emailInput.focus();
      return false;
    }
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) {
      emailInput.classList.add('border-danger');
      showToast('Please enter a valid email', 'error');
      emailInput.focus();
      return false;
    }
    if (!pass) {
      passwordInput.classList.add('border-danger');
      showToast('Password is required', 'error');
      passwordInput.focus();
      return false;
    }
    
    return true;
  }

  // ============ 4. EMAIL SIGN UP ============
  if (signupBtn) {
    signupBtn.addEventListener('click', () => {
      const email = emailInput.value.trim();
      const pass = passwordInput.value;

      if (!validateInputs(email, pass)) return;
      
      if (pass.length < 6) {
        passwordInput.classList.add('border-danger');
        showToast('Password must be at least 6 characters', 'error');
        passwordInput.focus();
        return;
      }

      setButtonLoading(signupBtn, true);
      createUserWithEmailAndPassword(auth, email, pass).then((userCred) => {
        const userRef = doc(db, "users", userCred.user.uid);
        return setDoc(userRef, {
          uid: userCred.user.uid, 
          email: email.toLowerCase(), 
          role: selectedRole,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp()
        });
      }).then(() => {
        showToast('Account created! Redirecting...', 'success');
      }).catch((err) => {
        setButtonLoading(signupBtn, false);
        showToast(getFriendlyError(err), 'error');
      });
    });
  }

  // ============ 5. EMAIL LOGIN ============
  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      const pass = passwordInput.value;

      if (!validateInputs(email, pass)) return;

      setButtonLoading(loginBtn, true);
      signInWithEmailAndPassword(auth, email, pass).then((userCred) => {
        const userRef = doc(db, "users", userCred.user.uid);
        return setDoc(userRef, {
          lastLogin: serverTimestamp()
        }, { merge: true });
      }).then(() => {
        showToast('Logged in! Redirecting...', 'success');
      }).catch((err) => {
        setButtonLoading(loginBtn, false);
        showToast(getFriendlyError(err), 'error');
      });
    });
  }

  // ============ 6. FORGOT PASSWORD ============
  const forgotLink = document.getElementById('forgotLink');
  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      
      if (!email) {
        emailInput.classList.add('border-danger');
        showToast('Enter your email first, then click Forgot password', 'warning');
        emailInput.focus();
        return;
      }
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!re.test(email)) {
        emailInput.classList.add('border-danger');
        showToast('Please enter a valid email', 'error');
        emailInput.focus();
        return;
      }

      sendPasswordResetEmail(auth, email).then(() => {
        showToast('Password reset email sent! Check your inbox.', 'success');
      }).catch((err) => {
        showToast(getFriendlyError(err), 'error');
      });
    });
  }
});
